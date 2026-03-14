import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Pencil, Trash2, Search, Upload, Download, Image, Sparkles, Loader2,
  History, FileSpreadsheet, ArrowRightLeft, DollarSign, MapPin, TrendingUp, TrendingDown,
  ArrowUpCircle, ArrowDownCircle, X
} from 'lucide-react';
import { toast } from 'sonner';
import { UNITS } from '@/types/inventory';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';
import DuplicateReviewDialog from '@/components/DuplicateReviewDialog';

type Item = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
  image_url: string | null; barcode: string | null;
};

type Kitchen = { id: string; name: string; is_default?: boolean };
type LocationStock = { kitchen_id: string; kitchen_name: string; current_stock: number };
type PriceHistoryEntry = { id: string; old_price: number; new_price: number; source: string; created_at: string };

// ─── Item Form ───
function ItemForm({ item, kitchens, allCategories, onSave, onCancel }: {
  item?: Item;
  kitchens: Kitchen[];
  allCategories: string[];
  onSave: (i: Partial<Item> & { name: string; category: string; unit: string }, imageFile?: File, initialKitchenId?: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || 'Outros');
  const [unit, setUnit] = useState(item?.unit || UNITS[0]);
  const [currentStock, setCurrentStock] = useState(item?.current_stock?.toString() || '0');
  const [minStock, setMinStock] = useState(item?.min_stock?.toString() || '0');
  const [unitCost, setUnitCost] = useState(item?.unit_cost?.toString() || '0');
  const [barcode, setBarcode] = useState(item?.barcode || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(item?.image_url || null);
  const [initialKitchen, setInitialKitchen] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); setPreviewUrl(URL.createObjectURL(file)); }
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
    }, imageFile || undefined, !item?.id ? initialKitchen || undefined : undefined);
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="flex items-center gap-4">
        <div onClick={() => fileRef.current?.click()}
          className="w-20 h-20 rounded-xl bg-accent border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors">
          {previewUrl ? <img src={previewUrl} alt="" className="w-full h-full object-cover" /> : <Image className="w-6 h-6 text-muted-foreground" />}
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
            <SelectContent>
              {(allCategories.length > 0 ? allCategories : ['Outros']).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
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

      {!item?.id && kitchens.length > 0 && (
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Cozinha inicial (opcional)</label>
          <Select value={initialKitchen} onValueChange={setInitialKitchen}>
            <SelectTrigger><SelectValue placeholder="Selecione uma cozinha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma (estoque geral)</SelectItem>
              {kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSubmit} className="flex-1">Salvar</Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─── Item Detail Dialog ───
function ItemDetailDialog({ item, kitchens, open, onClose, onGenerateImage, generatingImage }: {
  item: Item | null;
  kitchens: Kitchen[];
  open: boolean;
  onClose: () => void;
  onGenerateImage: (id: string, name: string) => void;
  generatingImage: boolean;
}) {
  const [locations, setLocations] = useState<LocationStock[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('kitchen');

  useEffect(() => {
    if (!item || !open) return;
    setLoading(true);
    setTab('kitchen');

    const loadAll = async () => {
      const [locRes, priceRes, entriesRes, outputsRes] = await Promise.all([
        supabase.from('stock_item_locations').select('kitchen_id, current_stock').eq('item_id', item.id),
        supabase.from('stock_price_history').select('*').eq('item_id', item.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('stock_entries').select('id, quantity, date, created_at, notes').eq('item_id', item.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('stock_outputs').select('id, quantity, date, created_at, notes, employee_name, event_name').eq('item_id', item.id).order('created_at', { ascending: false }).limit(30),
      ]);

      const locs: LocationStock[] = (locRes.data || []).map((l: any) => ({
        kitchen_id: l.kitchen_id,
        kitchen_name: kitchens.find(k => k.id === l.kitchen_id)?.name || 'Desconhecida',
        current_stock: l.current_stock,
      }));
      setLocations(locs);
      setPriceHistory((priceRes.data || []) as PriceHistoryEntry[]);

      const entries = (entriesRes.data || []).map((e: any) => ({ ...e, type: 'entry' }));
      const outputs = (outputsRes.data || []).map((o: any) => ({ ...o, type: 'output' }));
      setMovements([...entries, ...outputs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setLoading(false);
    };

    loadAll();
  }, [item, open, kitchens]);

  if (!item) return null;

  const totalLocationStock = locations.reduce((s, l) => s + l.current_stock, 0);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-accent flex items-center justify-center flex-shrink-0">
              {generatingImage ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">📦</span>
              )}
            </div>
            <div>
              <span>{item.name}</span>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                {item.category} · {item.unit} · R$ {item.unit_cost.toFixed(2)}/{item.unit}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Detalhes do item {item.name}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 my-2">
          <div className="bg-accent rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Geral</p>
            <p className="text-xl font-bold text-foreground">{item.current_stock}</p>
            <p className="text-xs text-muted-foreground">{item.unit}</p>
          </div>
          <div className="bg-accent rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Mínimo</p>
            <p className="text-xl font-bold text-foreground">{item.min_stock}</p>
            <p className="text-xs text-muted-foreground">{item.unit}</p>
          </div>
          <div className="bg-accent rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Valor Total</p>
            <p className="text-xl font-bold text-primary">R$ {(item.current_stock * item.unit_cost).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
          </div>
        </div>

        <Button
          variant="outline" size="sm" className="w-full"
          disabled={generatingImage}
          onClick={() => onGenerateImage(item.id, item.name)}
        >
          {generatingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-primary" />}
          {item.image_url ? 'Regenerar imagem com IA' : 'Gerar imagem com IA'}
        </Button>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="kitchen"><MapPin className="w-3 h-3 mr-1" />Cozinhas</TabsTrigger>
            <TabsTrigger value="prices"><DollarSign className="w-3 h-3 mr-1" />Preços</TabsTrigger>
            <TabsTrigger value="history"><History className="w-3 h-3 mr-1" />Movimentos</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-3">
            {loading && <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>}

            <TabsContent value="kitchen" className="mt-0">
              {!loading && locations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma cozinha com estoque deste item.</p>
              )}
              <div className="space-y-2">
                {locations.map(loc => (
                  <div key={loc.kitchen_id} className="flex items-center justify-between p-3 rounded-lg bg-accent">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{loc.kitchen_name}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{loc.current_stock} {item.unit}</span>
                  </div>
                ))}
                {locations.length > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-sm font-medium text-foreground">Total nas cozinhas</span>
                    <span className="text-sm font-bold text-primary">{totalLocationStock} {item.unit}</span>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="prices" className="mt-0">
              {!loading && priceHistory.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma alteração de preço registrada.</p>
              )}
              <div className="space-y-2">
                {priceHistory.map(p => {
                  const increased = p.new_price > p.old_price;
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent">
                      <div className={`p-1 rounded ${increased ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'}`}>
                        {increased ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          R$ {p.old_price.toFixed(2)} → R$ {p.new_price.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.source === 'bulk_import' ? 'Importação em massa' : 'Manual'} · {new Date(p.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${increased ? 'text-destructive' : 'text-success'}`}>
                        {increased ? '+' : ''}{((p.new_price - p.old_price) / (p.old_price || 1) * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              {!loading && movements.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma movimentação registrada.</p>
              )}
              <div className="space-y-2">
                {movements.map((m: any) => (
                  <div key={`${m.type}-${m.id}`} className="flex items-start gap-3 p-3 rounded-lg bg-accent">
                    <div className={`mt-0.5 p-1 rounded ${m.type === 'entry' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                      {m.type === 'entry' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{m.type === 'entry' ? '+' : '-'}{m.quantity} {item.unit}</p>
                        <Badge variant="outline" className="text-[10px]">{m.type === 'entry' ? 'Entrada' : 'Saída'}</Badge>
                      </div>
                      {m.employee_name && <p className="text-xs text-muted-foreground">Por: {m.employee_name}</p>}
                      {m.notes && <p className="text-xs text-muted-foreground">Obs: {m.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Transfer Dialog ───
function TransferDialog({ item, kitchens, open, onClose, onDone }: {
  item: Item | null;
  kitchens: Kitchen[];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [fromKitchen, setFromKitchen] = useState('');
  const [toKitchen, setToKitchen] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [locations, setLocations] = useState<LocationStock[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item || !open) return;
    supabase.from('stock_item_locations').select('kitchen_id, current_stock').eq('item_id', item.id)
      .then(({ data }) => {
        setLocations((data || []).map((l: any) => ({
          kitchen_id: l.kitchen_id,
          kitchen_name: kitchens.find(k => k.id === l.kitchen_id)?.name || '',
          current_stock: l.current_stock,
        })));
      });
    setFromKitchen(''); setToKitchen(''); setQuantity(''); setNotes('');
  }, [item, open, kitchens]);

  const fromStock = locations.find(l => l.kitchen_id === fromKitchen)?.current_stock || 0;

  const handleTransfer = async () => {
    if (!item || !fromKitchen || !toKitchen || !quantity) { toast.error('Preencha todos os campos'); return; }
    if (fromKitchen === toKitchen) { toast.error('Selecione cozinhas diferentes'); return; }
    const qty = parseFloat(quantity);
    if (qty <= 0) { toast.error('Quantidade inválida'); return; }
    if (qty > fromStock) { toast.error(`Estoque insuficiente. Disponível: ${fromStock}`); return; }

    setSaving(true);
    try {
      const { error: e1 } = await supabase.from('stock_item_locations')
        .update({ current_stock: fromStock - qty } as any)
        .eq('item_id', item.id).eq('kitchen_id', fromKitchen);
      if (e1) throw e1;

      const destStock = locations.find(l => l.kitchen_id === toKitchen)?.current_stock || 0;
      const existing = locations.find(l => l.kitchen_id === toKitchen);
      if (existing) {
        await supabase.from('stock_item_locations')
          .update({ current_stock: destStock + qty } as any)
          .eq('item_id', item.id).eq('kitchen_id', toKitchen);
      } else {
        await supabase.from('stock_item_locations')
          .insert({ item_id: item.id, kitchen_id: toKitchen, current_stock: qty } as any);
      }

      await supabase.from('stock_transfers').insert({
        item_id: item.id,
        from_kitchen_id: fromKitchen,
        to_kitchen_id: toKitchen,
        quantity: qty,
        transferred_by: user?.email || 'supervisor',
        notes: notes || null,
      } as any);

      toast.success('Transferência realizada!');
      onClose();
      onDone();
    } catch (err) {
      toast.error('Erro na transferência');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Transferir: {item.name}
          </DialogTitle>
          <DialogDescription>Mova estoque entre cozinhas</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">De (origem)</label>
            <Select value={fromKitchen} onValueChange={setFromKitchen}>
              <SelectTrigger><SelectValue placeholder="Cozinha de origem" /></SelectTrigger>
              <SelectContent>
                {kitchens.filter(k => locations.some(l => l.kitchen_id === k.id && l.current_stock > 0)).map(k => {
                  const stock = locations.find(l => l.kitchen_id === k.id)?.current_stock || 0;
                  return <SelectItem key={k.id} value={k.id}>{k.name} ({stock} {item.unit})</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Para (destino)</label>
            <Select value={toKitchen} onValueChange={setToKitchen}>
              <SelectTrigger><SelectValue placeholder="Cozinha de destino" /></SelectTrigger>
              <SelectContent>
                {kitchens.filter(k => k.id !== fromKitchen).map(k => (
                  <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Quantidade {fromKitchen && <span className="text-primary">(Disp: {fromStock} {item.unit})</span>}
            </label>
            <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Observações (opcional)</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Pedido urgente" />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleTransfer} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
              Transferir
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───
export default function StockItemsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | undefined>();
  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') || 'all');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [priceImportOpen, setPriceImportOpen] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [transferItem, setTransferItem] = useState<Item | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const priceFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setFilterCategory(cat);
  }, [searchParams]);

  const load = async () => {
    const [itemsRes, kitchensRes, catsRes] = await Promise.all([
      supabase.from('stock_items').select('*' as any).order('name'),
      supabase.from('kitchens').select('id, name, is_default').order('name'),
      supabase.from('categories').select('name').order('name'),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as unknown as Item[]);
    if (kitchensRes.data) setKitchens(kitchensRes.data);
    const dbCats = (catsRes.data || []).map((c: any) => c.name);
    const usedCats = itemsRes.data ? [...new Set((itemsRes.data as any[]).map(i => i.category))] : [];
    const merged = [...new Set([...dbCats, ...usedCats])].filter(c => c && c.trim() !== '').sort();
    setAllCategories(merged);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || i.category === filterCategory;
    return matchSearch && matchCat;
  });

  const groupedByCategory = allCategories.reduce<Record<string, Item[]>>((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {});

  const uncategorized = filtered.filter(i => !allCategories.includes(i.category));
  if (uncategorized.length > 0) {
    groupedByCategory['Outros'] = [...(groupedByCategory['Outros'] || []), ...uncategorized];
  }

  const totalValue = filtered.reduce((s, i) => s + i.current_stock * i.unit_cost, 0);

  const uploadImage = async (file: File, itemId: string): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `uploads/${itemId}.${ext}`;
    const { error } = await supabase.storage.from('item-images').upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('item-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSave = async (item: Partial<Item> & { name: string; category: string; unit: string }, imageFile?: File, initialKitchenId?: string) => {
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
        generateAIImage(data.id, item.name);
      }
      let targetKitchenId = initialKitchenId && initialKitchenId !== 'none' ? initialKitchenId : null;
      if (!targetKitchenId) {
        const defaultKitchen = kitchens.find(k => (k as any).is_default || k.name === 'Estoque Geral');
        if (defaultKitchen) targetKitchenId = defaultKitchen.id;
      }
      if (targetKitchenId) {
        await supabase.from('stock_item_locations').insert({
          item_id: data.id, kitchen_id: targetKitchenId, current_stock: item.current_stock || 0,
        } as any);
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
      const { error } = await supabase.functions.invoke('generate-item-image', { body: { itemId, itemName } });
      if (error) throw error;
      toast.success(`🎨 Imagem gerada para ${itemName}`);
      load();
    } catch {
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

  const exportStock = () => {
    const rows = items.map(i => ({
      'Nome': i.name, 'Categoria': i.category, 'Unidade': i.unit,
      'Estoque Atual': i.current_stock, 'Estoque Mínimo': i.min_stock,
      'Custo Unitário': i.unit_cost,
      'Valor em Estoque': Math.round(i.current_stock * i.unit_cost * 100) / 100,
      'EAN': i.barcode || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    XLSX.writeFile(wb, `estoque_rondello_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Planilha de estoque exportada!');
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);
    let count = 0;
    for (const row of rows) {
      const name = row['Nome']?.toString().trim();
      if (!name) continue;
      const { error } = await supabase.from('stock_items').insert({
        name, category: row['Categoria'] || 'Outros', unit: row['Unidade'] || 'un',
        current_stock: parseFloat(row['Estoque Atual']) || 0,
        min_stock: parseFloat(row['Estoque Mínimo']) || 0,
        unit_cost: parseFloat(row['Custo Unitário']) || 0,
        barcode: row['Código de Barras']?.toString() || null,
      } as any);
      if (!error) count++;
    }
    toast.success(`${count} itens importados com sucesso!`);
    setImportDialogOpen(false);
    load();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadPriceTemplate = () => {
    const rows = items.map(i => ({
      'ID': i.id, 'Nome': i.name, 'Categoria': i.category, 'Unidade': i.unit,
      'Preço Atual (R$)': i.unit_cost, 'Novo Preço (R$)': '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 36 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Precos');
    XLSX.writeFile(wb, `precos_rondello_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Planilha de preços baixada!');
  };

  const handlePriceImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);
    let count = 0;
    for (const row of rows) {
      const id = row['ID']?.toString().trim();
      const newPrice = parseFloat(row['Novo Preço (R$)']);
      if (!id || isNaN(newPrice) || newPrice < 0) continue;
      const { error } = await supabase.from('stock_items').update({ unit_cost: newPrice } as any).eq('id', id);
      if (!error) count++;
    }
    toast.success(`${count} preços atualizados!`);
    setPriceImportOpen(false);
    load();
    if (priceFileRef.current) priceFileRef.current.value = '';
  };

  const handleCategoryChange = (value: string) => {
    setFilterCategory(value);
    if (value === 'all') { searchParams.delete('category'); }
    else { searchParams.set('category', value); }
    setSearchParams(searchParams);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Estoque</h1>
          <p className="text-muted-foreground mt-1">
            {items.length} itens · Valor total: <span className="text-primary font-semibold">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportStock}>
            <FileSpreadsheet className="w-4 h-4 mr-1" />Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-1" />Importar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPriceImportOpen(true)}>
            <DollarSign className="w-4 h-4 mr-1" />Importar Preços
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDuplicateOpen(true)}>
            <Sparkles className="w-4 h-4 mr-1" />Revisar Duplicatas
          </Button>
          <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditingItem(undefined); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo Item</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
              </DialogHeader>
              <ItemForm item={editingItem} kitchens={kitchens} allCategories={allCategories} onSave={handleSave} onCancel={() => { setDialogOpen(false); setEditingItem(undefined); }} />
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
        <Select value={filterCategory} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Items grouped by category */}
      {Object.entries(groupedByCategory).map(([cat, catItems]) => (
        <div key={cat} className="mb-8">
          <h2 className="text-lg font-display font-semibold text-foreground mb-3 border-b border-border pb-2">{cat}</h2>
          <div className="space-y-2">
            {catItems.map(item => (
              <div key={item.id} className="glass-card rounded-xl p-4 flex items-center gap-4 animate-fade-in cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => setDetailItem(item)}>
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-accent flex items-center justify-center flex-shrink-0">
                  {generatingImages.has(item.id) ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">📦</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.current_stock <= item.min_stock ? 'bg-warning' : 'bg-success'}`} />
                    <p className="font-medium text-foreground truncate">{item.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.unit} · R$ {item.unit_cost.toFixed(2)}/{item.unit}
                    {item.barcode ? ` · EAN: ${item.barcode}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-semibold text-foreground">{item.current_stock} <span className="text-xs text-muted-foreground">{item.unit}</span></p>
                  <p className="text-xs text-muted-foreground">R$ {(item.current_stock * item.unit_cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" title="Regenerar imagem IA" onClick={() => generateAIImage(item.id, item.name)} disabled={generatingImages.has(item.id)}>
                    <Sparkles className="w-4 h-4 text-primary" />
                  </Button>
                  {kitchens.length >= 2 && (
                    <Button variant="ghost" size="icon" title="Transferir entre cozinhas" onClick={() => setTransferItem(item)}>
                      <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
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

      {/* Import items dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar Itens</DialogTitle></DialogHeader>
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

      {/* Import prices dialog */}
      <Dialog open={priceImportOpen} onOpenChange={setPriceImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar Preços em Massa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-accent rounded-lg p-4">
              <p className="text-sm text-foreground font-medium mb-2">Como atualizar preços:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                <li>Baixe o <button onClick={downloadPriceTemplate} className="text-primary underline">modelo com seus itens atuais</button></li>
                <li>Preencha a coluna <strong>"Novo Preço (R$)"</strong> com os valores atualizados</li>
                <li>Deixe em branco os itens que não mudaram de preço</li>
                <li>Faça upload da planilha preenchida abaixo</li>
              </ol>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
              <p className="text-xs text-foreground">💡 O histórico de preços será registrado automaticamente para cada alteração.</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Arquivo Excel (.xlsx)</label>
              <Input ref={priceFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handlePriceImport} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item detail dialog */}
      <ItemDetailDialog
        item={detailItem}
        kitchens={kitchens}
        open={detailItem !== null}
        onClose={() => setDetailItem(null)}
        onGenerateImage={generateAIImage}
        generatingImage={detailItem ? generatingImages.has(detailItem.id) : false}
      />

      {/* Transfer dialog */}
      <TransferDialog
        item={transferItem}
        kitchens={kitchens}
        open={transferItem !== null}
        onClose={() => setTransferItem(null)}
        onDone={load}
      />

      {/* Duplicate review dialog */}
      <DuplicateReviewDialog
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        items={items}
        onDone={() => { setDuplicateOpen(false); load(); }}
      />
    </div>
  );
}
