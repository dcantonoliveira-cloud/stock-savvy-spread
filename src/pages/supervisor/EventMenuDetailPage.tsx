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
import {
  ArrowLeft, Calendar, MapPin, Users, ShoppingCart,
  ChevronDown, ChevronUp, CheckCircle2, TrendingDown, Loader2,
  Plus, Pencil, Trash2, X, Check, ChevronsUpDown, PackagePlus,
  Package, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MANTIMENTOS_ID = '3fc5dd78-8578-4c45-9c01-6ba8a2123e7a';

type StockItem = { id: string; name: string; unit: string; unit_cost: number; current_stock: number };
type SheetItem = { id?: string; item_id: string; item_name: string; quantity: number; unit: string; unit_cost: number; section: 'receita' | 'decoracao' };
type Sheet = { id: string; name: string; yield_quantity: number; yield_unit: string; items: SheetItem[] };
type MenuDish = { id: string; sheet_id: string; sheet_name: string; planned_quantity: number; planned_unit: string; sheet: Sheet | null; expanded: boolean; isMantimentos: boolean };
type EventMenu = { id: string; name: string; location: string | null; guest_count: number; staff_count: number; event_date: string | null; status: string; notes: string | null; created_at: string; dishes: MenuDish[] };
type ShoppingItem = { id: string; name: string; unit: string; needed: number; inStock: number; toBuy: number; unitCost: number };

// ─── Item Combobox ────────────────────────────────────────────────────────────
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
  onSave: (items: SheetItem[], plannedQty: number, plannedUnit: string) => void;
  onCancel: () => void;
}) {
  const [formItems, setFormItems] = useState<SheetItem[]>(dish.sheet?.items.map(i => ({ ...i })) || []);
  const [plannedQty, setPlannedQty] = useState(dish.planned_quantity.toString());
  const [plannedUnit, setPlannedUnit] = useState(dish.planned_unit);
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
        <div className="flex items-center gap-3">
          <div><label className="text-xs text-muted-foreground mb-1 block">Quantidade planejada</label><Input type="number" value={plannedQty} onChange={e => setPlannedQty(e.target.value)} className="h-8 w-24 text-xs" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Unidade</label><Input value={plannedUnit} onChange={e => setPlannedUnit(e.target.value)} className="h-8 w-16 text-xs" /></div>
        </div>

        {/* Receita */}
        <div>
          <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Receita Principal</p><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addItem('receita')}><Plus className="w-3 h-3 mr-1" />Add</Button></div>
          {recipeItems.map((item) => { const idx = formItems.indexOf(item); return (<div key={idx} className="grid grid-cols-[1fr_80px_50px_28px] gap-1 items-center mb-1"><ItemCombobox stockItems={localStock} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => setQuickCreateOpen(true)} /><Input type="number" step="any" className="h-8 text-xs" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} /><span className="text-xs text-muted-foreground text-center">{item.unit}</span><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button></div>); })}
        </div>

        {/* Decoração */}
        <div className="border-t border-dashed border-amber-200 pt-3">
          <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">🎨 Decoração</p><Button variant="outline" size="sm" className="h-7 text-xs border-amber-200 text-amber-700" onClick={() => addItem('decoracao')}><Plus className="w-3 h-3 mr-1" />Add</Button></div>
          {decoItems.map((item) => { const idx = formItems.indexOf(item); return (<div key={idx} className="grid grid-cols-[1fr_80px_50px_28px] gap-1 items-center mb-1" style={{ background: 'hsl(38 80% 99%)' }}><ItemCombobox stockItems={localStock} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => setQuickCreateOpen(true)} /><Input type="number" step="any" className="h-8 text-xs" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} /><span className="text-xs text-muted-foreground text-center">{item.unit}</span><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button></div>); })}
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => onSave(formItems.filter(i => i.item_id), parseFloat(plannedQty) || 0, plannedUnit)}><Check className="w-3.5 h-3.5 mr-1" />Salvar ficha</Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
      <QuickCreateItemDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} onCreated={item => setLocalStock(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))} />
    </>
  );
}

