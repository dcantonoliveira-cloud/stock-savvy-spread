import React, { useEffect, useState } from 'react';
import html2canvas from 'html2canvas';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Calendar, MapPin, Users,
  ChevronDown, ChevronUp, CheckCircle2, TrendingDown, Loader2,
  Plus, Pencil, Trash2, X, Check, ChevronsUpDown, PackagePlus,
  Package, Truck, RotateCcw, AlertTriangle, MessageSquare,
  ClipboardList, UserCheck, RefreshCw, GripVertical, Download, Clock, Printer, Copy,
  Warehouse, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { convertToItemUnit } from '@/lib/units';
import { useAuth } from '@/hooks/useAuth';

const MANTIMENTOS_ID = '3fc5dd78-8578-4c45-9c01-6ba8a2123e7a';

const fmtQty = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const fmtCur = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type StockItem = { id: string; name: string; unit: string; unit_cost: number; current_stock: number; category: string };
type SheetItem = { id?: string; item_id: string; item_name: string; quantity: number; unit: string; unit_cost: number; section: 'receita' | 'decoracao' };
type Sheet = { id: string; name: string; yield_quantity: number; yield_unit: string; items: SheetItem[] };
type MenuDish = {
  id: string; sheet_id: string; sheet_name: string;
  planned_quantity: number; planned_unit: string;
  notes: string | null;
  decoration: string | null;
  section_name: string | null;
  sheet: Sheet | null; expanded: boolean; isMantimentos: boolean;
};
type EventMenu = {
  id: string; name: string; location: string | null;
  guest_count: number; staff_count: number;
  event_date: string | null; status: string; notes: string | null;
  created_at: string;
  dispatched_at: string | null; dispatched_by: string | null;
  returned_at: string | null; returned_by: string | null;
  assigned_to: string | null; assigned_at: string | null; assigned_by: string | null;
  dishes: MenuDish[];
};
type ShoppingItem = {
  id: string; name: string; unit: string; category: string;
  needed: number; inStock: number; toBuy: number; unitCost: number;
  hasStock: boolean;
  supplier?: string;
};
type DispatchItem = {
  item_id: string; item_name: string; unit: string;
  planned: number; actual: number; inStock: number; hasEnough: boolean;
};
type ReturnItem = {
  item_id: string; item_name: string; unit: string;
  dispatched: number; returned: number;
};
type Employee = {
  user_id: string; display_name: string; email: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ItemCombobox({ stockItems, value, onSelect, onCreateNew }: { stockItems: StockItem[]; value: string; onSelect: (id: string) => void; onCreateNew: () => void }) {
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
            <CommandSeparator />
            <CommandGroup><CommandItem onSelect={() => { setOpen(false); onCreateNew(); }} className="text-primary"><PackagePlus className="mr-2 h-3 w-3" />Criar novo insumo...</CommandItem></CommandGroup>
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
    const { data, error } = await supabase.from('stock_items').insert({ name: name.trim(), unit, unit_cost: parseFloat(unitCost) || 0, category, current_stock: 0, min_stock: 0 } as any).select('id, name, unit, unit_cost, current_stock').single();
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

// ─── Dish Edit Panel ──────────────────────────────────────────────────────────
function DishEditPanel({ dish, stockItems, onSave, onCancel }: {
  dish: MenuDish; stockItems: StockItem[];
  onSave: (items: SheetItem[], plannedQty: number, plannedUnit: string, notes: string) => void;
  onCancel: () => void;
}) {
  const [formItems, setFormItems] = useState<SheetItem[]>(dish.sheet?.items.map(i => ({ ...i })) || []);
  const [plannedQty, setPlannedQty] = useState(dish.planned_quantity.toString());
  const [plannedUnit, setPlannedUnit] = useState(dish.planned_unit);
  const [notes, setNotes] = useState(dish.notes || '');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [localStock, setLocalStock] = useState<StockItem[]>(stockItems);

  useEffect(() => { setLocalStock(stockItems); }, [stockItems]);

  const addItem = (section: 'receita' | 'decoracao') => setFormItems(prev => [...prev, { item_id: '', item_name: '', quantity: 0, unit: '', unit_cost: 0, section }]);
  const updateItem = (idx: number, field: string, value: any) => setFormItems(prev => prev.map((it, i) => { if (i !== idx) return it; if (field === 'item_id') { const si = localStock.find(s => s.id === value); return { ...it, item_id: value, item_name: si?.name || '', unit: si?.unit || '', unit_cost: si?.unit_cost || 0 }; } return { ...it, [field]: field === 'quantity' ? parseFloat(value) || 0 : value }; }));
  const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));

  const recipeItems = formItems.filter(i => i.section !== 'decoracao');
  const decoItems = formItems.filter(i => i.section === 'decoracao');

  return (
    <>
      <div className="p-4 bg-white border border-primary/20 rounded-xl space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div><label className="text-xs text-muted-foreground mb-1 block">Quantidade planejada</label><Input type="number" value={plannedQty} onChange={e => setPlannedQty(e.target.value)} className="h-8 w-24 text-xs" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Unidade</label><Input value={plannedUnit} onChange={e => setPlannedUnit(e.target.value)} className="h-8 w-16 text-xs" /></div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><MessageSquare className="w-3 h-3" />Observações do prato</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Servir gelado, sem glúten..." className="h-8 text-xs" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Receita Principal</p><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addItem('receita')}><Plus className="w-3 h-3 mr-1" />Add</Button></div>
          {recipeItems.map((item) => { const idx = formItems.indexOf(item); return (<div key={idx} className="grid grid-cols-[1fr_80px_50px_28px] gap-1 items-center mb-1"><ItemCombobox stockItems={localStock} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => setQuickCreateOpen(true)} /><Input type="number" step="any" className="h-8 text-xs" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} /><span className="text-xs text-muted-foreground text-center">{item.unit}</span><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button></div>); })}
        </div>

        <div className="border-t border-dashed border-amber-200 pt-3">
          <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">🎨 Decoração</p><Button variant="outline" size="sm" className="h-7 text-xs border-amber-200 text-amber-700" onClick={() => addItem('decoracao')}><Plus className="w-3 h-3 mr-1" />Add</Button></div>
          {decoItems.map((item) => { const idx = formItems.indexOf(item); return (<div key={idx} className="grid grid-cols-[1fr_80px_50px_28px] gap-1 items-center mb-1" style={{ background: 'hsl(38 80% 99%)' }}><ItemCombobox stockItems={localStock} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => setQuickCreateOpen(true)} /><Input type="number" step="any" className="h-8 text-xs" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} /><span className="text-xs text-muted-foreground text-center">{item.unit}</span><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button></div>); })}
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => onSave(formItems.filter(i => i.item_id), parseFloat(plannedQty) || 0, plannedUnit, notes)}><Check className="w-3.5 h-3.5 mr-1" />Salvar</Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
      <QuickCreateItemDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} onCreated={item => setLocalStock(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))} />
    </>
  );
}

