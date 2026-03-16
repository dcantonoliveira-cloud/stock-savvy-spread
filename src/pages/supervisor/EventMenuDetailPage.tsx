import { useEffect, useState } from 'react';
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
  ArrowLeft, Calendar, MapPin, Users, ShoppingCart,
  ChevronDown, ChevronUp, CheckCircle2, TrendingDown, Loader2,
  Plus, Pencil, Trash2, X, Check, ChevronsUpDown, PackagePlus,
  Package, Truck, RotateCcw, AlertTriangle, MessageSquare,
  ClipboardList, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const MANTIMENTOS_ID = '3fc5dd78-8578-4c45-9c01-6ba8a2123e7a';

type StockItem = { id: string; name: string; unit: string; unit_cost: number; current_stock: number };
type SheetItem = { id?: string; item_id: string; item_name: string; quantity: number; unit: string; unit_cost: number; section: 'receita' | 'decoracao' };
type Sheet = { id: string; name: string; yield_quantity: number; yield_unit: string; items: SheetItem[] };
type MenuDish = {
  id: string; sheet_id: string; sheet_name: string;
  planned_quantity: number; planned_unit: string;
  notes: string | null;
  sheet: Sheet | null; expanded: boolean; isMantimentos: boolean;
};
type EventMenu = {
  id: string; name: string; location: string | null;
  guest_count: number; staff_count: number;
  event_date: string | null; status: string; notes: string | null;
  created_at: string;
  dispatched_at: string | null; dispatched_by: string | null;
  returned_at: string | null; returned_by: string | null;
  dishes: MenuDish[];
};
type ShoppingItem = {
  id: string; name: string; unit: string;
  needed: number; inStock: number; toBuy: number; unitCost: number;
  hasStock: boolean;
};
type DispatchItem = {
  item_id: string; item_name: string; unit: string;
  planned: number; actual: number; inStock: number; hasEnough: boolean;
};
type ReturnItem = {
  item_id: string; item_name: string; unit: string;
  dispatched: number; returned: number;
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
function AddSheetDialog({ open, onClose, menuId, allSheets, onAdded }: { open: boolean; onClose: () => void; menuId: string; allSheets: Sheet[]; onAdded: () => void }) {
  const [sheetId, setSheetId] = useState(''); const [qty, setQty] = useState('1'); const [unit, setUnit] = useState('un'); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false);
  const handleAdd = async () => {
    if (!sheetId) { toast.error('Selecione uma ficha técnica'); return; } setSaving(true);
    const { error } = await supabase.from('event_menu_dishes').insert({ menu_id: menuId, sheet_id: sheetId, planned_quantity: parseFloat(qty) || 1, planned_unit: unit, notes: notes.trim() || null, sort_order: 999 } as any);
    if (error) { toast.error('Erro ao adicionar ficha'); setSaving(false); return; }
    toast.success('Ficha adicionada!'); setSheetId(''); setQty('1'); setUnit('un'); setNotes(''); setSaving(false); onAdded(); onClose();
  };
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Adicionar Ficha ao Cardápio</DialogTitle><DialogDescription>Adicione manualmente uma ficha técnica a este evento</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div><label className="text-sm text-muted-foreground mb-1 block">Ficha Técnica *</label><Select value={sheetId} onValueChange={setSheetId}><SelectTrigger><SelectValue placeholder="Selecionar ficha..." /></SelectTrigger><SelectContent>{allSheets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-muted-foreground mb-1 block">Quantidade</label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
            <div><label className="text-sm text-muted-foreground mb-1 block">Unidade</label><Input value={unit} onChange={e => setUnit(e.target.value)} /></div>
          </div>
          <div><label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1"><MessageSquare className="w-3 h-3" />Observações (opcional)</label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Servir gelado, porção extra..." /></div>
          <Button className="w-full" onClick={handleAdd} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Adicionar ao Cardápio</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dispatch Dialog ──────────────────────────────────────────────────────────
function DispatchDialog({ open, onClose, items, onConfirm, loading }: {
  open: boolean; onClose: () => void;
  items: DispatchItem[]; onConfirm: (items: DispatchItem[]) => void; loading: boolean;
}) {
  const [editItems, setEditItems] = useState<DispatchItem[]>([]);
  useEffect(() => { setEditItems(items.map(i => ({ ...i }))); }, [items]);

  const updateQty = (idx: number, val: number) => setEditItems(prev => prev.map((it, i) => i !== idx ? it : { ...it, actual: val }));
  const insufficientItems = editItems.filter(i => i.actual > i.inStock);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-primary" />Saída para o Evento</DialogTitle>
          <DialogDescription>Confirme as quantidades que serão retiradas do estoque. Ajuste se necessário.</DialogDescription>
        </DialogHeader>

        {insufficientItems.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{insufficientItems.length} item(s) com estoque insuficiente</p>
              <p className="text-xs text-muted-foreground mt-0.5">A saída será registrada mesmo assim — a equipe deve verificar fisicamente.</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground sticky top-0 bg-white">
                <th className="text-left py-2 px-3">Insumo</th>
                <th className="text-right py-2 px-3">Calculado</th>
                <th className="text-right py-2 px-3">Em estoque</th>
                <th className="text-right py-2 px-3 w-32">Qtd saída</th>
                <th className="text-center py-2 px-3 w-16">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {editItems.map((item, idx) => {
                const isInsufficient = item.actual > item.inStock;
                return (
                  <tr key={item.item_id} className={isInsufficient ? 'bg-warning/5' : ''}>
                    <td className="py-2 px-3 text-foreground">{item.item_name} <span className="text-muted-foreground text-xs">({item.unit})</span></td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{item.planned.toFixed(3)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{item.inStock}</td>
                    <td className="py-2 px-3 text-right">
                      <Input
                        type="number" step="any"
                        value={item.actual || ''}
                        onChange={e => updateQty(idx, parseFloat(e.target.value) || 0)}
                        className={`h-7 w-24 text-xs text-right ml-auto ${isInsufficient ? 'border-warning text-warning' : ''}`}
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isInsufficient
                        ? <AlertTriangle className="w-4 h-4 text-warning mx-auto" />
                        : <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => onConfirm(editItems)} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
            Confirmar Saída ({editItems.length} itens)
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
          <div><span className="text-muted-foreground">Total saiu: </span><span className="font-semibold">{totalDispatched.toFixed(2)}</span></div>
          <div className="w-px h-4 bg-border" />
          <div><span className="text-muted-foreground">Retornando: </span><span className="font-semibold text-success">{totalReturned.toFixed(2)}</span></div>
          <div className="w-px h-4 bg-border" />
          <div><span className="text-muted-foreground">Consumo real: </span><span className="font-semibold text-primary">{(totalDispatched - totalReturned).toFixed(2)}</span></div>
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
                  <td className="py-2 px-3 text-right text-muted-foreground">{item.dispatched.toFixed(3)}</td>
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
                    {(item.dispatched - item.returned).toFixed(3)}
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
              {recipeItems.map(si => (<tr key={si.item_id}><td className="py-2 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td><td className="py-2 text-right text-muted-foreground">{si.quantity}</td><td className="py-2 text-right font-medium text-foreground">{(si.quantity * scale).toFixed(3)}</td><td className="py-2 text-right text-muted-foreground text-xs">R$ {(si.quantity * scale * si.unit_cost).toFixed(2)}</td></tr>))}
            </tbody>
            <tfoot><tr className="border-t border-border"><td colSpan={3} className="pt-2 text-right text-xs font-semibold text-muted-foreground">Total receita:</td><td className="pt-2 text-right text-sm font-bold text-primary">R$ {recipeItems.reduce((s, i) => s + i.quantity * scale * i.unit_cost, 0).toFixed(2)}</td></tr></tfoot>
          </table>
        </div>
      )}
      {decoItems.length > 0 && (
        <div className="p-5 border-t border-dashed border-amber-200" style={{ background: 'hsl(38 80% 98%)' }}>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">🎨 Decoração</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-amber-200 text-xs text-muted-foreground"><th className="text-left pb-2">Item</th><th className="text-right pb-2">Na receita</th><th className="text-right pb-2">Para {dish.planned_quantity} {dish.planned_unit}</th><th className="text-right pb-2">Custo</th></tr></thead>
            <tbody className="divide-y divide-amber-100">
              {decoItems.map(si => (<tr key={si.item_id} style={{ background: 'hsl(38 80% 99%)' }}><td className="py-2 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td><td className="py-2 text-right text-muted-foreground">{si.quantity}</td><td className="py-2 text-right font-medium text-foreground">{(si.quantity * scale).toFixed(3)}</td><td className="py-2 text-right text-muted-foreground text-xs">R$ {(si.quantity * scale * si.unit_cost).toFixed(2)}</td></tr>))}
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pratos' | 'compras' | 'saida'>('pratos');
  const [shopFilter, setShopFilter] = useState<'all' | 'ok' | 'buy'>('all');
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  // Dispatch / Return
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [movementLoading, setMovementLoading] = useState(false);

  useEffect(() => { if (!id) return; loadMenu(); }, [id]);

  const loadMenu = async () => {
    setLoading(true);
    const [menuRes, itemsRes, sheetsRes] = await Promise.all([
      supabase.from('event_menus').select('*').eq('id', id!).single(),
      supabase.from('stock_items').select('id, name, unit, unit_cost, current_stock').order('name'),
      supabase.from('technical_sheets').select('*').order('name'),
    ]);
    if (!menuRes.data) { navigate('/event-menus'); return; }
    const stockData = (itemsRes.data || []) as unknown as StockItem[];
    setStockItems(stockData);

    if (sheetsRes.data) {
      const loaded = await Promise.all((sheetsRes.data as any[]).map(async s => {
        const { data: si } = await supabase.from('technical_sheet_items').select('id, item_id, quantity, unit_cost, section').eq('sheet_id', s.id);
        const items: SheetItem[] = (si || []).map((i: any) => { const item = stockData.find(x => x.id === i.item_id); return { id: i.id, item_id: i.item_id, item_name: item?.name || '?', quantity: i.quantity, unit: item?.unit || '', unit_cost: i.unit_cost || item?.unit_cost || 0, section: i.section || 'receita' }; });
        return { ...s, items } as Sheet;
      }));
      setAllSheets(loaded);
    }

    const { data: dishes } = await supabase.from('event_menu_dishes').select('*').eq('menu_id', id!).order('sort_order');
    const enrichedDishes: MenuDish[] = await Promise.all((dishes || []).map(async (d: any) => {
      const sheet = (sheetsRes.data as any[])?.find(s => s.id === d.sheet_id);
      if (!sheet) return { id: d.id, sheet_id: d.sheet_id, sheet_name: '?', planned_quantity: d.planned_quantity, planned_unit: d.planned_unit || 'un', notes: d.notes || null, sheet: null, expanded: false, isMantimentos: d.sheet_id === MANTIMENTOS_ID };
      const { data: si } = await supabase.from('technical_sheet_items').select('id, item_id, quantity, unit_cost, section').eq('sheet_id', d.sheet_id);
      const items: SheetItem[] = (si || []).map((i: any) => { const item = stockData.find(x => x.id === i.item_id); return { id: i.id, item_id: i.item_id, item_name: item?.name || '?', quantity: i.quantity, unit: item?.unit || '', unit_cost: i.unit_cost || item?.unit_cost || 0, section: i.section || 'receita' }; });
      return { id: d.id, sheet_id: d.sheet_id, sheet_name: sheet.name, planned_quantity: d.planned_quantity, planned_unit: d.planned_unit || 'un', notes: d.notes || null, sheet: { ...sheet, items }, expanded: false, isMantimentos: d.sheet_id === MANTIMENTOS_ID };
    }));

    const loadedMenu: EventMenu = { ...(menuRes.data as any), dishes: enrichedDishes };
    setMenu(loadedMenu);
    buildShoppingList(enrichedDishes, stockData);
    setLoading(false);
  };

  const buildShoppingList = (dishes: MenuDish[], stock: StockItem[]) => {
    const map: Record<string, ShoppingItem> = {};
    dishes.forEach(dish => {
      if (!dish.sheet) return;
      const scale = dish.planned_quantity / (dish.sheet.yield_quantity || 1);
      dish.sheet.items.forEach(si => {
        const needed = si.quantity * scale;
        if (!map[si.item_id]) { const s = stock.find(x => x.id === si.item_id); map[si.item_id] = { id: si.item_id, name: si.item_name, unit: si.unit, needed: 0, inStock: s?.current_stock || 0, toBuy: 0, unitCost: si.unit_cost, hasStock: true }; }
        map[si.item_id].needed += needed;
      });
    });
    const list = Object.values(map).map(i => ({ ...i, toBuy: Math.max(0, i.needed - i.inStock), hasStock: i.inStock >= i.needed })).sort((a, b) => a.name.localeCompare(b.name));
    setShoppingList(list);
  };

  // Build dispatch items from shopping list
  const prepareDispatch = () => {
    const items: DispatchItem[] = shoppingList.map(i => ({
      item_id: i.id, item_name: i.name, unit: i.unit,
      planned: i.needed, actual: i.needed,
      inStock: i.inStock, hasEnough: i.inStock >= i.needed,
    }));
    setDispatchItems(items);
    setDispatchOpen(true);
  };

  const prepareReturn = async () => {
    // Load what was dispatched
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

  const confirmDispatch = async (items: DispatchItem[]) => {
    setMovementLoading(true);
    try {
      // Insert movements
      await supabase.from('event_stock_movements').insert(
        items.map(i => ({ menu_id: id, item_id: i.item_id, movement_type: 'dispatch', planned_quantity: i.planned, actual_quantity: i.actual, created_by: profile?.display_name || 'Sistema' })) as any
      );
      // Deduct from stock
      for (const item of items) {
        const stock = stockItems.find(s => s.id === item.item_id);
        if (stock) {
          const newQty = Math.max(0, stock.current_stock - item.actual);
          await supabase.from('stock_items').update({ current_stock: newQty } as any).eq('id', item.item_id);
        }
      }
      // Update menu status
      await supabase.from('event_menus').update({ status: 'dispatched', dispatched_at: new Date().toISOString(), dispatched_by: profile?.display_name || 'Sistema' } as any).eq('id', id!);
      toast.success(`Saída confirmada! ${items.length} itens descontados do estoque.`);
      setDispatchOpen(false);
      loadMenu();
    } catch (err) {
      toast.error('Erro ao confirmar saída');
      console.error(err);
    } finally {
      setMovementLoading(false);
    }
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
    if (items.length > 0) await supabase.from('technical_sheet_items').insert(items.map(i => ({ sheet_id: dish.sheet_id, item_id: i.item_id, quantity: i.quantity, unit_cost: i.unit_cost, section: i.section || 'receita' })) as any);
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
  const totalToBuy = shoppingList.reduce((s, i) => s + i.toBuy * i.unitCost, 0);
  const itemsToBuy = shoppingList.filter(i => i.toBuy > 0).length;
  const itemsOk = shoppingList.filter(i => i.toBuy === 0).length;
  const insufficientCount = shoppingList.filter(i => !i.hasStock).length;
  const filteredShoppingList = shopFilter === 'ok' ? shoppingList.filter(i => i.toBuy === 0) : shopFilter === 'buy' ? shoppingList.filter(i => i.toBuy > 0) : shoppingList;

  const statusColor = { draft: 'secondary', dispatched: 'default', completed: 'default' }[menu.status] || 'secondary';
  const statusLabel = { draft: 'Rascunho', dispatched: 'Saída Confirmada', completed: 'Concluído' }[menu.status] || menu.status;
  const canDispatch = menu.status === 'draft';
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
              {menu.dispatched_at && ` · Saída: ${new Date(menu.dispatched_at).toLocaleDateString('pt-BR')} por ${menu.dispatched_by}`}
              {menu.returned_at && ` · Retorno: ${new Date(menu.returned_at).toLocaleDateString('pt-BR')} por ${menu.returned_by}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={statusColor as any} className="text-xs">
              {menu.status === 'dispatched' && <Truck className="w-3 h-3 mr-1" />}
              {menu.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {statusLabel}
            </Badge>
            {/* Action buttons */}
            <div className="flex gap-2">
              {canDispatch && (
                <Button size="sm" onClick={prepareDispatch} className="gap-1.5">
                  <Truck className="w-4 h-4" />Dar Saída do Estoque
                </Button>
              )}
              {canReturn && (
                <Button size="sm" onClick={prepareReturn} className="gap-1.5 bg-success hover:bg-success/90">
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

        {/* Insufficient stock warning */}
        {insufficientCount > 0 && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-warning/10 border border-warning/30 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
            <span><strong>{insufficientCount} insumo(s)</strong> com estoque insuficiente — compre antes de dar saída.</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-border p-1 w-fit">
        {([['pratos', `Fichas (${regularDishes.length})`, null], ['compras', 'Lista de Compras', itemsToBuy > 0 ? itemsToBuy : null], ['saida', 'Saída / Retorno', null]] as const).map(([tab, label, badge]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === tab ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
            {badge && <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${activeTab === tab ? 'bg-white/20' : 'bg-destructive text-white'}`}>{badge}</span>}
          </button>
        ))}
      </div>

      {/* ── FICHAS TÉCNICAS ── */}
      {activeTab === 'pratos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setAddSheetOpen(true)}><Plus className="w-4 h-4 mr-1" />Adicionar ficha ao cardápio</Button>
          </div>

          {/* MANTIMENTOS */}
          {mantimentosDish && (
            <div className="rounded-xl border-2 border-primary/20 bg-primary/3 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">MANTIMENTOS</p>
                      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Fixo do evento</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{mantimentosDish.planned_quantity} {mantimentosDish.planned_unit} · {mantimentosDish.sheet?.items.length || 0} ingredientes</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => toggleExpand(mantimentosDish.id)}>{mantimentosDish.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setEditingDishId(editingDishId === mantimentosDish.id ? null : mantimentosDish.id)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => handleRemoveDish(mantimentosDish.id)}><X className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              {editingDishId === mantimentosDish.id && <div className="px-5 pb-4"><DishEditPanel dish={mantimentosDish} stockItems={stockItems} onSave={(items, qty, unit, notes) => handleSaveDish(mantimentosDish.id, items, qty, unit, notes)} onCancel={() => setEditingDishId(null)} /></div>}
              {mantimentosDish.expanded && mantimentosDish.sheet && editingDishId !== mantimentosDish.id && <DishExpandedView dish={mantimentosDish} />}
            </div>
          )}

          {/* Regular dishes */}
          {regularDishes.map(dish => (
            <div key={dish.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => toggleExpand(dish.id)}>
                  {dish.expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{dish.sheet_name}</p>
                      {dish.notes && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 gap-1"><MessageSquare className="w-2.5 h-2.5" />obs</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{dish.planned_quantity} {dish.planned_unit}{dish.sheet ? ` · ${dish.sheet.items.length} ingredientes` : ''}</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setEditingDishId(editingDishId === dish.id ? null : dish.id)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleDuplicateDish(dish)}><Plus className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => handleRemoveDish(dish.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              {editingDishId === dish.id && <div className="px-5 pb-4"><DishEditPanel dish={dish} stockItems={stockItems} onSave={(items, qty, unit, notes) => handleSaveDish(dish.id, items, qty, unit, notes)} onCancel={() => setEditingDishId(null)} /></div>}
              {dish.expanded && dish.sheet && editingDishId !== dish.id && <DishExpandedView dish={dish} />}
            </div>
          ))}
        </div>
      )}

      {/* ── LISTA DE COMPRAS ── */}
      {activeTab === 'compras' && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-destructive" /><span className="font-semibold text-destructive">{itemsToBuy}</span><span className="text-muted-foreground">a comprar</span></div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /><span className="font-semibold text-success">{itemsOk}</span><span className="text-muted-foreground">em estoque</span></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-border/40 rounded-lg p-0.5">
                {([['all', 'Todos'], ['ok', '✓ Em estoque'], ['buy', '⬇ A comprar']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setShopFilter(v)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${shopFilter === v ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
                ))}
              </div>
              <div className="text-right"><p className="text-xs text-muted-foreground">Custo compra</p><p className="font-bold text-sm">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}><th className="text-left px-5 py-3 font-semibold text-muted-foreground">INSUMO</th><th className="text-right px-4 py-3 font-semibold text-muted-foreground">NECESSÁRIO</th><th className="text-right px-4 py-3 font-semibold text-muted-foreground">EM ESTOQUE</th><th className="text-right px-4 py-3 font-semibold text-muted-foreground">A COMPRAR</th><th className="text-right px-5 py-3 font-semibold text-muted-foreground">CUSTO EST.</th></tr></thead>
            <tbody className="divide-y divide-border/50">
              {filteredShoppingList.map(item => (
                <tr key={item.id} className={item.toBuy > 0 ? 'bg-red-50/30' : ''}>
                  <td className="px-5 py-3"><div className="flex items-center gap-2">{item.toBuy > 0 ? <TrendingDown className="w-3.5 h-3.5 text-destructive flex-shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />}<span className={item.toBuy > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>{item.name}</span></div></td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{item.needed.toFixed(2)} {item.unit}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{item.inStock} {item.unit}</td>
                  <td className="px-4 py-3 text-right font-semibold">{item.toBuy > 0 ? <span className="text-destructive">{item.toBuy.toFixed(2)} {item.unit}</span> : <span className="text-success text-xs">✓ ok</span>}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{item.toBuy > 0 ? `R$ ${(item.toBuy * item.unitCost).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
              {filteredShoppingList.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhum item neste filtro</td></tr>}
            </tbody>
            <tfoot><tr className="border-t-2 border-border" style={{ background: 'hsl(40 30% 97%)' }}><td colSpan={4} className="px-5 py-3 text-right font-semibold text-foreground">Total estimado para comprar:</td><td className="px-5 py-3 text-right font-bold text-lg gold-text">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr></tfoot>
          </table>
        </div>
      )}

      {/* ── SAÍDA / RETORNO ── */}
      {activeTab === 'saida' && (
        <div className="space-y-4">
          {/* Status timeline */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Status do Evento</p>
            <div className="flex items-center gap-0">
              {[
                { key: 'draft', label: 'Cardápio criado', icon: ClipboardList, done: true },
                { key: 'dispatched', label: 'Saída do estoque', icon: Truck, done: menu.status === 'dispatched' || menu.status === 'completed' },
                { key: 'completed', label: 'Retorno confirmado', icon: RotateCcw, done: menu.status === 'completed' },
              ].map(({ key, label, icon: Icon, done }, i) => (
                <div key={key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${done ? 'bg-success border-success' : 'bg-white border-border'}`}>
                      <Icon className={`w-4 h-4 ${done ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <p className="text-xs text-center text-muted-foreground whitespace-nowrap">{label}</p>
                    {key === 'dispatched' && menu.dispatched_at && <p className="text-[10px] text-muted-foreground opacity-70">{new Date(menu.dispatched_at).toLocaleDateString('pt-BR')}</p>}
                    {key === 'completed' && menu.returned_at && <p className="text-[10px] text-muted-foreground opacity-70">{new Date(menu.returned_at).toLocaleDateString('pt-BR')}</p>}
                  </div>
                  {i < 2 && <div className={`flex-1 h-0.5 mx-2 mb-5 ${done ? 'bg-success' : 'bg-border'}`} />}
                </div>
              ))}
            </div>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`bg-white rounded-xl border shadow-sm p-5 ${canDispatch ? 'border-primary/30' : 'border-border opacity-60'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Truck className={`w-5 h-5 ${canDispatch ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="font-semibold text-foreground">Saída para o Evento</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Desconta os insumos do estoque físico. A equipe confirma as quantidades antes de efetivar.</p>
              <div className="text-xs text-muted-foreground mb-4 space-y-1">
                <p>• {shoppingList.length} insumos calculados</p>
                <p>• {insufficientCount > 0 ? <span className="text-warning font-medium">{insufficientCount} itens com estoque insuficiente</span> : <span className="text-success">Todos os itens disponíveis</span>}</p>
              </div>
              <Button className="w-full" disabled={!canDispatch} onClick={prepareDispatch}>
                <Truck className="w-4 h-4 mr-2" />{canDispatch ? 'Iniciar Saída' : menu.status === 'dispatched' ? 'Saída já realizada' : 'Evento concluído'}
              </Button>
            </div>

            <div className={`bg-white rounded-xl border shadow-sm p-5 ${canReturn ? 'border-success/30' : 'border-border opacity-60'}`}>
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw className={`w-5 h-5 ${canReturn ? 'text-success' : 'text-muted-foreground'}`} />
                <p className="font-semibold text-foreground">Retorno de Sobras</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Devolve ao estoque o que sobrou do evento. Calcula automaticamente o consumo real.</p>
              <div className="text-xs text-muted-foreground mb-4 space-y-1">
                {menu.dispatched_at
                  ? <p>• Saída realizada em {new Date(menu.dispatched_at).toLocaleDateString('pt-BR')} por {menu.dispatched_by}</p>
                  : <p>• Realize a saída primeiro</p>
                }
              </div>
              <Button className="w-full bg-success hover:bg-success/90" disabled={!canReturn} onClick={prepareReturn}>
                <RotateCcw className="w-4 h-4 mr-2" />{canReturn ? 'Registrar Sobras' : menu.status === 'completed' ? 'Retorno já registrado' : 'Aguardando saída'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddSheetDialog open={addSheetOpen} onClose={() => setAddSheetOpen(false)} menuId={id!} allSheets={allSheets} onAdded={() => loadMenu()} />
      <DispatchDialog open={dispatchOpen} onClose={() => setDispatchOpen(false)} items={dispatchItems} onConfirm={confirmDispatch} loading={movementLoading} />
      <ReturnDialog open={returnOpen} onClose={() => setReturnOpen(false)} items={returnItems} onConfirm={confirmReturn} loading={movementLoading} />
    </div>
  );
}