// ─── Add Sheet Dialog ─────────────────────────────────────────────────────────
function AddSheetDialog({ open, onClose, menuId, allSheets, guestCount, onAdded }: {
  open: boolean; onClose: () => void; menuId: string;
  allSheets: Sheet[]; guestCount: number;
  onAdded: (dish: MenuDish) => void;
}) {
  const [sheetId, setSheetId] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('un');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!sheetId) { toast.error('Selecione uma ficha técnica'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('event_menu_dishes').insert({
      menu_id: menuId, sheet_id: sheetId,
      planned_quantity: parseFloat(qty) || 1, planned_unit: unit, sort_order: 999,
    } as any).select().single();
    if (error || !data) { toast.error('Erro ao adicionar ficha'); setSaving(false); return; }
    const sheet = allSheets.find(s => s.id === sheetId);
    toast.success('Ficha adicionada!');
    onAdded({ id: (data as any).id, sheet_id: sheetId, sheet_name: sheet?.name || '?', planned_quantity: parseFloat(qty) || 1, planned_unit: unit, sheet: sheet || null, expanded: false, isMantimentos: sheetId === MANTIMENTOS_ID });
    setSheetId(''); setQty('1'); setSaving(false); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Adicionar Ficha ao Cardápio</DialogTitle><DialogDescription>Adicione manualmente uma ficha técnica a este evento</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Ficha Técnica *</label>
            <Select value={sheetId} onValueChange={setSheetId}>
              <SelectTrigger><SelectValue placeholder="Selecionar ficha..." /></SelectTrigger>
              <SelectContent>{allSheets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-muted-foreground mb-1 block">Quantidade</label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
            <div><label className="text-sm text-muted-foreground mb-1 block">Unidade</label><Input value={unit} onChange={e => setUnit(e.target.value)} /></div>
          </div>
          <Button className="w-full" onClick={handleAdd} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Adicionar ao Cardápio</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EventMenuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<EventMenu | null>(null);
  const [allSheets, setAllSheets] = useState<Sheet[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pratos' | 'compras'>('pratos');
  const [shopFilter, setShopFilter] = useState<'all' | 'ok' | 'buy'>('all');
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [savingDish, setSavingDish] = useState<string | null>(null);

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

    // Load all sheets with items
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
      if (!sheet) return { id: d.id, sheet_id: d.sheet_id, sheet_name: '?', planned_quantity: d.planned_quantity, planned_unit: d.planned_unit || 'un', sheet: null, expanded: false, isMantimentos: d.sheet_id === MANTIMENTOS_ID };
      const { data: si } = await supabase.from('technical_sheet_items').select('id, item_id, quantity, unit_cost, section').eq('sheet_id', d.sheet_id);
      const items: SheetItem[] = (si || []).map((i: any) => { const item = stockData.find(x => x.id === i.item_id); return { id: i.id, item_id: i.item_id, item_name: item?.name || '?', quantity: i.quantity, unit: item?.unit || '', unit_cost: i.unit_cost || item?.unit_cost || 0, section: i.section || 'receita' }; });
      return { id: d.id, sheet_id: d.sheet_id, sheet_name: sheet.name, planned_quantity: d.planned_quantity, planned_unit: d.planned_unit || 'un', sheet: { ...sheet, items }, expanded: false, isMantimentos: d.sheet_id === MANTIMENTOS_ID };
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
        if (!map[si.item_id]) { const s = stock.find(x => x.id === si.item_id); map[si.item_id] = { id: si.item_id, name: si.item_name, unit: si.unit, needed: 0, inStock: s?.current_stock || 0, toBuy: 0, unitCost: si.unit_cost }; }
        map[si.item_id].needed += needed;
      });
    });
    setShoppingList(Object.values(map).map(i => ({ ...i, toBuy: Math.max(0, i.needed - i.inStock) })).sort((a, b) => a.name.localeCompare(b.name)));
  };

  const toggleExpand = (dishId: string) => setMenu(prev => prev ? { ...prev, dishes: prev.dishes.map(d => d.id === dishId ? { ...d, expanded: !d.expanded } : d) } : prev);

  const handleSaveDish = async (dishId: string, items: SheetItem[], plannedQty: number, plannedUnit: string) => {
    const dish = menu?.dishes.find(d => d.id === dishId);
    if (!dish) return;
    setSavingDish(dishId);
    // Update planned quantity/unit
    await supabase.from('event_menu_dishes').update({ planned_quantity: plannedQty, planned_unit: plannedUnit } as any).eq('id', dishId);
    // Update sheet items
    await supabase.from('technical_sheet_items').delete().eq('sheet_id', dish.sheet_id);
    if (items.length > 0) await supabase.from('technical_sheet_items').insert(items.map(i => ({ sheet_id: dish.sheet_id, item_id: i.item_id, quantity: i.quantity, unit_cost: i.unit_cost, section: i.section || 'receita' })) as any);
    toast.success('Ficha atualizada!');
    setEditingDishId(null); setSavingDish(null);
    await loadMenu();
  };

  const handleRemoveDish = async (dishId: string) => {
    if (!confirm('Remover esta ficha do cardápio?')) return;
    await supabase.from('event_menu_dishes').delete().eq('id', dishId);
    setMenu(prev => prev ? { ...prev, dishes: prev.dishes.filter(d => d.id !== dishId) } : prev);
    toast.success('Ficha removida do cardápio!');
    await loadMenu();
  };

  const handleDuplicateDish = async (dish: MenuDish) => {
    if (!dish.sheet) return;
    const { data: newSheet, error } = await supabase.from('technical_sheets').insert({ name: `${dish.sheet_name} (cópia)`, yield_quantity: dish.sheet.yield_quantity, yield_unit: dish.sheet.yield_unit, servings: 1 } as any).select().single();
    if (error || !newSheet) { toast.error('Erro ao duplicar'); return; }
    if (dish.sheet.items.length > 0) await supabase.from('technical_sheet_items').insert(dish.sheet.items.map(i => ({ sheet_id: (newSheet as any).id, item_id: i.item_id, quantity: i.quantity, unit_cost: i.unit_cost, section: i.section || 'receita' })) as any);
    const { data: newDish } = await supabase.from('event_menu_dishes').insert({ menu_id: id, sheet_id: (newSheet as any).id, planned_quantity: dish.planned_quantity, planned_unit: dish.planned_unit, sort_order: 999 } as any).select().single();
    toast.success('Ficha duplicada e adicionada ao cardápio!');
    await loadMenu();
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!menu) return null;

  const regularDishes = menu.dishes.filter(d => !d.isMantimentos);
  const mantimentosDish = menu.dishes.find(d => d.isMantimentos);
  const totalToBuy = shoppingList.reduce((s, i) => s + i.toBuy * i.unitCost, 0);
  const itemsToBuy = shoppingList.filter(i => i.toBuy > 0).length;
  const itemsOk = shoppingList.filter(i => i.toBuy === 0).length;

  const filteredShoppingList = shopFilter === 'ok' ? shoppingList.filter(i => i.toBuy === 0)
    : shopFilter === 'buy' ? shoppingList.filter(i => i.toBuy > 0)
    : shoppingList;

  const generatedAt = new Date(menu.created_at);

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
              Gerado em {generatedAt.toLocaleDateString('pt-BR')} às {generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <Badge variant={menu.status === 'draft' ? 'secondary' : 'default'} className="text-xs">{menu.status === 'draft' ? 'Rascunho' : menu.status}</Badge>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          <div className="text-center"><p className="text-2xl font-bold text-foreground">{regularDishes.length}</p><p className="text-xs text-muted-foreground mt-0.5">pratos</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-foreground">{shoppingList.length}</p><p className="text-xs text-muted-foreground mt-0.5">insumos</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-destructive">{itemsToBuy}</p><p className="text-xs text-muted-foreground mt-0.5">a comprar</p></div>
          <div className="text-center"><p className="text-2xl font-bold gold-text">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground mt-0.5">custo compra</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-border p-1 w-fit">
        <button onClick={() => setActiveTab('pratos')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pratos' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          Fichas Técnicas ({regularDishes.length})
        </button>
        <button onClick={() => setActiveTab('compras')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === 'compras' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          <ShoppingCart className="w-3.5 h-3.5" />Lista de Compras
          {itemsToBuy > 0 && <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${activeTab === 'compras' ? 'bg-white/20' : 'bg-destructive text-white'}`}>{itemsToBuy}</span>}
        </button>
      </div>

      {/* ── FICHAS TÉCNICAS ── */}
      {activeTab === 'pratos' && (
        <div className="space-y-3">
          {/* Add sheet button */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setAddSheetOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />Adicionar ficha ao cardápio
            </Button>
          </div>

          {/* MANTIMENTOS — separado */}
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
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => toggleExpand(mantimentosDish.id)}>
                    {mantimentosDish.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setEditingDishId(editingDishId === mantimentosDish.id ? null : mantimentosDish.id)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => handleRemoveDish(mantimentosDish.id)} title="Remover MANTIMENTOS deste cardápio">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {editingDishId === mantimentosDish.id && <div className="px-5 pb-4"><DishEditPanel dish={mantimentosDish} stockItems={stockItems} onSave={(items, qty, unit) => handleSaveDish(mantimentosDish.id, items, qty, unit)} onCancel={() => setEditingDishId(null)} /></div>}
              {mantimentosDish.expanded && mantimentosDish.sheet && editingDishId !== mantimentosDish.id && (
                <DishExpandedView dish={mantimentosDish} />
              )}
            </div>
          )}

          {/* Regular dishes */}
          {regularDishes.map(dish => (
            <div key={dish.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => toggleExpand(dish.id)}>
                  {dish.expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-foreground">{dish.sheet_name}</p>
                    <p className="text-xs text-muted-foreground">{dish.planned_quantity} {dish.planned_unit}{dish.sheet ? ` · ${dish.sheet.items.length} ingredientes` : ''}</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="w-8 h-8" title="Editar ficha" onClick={() => setEditingDishId(editingDishId === dish.id ? null : dish.id)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8" title="Duplicar ficha" onClick={() => handleDuplicateDish(dish)}><Plus className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" title="Remover do cardápio" onClick={() => handleRemoveDish(dish.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              {editingDishId === dish.id && <div className="px-5 pb-4"><DishEditPanel dish={dish} stockItems={stockItems} onSave={(items, qty, unit) => handleSaveDish(dish.id, items, qty, unit)} onCancel={() => setEditingDishId(null)} /></div>}
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
              {/* Filter buttons */}
              <div className="flex gap-1 bg-border/40 rounded-lg p-0.5">
                {([['all', 'Todos'], ['ok', '✓ Em estoque'], ['buy', '⬇ A comprar']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setShopFilter(v)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${shopFilter === v ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
                ))}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Custo compra</p>
                <p className="font-bold text-sm text-foreground">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">INSUMO</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">NECESSÁRIO</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">EM ESTOQUE</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">A COMPRAR</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">CUSTO EST.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredShoppingList.map(item => (
                <tr key={item.id} className={item.toBuy > 0 ? 'bg-red-50/30' : ''}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {item.toBuy > 0 ? <TrendingDown className="w-3.5 h-3.5 text-destructive flex-shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                      <span className={item.toBuy > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{item.needed.toFixed(2)} {item.unit}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{item.inStock} {item.unit}</td>
                  <td className="px-4 py-3 text-right font-semibold">{item.toBuy > 0 ? <span className="text-destructive">{item.toBuy.toFixed(2)} {item.unit}</span> : <span className="text-success text-xs">✓ ok</span>}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{item.toBuy > 0 ? `R$ ${(item.toBuy * item.unitCost).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
              {filteredShoppingList.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhum item neste filtro</td></tr>}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                <td colSpan={4} className="px-5 py-3 text-right font-semibold text-foreground">Total estimado para comprar:</td>
                <td className="px-5 py-3 text-right font-bold text-lg gold-text">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <AddSheetDialog
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        menuId={id!}
        allSheets={allSheets}
        guestCount={menu.guest_count}
        onAdded={(dish) => { setMenu(prev => prev ? { ...prev, dishes: [...prev.dishes, dish] } : prev); loadMenu(); }}
      />
    </div>
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
      {recipeItems.length > 0 && (
        <div className="p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Receita Principal</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="text-left pb-2">Insumo</th><th className="text-right pb-2">Na receita</th><th className="text-right pb-2">Para {dish.planned_quantity} {dish.planned_unit}</th><th className="text-right pb-2">Custo</th></tr></thead>
            <tbody className="divide-y divide-border/40">
              {recipeItems.map(si => (
                <tr key={si.item_id}>
                  <td className="py-2 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td>
                  <td className="py-2 text-right text-muted-foreground">{si.quantity}</td>
                  <td className="py-2 text-right font-medium text-foreground">{(si.quantity * scale).toFixed(3)}</td>
                  <td className="py-2 text-right text-muted-foreground text-xs">R$ {(si.quantity * scale * si.unit_cost).toFixed(2)}</td>
                </tr>
              ))}
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
              {decoItems.map(si => (
                <tr key={si.item_id}>
                  <td className="py-2 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td>
                  <td className="py-2 text-right text-muted-foreground">{si.quantity}</td>
                  <td className="py-2 text-right font-medium text-foreground">{(si.quantity * scale).toFixed(3)}</td>
                  <td className="py-2 text-right text-muted-foreground text-xs">R$ {(si.quantity * scale * si.unit_cost).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
