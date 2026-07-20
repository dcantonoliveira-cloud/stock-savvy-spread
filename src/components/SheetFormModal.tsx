/**
 * Modal reutilizável para criar/editar fichas técnicas.
 * Usado em SheetsPage e MenuSheetsTab.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Plus, X, ChevronsUpDown, Check, PackagePlus, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getCompatibleUnits, calcRecipeUnitCost, effectiveUnitCost } from '@/lib/units';
import { fmtCur } from '@/lib/format';

type StockItem = { id: string; name: string; unit: string; unit_cost: number; purchase_qty: number | null };
type SheetItem = { id?: string; item_id: string; item_name: string; quantity: number | string; gross_quantity: number | string; correction_factor: number; unit: string; unit_cost: number };
type Sheet = { id: string; name: string; servings: number; description: string | null; category: string | null; prep_time: number; yield_quantity: number; yield_unit: string; instructions: string | null; image_url: string | null; items: SheetItem[]; is_active: boolean };

const YIELD_UNITS = ['kg', 'g', 'L', 'ml', 'un', 'unid', 'pct', 'cx', 'bd', 'fatias'];

// ── ItemCombobox ──────────────────────────────────────────────────────────────
function ItemCombobox({ stockItems, value, onSelect, onCreateNew }: {
  stockItems: StockItem[]; value: string; onSelect: (id: string) => void; onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!value) { setSelectedItem(null); return; }
    const found = stockItems.find(s => s.id === value);
    if (found) { setSelectedItem(found); return; }
    (supabase.from('stock_items') as any).select('id, name, unit, unit_cost, purchase_qty').eq('id', value).single()
      .then(({ data }: any) => { if (data) setSelectedItem(data as StockItem); });
  }, [value, stockItems]);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    const delay = query.trim() ? 250 : 0;
    debounceRef.current = setTimeout(async () => {
      let q = (supabase.from('stock_items') as any).select('id, name, unit, unit_cost, purchase_qty').order('name').limit(200);
      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
      const { data } = await q;
      setResults((data || []) as StockItem[]);
    }, delay);
    return () => clearTimeout(debounceRef.current);
  }, [open, query]);

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-8 text-xs justify-between w-full font-normal">
          <span className="truncate">{selectedItem ? selectedItem.name : 'Selecionar item...'}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar insumo..." className="h-9" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>
              {results.map(si => (
                <CommandItem key={si.id} value={si.id} onSelect={() => { onSelect(si.id); setOpen(false); setQuery(''); }}>
                  <Check className={cn("mr-2 h-3 w-3", value === si.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{si.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{si.unit}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={() => { setOpen(false); setQuery(''); onCreateNew(); }} className="text-primary">
                <PackagePlus className="mr-2 h-3 w-3" /> Criar novo insumo...
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Quick Create Item Dialog ──────────────────────────────────────────────────
function QuickCreateItemDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (item: StockItem) => void }) {
  const [name, setName] = useState(''); const [unit, setUnit] = useState('kg'); const [cost, setCost] = useState('0');
  const save = async () => {
    if (!name.trim()) { toast.error('Nome obrigatório'); return; }
    const { data, error } = await (supabase.from('stock_items') as any).insert({ name: name.trim(), unit, unit_cost: parseFloat(cost) || 0, purchase_qty: 1 }).select().single();
    if (error) { toast.error('Erro ao criar item'); return; }
    toast.success('Item criado!'); onCreated(data as StockItem); onClose(); setName(''); setCost('0');
  };
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Criar Novo Insumo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome do item" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <select className="h-9 text-sm border rounded-md px-2 bg-background" value={unit} onChange={e => setUnit(e.target.value)}>
              {['kg','g','L','ml','un','unid','pct','cx'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <Input type="number" placeholder="Custo/unidade" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
          <Button onClick={save} className="w-full">Criar Item</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Image Uploader ────────────────────────────────────────────────────────────
function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `sheets/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('item-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(path);
      onChange(publicUrl);
    } catch {
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="text-sm text-muted-foreground mb-1 block">Foto do Prato</label>
      <div
        className="relative border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
        style={{ height: value ? 160 : 80 }}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {value ? (
          <>
            <img src={value} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-medium flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Trocar foto
              </span>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(''); }}
              className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Enviando...</span></>
              : <><Upload className="w-4 h-4" /><span className="text-xs">Clique para adicionar foto</span></>
            }
          </div>
        )}
        {uploading && value && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
interface SheetFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (sheet: { id: string; name: string; category: string | null }) => void;
  /** Pass to edit existing sheet */
  sheetId?: string | null;
  /** Pre-fill name when creating new */
  initialName?: string;
  /** Mode: 'create' | 'edit' | 'duplicate' */
  mode?: 'create' | 'edit' | 'duplicate';
}