// ─── Add Sheet Dialog ─────────────────────────────────────────────────────────
function AddSheetDialog({ open, onClose, menuId, allSheets, existingSections, defaultSection, onAdded }: { open: boolean; onClose: () => void; menuId: string; allSheets: Sheet[]; existingSections: string[]; defaultSection?: string; onAdded: () => void }) {
  const [sheetId, setSheetId] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('un');
  const [notes, setNotes] = useState('');
  const [sectionName, setSectionName] = useState(defaultSection || '');
  const [newSection, setNewSection] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setSectionName(defaultSection || ''); setNewSection(''); setSheetId(''); setQty('1'); setUnit('un'); setNotes(''); } }, [open, defaultSection]);

  const resolvedSection = sectionName === '__new__' ? newSection.trim() : sectionName;

  const handleAdd = async () => {
    if (!sheetId) { toast.error('Selecione uma ficha técnica'); return; }
    setSaving(true);
    const { error } = await supabase.from('event_menu_dishes').insert({
      menu_id: menuId, sheet_id: sheetId,
      planned_quantity: parseFloat(qty) || 1, planned_unit: unit,
      notes: notes.trim() || null,
      section_name: resolvedSection || null,
      sort_order: 999,
    } as any);
    if (error) { toast.error('Erro ao adicionar ficha'); setSaving(false); return; }
    toast.success('Ficha adicionada!');
    setSaving(false); onAdded(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Adicionar Prato ao Cardápio</DialogTitle><DialogDescription>Adicione uma ficha técnica a este evento</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Seção do cardápio</label>
            <Select value={sectionName} onValueChange={setSectionName}>
              <SelectTrigger><SelectValue placeholder="Selecionar seção..." /></SelectTrigger>
              <SelectContent>
                {existingSections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                <SelectItem value="__new__">+ Nova seção...</SelectItem>
              </SelectContent>
            </Select>
            {sectionName === '__new__' && (
              <Input className="mt-2" value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="Nome da nova seção (ex: JANTAR)" autoFocus />
            )}
          </div>
          <div><label className="text-sm text-muted-foreground mb-1 block">Ficha Técnica *</label><Select value={sheetId} onValueChange={v => { setSheetId(v); const s = allSheets.find(x => x.id === v); if (s) setUnit(s.yield_unit || 'un'); }}><SelectTrigger><SelectValue placeholder="Selecionar ficha..." /></SelectTrigger><SelectContent>{allSheets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-muted-foreground mb-1 block">Quantidade</label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
            <div><label className="text-sm text-muted-foreground mb-1 block">Unidade</label><Input value={unit} onChange={e => setUnit(e.target.value)} /></div>
          </div>
          <div><label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1"><MessageSquare className="w-3 h-3" />Observações (opcional)</label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Servir gelado, sem glúten..." /></div>
          <Button className="w-full" onClick={handleAdd} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Adicionar ao Cardápio</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Separation Dialog ─────────────────────────────────────────────────
function AssignSeparationDialog({ open, onClose, menuId, employees, shoppingList, onAssigned }: {
  open: boolean; onClose: () => void; menuId: string;
  employees: Employee[]; shoppingList: ShoppingItem[];
  stockItems: StockItem[]; onAssigned: () => void;
}) {
  const { profile } = useAuth();
  const [defaultEmployee, setDefaultEmployee] = useState('');
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [refreshingStock, setRefreshingStock] = useState(false);
  const [currentStock, setCurrentStock] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [stockRefreshed, setStockRefreshed] = useState(false);

  const categories = [...new Set(shoppingList.map(i => i.category || 'Outros'))].sort();
  const itemsByCategory = (cat: string) => shoppingList.filter(i => (i.category || 'Outros') === cat);
  const getEmployeeForCat = (cat: string) => categoryOverrides[cat] ?? defaultEmployee;
  const setCatEmployee = (cat: string, val: string) =>
    setCategoryOverrides(prev => ({ ...prev, [cat]: val }));

  useEffect(() => {
    if (open) {
      setDefaultEmployee('');
      setCategoryOverrides({});
      setStockRefreshed(false);
      const initial: Record<string, number> = {};
      shoppingList.forEach(i => { initial[i.id] = i.inStock; });
      setCurrentStock(initial);
    }
  }, [open, shoppingList]);

  const handleRefreshStock = async () => {
    setRefreshingStock(true);
    const ids = shoppingList.map(i => i.id);
    const { data } = await supabase.from('stock_items').select('id, current_stock').in('id', ids);
    if (data) {
      const updated: Record<string, number> = {};
      (data as any[]).forEach(d => { updated[d.id] = d.current_stock; });
      setCurrentStock(updated);
      setStockRefreshed(true);
      toast.success('Estoque atualizado com saldo atual!');
    }
    setRefreshingStock(false);
  };

  const handleAssign = async () => {
    const anyAssigned = categories.some(cat => getEmployeeForCat(cat));
    if (!anyAssigned) { toast.error('Atribua ao menos uma categoria a um funcionário'); return; }
    setSaving(true);
    try {
      await supabase.from('event_separation_items').delete().eq('menu_id', menuId);

      const separationItems = shoppingList.map(item => ({
        menu_id: menuId,
        item_id: item.id,
        planned_quantity: item.needed,
        status: 'pending',
        assigned_to: getEmployeeForCat(item.category || 'Outros') || null,
        category: item.category || 'Outros',
      }));

      const { error: insertError } = await supabase
        .from('event_separation_items')
        .insert(separationItems as any);
      if (insertError) throw insertError;

      const primaryEmp = defaultEmployee || Object.values(categoryOverrides).find(Boolean) || '';
      const { error: updateError } = await supabase
        .from('event_menus')
        .update({
          assigned_to: primaryEmp || null,
          assigned_at: new Date().toISOString(),
          assigned_by: profile?.display_name || 'Supervisor',
          status: 'assigned',
        } as any)
        .eq('id', menuId);
      if (updateError) throw updateError;

      const assignedEmps = [...new Set(categories.map(c => getEmployeeForCat(c)).filter(Boolean))];
      const names = assignedEmps.map(uid => employees.find(e => e.user_id === uid)?.display_name).filter(Boolean);
      toast.success(`Separação atribuída para ${names.join(', ')}!`);
      onAssigned();
      onClose();
    } catch (err) {
      toast.error('Erro ao atribuir separação');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const insufficientItems = shoppingList.filter(i => (currentStock[i.id] ?? i.inStock) < i.needed);

  function EmployeeSelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
      <Select value={value || '__none__'} onValueChange={v => onChange(v === '__none__' ? '' : v)}>
        <SelectTrigger className="h-8 text-xs w-44 flex-shrink-0">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground italic">{placeholder}</span>
          </SelectItem>
          {employees.map(e => (
            <SelectItem key={e.user_id} value={e.user_id}>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                  {e.display_name.charAt(0).toUpperCase()}
                </div>
                {e.display_name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Atribuir Separação por Categoria
          </DialogTitle>
          <DialogDescription>
            Distribua a separação entre funcionários por categoria. O padrão se aplica às categorias sem atribuição específica.
          </DialogDescription>
        </DialogHeader>

        {/* Default employee + refresh */}
        <div className="flex items-end gap-3 p-3 rounded-xl border border-border bg-muted/20">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">RESPONSÁVEL PADRÃO (todas as categorias)</p>
            <EmployeeSelect value={defaultEmployee} onChange={setDefaultEmployee} placeholder="Selecionar padrão..." />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshStock}
            disabled={refreshingStock}
            className="border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0"
          >
            {refreshingStock ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            {stockRefreshed ? '✓ Atualizado' : 'Atualizar Estoque'}
          </Button>
        </div>

        {insufficientItems.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <span><strong>{insufficientItems.length} item(s)</strong> com estoque insuficiente — os funcionários serão avisados.</span>
          </div>
        )}

        {/* Items grouped by category */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          {categories.map(cat => {
            const items = itemsByCategory(cat);
            const overrideVal = categoryOverrides[cat] ?? '';
            const effectiveEmpId = getEmployeeForCat(cat);
            const effectiveEmpName = effectiveEmpId ? employees.find(e => e.user_id === effectiveEmpId)?.display_name : null;
            const overridden = !!categoryOverrides[cat];
            return (
              <div key={cat} className="border border-border rounded-xl overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm text-foreground">{cat}</span>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                    {overridden && (
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">personalizado</Badge>
                    )}
                    {!overridden && effectiveEmpName && (
                      <span className="text-xs text-muted-foreground italic truncate">padrão: {effectiveEmpName}</span>
                    )}
                  </div>
                  <EmployeeSelect
                    value={overrideVal}
                    onChange={v => setCatEmployee(cat, v)}
                    placeholder={effectiveEmpName ? `↑ ${effectiveEmpName}` : 'Atribuir...'}
                  />
                </div>
                {/* Items */}
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border/30">
                    {items.map(item => {
                      const stock = currentStock[item.id] ?? item.inStock;
                      const ok = stock >= item.needed;
                      return (
                        <tr key={item.id} className={!ok ? 'bg-destructive/5' : ''}>
                          <td className="py-1.5 px-3 text-foreground">{item.name} <span className="text-muted-foreground text-xs">({item.unit})</span></td>
                          <td className="py-1.5 px-3 text-right text-muted-foreground whitespace-nowrap text-xs">{fmtQty(item.needed)}</td>
                          <td className={`py-1.5 px-3 text-right font-medium whitespace-nowrap text-xs ${ok ? 'text-success' : 'text-destructive'}`}>{stock}</td>
                          <td className="py-1.5 px-3 text-center w-8">
                            {ok
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-success mx-auto" />
                              : <AlertTriangle className="w-3.5 h-3.5 text-destructive mx-auto" />
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleAssign} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
            Atribuir Separação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Return Dialog ────────────────────────────────────────────────────────────
function ReturnDialog({ open, onClose, items, onConfirm, loading }: {
  open: boolean; onClose: () => void;
  items: ReturnItem[]; onConfirm: (items: ReturnItem[]) => void; loading: boolean;
}) {
  const [editItems, setEditItems] = useState<ReturnItem[]>([]);
  useEffect(() => { setEditItems(items.map(i => ({ ...i, returned: 0 }))); }, [items]);

  const updateQty = (idx: number, val: number) => setEditItems(prev => prev.map((it, i) => i !== idx ? it : { ...it, returned: val }));
  const totalReturned = editItems.reduce((s, i) => s + i.returned, 0);
  const totalDispatched = editItems.reduce((s, i) => s + i.dispatched, 0);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5 text-success" />Retorno de Sobras</DialogTitle>
          <DialogDescription>Informe as quantidades que voltaram do evento para o estoque.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border text-sm">
          <div><span className="text-muted-foreground">Total saiu: </span><span className="font-semibold">{fmtQty(totalDispatched)}</span></div>
          <div className="w-px h-4 bg-border" />
          <div><span className="text-muted-foreground">Retornando: </span><span className="font-semibold text-success">{fmtQty(totalReturned)}</span></div>
          <div className="w-px h-4 bg-border" />
          <div><span className="text-muted-foreground">Consumo real: </span><span className="font-semibold text-primary">{fmtQty(totalDispatched - totalReturned)}</span></div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground sticky top-0 bg-white">
                <th className="text-left py-2 px-3">Insumo</th>
                <th className="text-right py-2 px-3">Saiu</th>
                <th className="text-right py-2 px-3 w-32">Voltou</th>
                <th className="text-right py-2 px-3">Consumido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {editItems.map((item, idx) => (
                <tr key={item.item_id}>
                  <td className="py-2 px-3 text-foreground">{item.item_name} <span className="text-muted-foreground text-xs">({item.unit})</span></td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{fmtQty(item.dispatched)}</td>
                  <td className="py-2 px-3 text-right">
                    <Input
                      type="number" step="any"
                      value={item.returned || ''}
                      onChange={e => updateQty(idx, parseFloat(e.target.value) || 0)}
                      className="h-7 w-24 text-xs text-right ml-auto"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-foreground">
                    {fmtQty(item.dispatched - item.returned)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => onConfirm(editItems)} disabled={loading} className="flex-1 bg-success hover:bg-success/90">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
            Confirmar Retorno
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dish Expanded View ───────────────────────────────────────────────────────
function DishExpandedView({ dish }: { dish: MenuDish }) {
  if (!dish.sheet) return null;
  const recipeItems = dish.sheet.items.filter(i => i.section !== 'decoracao');
  const decoItems = dish.sheet.items.filter(i => i.section === 'decoracao');
  const scale = dish.planned_quantity / (dish.sheet.yield_quantity || 1);

  return (
    <div className="border-t border-border">
      {dish.notes && (
        <div className="px-5 py-3 flex items-start gap-2 bg-amber-50/50 border-b border-amber-100">
          <MessageSquare className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{dish.notes}</p>
        </div>
      )}
      {recipeItems.length > 0 && (
        <div className="p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Receita Principal</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="text-left pb-2">Insumo</th><th className="text-right pb-2">Na receita</th><th className="text-right pb-2">Para {dish.planned_quantity} {dish.planned_unit}</th><th className="text-right pb-2">Custo</th></tr></thead>
            <tbody className="divide-y divide-border/40">
              {recipeItems.map(si => (<tr key={si.item_id}><td className="py-2 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td><td className="py-2 text-right text-muted-foreground">{si.quantity}</td><td className="py-2 text-right font-medium text-foreground">{fmtQty(si.quantity * scale)}</td><td className="py-2 text-right text-muted-foreground text-xs">R$ {fmtCur(si.quantity * scale * si.unit_cost)}</td></tr>))}
            </tbody>
            <tfoot><tr className="border-t border-border"><td colSpan={3} className="pt-2 text-right text-xs font-semibold text-muted-foreground">Total receita:</td><td className="pt-2 text-right text-sm font-bold text-primary">R$ {fmtCur(recipeItems.reduce((s, i) => s + i.quantity * scale * i.unit_cost, 0))}</td></tr></tfoot>
          </table>
        </div>
      )}
      {decoItems.length > 0 && (
        <div className="p-5 border-t border-dashed border-amber-200" style={{ background: 'hsl(38 80% 98%)' }}>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">🎨 Decoração</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-amber-200 text-xs text-muted-foreground"><th className="text-left pb-2">Item</th><th className="text-right pb-2">Na receita</th><th className="text-right pb-2">Para {dish.planned_quantity} {dish.planned_unit}</th><th className="text-right pb-2">Custo</th></tr></thead>
            <tbody className="divide-y divide-amber-100">
              {decoItems.map(si => (<tr key={si.item_id} style={{ background: 'hsl(38 80% 99%)' }}><td className="py-2 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td><td className="py-2 text-right text-muted-foreground">{si.quantity}</td><td className="py-2 text-right font-medium text-foreground">{fmtQty(si.quantity * scale)}</td><td className="py-2 text-right text-muted-foreground text-xs">R$ {fmtCur(si.quantity * scale * si.unit_cost)}</td></tr>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EventMenuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [menu, setMenu] = useState<EventMenu | null>(null);
  const [allSheets, setAllSheets] = useState<Sheet[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [dishesWithNoIngredients, setDishesWithNoIngredients] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pratos' | 'compras' | 'saida' | 'materiais'>('pratos');

  // Materials tab
  const [materialItems, setMaterialItems] = useState<{id:string;name:string;category:string;unit:string;total_qty:number;available_qty:number;image_url:string|null}[]>([]);
  const [linkedLoanId, setLinkedLoanId] = useState<string|null>(null);
  const [planQty, setPlanQty] = useState<Record<string,number>>({});
  const [savingMaterials, setSavingMaterials] = useState(false);
  const [matLoaded, setMatLoaded] = useState(false);
  const [editingMaterials, setEditingMaterials] = useState(false);
  const [shopFilter, setShopFilter] = useState<'all' | 'ok' | 'buy'>('all');
  const [shopGroupMode, setShopGroupMode] = useState<'category' | 'supplier'>('category');
  const [copyingSupplier, setCopyingSupplier] = useState<string | null>(null);
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number | string>>({});
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishDialogOpen, setDishDialogOpen] = useState(false);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState('');
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addSheetDefaultSection, setAddSheetDefaultSection] = useState<string | undefined>(undefined);
  const [assignOpen, setAssignOpen] = useState(false);
  const [renamingSectionName, setRenamingSectionName] = useState<string | null>(null);
  const [renamingSectionValue, setRenamingSectionValue] = useState('');

  // Return
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnOpen, setReturnOpen] = useState(false);
  const [movementLoading, setMovementLoading] = useState(false);

  useEffect(() => { if (!id) return; loadMenu(); loadEmployees(); }, [id]);

  useEffect(() => {
    if (activeTab === 'materiais' && !matLoaded && id) loadMaterials();
  }, [activeTab]);

  const loadMaterials = async () => {
    const [itemsRes, loanRes] = await Promise.all([
      supabase.from('material_items' as any).select('id, name, category, unit, total_qty, available_qty, image_url').order('category').order('name'),
      supabase.from('material_loans' as any).select('id, material_loan_items(material_item_id, qty_out)').eq('event_menu_id', id!).maybeSingle(),
    ]);
    if (itemsRes.data) setMaterialItems(itemsRes.data as any[]);
    if ((loanRes as any).data) {
      const loan = (loanRes as any).data;
      setLinkedLoanId(loan.id);
      const qty: Record<string, number> = {};
      for (const li of loan.material_loan_items || []) qty[li.material_item_id] = li.qty_out;
      setPlanQty(qty);
    }
    setMatLoaded(true);
  };

  const handleSaveMaterials = async () => {
    if (!menu) return;
    setSavingMaterials(true);
    try {
      let loanId = linkedLoanId;
      if (!loanId) {
        const { data, error } = await supabase.from('material_loans' as any).insert({
          event_name: menu.name,
          event_menu_id: id,
          responsible: null,
          date_out: menu.event_date || new Date().toISOString().split('T')[0],
          status: 'planning',
        }).select('id').single();
        if (error || !data) throw error || new Error('Erro ao criar lista');
        loanId = (data as any).id;
        setLinkedLoanId(loanId);
      }
      await supabase.from('material_loan_items' as any).delete().eq('loan_id', loanId!);
      const planned = Object.entries(planQty).filter(([, q]) => q > 0);
      if (planned.length > 0) {
        const { error } = await supabase.from('material_loan_items' as any).insert(
          planned.map(([material_item_id, qty]) => ({ loan_id: loanId, material_item_id, qty_out: qty, qty_returned: 0, qty_damaged: 0 }))
        );
        if (error) throw error;
      }
      await supabase.from('material_loans' as any).update({ status: planned.length > 0 ? 'active' : 'planning' }).eq('id', loanId!);
      toast.success('Lista de materiais salva!');
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Tente novamente'));
    }
    setSavingMaterials(false);
  };

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name, email');
    // Filter only employees (role = 'employee') via user_roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'employee');
    if (data && roles) {
      const employeeIds = new Set(roles.map((r: any) => r.user_id));
      setEmployees((data as any[]).filter(p => employeeIds.has(p.user_id)) as Employee[]);
    }
  };

  const loadMenu = async () => {
    setLoading(true);
    const [menuRes, itemsRes, sheetsRes] = await Promise.all([
      supabase.from('event_menus').select('*').eq('id', id!).single(),
      supabase.from('stock_items').select('id, name, unit, unit_cost, current_stock, category').order('name'),
      supabase.from('technical_sheets').select('*').order('name'),
    ]);
    if (!menuRes.data) { navigate('/event-menus'); return; }
    const stockData = (itemsRes.data || []) as unknown as StockItem[];
    setStockItems(stockData);

    if (sheetsRes.data) {
      const loaded = await Promise.all((sheetsRes.data as any[]).map(async s => {
        const { data: si } = await supabase.from('technical_sheet_items').select('id, item_id, quantity, unit_cost, section, unit').eq('sheet_id', s.id);
        const items: SheetItem[] = (si || []).map((i: any) => { const item = stockData.find(x => x.id === i.item_id); const recipeUnit = i.unit || item?.unit || ''; return { id: i.id, item_id: i.item_id, item_name: item?.name || '?', quantity: i.quantity, unit: recipeUnit, unit_cost: i.unit_cost || item?.unit_cost || 0, section: i.section || 'receita' }; });
        return { ...s, items } as Sheet;
      }));
      setAllSheets(loaded);
    }

    const { data: dishes } = await supabase.from('event_menu_dishes').select('*').eq('menu_id', id!).order('sort_order');
    const enrichedDishes: MenuDish[] = await Promise.all((dishes || []).map(async (d: any) => {
      const sheet = (sheetsRes.data as any[])?.find(s => s.id === d.sheet_id);
      if (!sheet) return { id: d.id, sheet_id: d.sheet_id, sheet_name: '?', planned_quantity: d.planned_quantity, planned_unit: d.planned_unit || 'un', notes: d.notes || null, decoration: d.decoration || null, section_name: d.section_name || null, sheet: null, expanded: false, isMantimentos: d.sheet_id === MANTIMENTOS_ID };
      const { data: si } = await supabase.from('technical_sheet_items').select('id, item_id, quantity, unit_cost, section').eq('sheet_id', d.sheet_id);
      const items: SheetItem[] = (si || []).map((i: any) => { const item = stockData.find(x => x.id === i.item_id); return { id: i.id, item_id: i.item_id, item_name: item?.name || '?', quantity: i.quantity, unit: item?.unit || '', unit_cost: i.unit_cost || item?.unit_cost || 0, section: i.section || 'receita' }; });
      return { id: d.id, sheet_id: d.sheet_id, sheet_name: sheet.name, planned_quantity: d.planned_quantity, planned_unit: d.planned_unit || 'un', notes: d.notes || null, decoration: d.decoration || null, section_name: d.section_name || null, sheet: { ...sheet, items }, expanded: false, isMantimentos: d.sheet_id === MANTIMENTOS_ID };
    }));

    const loadedMenu: EventMenu = { ...(menuRes.data as any), dishes: enrichedDishes };
    setMenu(loadedMenu);
    const rawList = buildShoppingList(enrichedDishes, stockData, loadedMenu.guest_count);
    // Load preferred suppliers for all items in the list
    if (rawList.length > 0) {
      const { data: suppData } = await supabase
        .from('item_suppliers')
        .select('item_id, supplier_name, unit_price')
        .in('item_id', rawList.map(i => i.id));

      const suppMap: Record<string, string> = {};
      const suppBest: Record<string, { name: string; price: number }> = {};
      (suppData || []).forEach((s: any) => {
        const cur = suppBest[s.item_id];
        if (!cur || s.unit_price < cur.price) {
          suppBest[s.item_id] = { name: s.supplier_name, price: s.unit_price };
        }
      });
      Object.entries(suppBest).forEach(([itemId, { name }]) => { suppMap[itemId] = name; });
      setShoppingList(rawList.map(i => ({ ...i, supplier: suppMap[i.id] })));
    } else {
      setShoppingList(rawList);
    }
    setLoading(false);
  };

  const buildShoppingList = (dishes: MenuDish[], stock: StockItem[], guestCount: number): ShoppingItem[] => {
    const map: Record<string, ShoppingItem> = {};
    const noIngredients: string[] = [];

    // ── Pratos normais: scale = planned_quantity / yield_quantity
    // A quantidade no cardápio JÁ é o total do evento (ex: 10kg de abadejo).
    // A ficha técnica descreve o rendimento base (ex: 1kg).
    // Então multiplicamos os insumos pelo fator: 10 / 1 = 10×.
    dishes.forEach(dish => {
      if (dish.isMantimentos) return;
      if (!dish.sheet) { noIngredients.push(dish.sheet_name); return; }
      const recipeItems = dish.sheet.items.filter(i => i.section === 'receita');
      if (recipeItems.length === 0) { noIngredients.push(dish.sheet_name); return; }
      const scale = dish.planned_quantity / (dish.sheet.yield_quantity || 1);
      recipeItems.forEach(si => {
        const s = stock.find(x => x.id === si.item_id);
        const itemUnit = s?.unit || si.unit;
        // Convert recipe quantity to item's base unit before aggregating
        const qtyInItemUnit = convertToItemUnit(si.quantity, si.unit, itemUnit);
        const needed = qtyInItemUnit * scale;
        if (!map[si.item_id]) {
          map[si.item_id] = { id: si.item_id, name: si.item_name, unit: itemUnit, category: s?.category || 'Outros', needed: 0, inStock: s?.current_stock || 0, toBuy: 0, unitCost: s?.unit_cost || si.unit_cost, hasStock: true };
        }
        map[si.item_id].needed += needed;
      });
    });

    // ── Mantimentos: scale = guest_count / yield_quantity
    // A ficha de mantimentos é cadastrada por pessoa (ex: yield = 1 pessoa).
    // Multiplicamos pelo número de convidados do evento.
    dishes.filter(d => d.isMantimentos).forEach(dish => {
      if (!dish.sheet) return;
      const scale = guestCount / (dish.sheet.yield_quantity || 1);
      dish.sheet.items.forEach(si => {
        const s = stock.find(x => x.id === si.item_id);
        const itemUnit = s?.unit || si.unit;
        const qtyInItemUnit = convertToItemUnit(si.quantity, si.unit, itemUnit);
        const needed = qtyInItemUnit * scale;
        if (!map[si.item_id]) {
          map[si.item_id] = { id: si.item_id, name: si.item_name, unit: itemUnit, category: s?.category || 'Outros', needed: 0, inStock: s?.current_stock || 0, toBuy: 0, unitCost: s?.unit_cost || si.unit_cost, hasStock: true };
        }
        map[si.item_id].needed += needed;
      });
    });

    const list = Object.values(map)
      .map(i => ({ ...i, toBuy: Math.max(0, i.needed - i.inStock), hasStock: i.inStock >= i.needed }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setDishesWithNoIngredients(noIngredients);
    return list;
  };

  const prepareReturn = async () => {
    const { data: movements } = await supabase
      .from('event_stock_movements')
      .select('*')
      .eq('menu_id', id!)
      .eq('movement_type', 'dispatch');
    const items: ReturnItem[] = (movements || []).map((m: any) => {
      const stock = stockItems.find(s => s.id === m.item_id);
      return { item_id: m.item_id, item_name: stock?.name || '?', unit: stock?.unit || '', dispatched: m.actual_quantity, returned: 0 };
    });
    setReturnItems(items);
    setReturnOpen(true);
  };

  const confirmReturn = async (items: ReturnItem[]) => {
    setMovementLoading(true);
    try {
      const returning = items.filter(i => i.returned > 0);
      if (returning.length > 0) {
        await supabase.from('event_stock_movements').insert(
          returning.map(i => ({ menu_id: id, item_id: i.item_id, movement_type: 'return', planned_quantity: i.dispatched, actual_quantity: i.returned, created_by: profile?.display_name || 'Sistema' })) as any
        );
        for (const item of returning) {
          const stock = stockItems.find(s => s.id === item.item_id);
          if (stock) {
            await supabase.from('stock_items').update({ current_stock: stock.current_stock + item.returned } as any).eq('id', item.item_id);
          }
        }
      }
      await supabase.from('event_menus').update({ status: 'completed', returned_at: new Date().toISOString(), returned_by: profile?.display_name || 'Sistema' } as any).eq('id', id!);
      toast.success('Retorno confirmado! Estoque atualizado.');
      setReturnOpen(false);
      loadMenu();
    } catch (err) {
      toast.error('Erro ao confirmar retorno');
      console.error(err);
    } finally {
      setMovementLoading(false);
    }
  };

  const toggleExpand = (dishId: string) => setMenu(prev => prev ? { ...prev, dishes: prev.dishes.map(d => d.id === dishId ? { ...d, expanded: !d.expanded } : d) } : prev);

  const handleSaveDish = async (dishId: string, items: SheetItem[], plannedQty: number, plannedUnit: string, notes: string) => {
    const dish = menu?.dishes.find(d => d.id === dishId);
    if (!dish) return;
    await supabase.from('event_menu_dishes').update({ planned_quantity: plannedQty, planned_unit: plannedUnit, notes: notes || null } as any).eq('id', dishId);
    await supabase.from('technical_sheet_items').delete().eq('sheet_id', dish.sheet_id);
    if (items.length > 0) await supabase.from('technical_sheet_items').insert(items.map(i => ({ sheet_id: dish.sheet_id, item_id: i.item_id, quantity: i.quantity, unit_cost: i.unit_cost, unit: i.unit || null, section: i.section || 'receita' })) as any);
    toast.success('Ficha atualizada!');
    setEditingDishId(null);
    await loadMenu();
  };

  const handleRemoveDish = async (dishId: string) => {
    if (!confirm('Remover esta ficha do cardápio?')) return;
    await supabase.from('event_menu_dishes').delete().eq('id', dishId);
    toast.success('Ficha removida!');
    await loadMenu();
  };

  const handleSaveQty = async (dishId: string) => {
    const qty = parseFloat(editingQtyValue);
    if (!isNaN(qty) && qty > 0) {
      await supabase.from('event_menu_dishes').update({ planned_quantity: qty } as any).eq('id', dishId);
      await loadMenu();
    }
    setEditingQtyId(null);
  };

  const handleRenameSection = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) { setRenamingSectionName(null); return; }
    const dishIds = menu?.dishes.filter(d => d.section_name === oldName).map(d => d.id) || [];
    for (const id of dishIds) {
      await supabase.from('event_menu_dishes').update({ section_name: newName.trim() } as any).eq('id', id);
    }
    toast.success('Seção renomeada!');
    setRenamingSectionName(null);
    await loadMenu();
  };

  const handleExportCsv = () => {
    if (!menu) return;
    const rows: string[][] = [['Seção', 'Prato', 'Qtd', 'Un', 'Observações', 'Decoração / Apresentação']];
    const sections = Array.from(new Set(menu.dishes.filter(d => !d.isMantimentos).map(d => d.section_name || 'Sem Seção')));
    for (const sec of sections) {
      const dishes = menu.dishes.filter(d => !d.isMantimentos && (d.section_name || 'Sem Seção') === sec);
      for (const d of dishes) {
        const deco = d.sheet?.items.filter(i => i.section === 'decoracao').map(i => i.item_name).join(' / ') || '';
        rows.push([sec, d.sheet_name, String(d.planned_quantity), d.planned_unit, d.notes || '', deco]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `cardapio-${menu.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDuplicateDish = async (dish: MenuDish) => {
    if (!dish.sheet) return;
    const { data: newSheet, error } = await supabase.from('technical_sheets').insert({ name: `${dish.sheet_name} (cópia)`, yield_quantity: dish.sheet.yield_quantity, yield_unit: dish.sheet.yield_unit, servings: 1 } as any).select().single();
    if (error || !newSheet) { toast.error('Erro ao duplicar'); return; }
    if (dish.sheet.items.length > 0) await supabase.from('technical_sheet_items').insert(dish.sheet.items.map(i => ({ sheet_id: (newSheet as any).id, item_id: i.item_id, quantity: i.quantity, unit_cost: i.unit_cost, section: i.section || 'receita' })) as any);
    await supabase.from('event_menu_dishes').insert({ menu_id: id, sheet_id: (newSheet as any).id, planned_quantity: dish.planned_quantity, planned_unit: dish.planned_unit, sort_order: 999 } as any);
    toast.success('Ficha duplicada!');
    await loadMenu();
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!menu) return null;

  const regularDishes = menu.dishes.filter(d => !d.isMantimentos);
  const mantimentosDish = menu.dishes.find(d => d.isMantimentos);
  const existingSections = Array.from(new Set(regularDishes.map(d => d.section_name || 'Sem Seção').filter(Boolean)));
  const groupedDishes: { section: string; dishes: MenuDish[] }[] = existingSections.map(sec => ({
    section: sec,
    dishes: regularDishes.filter(d => (d.section_name || 'Sem Seção') === sec),
  }));
  if (regularDishes.some(d => !d.section_name)) {
    const uncat = regularDishes.filter(d => !d.section_name);
    if (uncat.length > 0 && !groupedDishes.find(g => g.section === 'Sem Seção')) {
      groupedDishes.push({ section: 'Sem Seção', dishes: uncat });
    }
  }
  const editingDish = menu.dishes.find(d => d.id === editingDishId) || null;
  const totalToBuy = shoppingList.reduce((s, i) => s + i.toBuy * i.unitCost, 0);
  const itemsToBuy = shoppingList.filter(i => i.toBuy > 0).length;
  const itemsOk = shoppingList.filter(i => i.toBuy === 0).length;
  const insufficientCount = shoppingList.filter(i => !i.hasStock).length;
  const filteredShoppingList = shopFilter === 'ok' ? shoppingList.filter(i => i.toBuy === 0) : shopFilter === 'buy' ? shoppingList.filter(i => i.toBuy > 0) : shoppingList;

  const statusLabel: Record<string, string> = {
    draft: 'Rascunho',
    assigned: 'Separação Atribuída',
    dispatched: 'Saída Confirmada',
    completed: 'Concluído'
  };
  const statusColor: Record<string, string> = {
    draft: 'secondary',
    assigned: 'default',
    dispatched: 'default',
    completed: 'default'
  };

  const assignedEmployee = menu.assigned_to ? employees.find(e => e.user_id === menu.assigned_to) : null;

  // ─── Print helpers ────────────────────────────────────────────────────────────
  const printBase = (title: string, body: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const eventDate = menu.event_date ? new Date(menu.event_date).toLocaleDateString('pt-BR') : '—';
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
        h1 { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
        .meta { color: #555; font-size: 10px; margin-bottom: 14px; }
        h2 { font-size: 12px; font-weight: bold; margin: 14px 0 4px; background: #f0ebe0; padding: 4px 8px; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        th { text-align: left; font-size: 10px; color: #555; font-weight: 600; border-bottom: 1px solid #ccc; padding: 4px 6px; }
        td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        .right { text-align: right; }
        .center { text-align: center; }
        .badge-buy { color: #c00; font-weight: 600; }
        .badge-ok { color: #060; }
        .total-row td { border-top: 2px solid #999; font-weight: bold; padding-top: 6px; }
        .cat-header { font-weight: bold; font-size: 10px; color: #555; background: #f7f4ef; padding: 3px 6px; }
        .status-pending { color: #b45309; }
        .status-ok { color: #065f46; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <h1>${title}</h1>
      <div class="meta">${menu.name} · ${eventDate} · ${menu.location || ''} · ${menu.guest_count} convidados</div>
      ${body}
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const handlePrintShoppingList = () => {
    const byCategory: Record<string, ShoppingItem[]> = {};
    shoppingList.forEach(i => {
      const cat = i.category || 'Outros';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(i);
    });

    const rows = Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => {
      const catRows = items.map(i => `
        <tr>
          <td>${i.name}</td>
          <td class="right">${fmtQty(i.needed)} ${i.unit}</td>
          <td class="right">${fmtQty(i.inStock)} ${i.unit}</td>
          <td class="right ${i.toBuy > 0 ? 'badge-buy' : 'badge-ok'}">${i.toBuy > 0 ? fmtQty(i.toBuy) + ' ' + i.unit : '✓ ok'}</td>
          <td class="right">${i.toBuy > 0 ? 'R$ ' + fmtCur(i.toBuy * i.unitCost) : '—'}</td>
        </tr>`).join('');
      return `<h2>${cat} (${items.length})</h2>
        <table>
          <thead><tr><th>INSUMO</th><th class="right">NECESSÁRIO</th><th class="right">EM ESTOQUE</th><th class="right">A COMPRAR</th><th class="right">CUSTO EST.</th></tr></thead>
          <tbody>${catRows}</tbody>
        </table>`;
    }).join('');

    const total = shoppingList.reduce((s, i) => s + i.toBuy * i.unitCost, 0);
    const footer = `<table><tbody class="total-row"><tr class="total-row"><td colspan="4" style="text-align:right;font-weight:bold">Total estimado:</td><td class="right">R$ ${fmtCur(total)}</td></tr></tbody></table>`;
    printBase('Lista de Compras', rows + footer);
  };

  const handlePrintBySupplier = (supplierName: string) => {
    const items = shoppingList.filter(i => i.supplier === supplierName && i.toBuy > 0);
    if (items.length === 0) { return; }
    const rows = items.map(i => {
      const qty = getEffectiveQty(i);
      return `
      <tr>
        <td class="right">${fmtQty(qty)}</td>
        <td>${i.unit}</td>
        <td>${i.name}</td>
        <td class="right">R$ ${fmtCur(i.unitCost)}</td>
        <td class="right">R$ ${fmtCur(qty * i.unitCost)}</td>
      </tr>`;
    }).join('');
    const total = items.reduce((s, i) => s + getEffectiveQty(i) * i.unitCost, 0);
    const body = `
      <table>
        <thead><tr><th class="right">QTD</th><th>UN</th><th>PRODUTO</th><th class="right">CUSTO UNIT.</th><th class="right">TOTAL</th></tr></thead>
        <tbody>${rows}</tbody>
        <tbody><tr class="total-row"><td colspan="4" class="right">Total estimado:</td><td class="right">R$ ${fmtCur(total)}</td></tr></tbody>
      </table>`;
    printBase(`Pedido — ${supplierName}`, body);
  };

  const getEffectiveQty = (item: ShoppingItem) => {
    const ov = qtyOverrides[item.id];
    if (ov !== undefined && ov !== '') return parseFloat(String(ov)) || 0;
    return item.toBuy;
  };

  const copySupplierOrderAsImage = async (supplierName: string) => {
    const items = shoppingList.filter(i => i.supplier === supplierName && i.toBuy > 0);
    if (items.length === 0) return;
    setCopyingSupplier(supplierName);

    const total = items.reduce((s, i) => s + getEffectiveQty(i) * i.unitCost, 0);
    const eventDate = menu?.event_date ? new Date(menu.event_date).toLocaleDateString('pt-BR') : '—';
    const now = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;padding:24px;font-family:Arial,sans-serif;width:640px;color:#111;';
    container.innerHTML = `
      <div style="margin-bottom:16px;border-bottom:2px solid #e5dcc8;padding-bottom:12px;">
        <div style="font-size:20px;font-weight:bold;color:#111;">${supplierName}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f5f0e8;border-bottom:2px solid #c9bfa0;">
            <th style="text-align:right;padding:8px 14px;font-weight:700;color:#555;white-space:nowrap;">QTD</th>
            <th style="text-align:left;padding:8px 6px;font-weight:700;color:#555;">UN</th>
            <th style="text-align:left;padding:8px 14px;font-weight:700;color:#555;">PRODUTO</th>
            <th style="text-align:right;padding:8px 14px;font-weight:700;color:#555;white-space:nowrap;">CUSTO UNIT.</th>
            <th style="text-align:right;padding:8px 14px;font-weight:700;color:#555;white-space:nowrap;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, i) => {
            const qty = getEffectiveQty(item);
            return `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#fafaf6'};border-bottom:1px solid #eee;">
              <td style="text-align:right;padding:7px 14px;font-weight:700;">${fmtQty(qty)}</td>
              <td style="text-align:left;padding:7px 6px;color:#777;">${item.unit}</td>
              <td style="text-align:left;padding:7px 14px;">${item.name}</td>
              <td style="text-align:right;padding:7px 14px;color:#777;">R$ ${fmtCur(item.unitCost)}</td>
              <td style="text-align:right;padding:7px 14px;font-weight:600;">R$ ${fmtCur(qty * item.unitCost)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid #aaa;background:#f5f0e8;">
            <td colspan="4" style="text-align:right;padding:9px 14px;font-weight:700;font-size:13px;">Total estimado:</td>
            <td style="text-align:right;padding:9px 14px;font-weight:800;font-size:15px;color:#b45309;">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:10px;font-size:10px;color:#bbb;text-align:right;">Gerado em ${now}</div>
    `;

    document.body.appendChild(container);

    // Build the blob promise from html2canvas — no await before clipboard.write
    const blobPromise: Promise<Blob> = html2canvas(container, {
      scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
    }).then(canvas => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    }));

    // Call clipboard.write synchronously (no preceding await) so the user-gesture context is intact
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
      toast.success(`Pedido de "${supplierName}" copiado! Cole no WhatsApp, email ou onde quiser.`);
    } catch (err) {
      console.error('clipboard.write failed:', err);
      toast.error('Não foi possível copiar. Verifique se o navegador permite acesso à área de transferência.');
    } finally {
      blobPromise.catch(() => {}).finally(() => {
        document.body.removeChild(container);
        setCopyingSupplier(null);
      });
    }
  };

  const handlePrintSeparationList = async () => {
    const { data: sepItems } = await supabase
      .from('event_separation_items')
      .select('*, stock_items(name, unit)')
      .eq('menu_id', id!)
      .order('category')
      .order('created_at');

    if (!sepItems || sepItems.length === 0) {
      toast.error('Nenhum item de separação encontrado. Atribua a separação primeiro.');
      return;
    }

    // Group by assigned employee
    const byEmp: Record<string, typeof sepItems> = {};
    for (const item of sepItems) {
      const empId = (item as any).assigned_to || '__nenhum__';
      if (!byEmp[empId]) byEmp[empId] = [];
      byEmp[empId].push(item);
    }

    const rows = Object.entries(byEmp).map(([empId, items]) => {
      const emp = empId !== '__nenhum__' ? employees.find(e => e.user_id === empId) : null;
      const empName = emp?.display_name || (empId !== '__nenhum__' ? empId.slice(0, 8) : 'Não atribuído');

      // Group by category within employee
      const byCat: Record<string, typeof items> = {};
      items.forEach(i => {
        const cat = (i as any).category || 'Outros';
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(i);
      });

      const catRows = Object.entries(byCat).map(([cat, citems]) => {
        const trs = citems.map(i => {
          const si = (i as any).stock_items as { name?: string; unit?: string } | null;
          const status = i.status === 'separated' ? '<span class="status-ok">✓ Separado</span>' :
                         i.status === 'skipped'   ? 'Pulado' :
                         '<span class="status-pending">Pendente</span>';
          return `<tr>
            <td>${si?.name || '?'} <span style="color:#888;font-size:9px">(${si?.unit || ''})</span></td>
            <td class="right">${fmtQty(i.planned_quantity ?? 0)}</td>
            <td class="right">${i.separated_quantity != null ? fmtQty(i.separated_quantity) : '—'}</td>
            <td class="center">${status}</td>
          </tr>`;
        }).join('');
        return `<tr><td colspan="4" class="cat-header">${cat}</td></tr>${trs}`;
      }).join('');

      return `<h2>👤 ${empName} — ${items.length} itens</h2>
        <table>
          <thead><tr><th>INSUMO</th><th class="right">PLANEJADO</th><th class="right">SEPARADO</th><th class="center">STATUS</th></tr></thead>
          <tbody>${catRows}</tbody>
        </table>`;
    }).join('');

    printBase('Lista de Separação', rows);
  };

  const canAssign = menu.status === 'draft' || menu.status === 'assigned';
  const canReturn = menu.status === 'dispatched';

  return (
    <div className="max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate('/event-menus')}>
        <ArrowLeft className="w-4 h-4 mr-1" />Voltar aos cardápios
      </Button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-border p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">{menu.name}</h1>
            <div className="flex flex-wrap gap-2">
              {menu.event_date && <Badge variant="outline" className="text-sm px-3 py-1"><Calendar className="w-3.5 h-3.5 mr-1.5" />{new Date(menu.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Badge>}
              {menu.location && <Badge variant="outline" className="text-sm px-3 py-1"><MapPin className="w-3.5 h-3.5 mr-1.5" />{menu.location}</Badge>}
              <Badge variant="outline" className="text-sm px-3 py-1"><Users className="w-3.5 h-3.5 mr-1.5" />{menu.guest_count} convidados</Badge>
              {menu.staff_count > 0 && <Badge variant="outline" className="text-sm px-3 py-1">{menu.staff_count} profissionais</Badge>}
            </div>
            {menu.notes && <p className="text-sm text-muted-foreground mt-2">{menu.notes}</p>}
            <p className="text-xs text-muted-foreground mt-2 opacity-60">
              Gerado em {new Date(menu.created_at).toLocaleDateString('pt-BR')} às {new Date(menu.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {menu.assigned_at && ` · Atribuído: ${new Date(menu.assigned_at).toLocaleDateString('pt-BR')} por ${menu.assigned_by}`}
              {menu.dispatched_at && ` · Saída: ${new Date(menu.dispatched_at).toLocaleDateString('pt-BR')} por ${menu.dispatched_by}`}
              {menu.returned_at && ` · Retorno: ${new Date(menu.returned_at).toLocaleDateString('pt-BR')} por ${menu.returned_by}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3 flex-shrink-0">

            {/* Info card: status + funcionário responsável */}
            {menu.status !== 'draft' && (
              <div className={`rounded-xl border px-4 py-3 flex flex-col gap-2 min-w-[200px] ${
                menu.status === 'completed'
                  ? 'bg-green-50 border-green-200'
                  : menu.status === 'dispatched'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                {/* Status label */}
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                  menu.status === 'completed' ? 'text-green-700'
                  : menu.status === 'dispatched' ? 'text-blue-700'
                  : 'text-amber-700'
                }`}>
                  {menu.status === 'assigned' && <UserCheck className="w-3.5 h-3.5" />}
                  {menu.status === 'dispatched' && <Truck className="w-3.5 h-3.5" />}
                  {menu.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {statusLabel[menu.status]}
                </div>

                {/* Funcionário */}
                {assignedEmployee && (
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
                      menu.status === 'completed' ? 'bg-green-200 text-green-800'
                      : menu.status === 'dispatched' ? 'bg-blue-200 text-blue-800'
                      : 'bg-amber-200 text-amber-800'
                    }`}>
                      {assignedEmployee.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${
                        menu.status === 'completed' ? 'text-green-800'
                        : menu.status === 'dispatched' ? 'text-blue-800'
                        : 'text-amber-800'
                      }`}>{assignedEmployee.display_name}</p>
                      <p className={`text-[10px] ${
                        menu.status === 'completed' ? 'text-green-600'
                        : menu.status === 'dispatched' ? 'text-blue-600'
                        : 'text-amber-600'
                      }`}>responsável pela separação</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Status rascunho (sem card colorido) */}
            {menu.status === 'draft' && (
              <Badge variant="secondary" className="text-xs">Rascunho</Badge>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 w-full">
              {canAssign && (
                <Button size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5 gold-button flex-1 justify-center">
                  <UserCheck className="w-4 h-4" />
                  {menu.status === 'assigned' ? 'Reatribuir Separação' : 'Atribuir Separação'}
                </Button>
              )}
              {canReturn && (
                <Button size="sm" onClick={prepareReturn} className="gap-1.5 bg-success hover:bg-success/90 flex-1 justify-center">
                  <RotateCcw className="w-4 h-4" />Registrar Retorno
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          <div className="text-center"><p className="text-2xl font-bold text-foreground">{regularDishes.length}</p><p className="text-xs text-muted-foreground mt-0.5">pratos</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-foreground">{shoppingList.length}</p><p className="text-xs text-muted-foreground mt-0.5">insumos</p></div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${insufficientCount > 0 ? 'text-destructive' : 'text-success'}`}>{insufficientCount > 0 ? insufficientCount : itemsOk}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{insufficientCount > 0 ? 'sem estoque' : 'em estoque'}</p>
          </div>
          <div className="text-center"><p className="text-2xl font-bold gold-text">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground mt-0.5">custo compra</p></div>
        </div>

        {insufficientCount > 0 && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-warning/10 border border-warning/30 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
            <span><strong>{insufficientCount} insumo(s)</strong> com estoque insuficiente — compre antes de atribuir a separação.</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-border p-1 w-fit">
        {([['pratos', `Cardápio (${regularDishes.length})`, null], ['compras', 'Lista de Compras', itemsToBuy > 0 ? itemsToBuy : null], ['saida', 'Separação / Retorno', null], ['materiais', 'Materiais', null]] as const).map(([tab, label, badge]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === tab ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
            {badge && <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${activeTab === tab ? 'bg-white/20' : 'bg-destructive text-white'}`}>{badge}</span>}
          </button>
        ))}
      </div>

      {/* ── FICHAS TÉCNICAS ── */}
      {activeTab === 'pratos' && (
        <div className="space-y-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">{regularDishes.length} pratos · {groupedDishes.length} seções</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={regularDishes.length === 0}>
                <Download className="w-4 h-4 mr-1" />CSV
              </Button>
              <Button size="sm" onClick={() => { setAddSheetDefaultSection(undefined); setAddSheetOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" />Adicionar prato
              </Button>
            </div>
          </div>

          {/* Mantimentos block */}
          {mantimentosDish && (
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 overflow-hidden mb-3">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground">MANTIMENTOS</p>
                      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Fixo</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{mantimentosDish.planned_quantity} {mantimentosDish.planned_unit} · {mantimentosDish.sheet?.items.length || 0} insumos</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => toggleExpand(mantimentosDish.id)}>{mantimentosDish.expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditingDishId(mantimentosDish.id); setDishDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleRemoveDish(mantimentosDish.id)}><X className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              {mantimentosDish.expanded && mantimentosDish.sheet && <DishExpandedView dish={mantimentosDish} />}
            </div>
          )}

          {/* Spreadsheet table */}
          <div className="rounded-xl border border-border overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground w-20">QTD</th>
                  <th className="text-left px-2 py-2 font-semibold text-xs text-muted-foreground w-14">UN</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground">PRATO</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground hidden md:table-cell w-40">OBSERVAÇÕES</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground hidden md:table-cell w-48">DECORAÇÃO / APRESENTAÇÃO</th>
                  <th className="w-24 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {groupedDishes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground text-sm">
                      Nenhum prato adicionado. Clique em "Adicionar prato" para começar.
                    </td>
                  </tr>
                )}
                {groupedDishes.map(({ section, dishes: secDishes }) => (
                  <React.Fragment key={section}>
                    {/* Section header row */}
                    <tr key={`sec-${section}`} className="bg-muted/60 border-y border-border/70">
                      <td colSpan={6} className="px-3 py-1.5">
                        <div className="flex items-center justify-between">
                          {renamingSectionName === section ? (
                            <input
                              autoFocus
                              className="text-xs font-bold uppercase tracking-wide bg-transparent border-b border-primary outline-none w-48"
                              value={renamingSectionValue}
                              onChange={e => setRenamingSectionValue(e.target.value)}
                              onBlur={() => handleRenameSection(section, renamingSectionValue)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRenameSection(section, renamingSectionValue); if (e.key === 'Escape') setRenamingSectionName(null); }}
                            />
                          ) : (
                            <span
                              className="text-xs font-bold uppercase tracking-wide text-foreground cursor-pointer hover:text-primary"
                              onClick={() => { setRenamingSectionName(section); setRenamingSectionValue(section); }}
                              title="Clique para renomear"
                            >
                              {section}
                            </span>
                          )}
                          <button
                            className="text-xs text-primary hover:underline flex items-center gap-1 ml-2"
                            onClick={() => { setAddSheetDefaultSection(section); setAddSheetOpen(true); }}
                          >
                            <Plus className="w-3 h-3" />prato
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Dish rows */}
                    {secDishes.map((dish, idx) => (
                      <tr key={dish.id} className={`border-b border-border/40 hover:bg-amber-50 transition-colors cursor-default ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                        {/* Qty — inline editable */}
                        <td className="px-3 py-2 text-right">
                          {editingQtyId === dish.id ? (
                            <input
                              autoFocus
                              type="number"
                              step="any"
                              className="w-16 text-right text-sm border border-primary rounded px-1 py-0.5 outline-none"
                              value={editingQtyValue}
                              onChange={e => setEditingQtyValue(e.target.value)}
                              onBlur={() => handleSaveQty(dish.id)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveQty(dish.id); if (e.key === 'Escape') setEditingQtyId(null); }}
                            />
                          ) : (
                            <span
                              className="font-semibold text-foreground cursor-pointer hover:text-primary hover:underline"
                              onClick={() => { setEditingQtyId(dish.id); setEditingQtyValue(String(dish.planned_quantity)); }}
                              title="Clique para editar"
                            >
                              {dish.planned_quantity}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-muted-foreground font-medium">{dish.planned_unit}</td>
                        <td className="px-3 py-2 font-medium text-foreground">
                          <span className="flex items-center gap-1.5">
                            {dish.sheet_name}
                            {(!dish.sheet || dish.sheet.items.filter(i => i.section === 'receita').length === 0) && (
                              <span title="Ficha técnica sem insumos — não contribui para a lista de compras" className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 cursor-help">sem insumos</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                          {dish.notes || <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                          {dish.decoration || dish.sheet?.items.filter(i => i.section === 'decoracao').map(i => i.item_name).join(' / ') || <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-0.5 justify-end">
                            <Button
                              variant="ghost" size="icon" className="w-7 h-7"
                              title="Editar receita"
                              onClick={() => { setEditingDishId(dish.id); setDishDialogOpen(true); }}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="w-7 h-7"
                              title="Duplicar"
                              onClick={() => handleDuplicateDish(dish)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="w-7 h-7 text-destructive/70 hover:text-destructive"
                              title="Remover"
                              onClick={() => handleRemoveDish(dish.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              {regularDishes.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border bg-muted/30">
                    <td colSpan={6} className="px-3 py-2">
                      <button
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        onClick={() => { setAddSheetDefaultSection(undefined); setAddSheetOpen(true); }}
                      >
                        <Plus className="w-3 h-3" />Adicionar prato em nova seção
                      </button>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Dish edit dialog */}
      <Dialog open={dishDialogOpen} onOpenChange={o => { if (!o) { setDishDialogOpen(false); setEditingDishId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Receita — {editingDish?.sheet_name}</DialogTitle>
            <DialogDescription>Altere os insumos, quantidade e observações deste prato.</DialogDescription>
          </DialogHeader>
          {editingDish && (
            <DishEditPanel
              dish={editingDish}
              stockItems={stockItems}
              onSave={async (items, qty, unit, notes) => {
                await handleSaveDish(editingDish.id, items, qty, unit, notes);
                setDishDialogOpen(false);
              }}
              onCancel={() => { setDishDialogOpen(false); setEditingDishId(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── LISTA DE COMPRAS ── */}
      {activeTab === 'compras' && (() => {
        // Check if this event's list was consolidated
        const consolidatedEventIds: string[] = (() => { try { return JSON.parse(localStorage.getItem('consolidatedEventIds') || '[]'); } catch { return []; } })();
        const savedLists: any[] = (() => { try { return JSON.parse(localStorage.getItem('savedShoppingLists') || '[]'); } catch { return []; } })();
        const consolidatedList = id ? savedLists.find((l: any) => l.menuIds?.includes(id)) : null;

        // Supplier grouping
        const suppliersInList = Array.from(new Set(
          shoppingList.filter(i => i.toBuy > 0 && i.supplier).map(i => i.supplier!)
        )).sort();
        const itemsNoSupplier = shoppingList.filter(i => i.toBuy > 0 && !i.supplier);

        return (
          <div className="space-y-3">
            {consolidatedList && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 text-sm">
                <span className="text-lg">🔗</span>
                <p className="text-foreground">
                  Esta lista foi unificada com outros eventos em{' '}
                  <span className="font-semibold">"{consolidatedList.name}"</span>.
                  Veja a lista consolidada em{' '}
                  <a href="/shopping-lists" className="underline text-primary font-medium">Listas de Compras</a>.
                </p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-destructive" /><span className="font-semibold text-destructive">{itemsToBuy}</span><span className="text-muted-foreground">a comprar</span></div>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /><span className="font-semibold text-success">{itemsOk}</span><span className="text-muted-foreground">em estoque</span></div>
                </div>
                <div className="flex items-center gap-3">
                  {/* View mode toggle */}
                  <div className="flex gap-1 bg-border/40 rounded-lg p-0.5">
                    {([['category', 'Por Categoria'], ['supplier', 'Por Fornecedor']] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setShopGroupMode(v)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${shopGroupMode === v ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
                    ))}
                  </div>
                  {shopGroupMode === 'category' && (
                    <div className="flex gap-1 bg-border/40 rounded-lg p-0.5">
                      {([['all', 'Todos'], ['ok', '✓ Ok'], ['buy', '⬇ Comprar']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => setShopFilter(v)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${shopFilter === v ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
                      ))}
                    </div>
                  )}
                  <div className="text-right"><p className="text-xs text-muted-foreground">Custo compra</p><p className="font-bold text-sm">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  <Button variant="outline" size="sm" onClick={handlePrintShoppingList} className="gap-1.5">
                    <Printer className="w-3.5 h-3.5" />Imprimir Lista
                  </Button>
                </div>
              </div>
              {dishesWithNoIngredients.length > 0 && (
                <div className="mx-5 mt-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-amber-800 mb-1">Pratos sem insumos cadastrados na ficha técnica:</p>
                  <p className="text-amber-700 text-xs">Os pratos abaixo não possuem ingredientes na ficha técnica e por isso não aparecem na lista de compras. Edite a ficha técnica de cada um para adicionar os insumos.</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {dishesWithNoIngredients.map(name => (
                      <li key={name} className="rounded bg-amber-200/60 px-2 py-0.5 text-xs font-medium text-amber-900">{name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Category view ── */}
              {shopGroupMode === 'category' && (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}><th className="text-left px-5 py-3 font-semibold text-muted-foreground">INSUMO</th><th className="text-right px-4 py-3 font-semibold text-muted-foreground">NECESSÁRIO</th><th className="text-right px-4 py-3 font-semibold text-muted-foreground">EM ESTOQUE</th><th className="text-right px-4 py-3 font-semibold text-muted-foreground">A COMPRAR</th><th className="text-right px-5 py-3 font-semibold text-muted-foreground">CUSTO EST.</th></tr></thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredShoppingList.map(item => (
                      <tr key={item.id} className={item.toBuy > 0 ? 'bg-red-50/30' : ''}>
                        <td className="px-5 py-3"><div className="flex items-center gap-2">{item.toBuy > 0 ? <TrendingDown className="w-3.5 h-3.5 text-destructive flex-shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />}<span className={item.toBuy > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>{item.name}</span>{item.supplier && <span className="text-[10px] text-muted-foreground/60 italic ml-1">({item.supplier})</span>}</div></td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmtQty(item.needed)} {item.unit}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmtQty(item.inStock)} {item.unit}</td>
                        <td className="px-4 py-3 text-right font-semibold">{item.toBuy > 0 ? <span className="text-destructive">{fmtQty(item.toBuy)} {item.unit}</span> : <span className="text-success text-xs">✓ ok</span>}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">{item.toBuy > 0 ? `R$ ${fmtCur(item.toBuy * item.unitCost)}` : '—'}</td>
                      </tr>
                    ))}
                    {filteredShoppingList.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhum item neste filtro</td></tr>}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-border" style={{ background: 'hsl(40 30% 97%)' }}><td colSpan={4} className="px-5 py-3 text-right font-semibold text-foreground">Total estimado para comprar:</td><td className="px-5 py-3 text-right font-bold text-lg gold-text">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr></tfoot>
                </table>
              )}

              {/* ── Supplier view ── */}
              {shopGroupMode === 'supplier' && (
                <div className="divide-y divide-border/50">
                  {suppliersInList.length === 0 && itemsNoSupplier.length === 0 && (
                    <p className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhum item a comprar.</p>
                  )}
                  {suppliersInList.map(supplier => {
                    const items = shoppingList.filter(i => i.supplier === supplier && i.toBuy > 0);
                    const supplierTotal = items.reduce((s, i) => s + getEffectiveQty(i) * i.unitCost, 0);
                    return (
                      <div key={supplier}>
                        <div className="flex items-center justify-between px-5 py-3 bg-muted/20">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="font-semibold text-foreground text-sm">{supplier}</span>
                            <span className="text-xs text-muted-foreground">({items.length} item{items.length !== 1 ? 's' : ''})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-primary">R$ {fmtCur(supplierTotal)}</span>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => copySupplierOrderAsImage(supplier)}
                              disabled={copyingSupplier === supplier}
                              className="gap-1.5 h-7 text-xs"
                              title="Copiar tabela como imagem para colar no WhatsApp ou email"
                            >
                              {copyingSupplier === supplier
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Copy className="w-3 h-3" />
                              }
                              Copiar Imagem
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handlePrintBySupplier(supplier)} className="gap-1.5 h-7 text-xs">
                              <Printer className="w-3 h-3" />Imprimir Pedido
                            </Button>
                          </div>
                        </div>
                        <table className="w-full text-sm">
                          <thead><tr className="border-b border-border/40 text-xs text-muted-foreground" style={{ background: 'hsl(40 30% 98%)' }}><th className="text-right px-5 py-2 font-semibold w-28">A COMPRAR</th><th className="text-left px-3 py-2 font-semibold w-14">UN</th><th className="text-left px-3 py-2 font-semibold">PRODUTO</th><th className="text-right px-5 py-2 font-semibold">CUSTO UNIT.</th><th className="text-right px-5 py-2 font-semibold">TOTAL</th></tr></thead>
                          <tbody className="divide-y divide-border/40">
                            {items.map(item => {
                              const effQty = getEffectiveQty(item);
                              return (
                                <tr key={item.id}>
                                  <td className="px-2 py-1.5 text-right w-28">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      className="w-24 text-right font-semibold text-destructive bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none rounded px-2 py-1 text-sm transition-colors"
                                      value={qtyOverrides[item.id] !== undefined ? qtyOverrides[item.id] : item.toBuy}
                                      onChange={e => setQtyOverrides(prev => ({ ...prev, [item.id]: e.target.value }))}
                                      onBlur={e => {
                                        const v = parseFloat(e.target.value);
                                        if (isNaN(v) || v < 0) setQtyOverrides(prev => ({ ...prev, [item.id]: item.toBuy }));
                                        else setQtyOverrides(prev => ({ ...prev, [item.id]: v }));
                                      }}
                                    />
                                  </td>
                                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.unit}</td>
                                  <td className="px-3 py-2.5 font-medium text-foreground">{item.name}</td>
                                  <td className="px-5 py-2.5 text-right text-muted-foreground">R$ {fmtCur(item.unitCost)}</td>
                                  <td className="px-5 py-2.5 text-right font-medium">R$ {fmtCur(effQty * item.unitCost)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                  {itemsNoSupplier.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-5 py-3 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-muted-foreground text-sm">Sem fornecedor definido</span>
                          <span className="text-xs text-muted-foreground">({itemsNoSupplier.length} item{itemsNoSupplier.length !== 1 ? 's' : ''})</span>
                        </div>
                        <span className="text-xs text-muted-foreground italic">Cadastre fornecedores em Estoque Geral</span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border/40">
                          {itemsNoSupplier.map(item => (
                            <tr key={item.id}>
                              <td className="px-5 py-2.5 text-right font-semibold text-destructive w-28">{fmtQty(item.toBuy)}</td>
                              <td className="px-3 py-2.5 text-muted-foreground text-xs w-14">{item.unit}</td>
                              <td className="px-3 py-2.5 font-medium text-foreground">{item.name}</td>
                              <td className="px-5 py-2.5 text-right text-muted-foreground">R$ {fmtCur(item.unitCost)}</td>
                              <td className="px-5 py-2.5 text-right font-medium">R$ {fmtCur(item.toBuy * item.unitCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── MATERIAIS ── */}
      {activeTab === 'materiais' && (
        <div>
          {!matLoaded ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>

          /* ── Sem lista criada: botão Criar ── */
          ) : !linkedLoanId && !editingMaterials ? (
            <div className="bg-white rounded-xl border border-border p-8 flex flex-col items-center justify-center gap-4 text-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Warehouse className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">Nenhuma lista de materiais</p>
                <p className="text-sm text-muted-foreground mt-1">Crie a lista para definir quais materiais serão usados neste evento</p>
              </div>
              <Button className="gold-button mt-2" onClick={() => setEditingMaterials(true)}>
                <Plus className="w-4 h-4 mr-2" />Criar Lista de Materiais
              </Button>
            </div>

          /* ── Lista salva: visualização ── */
          ) : linkedLoanId && !editingMaterials ? (
            <div>
              {/* Header da lista */}
              <div className="bg-white rounded-xl border border-border p-4 mb-5 flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm">
                  <Warehouse className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">
                    {materialItems.filter(i => (planQty[i.id] || 0) > 0).length} tipo{materialItems.filter(i => (planQty[i.id] || 0) > 0).length !== 1 ? 's' : ''} de material na lista
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditingMaterials(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar Lista
                </Button>
              </div>

              {materialItems.filter(i => (planQty[i.id] || 0) > 0).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Lista vazia — clique em Editar para adicionar materiais</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Array.from(new Set(materialItems.filter(i => (planQty[i.id] || 0) > 0).map(i => i.category))).sort().map(cat => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">📦 {cat}</p>
                      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/20">
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full">Material</th>
                              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Total</th>
                              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Disponível</th>
                              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Necessário</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {materialItems.filter(i => i.category === cat && (planQty[i.id] || 0) > 0).map(item => {
                              const needed = planQty[item.id] || 0;
                              const inUse = item.total_qty - item.available_qty;
                              return (
                                <tr key={item.id} className="hover:bg-muted/5 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                                      ) : (
                                        <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                                          <Package className="w-4 h-4 text-muted-foreground/40" />
                                        </div>
                                      )}
                                      <div>
                                        <p className="font-medium text-foreground">{item.name}</p>
                                        {inUse > 0 && <p className="text-[11px] text-amber-600">{inUse} em uso em outros eventos</p>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground">
                                    {item.total_qty} <span className="text-xs">{item.unit}</span>
                                  </td>
                                  <td className="px-3 py-3 text-right whitespace-nowrap">
                                    <span className={item.available_qty === 0 ? 'text-destructive font-semibold' : item.available_qty < needed ? 'text-amber-600 font-semibold' : 'text-foreground'}>
                                      {item.available_qty}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <span className={needed > item.available_qty ? 'text-destructive font-bold' : 'text-primary font-semibold'}>
                                      {needed}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          /* ── Modo edição: todos os materiais com inputs ── */
          ) : (
            <div>
              {/* Barra de ação */}
              <div className="bg-white rounded-xl border border-border p-4 mb-5 flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Warehouse className="w-4 h-4 text-primary" />
                  <span>
                    {Object.values(planQty).filter(q => q > 0).length === 0
                      ? 'Selecione os materiais necessários'
                      : `${Object.values(planQty).filter(q => q > 0).length} tipo(s) selecionado(s)`}
                  </span>
                </div>
                <div className="flex gap-2">
                  {linkedLoanId && (
                    <Button variant="outline" size="sm" onClick={() => setEditingMaterials(false)}>Cancelar</Button>
                  )}
                  <Button onClick={async () => { await handleSaveMaterials(); setEditingMaterials(false); }} disabled={savingMaterials} className="gold-button" size="sm">
                    {savingMaterials ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Lista
                  </Button>
                </div>
              </div>

              {materialItems.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Nenhum material cadastrado</p>
                  <p className="text-sm mt-1">Cadastre itens em Materiais → Inventário</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.from(new Set(materialItems.map(i => i.category))).sort().map(cat => {
                    const catItems = materialItems.filter(i => i.category === cat);
                    const catSelected = catItems.filter(i => (planQty[i.id] || 0) > 0).length;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">📦 {cat}</h3>
                          {catSelected > 0 && <span className="text-xs text-primary font-medium">{catSelected} selecionado(s)</span>}
                        </div>
                        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/20">
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full">Material</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Total</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Disponível</th>
                                <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap w-28">Necessário</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {catItems.map(item => {
                                const qty = planQty[item.id] || 0;
                                const isSelected = qty > 0;
                                return (
                                  <tr key={item.id} className={`transition-colors ${isSelected ? 'bg-amber-50/40' : 'hover:bg-muted/10'}`}>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        {item.image_url ? (
                                          <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                                        ) : (
                                          <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                                            <Package className="w-4 h-4 text-muted-foreground/40" />
                                          </div>
                                        )}
                                        <span className={`font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>{item.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground">
                                      {item.total_qty} <span className="text-xs">{item.unit}</span>
                                    </td>
                                    <td className="px-3 py-3 text-right whitespace-nowrap">
                                      <span className={item.available_qty === 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                                        {item.available_qty}
                                      </span>
                                      <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                      <Input
                                        type="number" min={0}
                                        value={qty === 0 ? '' : qty}
                                        placeholder="0"
                                        className={`w-20 text-center h-8 text-sm mx-auto ${isSelected ? 'border-primary/50 bg-white' : ''}`}
                                        onChange={e => {
                                          const v = Math.max(0, Number(e.target.value) || 0);
                                          setPlanQty(prev => { const next = { ...prev }; if (v === 0) delete next[item.id]; else next[item.id] = v; return next; });
                                        }}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-end pt-2 pb-6">
                    <Button onClick={async () => { await handleSaveMaterials(); setEditingMaterials(false); }} disabled={savingMaterials} className="gold-button">
                      {savingMaterials ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Salvar Lista de Materiais
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SEPARAÇÃO / RETORNO ── */}
      {activeTab === 'saida' && (
        <div className="space-y-4">
          {/* Status timeline */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Status do Evento</p>
            <div className="flex items-center gap-0">
              {[
                { key: 'draft', label: 'Cardápio criado', icon: ClipboardList, done: true },
                { key: 'assigned', label: 'Separação atribuída', icon: UserCheck, done: menu.status === 'assigned' || menu.status === 'dispatched' || menu.status === 'completed' },
                { key: 'dispatched', label: 'Saída do estoque', icon: Truck, done: menu.status === 'dispatched' || menu.status === 'completed' },
                { key: 'completed', label: 'Retorno confirmado', icon: RotateCcw, done: menu.status === 'completed' },
              ].map(({ key, label, icon: Icon, done }, i, arr) => (
                <div key={key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${done ? 'bg-success border-success' : 'bg-white border-border'}`}>
                      <Icon className={`w-4 h-4 ${done ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <p className="text-xs text-center text-muted-foreground whitespace-nowrap">{label}</p>
                    {key === 'assigned' && menu.assigned_at && <p className="text-[10px] text-muted-foreground opacity-70">{new Date(menu.assigned_at).toLocaleDateString('pt-BR')}</p>}
                    {key === 'dispatched' && menu.dispatched_at && <p className="text-[10px] text-muted-foreground opacity-70">{new Date(menu.dispatched_at).toLocaleDateString('pt-BR')}</p>}
                    {key === 'completed' && menu.returned_at && <p className="text-[10px] text-muted-foreground opacity-70">{new Date(menu.returned_at).toLocaleDateString('pt-BR')}</p>}
                  </div>
                  {i < arr.length - 1 && <div className={`flex-1 h-0.5 mx-2 mb-5 ${done ? 'bg-success' : 'bg-border'}`} />}
                </div>
              ))}
            </div>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Assign card */}
            <div className={`bg-white rounded-xl border shadow-sm p-5 ${canAssign ? 'border-primary/30' : 'border-border opacity-60'}`}>
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className={`w-5 h-5 ${canAssign ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="font-semibold text-foreground">Atribuir Separação</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Distribua a separação por categoria entre funcionários. Cada um verá seus itens no app.
              </p>
              <div className="text-xs text-muted-foreground mb-4 space-y-1">
                <p>• {shoppingList.length} insumos para separar</p>
                {menu.status === 'assigned'
                  ? <p>• <span className="text-primary font-medium">Separação já atribuída</span> — clique para reatribuir</p>
                  : <p>• Nenhum funcionário designado ainda</p>
                }
                {insufficientCount > 0 && <p>• <span className="text-warning font-medium">{insufficientCount} itens com estoque insuficiente</span></p>}
              </div>
              <Button className="w-full" disabled={!canAssign} onClick={() => setAssignOpen(true)}>
                <UserCheck className="w-4 h-4 mr-2" />
                {menu.status === 'assigned' ? 'Reatribuir Separação' : menu.status === 'dispatched' || menu.status === 'completed' ? 'Separação concluída' : 'Atribuir Separação'}
              </Button>
            </div>

            {/* Return card */}
            <div className={`bg-white rounded-xl border shadow-sm p-5 ${canReturn ? 'border-success/30' : 'border-border opacity-60'}`}>
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw className={`w-5 h-5 ${canReturn ? 'text-success' : 'text-muted-foreground'}`} />
                <p className="font-semibold text-foreground">Retorno de Sobras</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Devolve ao estoque o que sobrou do evento. Calcula automaticamente o consumo real.</p>
              <div className="text-xs text-muted-foreground mb-4 space-y-1">
                {menu.dispatched_at
                  ? <p>• Saída realizada em {new Date(menu.dispatched_at).toLocaleDateString('pt-BR')} por {menu.dispatched_by}</p>
                  : <p>• O funcionário precisa confirmar a saída primeiro</p>
                }
              </div>
              <Button className="w-full bg-success hover:bg-success/90" disabled={!canReturn} onClick={prepareReturn}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {canReturn ? 'Registrar Sobras' : menu.status === 'completed' ? 'Retorno já registrado' : 'Aguardando saída'}
              </Button>
            </div>
          </div>

          {/* Separation progress (if assigned) */}
          {(menu.status === 'assigned' || menu.status === 'dispatched') && (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handlePrintSeparationList} className="gap-1.5">
                  <Printer className="w-3.5 h-3.5" />Imprimir Lista de Separação
                </Button>
              </div>
              <SeparationErrorBoundary>
                <SeparationProgress menuId={id!} employees={employees} />
              </SeparationErrorBoundary>
            </>
          )}
        </div>
      )}

      {/* Dialogs */}
      <AddSheetDialog open={addSheetOpen} onClose={() => setAddSheetOpen(false)} menuId={id!} allSheets={allSheets} existingSections={existingSections} defaultSection={addSheetDefaultSection} onAdded={() => loadMenu()} />
      <AssignSeparationDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        menuId={id!}
        employees={employees}
        shoppingList={shoppingList}
        stockItems={stockItems}
        onAssigned={() => loadMenu()}
      />
      <ReturnDialog open={returnOpen} onClose={() => setReturnOpen(false)} items={returnItems} onConfirm={confirmReturn} loading={movementLoading} />
    </div>
  );
}

// ─── Separation Progress Panel ────────────────────────────────────────────────
class SeparationErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: any) { return { error: error?.message || String(error) }; }
  render() {
    if (this.state.error) return <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-xl">Erro no painel de progresso: {this.state.error}</div>;
    return this.props.children;
  }
}
function SeparationProgress({ menuId, employees }: { menuId: string; employees: Employee[] }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('event_separation_items')
        .select('*, stock_items(name, unit)')
        .eq('menu_id', menuId)
        .order('category')
        .order('created_at');
      setItems(data || []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`separation-${menuId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_separation_items', filter: `menu_id=eq.${menuId}` }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [menuId]);

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (items.length === 0) return null;

  const total = items.length;
  const done = items.filter(i => i.status === 'separated' || i.status === 'skipped').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Per-employee summary — only when items have assigned_to set
  const assignedEmps: { id: string; name: string; done: number; total: number }[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const uid = item.assigned_to as string | null;
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    const empName = employees.find(e => e.user_id === uid)?.display_name || uid.slice(0, 8);
    const empItems = items.filter(i => i.assigned_to === uid);
    assignedEmps.push({ id: uid, name: empName, done: empItems.filter(i => i.status !== 'pending').length, total: empItems.length });
  }

  // Group by category (only when per-employee assignments exist)
  const hasCategoryGroups = assignedEmps.length > 0;
  const catGroups: { cat: string; empName: string | null; items: typeof items }[] = [];
  if (hasCategoryGroups) {
    const cats = [...new Set(items.map(i => (i.category as string) || 'Sem categoria'))].sort();
    for (const cat of cats) {
      const catItems = items.filter(i => ((i.category as string) || 'Sem categoria') === cat);
      const firstEmpId = catItems[0]?.assigned_to as string | null;
      const empName = firstEmpId ? (employees.find(e => e.user_id === firstEmpId)?.display_name || null) : null;
      catGroups.push({ cat, empName, items: catItems });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <p className="font-semibold text-foreground text-sm">Progresso da Separação</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary">{pct}%</span>
          <span className="text-xs text-muted-foreground">({done}/{total})</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3 pb-2">
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Per-employee chips */}
      {assignedEmps.length > 0 && (
        <div className="px-5 pb-2 flex flex-wrap gap-2">
          {assignedEmps.map(emp => {
            const empPct = emp.total > 0 ? Math.round((emp.done / emp.total) * 100) : 0;
            return (
              <div key={emp.id} className="flex items-center gap-1.5 text-xs bg-muted/40 rounded-lg px-2.5 py-1.5 border border-border">
                <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium">{emp.name}</span>
                <span className="text-muted-foreground">·</span>
                <span className={empPct === 100 ? 'text-success font-semibold' : 'text-primary font-semibold'}>{empPct}%</span>
                <span className="text-muted-foreground">({emp.done}/{emp.total})</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Items — grouped by category if per-employee, flat list otherwise */}
      {hasCategoryGroups ? catGroups.map(group => (
        <div key={group.cat}>
          <div className="flex items-center justify-between px-5 py-1.5 bg-muted/20 border-t border-border/60">
            <span className="text-xs font-semibold text-foreground">{group.cat}</span>
            {group.empName && (
              <span className="text-[10px] text-muted-foreground">{group.empName}</span>
            )}
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border/40">
              {group.items.map(item => {
                const si = item.stock_items as { name?: string; unit?: string } | null;
                return (
                  <tr key={item.id} className={item.status === 'separated' ? 'bg-success/5' : item.status === 'skipped' ? 'bg-muted/30' : ''}>
                    <td className="py-2 px-5 text-foreground">{si?.name || '?'} <span className="text-muted-foreground text-xs">({si?.unit || ''})</span></td>
                    <td className="py-2 px-4 text-right text-muted-foreground text-xs">{item.planned_quantity != null ? fmtQty(item.planned_quantity) : '—'}</td>
                    <td className="py-2 px-4 text-right font-medium text-xs">{item.separated_quantity != null ? fmtQty(item.separated_quantity) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 px-4 text-center w-24">
                      {item.status === 'separated' && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />OK</span>}
                      {item.status === 'skipped' && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full"><X className="w-3 h-3" />Pulado</span>}
                      {item.status === 'pending' && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Pendente</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border/40">
            {items.map(item => {
              const si = item.stock_items as { name?: string; unit?: string } | null;
              return (
                <tr key={item.id} className={item.status === 'separated' ? 'bg-success/5' : item.status === 'skipped' ? 'bg-muted/30' : ''}>
                  <td className="py-2 px-5 text-foreground">{si?.name || '?'} <span className="text-muted-foreground text-xs">({si?.unit || ''})</span></td>
                  <td className="py-2 px-4 text-right text-muted-foreground text-xs">{item.planned_quantity != null ? fmtQty(item.planned_quantity) : '—'}</td>
                  <td className="py-2 px-4 text-right font-medium text-xs">{item.separated_quantity != null ? fmtQty(item.separated_quantity) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 px-4 text-center w-24">
                    {item.status === 'separated' && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />OK</span>}
                    {item.status === 'skipped' && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full"><X className="w-3 h-3" />Pulado</span>}
                    {item.status === 'pending' && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Pendente</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
