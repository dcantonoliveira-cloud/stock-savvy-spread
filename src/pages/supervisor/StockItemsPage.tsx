import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, Upload, Download, Image, Sparkles, Loader2, History, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES, UNITS } from '@/types/inventory';
import * as XLSX from 'xlsx';

type Item = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
  image_url: string | null; barcode: string | null;
};

function ItemForm({ item, onSave, onCancel }: {
  item?: Item;
  onSave: (i: Partial<Item> & { name: string; category: string; unit: string }, imageFile?: File) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || CATEGORIES[0]);
  const [unit, setUnit] = useState(item?.unit || UNITS[0]);
  const [currentStock, setCurrentStock] = useState(item?.current_stock?.toString() || '0');
  const [minStock, setMinStock] = useState(item?.min_stock?.toString() || '0');
  const [unitCost, setUnitCost] = useState(item?.unit_cost?.toString() || '0');
  const [barcode, setBarcode] = useState(item?.barcode || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(item?.image_url || null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    onSave({
      ...(item?.id ? { id: item.id } : {}),
      name: name.trim(), category, unit,
      current_stock: parseFloat(currentStock) || 0,
      min_stock: parseFloat(minStock) || 0,
      unit_cost: parseFloat(unitCost) || 0,
      barcode: barcode.trim() || null,
      image_url: item?.image_url || null,
    }, imageFile || undefined);
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* Image */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="w-20 h-20 rounded-xl bg-accent border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Image className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Foto do item</p>
          <p className="text-xs text-muted-foreground">Clique para enviar ou será gerada por IA</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Nome do Item *</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Filé Mignon" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Categoria</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Unidade</label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Estoque Atual</label>
          <Input type="number" value={currentStock} onChange={e => setCurrentStock(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Estoque Mínimo</label>
          <Input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Custo Unit. (R$)</label>
          <Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Código de Barras (EAN)</label>
        <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="7891234567890" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSubmit} className="flex-1">Salvar</Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function StockItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | undefined>();
  const [filterCategory, setFilterCategory] = useState('all');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from('stock_items').select('*' as any).order('name');
    if (data) setItems(data as unknown as Item[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || i.category === filterCategory;
    return matchSearch && matchCat;
  });

  const groupedByCategory = CATEGORIES.reduce<Record<string, Item[]>>((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {});

  const totalValue = filtered.reduce((s, i) => s + i.current_stock * i.unit_cost, 0);

  const uploadImage = async (file: File, itemId: string): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `uploads/${itemId}.${ext}`;
    const { error } = await supabase.storage.from('item-images').upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('item-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSave = async (item: Partial<Item> & { name: string; category: string; unit: string }, imageFile?: File) => {
    let imageUrl = item.image_url;

    if (item.id) {
      if (imageFile) imageUrl = await uploadImage(imageFile, item.id);
      const { error } = await supabase.from('stock_items').update({ ...item, image_url: imageUrl } as any).eq('id', item.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Item atualizado!');
    } else {
      const { data, error } = await supabase.from('stock_items').insert(item as any).select('id').single();
      if (error || !data) { toast.error('Erro ao cadastrar'); return; }
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, data.id);
        await supabase.from('stock_items').update({ image_url: imageUrl } as any).eq('id', data.id);
      } else {
        // Auto-generate AI image
        generateAIImage(data.id, item.name);
      }
      toast.success('Item cadastrado!');
    }
    load();
    setDialogOpen(false);
    setEditingItem(undefined);
  };

  const generateAIImage = async (itemId: string, itemName: string) => {
    setGeneratingImages(prev => new Set(prev).add(itemId));
    try {
      const { data, error } = await supabase.functions.invoke('generate-item-image', {
        body: { itemId, itemName },
      });
      if (error) throw error;
      toast.success(`🎨 Imagem gerada para ${itemName}`);
      load();
    } catch (e) {
      console.error('AI image generation error:', e);
      toast.error(`Erro ao gerar imagem para ${itemName}`);
    } finally {
      setGeneratingImages(prev => { const s = new Set(prev); s.delete(itemId); return s; });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('stock_items').delete().eq('id', id);
    if (error) toast.error('Erro ao remover');
    else { toast.success('Item removido!'); load(); }
  };

  // Excel functions
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome', 'Categoria', 'Unidade', 'Estoque Atual', 'Estoque Mínimo', 'Custo Unitário', 'Código de Barras'],
      ['Filé Mignon', 'Carnes', 'kg', 50, 10, 89.90, '7891234567890'],
      ['Coca-Cola 2L', 'Bebidas', 'un', 100, 20, 8.50, ''],
    ]);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Itens');
    XLSX.writeFile(wb, 'modelo_itens_rondello.xlsx');
    toast.success('Planilha modelo baixada!');
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws);

      let success = 0;
      let errors = 0;

      for (const row of rows) {
        const name = row['Nome'] || row['name'];
        const category = row['Categoria'] || row['category'] || 'Outros';
        const unit = row['Unidade'] || row['unit'] || 'un';
        if (!name) { errors++; continue; }

        const { error } = await supabase.from('stock_items').insert({
          name,
          category: CATEGORIES.includes(category) ? category : 'Outros',
          unit: UNITS.includes(unit) ? unit : 'un',
          current_stock: parseFloat(row['Estoque Atual'] || row['current_stock'] || '0') || 0,
          min_stock: parseFloat(row['Estoque Mínimo'] || row['min_stock'] || '0') || 0,
          unit_cost: parseFloat(row['Custo Unitário'] || row['unit_cost'] || '0') || 0,
          barcode: row['Código de Barras'] || row['barcode'] || null,
        } as any);

        if (error) errors++;
        else success++;
      }

      toast.success(`✅ ${success} itens importados${errors > 0 ? `, ${errors} erros` : ''}`);
      load();
      setImportDialogOpen(false);
    } catch {
      toast.error('Erro ao ler a planilha');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Estoque</h1>
          <p className="text-muted-foreground mt-1">
            {items.length} itens · Valor total: <span className="text-primary font-semibold">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />Modelo
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />Importar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditingItem(undefined); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Novo Item</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
              </DialogHeader>
              <ItemForm item={editingItem} onSave={handleSave} onCancel={() => { setDialogOpen(false); setEditingItem(undefined); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar item..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Items grouped by category */}
      {Object.entries(groupedByCategory).map(([cat, catItems]) => (
        <div key={cat} className="mb-8">
          <h2 className="text-lg font-display font-semibold text-foreground mb-3 border-b border-border pb-2">{cat}</h2>
          <div className="space-y-2">
            {catItems.map(item => (
              <div key={item.id} className="glass-card rounded-xl p-4 flex items-center gap-4 animate-fade-in">
                {/* Image */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-accent flex items-center justify-center flex-shrink-0">
                  {generatingImages.has(item.id) ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">📦</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.current_stock <= item.min_stock ? 'bg-warning' : 'bg-success'}`} />
                    <p className="font-medium text-foreground truncate">{item.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.unit} {item.barcode ? `· EAN: ${item.barcode}` : ''}
                  </p>
                </div>

                {/* Stock info */}
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-semibold text-foreground">{item.current_stock} <span className="text-xs text-muted-foreground">{item.unit}</span></p>
                  <p className="text-xs text-muted-foreground">R$ {(item.current_stock * item.unit_cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  {!item.image_url && !generatingImages.has(item.id) && (
                    <Button variant="ghost" size="icon" title="Gerar imagem com IA" onClick={() => generateAIImage(item.id, item.name)}>
                      <Sparkles className="w-4 h-4 text-primary" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {items.length === 0 ? 'Nenhum item cadastrado.' : 'Nenhum item encontrado.'}
        </div>
      )}

      {/* Import dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Planilha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-accent rounded-lg p-4">
              <p className="text-sm text-foreground font-medium mb-2">Como importar:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                <li>Baixe o <button onClick={downloadTemplate} className="text-primary underline">modelo da planilha</button></li>
                <li>Preencha com seus itens (não altere os cabeçalhos)</li>
                <li>Faça upload do arquivo preenchido abaixo</li>
              </ol>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Arquivo Excel (.xlsx)</label>
              <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