export default function SheetFormModal({ open, onClose, onSaved, sheetId, initialName = '', mode = 'create' }: SheetFormModalProps) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickCreate, setQuickCreate] = useState(false);
  const [quickCreateIdx, setQuickCreateIdx] = useState<number | null>(null);

  // Form
  const [name, setName]           = useState('');
  const [description, setDesc]    = useState('');
  const [category, setCategory]   = useState('');
  const [servings, setServings]   = useState('1');
  const [yieldQty, setYieldQty]   = useState('1');
  const [yieldUnit, setYieldUnit] = useState('kg');
  const [prepTime, setPrepTime]   = useState('0');
  const [instructions, setInstr]  = useState('');
  const [imageUrl, setImageUrl]   = useState('');
  const [formItems, setFormItems] = useState<SheetItem[]>([]);

  // Load categories + stock items once
  useEffect(() => {
    const load = async () => {
      const [catRes, stockRes] = await Promise.all([
        (supabase.from('sheet_categories') as any).select('name').order('sort_order'),
        (supabase.from('stock_items') as any).select('id, name, unit, unit_cost, purchase_qty').order('name').limit(500),
      ]);
      setCategories((catRes.data ?? []).map((c: any) => c.name));
      setStockItems((stockRes.data ?? []) as StockItem[]);
    };
    load();
  }, []);

  // Load sheet data when editing
  useEffect(() => {
    if (!open) return;
    if ((mode === 'edit' || mode === 'duplicate') && sheetId) {
      setLoading(true);
      Promise.all([
        (supabase.from('technical_sheets') as any).select('*').eq('id', sheetId).single(),
        supabase.from('technical_sheet_items').select('*').eq('sheet_id', sheetId),
      ]).then(([sheetRes, itemsRes]) => {
        const s = sheetRes.data as Sheet | null;
        if (!s) { setLoading(false); return; }
        setName(mode === 'duplicate' ? `${s.name} (cópia)` : s.name);
        setDesc(s.description ?? '');
        setCategory(s.category ?? '');
        setServings(String(s.servings ?? 1));
        setYieldQty(String(s.yield_quantity ?? 1));
        setYieldUnit(s.yield_unit ?? 'kg');
        setPrepTime(String(s.prep_time ?? 0));
        setInstr(s.instructions ?? '');
        setImageUrl(s.image_url ?? '');
        const items: SheetItem[] = ((itemsRes.data ?? []) as any[]).map(i => ({
          id: mode === 'duplicate' ? undefined : i.id,
          item_id: i.item_id,
          item_name: '',
          quantity: i.quantity,
          gross_quantity: i.gross_quantity,
          correction_factor: i.correction_factor ?? 1,
          unit: i.unit ?? '',
          unit_cost: i.unit_cost ?? 0,
        }));
        setFormItems(items);
        setLoading(false);
      });
    } else {
      // Creating new
      setName(initialName);
      setDesc(''); setCategory(categories[0] ?? ''); setServings('1');
      setYieldQty('1'); setYieldUnit('kg'); setPrepTime('0');
      setInstr(''); setImageUrl(''); setFormItems([]);
    }
  }, [open, sheetId, mode]);

  const addItem = () => setFormItems(p => [...p, { item_id: '', item_name: '', quantity: 0, gross_quantity: 0, correction_factor: 1, unit: '', unit_cost: 0 }]);
  const removeItem = (idx: number) => setFormItems(p => p.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: any) => {
    setFormItems(prev => {
      const updated = [...prev];
      if (field === 'item_id') {
        const si = stockItems.find(s => s.id === value);
        const effCost = si ? effectiveUnitCost(si.unit_cost || 0, si.purchase_qty) : 0;
        updated[idx] = { ...updated[idx], item_id: value, item_name: si?.name ?? '', unit: si?.unit ?? '', unit_cost: effCost };
      } else if (field === 'unit') {
        const si = stockItems.find(s => s.id === updated[idx].item_id);
        const effCost = si ? effectiveUnitCost(si.unit_cost || 0, si.purchase_qty) : 0;
        updated[idx] = { ...updated[idx], unit: value, unit_cost: calcRecipeUnitCost(effCost, si?.unit ?? value, value) };
      } else if (field === 'quantity') {
        updated[idx] = { ...updated[idx], quantity: value, gross_quantity: value };
      } else {
        (updated[idx] as any)[field] = value;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    const validItems = formItems.filter(i => i.item_id);

    const sheetData = {
      name: name.trim(), description: description.trim() || null,
      category: category || null,
      servings: parseInt(servings) || 1,
      yield_quantity: parseFloat(yieldQty) || 1, yield_unit: yieldUnit,
      prep_time: parseInt(prepTime) || 0,
      instructions: instructions.trim() || null,
      image_url: imageUrl.trim() || null,
    };

    const insertItems = (sid: string) => validItems.map(i => ({
      sheet_id: sid, item_id: i.item_id,
      quantity: parseFloat(String(i.quantity).replace(',', '.')) || 0,
      gross_quantity: parseFloat(String(i.gross_quantity).replace(',', '.')) || 0,
      correction_factor: i.correction_factor, unit_cost: i.unit_cost,
    }));

    if (mode === 'edit' && sheetId) {
      const { error } = await (supabase.from('technical_sheets') as any).update(sheetData).eq('id', sheetId);
      if (error) { toast.error('Erro ao atualizar'); return; }
      await supabase.from('technical_sheet_items').delete().eq('sheet_id', sheetId);
      if (validItems.length) await supabase.from('technical_sheet_items').insert(insertItems(sheetId) as any);
      toast.success('Ficha atualizada!');
      onSaved({ id: sheetId, name: name.trim(), category: category || null });
    } else {
      const { data: sheet, error } = await (supabase.from('technical_sheets') as any).insert(sheetData).select().single();
      if (error || !sheet) { toast.error('Erro ao criar ficha'); return; }
      if (validItems.length) await supabase.from('technical_sheet_items').insert(insertItems((sheet as any).id) as any);
      toast.success(mode === 'duplicate' ? 'Ficha duplicada!' : 'Ficha criada!');
      onSaved({ id: (sheet as any).id, name: name.trim(), category: category || null });
    }
    onClose();
  };

  const totalCost = formItems.reduce((s, i) => s + (parseFloat(String(i.quantity).replace(',', '.')) || 0) * i.unit_cost, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {mode === 'edit' ? 'Editar Ficha Técnica' : mode === 'duplicate' ? 'Duplicar Ficha Técnica' : 'Nova Ficha Técnica'}
            </DialogTitle>
            <DialogDescription>Defina os insumos e o modo de preparo da receita</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground mb-1 block">Nome da Receita *</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Espeto Baiano" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Categoria</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Tempo de Preparo (min)</label>
                  <Input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Descrição (opcional)</label>
                <Input value={description} onChange={e => setDesc(e.target.value)} placeholder="Breve descrição do prato" />
              </div>

              <ImageUploader value={imageUrl} onChange={setImageUrl} />


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Rendimento</label>
                  <Input type="number" value={yieldQty} onChange={e => setYieldQty(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Unidade</label>
                  <Select value={yieldUnit} onValueChange={setYieldUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{YIELD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">Insumos da Receita</label>
                  <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
                </div>
                {formItems.length > 0 && (
                  <div className="grid grid-cols-[1fr_80px_70px_90px_32px] gap-1 text-[10px] text-muted-foreground mb-1 px-1">
                    <span>Item</span><span>Qtd</span><span>Un.</span><span className="text-right">Custo</span><span></span>
                  </div>
                )}
                {formItems.map((item, idx) => {
                  const compatUnits = item.item_id ? getCompatibleUnits(stockItems.find(s => s.id === item.item_id)?.unit || item.unit) : [item.unit].filter(Boolean);
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_80px_70px_90px_32px] gap-1 items-center mb-1">
                      <ItemCombobox stockItems={stockItems} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => { setQuickCreateIdx(idx); setQuickCreate(true); }} />
                      <Input type="text" inputMode="decimal" className="h-8 text-xs" placeholder="0.5" value={String(item.quantity)} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                      {compatUnits.length > 1 ? (
                        <select className="h-8 text-xs border rounded-md px-1 bg-background" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}>
                          {compatUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground text-center">{item.unit}</span>
                      )}
                      <span className="text-xs font-medium text-right">{fmtCur((parseFloat(String(item.quantity).replace(',', '.')) || 0) * item.unit_cost)}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)}><X className="w-3 h-3" /></Button>
                    </div>
                  );
                })}
                {formItems.length > 0 && (
                  <div className="flex justify-end mt-2 pr-10">
                    <span className="text-sm font-semibold text-primary">Total: {fmtCur(totalCost)}</span>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Modo de Preparo</label>
                <Textarea value={instructions} onChange={e => setInstr(e.target.value)} placeholder="Passo a passo..." rows={4} />
              </div>

              <Button onClick={handleSave} className="w-full">
                {mode === 'edit' ? 'Salvar Alterações' : mode === 'duplicate' ? 'Salvar Cópia' : 'Criar Ficha Técnica'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <QuickCreateItemDialog
        open={quickCreate}
        onClose={() => setQuickCreate(false)}
        onCreated={item => {
          setStockItems(p => [...p, item]);
          if (quickCreateIdx !== null) updateItem(quickCreateIdx, 'item_id', item.id);
          setQuickCreate(false);
        }}
      />
    </>
  );
}
