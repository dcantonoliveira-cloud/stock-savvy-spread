import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Pencil, Trash2, Search, Upload, FileSpreadsheet,
  Sparkles, Loader2, ChevronUp, ChevronDown, AlertTriangle, CheckCircle2,
  Merge, Store, X, Star, StarOff
} from 'lucide-react';
import { toast } from 'sonner';
import { UNITS } from '@/types/inventory';
import * as XLSX from 'xlsx';
import { ItemImage } from '@/components/ItemImage';

type Item = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
  purchase_qty: number | null;
  image_url: string | null; barcode: string | null;
};

type Supplier = {
  id: string; item_id: string; supplier_name: string;
  unit_price: number; is_preferred: boolean; notes: string | null;
};

type DuplicateGroup = { canonical: Item; duplicates: Item[] };

// ─── Similarity ───
function similarity(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const s2 = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (s1 === s2) return 1;
  const len = Math.max(s1.length, s2.length);
  if (len === 0) return 1;
  const dp: number[][] = Array.from({ length: s1.length + 1 }, (_, i) =>
    Array.from({ length: s2.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= s1.length; i++)
    for (let j = 1; j <= s2.length; j++)
      dp[i][j] = s1[i-1] === s2[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[s1.length][s2.length] / len;
}

function normalize(name: string): string {
  return name.replace(/\s*\d+\s*$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function findDuplicates(items: Item[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    if (used.has(items[i].id)) continue;
    const group: Item[] = [];
    const normI = normalize(items[i].name);
    for (let j = i + 1; j < items.length; j++) {
      if (used.has(items[j].id)) continue;
      if (similarity(normI, normalize(items[j].name)) >= 0.82) { group.push(items[j]); used.add(items[j].id); }
    }
    if (group.length > 0) {
      used.add(items[i].id);
      const all = [items[i], ...group].sort((a, b) => a.name.length - b.name.length);
      groups.push({ canonical: all[0], duplicates: all.slice(1) });
    }
  }
  return groups;
}

// ─── Supplier Dialog ───
function SupplierDialog({ item, open, onClose }: { item: Item | null; open: boolean; onClose: () => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item || !open) return;
    supabase.from('item_suppliers').select('*').eq('item_id', item.id)
      .order('is_preferred', { ascending: false })
      .then(({ data }) => setSuppliers((data || []) as Supplier[]));
  }, [item, open]);

  const addSupplier = async () => {
    if (!item || !newName.trim() || !newPrice) return;
    setSaving(true);
    const { data, error } = await supabase.from('item_suppliers').insert({
      item_id: item.id, supplier_name: newName.trim(),
      unit_price: parseFloat(newPrice), is_preferred: suppliers.length === 0,
    } as any).select().single();
    if (!error && data) { setSuppliers(prev => [...prev, data as Supplier]); setNewName(''); setNewPrice(''); setAdding(false); toast.success('Fornecedor adicionado!'); }
    setSaving(false);
  };

  const deleteSupplier = async (id: string) => {
    await supabase.from('item_suppliers').delete().eq('id', id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  const setPreferred = async (id: string) => {
    await supabase.from('item_suppliers').update({ is_preferred: false } as any).eq('item_id', item!.id);
    await supabase.from('item_suppliers').update({ is_preferred: true } as any).eq('id', id);
    setSuppliers(prev => prev.map(s => ({ ...s, is_preferred: s.id === id })));
  };

  const updatePrice = async (id: string, price: number) => {
    await supabase.from('item_suppliers').update({ unit_price: price } as any).eq('id', id);
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, unit_price: price } : s));
  };

  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Store className="w-5 h-5 text-primary" />Fornecedores — {item.name}</DialogTitle>
          <DialogDescription>Gerencie os fornecedores e preços. ⭐ = fornecedor preferido</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {suppliers.length === 0 && !adding && <p className="text-sm text-muted-foreground text-center py-4">Nenhum fornecedor cadastrado.</p>}
          {suppliers.map(s => (
            <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border ${s.is_preferred ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
              <button
                onClick={() => setPreferred(s.id)}
                title={s.is_preferred ? 'Preferido' : 'Clique para definir como preferido'}
                className="cursor-pointer hover:scale-110 transition-transform p-0.5"
              >
                {s.is_preferred
                  ? <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                  : <StarOff className="w-4 h-4 text-muted-foreground/40 hover:text-amber-400 transition-colors" />
                }
              </button>
              <span className="flex-1 text-sm font-medium">{s.supplier_name}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">R$</span>
                <Input type="number" step="0.01" defaultValue={s.unit_price} className="w-20 h-7 text-xs text-right"
                  onBlur={e => updatePrice(s.id, parseFloat(e.target.value) || 0)} />
                <span className="text-xs text-muted-foreground">/{item.unit}</span>
              </div>
              <button onClick={() => deleteSupplier(s.id)}><X className="w-4 h-4 text-muted-foreground hover:text-destructive" /></button>
            </div>
          ))}
          {adding && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/40 bg-primary/5">
              <Input placeholder="Nome do fornecedor" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1 h-8 text-sm" autoFocus />
              <Input type="number" step="0.01" placeholder="Preço" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-24 h-8 text-sm"
                onKeyDown={e => e.key === 'Enter' && addSupplier()} />
              <Button size="sm" onClick={addSupplier} disabled={saving} className="h-8">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}</Button>
              <button onClick={() => { setAdding(false); setNewName(''); setNewPrice(''); }}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
          )}
        </div>
        {!adding && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" />Adicionar Fornecedor
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Duplicate Dialog ───
function DuplicateReviewDialog({ open, onClose, items, onDone }: {
  open: boolean; onClose: () => void; items: Item[]; onDone: () => void;
}) {
  const [step, setStep] = useState<'idle' | 'analyzing' | 'review' | 'merging' | 'done'>('idle');
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  const analyze = () => {
    setStep('analyzing');
    setTimeout(() => { const result = findDuplicates(items); setGroups(result); setSelected(new Set(result.map((_, i) => i))); setExpanded(new Set([0])); setStep('review'); }, 600);
  };
  const toggleGroup = (idx: number) => { setSelected(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; }); };
  const toggleExpand = (idx: number) => { setExpanded(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; }); };

  const merge = async () => {
    if (selected.size === 0) return;
    setStep('merging');
    let count = 0;
    for (const idx of selected) {
      const group = groups[idx];
      for (const dup of group.duplicates) {
        try {
          const { data: sheetItems } = await supabase.from('technical_sheet_items').select('id, sheet_id, quantity').eq('item_id', dup.id as any);
          for (const si of (sheetItems || [])) {
            const { data: existing } = await supabase.from('technical_sheet_items').select('id, quantity').eq('sheet_id', si.sheet_id as any).eq('item_id', group.canonical.id as any).maybeSingle();
            if (existing) {
              await supabase.from('technical_sheet_items').update({ quantity: (existing.quantity as number) + ((si.quantity as number) || 0) } as any).eq('id', existing.id as any);
              await supabase.from('technical_sheet_items').delete().eq('id', si.id as any);
            } else {
              await supabase.from('technical_sheet_items').update({ item_id: group.canonical.id } as any).eq('id', si.id as any);
            }
          }
          await supabase.from('stock_entries').update({ item_id: group.canonical.id } as any).eq('item_id', dup.id as any);
          await supabase.from('stock_outputs').update({ item_id: group.canonical.id } as any).eq('item_id', dup.id as any);
          if (dup.current_stock > 0) await supabase.from('stock_items').update({ current_stock: group.canonical.current_stock + dup.current_stock } as any).eq('id', group.canonical.id as any);
          await supabase.from('stock_items').delete().eq('id', dup.id as any);
          count++;
        } catch (err) { console.error(err); }
      }
    }
    toast.success(`${count} itens unificados!`);
    setStep('done');
    onDone();
  };

  const reset = () => { setStep('idle'); setGroups([]); setSelected(new Set()); onClose(); };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />Revisar Duplicatas</DialogTitle>
          <DialogDescription>Detecta itens com nomes similares e unifica, atualizando as fichas técnicas automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {step === 'idle' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"><Sparkles className="w-8 h-8 text-primary" /></div>
              <p className="text-sm text-muted-foreground">Analisa {items.length} itens localmente, sem custo e sem API externa.</p>
              <Button onClick={analyze}><Sparkles className="w-4 h-4 mr-2" />Analisar Duplicatas</Button>
            </div>
          )}
          {step === 'analyzing' && <div className="py-8 text-center"><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" /><p className="text-sm text-muted-foreground">Analisando similaridade...</p></div>}
          {step === 'review' && (
            <div className="space-y-3 py-2">
              {groups.length === 0 ? (
                <div className="py-8 text-center"><CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" /><p className="font-medium">Nenhuma duplicata encontrada!</p></div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-1 mb-2">
                    <p className="text-sm text-muted-foreground">{groups.length} grupos · {selected.size} selecionados</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelected(new Set(groups.map((_, i) => i)))}>Todos</Button>
                      <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Limpar</Button>
                    </div>
                  </div>
                  {groups.map((group, idx) => (
                    <div key={idx} className={`rounded-xl border transition-all ${selected.has(idx) ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}>
                      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => toggleGroup(idx)}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected.has(idx) ? 'bg-primary border-primary' : 'border-border'}`}>
                          {selected.has(idx) && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0"><span className="font-medium text-sm">{group.canonical.name}</span><Badge variant="outline" className="ml-2 text-[10px]">principal</Badge></div>
                        <button onClick={e => { e.stopPropagation(); toggleExpand(idx); }}>{expanded.has(idx) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                      </div>
                      {expanded.has(idx) && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                          {group.duplicates.map(dup => (
                            <div key={dup.id} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              <div className="flex-1"><p className="text-sm">{dup.name}</p><p className="text-xs text-muted-foreground">Estoque: {dup.current_stock} {dup.unit}</p></div>
                              {dup.current_stock > 0 && <Badge variant="outline" className="text-[10px] text-success border-success/30">+{dup.current_stock} somado</Badge>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {step === 'merging' && <div className="py-8 text-center"><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" /><p className="text-sm text-muted-foreground">Unificando itens...</p></div>}
          {step === 'done' && <div className="py-8 text-center space-y-4"><CheckCircle2 className="w-10 h-10 text-success mx-auto" /><p className="font-medium">Unificação concluída!</p><Button onClick={reset}>Fechar</Button></div>}
        </div>
        {step === 'review' && groups.length > 0 && (
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="w-3.5 h-3.5 text-warning" />Esta ação não pode ser desfeita</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={merge} disabled={selected.size === 0}><Merge className="w-4 h-4 mr-2" />Unificar {selected.size} grupo{selected.size !== 1 ? 's' : ''}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Item Form ───
function ItemForm({ item, allCategories, onSave, onCancel }: {
  item?: Item; allCategories: string[];
  onSave: (i: Partial<Item> & { name: string; category: string; unit: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || 'Outros');
  const [unit, setUnit] = useState(item?.unit || UNITS[0]);
  const [currentStock, setCurrentStock] = useState(item?.current_stock?.toString() || '0');
  const [minStock, setMinStock] = useState(item?.min_stock?.toString() || '0');
  const [unitCost, setUnitCost] = useState(item?.unit_cost?.toString() || '0');
  const [purchaseQty, setPurchaseQty] = useState(item?.purchase_qty?.toString() || '1');
  const [barcode, setBarcode] = useState(item?.barcode || '');
  const [imageUrl, setImageUrl] = useState(item?.image_url || null);

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    onSave({
      ...(item?.id ? { id: item.id } : {}),
      name: name.trim(), category, unit,
      current_stock: parseFloat(currentStock) || 0,
      min_stock: parseFloat(minStock) || 0,
      unit_cost: parseFloat(unitCost) || 0,
      purchase_qty: parseFloat(purchaseQty) || 1,
      barcode: barcode.trim() || null,
      image_url: imageUrl,
    });
  };

  return (
    <div className="space-y-4">
      {/* Imagem — só aparece no modo edição de item existente */}
      {item?.id && (
        <div className="flex flex-col items-center py-2">
          <ItemImage
            itemId={item.id}
            itemName={name || item.name}
            imageUrl={imageUrl}
            size="lg"
            editMode={true}
            onImageUpdate={setImageUrl}
          />
        </div>
      )}

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Nome *</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Filé Mignon" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Categoria</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(allCategories.length > 0 ? allCategories : ['Outros']).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
          <label className="text-sm text-muted-foreground mb-1 block">Mínimo</label>
          <Input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Custo Unit.</label>
          <Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">
          Qtde por embalagem de compra
          <span className="ml-1 text-xs text-muted-foreground/70">(ex: 5 para "pacote de 5{unit})"</span>
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="number" step="any" value={purchaseQty}
            onChange={e => setPurchaseQty(e.target.value)}
            className="w-32"
            min="0.001"
          />
          <span className="text-sm text-muted-foreground">{unit} / compra</span>
        </div>
        {parseFloat(purchaseQty) > 1 && parseFloat(unitCost) > 0 && (
          <p className="text-xs text-primary mt-1">
            Preço do pacote ≈ R$ {(parseFloat(purchaseQty) * parseFloat(unitCost)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Código de Barras</label>
        <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="EAN" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSubmit} className="flex-1">Salvar</Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function StockItemsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, Supplier[]>>({});
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'current_stock' | 'min_stock' | 'unit_cost' } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | undefined>();
  const [supplierItem, setSupplierItem] = useState<Item | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'current_stock' | 'unit_cost'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [itemsRes, catsRes, suppRes] = await Promise.all([
      supabase.from('stock_items').select('*' as any).order('name'),
      supabase.from('categories').select('name').order('name'),
      supabase.from('item_suppliers').select('*' as any),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as unknown as Item[]);
    const dbCats = (catsRes.data || []).map((c: any) => c.name);
    const usedCats = itemsRes.data ? [...new Set((itemsRes.data as any[]).map(i => i.category))] : [];
    setAllCategories([...new Set([...dbCats, ...usedCats])].filter(c => c && c.trim() !== '').sort());
    const suppMap: Record<string, Supplier[]> = {};
    for (const s of ((suppRes.data || []) as Supplier[])) {
      if (!suppMap[s.item_id]) suppMap[s.item_id] = [];
      suppMap[s.item_id].push(s);
    }
    setSuppliers(suppMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (id: string, field: 'current_stock' | 'min_stock' | 'unit_cost', value: number) => {
    setEditingCell({ id, field });
    setEditingValue(value.toString());
    setTimeout(() => cellInputRef.current?.select(), 50);
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const val = parseFloat(editingValue.replace(',', '.'));
    if (isNaN(val)) { setEditingCell(null); return; }
    const { error } = await supabase.from('stock_items').update({ [editingCell.field]: val } as any).eq('id', editingCell.id);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      setEditingCell(null);
      return;
    }
    setItems(prev => prev.map(i => i.id === editingCell.id ? { ...i, [editingCell.field]: val } : i));
    toast.success('Salvo!');
    setEditingCell(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este item do estoque?')) return;
    await supabase.from('stock_items').delete().eq('id', id);
    toast.success('Item removido!');
    load();
  };

  const handleSave = async (data: Partial<Item> & { name: string; category: string; unit: string }) => {
    if (data.id) {
      await supabase.from('stock_items').update(data as any).eq('id', data.id);
      toast.success('Item atualizado!');
    } else {
      await supabase.from('stock_items').insert(data as any);
      toast.success('Item cadastrado!');
    }
    setDialogOpen(false);
    setEditingItem(undefined);
    load();
  };

  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const parsed = rows
        .map(row => ({
          name: (row['Nome'] || row['NOME'] || row['name'])?.toString().trim() || '',
          category: row['Categoria'] || row['CATEGORIA'] || row['category'] || 'Outros',
          unit: row['Unidade'] || row['UNIDADE'] || row['unit'] || 'un',
          current_stock: parseFloat(row['Estoque Atual'] ?? row['current_stock']) || 0,
          min_stock: parseFloat(row['Estoque Mínimo'] ?? row['min_stock']) || 0,
          unit_cost: parseFloat(row['Custo Unitário'] ?? row['unit_cost']) || 0,
        }))
        .filter(r => r.name);
      setImportRows(parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportConfirm = async () => {
    if (!importRows.length) return;
    setImportLoading(true);

    // Delete all existing items whose names appear in the spreadsheet (removes duplicates too)
    const names = importRows.map(r => r.name);
    const { error: delError } = await supabase.from('stock_items').delete().in('name', names);
    if (delError) { console.error('Erro ao limpar itens existentes:', delError.message); }

    // Insert all rows fresh
    const { error } = await supabase.from('stock_items').insert(importRows as any);
    if (error) {
      console.error('Erro ao importar:', error.message);
      toast.error('Erro ao importar planilha.');
    } else {
      toast.success(`${importRows.length} itens importados com sucesso!`);
    }

    setImportLoading(false);
    setImportDialogOpen(false);
    setImportRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    load();
  };

  const exportStock = () => {
    const rows = items.map(i => {
      const itemSupps = suppliers[i.id] || [];
      const preferred = itemSupps.find(s => s.is_preferred);
      return {
        'Nome': i.name, 'Categoria': i.category, 'Unidade': i.unit,
        'Estoque Atual': i.current_stock, 'Estoque Mínimo': i.min_stock, 'Custo Unitário': i.unit_cost,
        'Fornecedor Preferido': preferred?.supplier_name || '', 'Preço Fornecedor': preferred?.unit_price || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    XLSX.writeFile(wb, `estoque_rondello_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Exportado!');
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field
      ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
      : <ChevronUp className="w-3 h-3 opacity-20" />;

  const filtered = items
    .filter(i => {
      const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'all' || i.category === filterCategory;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      let va: any = a[sortField], vb: any = b[sortField];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb as string).toLowerCase(); }
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const totalValue = filtered.reduce((s, i) => s + i.current_stock * i.unit_cost, 0);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Estoque</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {filtered.length} itens · Valor total:{' '}
            <span className="text-foreground font-semibold">
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportStock}><FileSpreadsheet className="w-4 h-4 mr-1" />Exportar</Button>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}><Upload className="w-4 h-4 mr-1" />Importar</Button>
          <Button variant="outline" size="sm" onClick={() => setDuplicateOpen(true)}><Sparkles className="w-4 h-4 mr-1" />Duplicatas</Button>
          <Button size="sm" onClick={() => { setEditingItem(undefined); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />Novo Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9 bg-white" placeholder="Buscar item..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48 h-9 bg-white"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs w-8">#</th>
                <th className="w-10 px-2 py-3"></th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs cursor-pointer select-none min-w-[200px]" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1">PRODUTO <SortIcon field="name" /></div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs">CATEGORIA</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground text-xs cursor-pointer select-none" onClick={() => toggleSort('current_stock')}>
                  <div className="flex items-center justify-end gap-1">ESTOQUE <SortIcon field="current_stock" /></div>
                </th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground text-xs">MÍN.</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground text-xs cursor-pointer select-none" onClick={() => toggleSort('unit_cost')}>
                  <div className="flex items-center justify-end gap-1">PREÇO <SortIcon field="unit_cost" /></div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs min-w-[140px]">FORNECEDOR</th>
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs w-20">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((item, idx) => {
                const itemSupps = suppliers[item.id] || [];
                const preferred = itemSupps.find(s => s.is_preferred) || itemSupps[0];
                const isLow = item.current_stock <= item.min_stock && item.min_stock > 0;

                return (
                  <tr key={item.id} className={`hover:bg-amber-50/40 transition-colors ${isLow ? 'bg-red-50/50' : ''}`}>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>

                    {/* Avatar com inicial */}
                    <td className="px-2 py-1.5">
                      <ItemImage
                        itemId={item.id}
                        itemName={item.name}
                        imageUrl={item.image_url}
                        size="sm"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {isLow && <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" title="Estoque abaixo do mínimo" />}
                        <span
                          className="font-medium text-foreground leading-tight hover:text-primary hover:underline cursor-pointer"
                          onClick={() => navigate(`/items/${item.id}`)}
                        >{item.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px] font-normal whitespace-nowrap">{item.category || '—'}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editingCell?.id === item.id && editingCell.field === 'current_stock' ? (
                        <input ref={cellInputRef} type="number" value={editingValue}
                          onChange={e => setEditingValue(e.target.value)} onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                          className="w-20 text-right bg-amber-50 border border-amber-300 rounded px-2 py-0.5 text-sm outline-none" />
                      ) : (
                        <span className={`cursor-pointer font-semibold transition-colors hover:text-primary ${isLow ? 'text-destructive' : 'text-foreground'}`}
                          onClick={() => startEdit(item.id, 'current_stock', item.current_stock)} title="Clique para editar">
                          {item.current_stock}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">{item.unit}</span>
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-right">
                      {editingCell?.id === item.id && editingCell.field === 'min_stock' ? (
                        <input ref={cellInputRef} type="number" value={editingValue}
                          onChange={e => setEditingValue(e.target.value)} onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                          className="w-20 text-right bg-amber-50 border border-amber-300 rounded px-2 py-0.5 text-sm outline-none" />
                      ) : (
                        <span className="cursor-pointer text-muted-foreground transition-colors hover:text-primary"
                          onClick={() => startEdit(item.id, 'min_stock', item.min_stock)} title="Clique para editar">
                          {item.min_stock}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-right">
                      {editingCell?.id === item.id && editingCell.field === 'unit_cost' ? (
                        <input ref={cellInputRef} type="number" step="0.01" value={editingValue}
                          onChange={e => setEditingValue(e.target.value)} onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                          className="w-24 text-right bg-amber-50 border border-amber-300 rounded px-2 py-0.5 text-sm outline-none" />
                      ) : (
                        <span className="cursor-pointer text-foreground transition-colors hover:text-primary"
                          onClick={() => startEdit(item.id, 'unit_cost', item.unit_cost)} title="Clique para editar">
                          R$ {item.unit_cost.toFixed(2)}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <button onClick={() => setSupplierItem(item)}
                        className="flex items-center gap-1.5 hover:text-primary transition-colors group w-full text-left">
                        {preferred ? (
                          <>
                            <Store className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                            <span className="text-sm truncate max-w-[110px]">{preferred.supplier_name}</span>
                            {itemSupps.length > 1 && <Badge variant="outline" className="text-[10px] flex-shrink-0">+{itemSupps.length - 1}</Badge>}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic group-hover:text-primary">+ Adicionar</span>
                        )}
                      </button>
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {items.length === 0 ? 'Nenhum item cadastrado.' : 'Nenhum item encontrado.'}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditingItem(undefined); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
            <DialogDescription>{editingItem ? 'Atualize os dados do item' : 'Preencha os dados do novo item'}</DialogDescription>
          </DialogHeader>
          <ItemForm item={editingItem} allCategories={allCategories} onSave={handleSave} onCancel={() => { setDialogOpen(false); setEditingItem(undefined); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={o => { setImportDialogOpen(o); if (!o) setImportRows([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar Itens</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Planilha com colunas: Nome, Categoria, Unidade, Estoque Atual, Estoque Mínimo, Custo Unitário</p>
          <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelFileSelect} />
          {importRows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-green-600 font-medium">{importRows.length} itens encontrados na planilha</p>
              <Button className="w-full" onClick={handleImportConfirm} disabled={importLoading}>
                {importLoading ? 'Importando...' : `Importar ${importRows.length} itens`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SupplierDialog item={supplierItem} open={supplierItem !== null} onClose={() => { setSupplierItem(null); load(); }} />
      <DuplicateReviewDialog open={duplicateOpen} onClose={() => setDuplicateOpen(false)} items={items} onDone={() => { setDuplicateOpen(false); load(); }} />
    </div>
  );
}
