import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Pencil, Check, X, Plus, Loader2,
  ChefHat, Clock, Users, ChevronsUpDown, PackagePlus, CalendarDays
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getCompatibleUnits, calcRecipeUnitCost, effectiveUnitCost } from '@/lib/units';

type StockItem = { id: string; name: string; unit: string; unit_cost: number; purchase_qty: number | null };
type SheetItem = { id?: string; item_id: string; item_name: string; quantity: number | string; unit: string; unit_cost: number; section: 'receita' | 'decoracao' };
type Sheet = { id: string; name: string; servings: number; description: string | null; category: string | null; prep_time: number; yield_quantity: number; yield_unit: string; instructions: string | null; items: SheetItem[] };

function ItemCombobox({ stockItems, value, onSelect, onCreateNew }: { stockItems: StockItem[]; value: string; onSelect: (id: string) => void; onCreateNew: (idx?: number) => void }) {
  const [open, setOpen] = useState(false);
  const selected = stockItems.find(s => s.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-8 text-xs justify-between w-full font-normal">
          <span className="truncate">{selected ? selected.name : 'Selecionar item...'}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar insumo..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>{stockItems.map(si => (<CommandItem key={si.id} value={si.name} onSelect={() => { onSelect(si.id); setOpen(false); }}><Check className={cn("mr-2 h-3 w-3", value === si.id ? "opacity-100" : "opacity-0")} /><span className="truncate">{si.name}</span><span className="ml-auto text-[10px] text-muted-foreground">{si.unit}</span></CommandItem>))}</CommandGroup>
            <CommandSeparator alwaysRender />
            <CommandGroup forceMount><CommandItem forceMount onSelect={() => { setOpen(false); onCreateNew(); }} className="text-primary"><PackagePlus className="mr-2 h-3 w-3" />Criar novo insumo...</CommandItem></CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function QuickCreateItemDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (item: StockItem) => void }) {
  const [name, setName] = useState(''); const [unit, setUnit] = useState('kg'); const [unitCost, setUnitCost] = useState('0'); const [category, setCategory] = useState('Outros'); const [categories, setCategories] = useState<string[]>([]); const [saving, setSaving] = useState(false);
  const UNITS = ['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct'];
  useEffect(() => { if (open) supabase.from('categories').select('name').order('name').then(({ data }) => { if (data) setCategories(data.map((c: any) => c.name)); }); }, [open]);
  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; } setSaving(true);
    const { data, error } = await supabase.from('stock_items').insert({ name: name.trim(), unit, unit_cost: parseFloat(unitCost) || 0, category, current_stock: 0, min_stock: 0 } as any).select('id, name, unit, unit_cost').single();
    if (error || !data) { toast.error('Erro ao criar insumo'); setSaving(false); return; }
    toast.success(`Insumo "${name}" criado!`); onCreated(data as unknown as StockItem); setName(''); setSaving(false); onClose();
  };
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Criar Novo Insumo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-sm text-muted-foreground mb-1 block">Nome *</label><Input value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-muted-foreground mb-1 block">Unidade</label><Select value={unit} onValueChange={setUnit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-sm text-muted-foreground mb-1 block">Custo (R$)</label><Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} /></div>
          </div>
          <div><label className="text-sm text-muted-foreground mb-1 block">Categoria</label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Criar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [pendingSelectIdx, setPendingSelectIdx] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState(0);

  // Edit state
  const [name, setName] = useState('');
  const [yieldQty, setYieldQty] = useState('1');
  const [yieldUnit, setYieldUnit] = useState('kg');
  const [formItems, setFormItems] = useState<SheetItem[]>([]);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    setLoading(true);
    const [sheetRes, itemsRes, eventRes] = await Promise.all([
      supabase.from('technical_sheets').select('*').eq('id', id!).single(),
      supabase.from('stock_items').select('id, name, unit, unit_cost, purchase_qty').order('name'),
      supabase.from('event_menu_dishes').select('id', { count: 'exact', head: true }).eq('sheet_id', id!),
    ]);
    setEventCount(eventRes.count || 0);
    if (!sheetRes.data) { navigate('/sheets'); return; }
    if (itemsRes.data) setStockItems(itemsRes.data as unknown as StockItem[]);
    const { data: si } = await supabase.from('technical_sheet_items').select('id, item_id, quantity, unit_cost, section').eq('sheet_id', id!);
    const items: SheetItem[] = (si || []).map((i: any) => {
      const item = (itemsRes.data as any[])?.find((x: any) => x.id === i.item_id);
      const itemUnit = item?.unit || '';
      const baseUnitCost = effectiveUnitCost(item?.unit_cost || 0, item?.purchase_qty);
      return { id: i.id, item_id: i.item_id, item_name: item?.name || '?', quantity: i.quantity, unit: itemUnit, unit_cost: baseUnitCost, section: i.section || 'receita' };
    });
    const loaded = { ...(sheetRes.data as any), items } as Sheet;
    setSheet(loaded);
    setName(loaded.name); setYieldQty(loaded.yield_quantity?.toString() || '1'); setYieldUnit(loaded.yield_unit || 'kg');
    setFormItems(items.map(i => ({ ...i })));
    setLoading(false);
  };

  const addItem = (section: 'receita' | 'decoracao') => setFormItems(prev => [...prev, { item_id: '', item_name: '', quantity: 0, unit: '', unit_cost: 0, section }]);
  const updateItem = (idx: number, field: string, value: any) => setFormItems(prev => prev.map((it, i) => {
    if (i !== idx) return it;
    if (field === 'item_id') {
      const si = stockItems.find(s => s.id === value);
      const effCost = si ? effectiveUnitCost(si.unit_cost || 0, si.purchase_qty) : 0;
      return { ...it, item_id: value, item_name: si?.name || '', unit: si?.unit || '', unit_cost: effCost };
    }
    if (field === 'unit') {
      const si = stockItems.find(s => s.id === it.item_id);
      const effCost = si ? effectiveUnitCost(si.unit_cost || 0, si.purchase_qty) : 0;
      const itemUnit = si?.unit || it.unit;
      return { ...it, unit: value, unit_cost: calcRecipeUnitCost(effCost, itemUnit, value) };
    }
    return { ...it, [field]: value }; // quantity stored as raw string; parsed only on save
  }));
  const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!sheet) return;
    setSaving(true);
    try {
      // 1. Atualiza nome / rendimento
      const { error: sheetErr } = await supabase.from('technical_sheets')
        .update({ name: name.trim(), yield_quantity: parseFloat(yieldQty) || 1, yield_unit: yieldUnit } as any)
        .eq('id', sheet.id);
      if (sheetErr) throw sheetErr;

      const valid = formItems.filter(i => i.item_id);

      // 2. Deleta apenas os itens que o usuário removeu (não todos)
      const originalIds = sheet.items.filter(i => i.id).map(i => i.id!);
      const keepIds = new Set(valid.filter(i => i.id).map(i => i.id!));
      const toDelete = originalIds.filter(id => !keepIds.has(id));
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from('technical_sheet_items').delete().in('id', toDelete);
        if (delErr) throw delErr;
      }

      // 3. Atualiza itens existentes
      for (const i of valid.filter(i => i.id)) {
        const { error: updErr } = await supabase.from('technical_sheet_items').update({
          item_id: i.item_id,
          quantity: parseFloat(String(i.quantity).replace(',', '.')) || 0,
          unit_cost: i.unit_cost,
          section: i.section || 'receita',
        } as any).eq('id', i.id!);
        if (updErr) throw updErr;
      }

      // 4. Insere novos itens (sem id)
      const newItems = valid.filter(i => !i.id);
      if (newItems.length > 0) {
        const { error: insErr } = await supabase.from('technical_sheet_items').insert(
          newItems.map(i => ({
            sheet_id: sheet.id,
            item_id: i.item_id,
            quantity: parseFloat(String(i.quantity).replace(',', '.')) || 0,
            unit_cost: i.unit_cost,
            section: i.section || 'receita',
          })) as any
        );
        if (insErr) throw insErr;
      }

      toast.success('Ficha atualizada!');
      setEditing(false);
      load();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'Tente novamente'));
      console.error('[handleSave]', JSON.stringify(err));
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => { if (!sheet) return; setName(sheet.name); setYieldQty(sheet.yield_quantity?.toString() || '1'); setYieldUnit(sheet.yield_unit || 'kg'); setFormItems(sheet.items.map(i => ({ ...i }))); setEditing(false); };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!sheet) return null;

  const displayItems = editing ? formItems : sheet.items;
  const recipeItems = displayItems.filter(i => i.section !== 'decoracao');
  const decoItems = displayItems.filter(i => i.section === 'decoracao');
  const parseQty = (q: number | string) => parseFloat(String(q).replace(',', '.')) || 0;
  const totalCost = displayItems.reduce((s, i) => s + parseQty(i.quantity) * i.unit_cost, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate('/sheets')}>
        <ArrowLeft className="w-4 h-4 mr-1" />Voltar às fichas técnicas
      </Button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-border p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {editing
              ? <Input value={name} onChange={e => setName(e.target.value)} className="text-2xl font-bold h-10 mb-3" />
              : <h1 className="text-2xl font-display font-bold text-foreground mb-2">{sheet.name}</h1>
            }
            <div className="flex flex-wrap gap-2">
              {sheet.category && <Badge variant="secondary"><ChefHat className="w-3 h-3 mr-1" />{sheet.category}</Badge>}
              {sheet.prep_time > 0 && <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{sheet.prep_time} min</Badge>}
              <Badge variant="outline"><Users className="w-3 h-3 mr-1" />{sheet.servings} porções</Badge>
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                <CalendarDays className="w-3 h-3 mr-1" />
                {eventCount === 0 ? 'Nunca usado em evento' : `${eventCount} evento${eventCount !== 1 ? 's' : ''}`}
              </Badge>
              {editing
                ? <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Rende:</span>
                    <Input type="number" value={yieldQty} onChange={e => setYieldQty(e.target.value)} className="h-7 w-16 text-xs" />
                    <Input value={yieldUnit} onChange={e => setYieldUnit(e.target.value)} className="h-7 w-14 text-xs" />
                  </div>
                : <Badge variant="outline">Rende {sheet.yield_quantity} {sheet.yield_unit}</Badge>
              }
              <Badge className="bg-primary/10 text-primary border-primary/20">Custo: R$ {totalCost.toFixed(2)}</Badge>
            </div>
            {sheet.description && <p className="text-sm text-muted-foreground mt-2">{sheet.description}</p>}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {!editing
              ? <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="w-4 h-4 mr-2" />Editar</Button>
              : <>
                  <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}Salvar</Button>
                  <Button variant="outline" onClick={cancelEdit}>Cancelar</Button>
                </>
            }
          </div>
        </div>
      </div>

      {/* Receita Principal */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
          <p className="text-sm font-semibold text-foreground">Receita Principal</p>
          {editing && <Button variant="outline" size="sm" onClick={() => addItem('receita')}><Plus className="w-3.5 h-3.5 mr-1" />Adicionar ingrediente</Button>}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground" style={{ background: 'hsl(40 30% 97%)' }}><th className="text-left px-5 py-2">Insumo</th><th className="text-right px-4 py-2">Quantidade</th><th className="text-center px-3 py-2">Un.</th><th className="text-right px-4 py-2">Custo Unit.</th><th className="text-right px-5 py-2">Custo Total</th>{editing && <th className="w-10"></th>}</tr></thead>
          <tbody className="divide-y divide-border/40">
            {recipeItems.map((item) => {
              const idx = formItems.indexOf(item);
              return (
                <tr key={editing ? idx : item.item_id}>
                  <td className="px-5 py-3">{editing ? <ItemCombobox stockItems={stockItems} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => { setPendingSelectIdx(idx); setQuickCreateOpen(true); }} /> : <span className="text-foreground">{item.item_name}</span>}</td>
                  <td className="px-4 py-3 text-right">{editing ? <Input type="text" inputMode="decimal" className="h-8 w-24 text-xs text-right ml-auto" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /> : <span className="font-medium">{item.quantity}</span>}</td>
                  <td className="px-3 py-3 text-center text-muted-foreground text-xs">
                    {editing ? (() => {
                      const compatUnits = item.item_id ? getCompatibleUnits(stockItems.find(s => s.id === item.item_id)?.unit || item.unit) : [item.unit].filter(Boolean);
                      return compatUnits.length > 1
                        ? <select className="text-xs border border-input rounded px-1 py-0.5 bg-background cursor-pointer" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}>{compatUnits.map(u => <option key={u} value={u}>{u}</option>)}</select>
                        : <span>{item.unit}</span>;
                    })() : item.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">R$ {item.unit_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">R$ {(parseQty(item.quantity) * item.unit_cost).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  {editing && <td className="pr-3 py-3"><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button></td>}
                </tr>
              );
            })}
          </tbody>
          {recipeItems.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                <td colSpan={editing ? 4 : 4} className="px-5 py-3 text-right font-semibold text-foreground">Total receita:</td>
                <td className="px-5 py-3 text-right font-bold text-primary">R$ {recipeItems.reduce((s, i) => s + parseQty(i.quantity) * i.unit_cost, 0).toFixed(2)}</td>
                {editing && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
        {recipeItems.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Nenhum ingrediente cadastrado</div>}
      </div>

      {/* Decoração */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border" style={{ background: 'hsl(38 80% 97%)' }}>
          <p className="text-sm font-semibold text-amber-700">🎨 Decoração</p>
          {editing && <Button variant="outline" size="sm" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => addItem('decoracao')}><Plus className="w-3.5 h-3.5 mr-1" />Adicionar item decoração</Button>}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-amber-100 text-xs text-muted-foreground" style={{ background: 'hsl(38 80% 98%)' }}><th className="text-left px-5 py-2">Item</th><th className="text-right px-4 py-2">Quantidade</th><th className="text-center px-3 py-2">Un.</th><th className="text-right px-4 py-2">Custo Unit.</th><th className="text-right px-5 py-2">Custo Total</th>{editing && <th className="w-10"></th>}</tr></thead>
          <tbody className="divide-y divide-amber-50">
            {decoItems.map((item) => {
              const idx = formItems.indexOf(item);
              return (
                <tr key={editing ? idx : item.item_id} style={{ background: 'hsl(38 80% 99%)' }}>
                  <td className="px-5 py-3">{editing ? <ItemCombobox stockItems={stockItems} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => { setPendingSelectIdx(idx); setQuickCreateOpen(true); }} /> : <span className="text-foreground">{item.item_name}</span>}</td>
                  <td className="px-4 py-3 text-right">{editing ? <Input type="text" inputMode="decimal" className="h-8 w-24 text-xs text-right ml-auto" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /> : <span className="font-medium">{item.quantity}</span>}</td>
                  <td className="px-3 py-3 text-center text-muted-foreground text-xs">
                    {editing ? (() => {
                      const compatUnits = item.item_id ? getCompatibleUnits(stockItems.find(s => s.id === item.item_id)?.unit || item.unit) : [item.unit].filter(Boolean);
                      return compatUnits.length > 1
                        ? <select className="text-xs border border-input rounded px-1 py-0.5 bg-background cursor-pointer" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}>{compatUnits.map(u => <option key={u} value={u}>{u}</option>)}</select>
                        : <span>{item.unit}</span>;
                    })() : item.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">R$ {item.unit_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">R$ {(parseQty(item.quantity) * item.unit_cost).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  {editing && <td className="pr-3 py-3"><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {decoItems.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Nenhum item de decoração cadastrado</div>}
      </div>

      {/* Instructions */}
      {sheet.instructions && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 mt-4">
          <p className="text-sm font-semibold text-foreground mb-2">Modo de Preparo</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{sheet.instructions}</p>
        </div>
      )}

      <QuickCreateItemDialog
        open={quickCreateOpen}
        onClose={() => { setQuickCreateOpen(false); setPendingSelectIdx(null); }}
        onCreated={item => {
          setStockItems(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
          if (pendingSelectIdx !== null) {
            updateItem(pendingSelectIdx, 'item_id', item.id);
            setPendingSelectIdx(null);
          }
        }}
      />
    </div>
  );
}
