import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fmtNum, fmtCur } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Package, TrendingUp, TrendingDown, ClipboardList, CalendarDays,
  Search, ChevronDown, Check, LogOut, AlertTriangle, Users,
  ChefHat, Loader2, CheckCircle2, ArrowLeftRight, History, Plus, ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type StockItem = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
};
type EventMenu = {
  id: string; name: string; event_date: string | null;
  guest_count: number; status: string; location: string | null;
  dish_count: number;
};
type MenuDish = { sheet_name: string; planned_quantity: number; planned_unit: string; section_name: string | null };
type Kitchen = { id: string; name: string };
type InventoryCount = {
  id: string; date: string; status: string; counted_by: string | null;
  notes: string | null; created_at: string; completed_at: string | null;
};

type Tab = 'stock' | 'movement' | 'inventory' | 'menus';

// ─── Item Combobox ──────────────────────────────────────────────────────────
function ItemCombobox({ items, value, onChange }: { items: StockItem[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = items.find(i => i.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center justify-between h-11 px-3 rounded-xl border border-border bg-white text-sm">
          <span className={selected ? 'text-foreground font-medium' : 'text-muted-foreground'}>
            {selected ? selected.name : 'Selecionar insumo...'}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." className="h-10" />
          <CommandList className="max-h-60">
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>
              {items.map(item => (
                <CommandItem key={item.id} value={item.name} onSelect={() => { onChange(item.id); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === item.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex-1 min-w-0">
                    <span className="truncate">{item.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{item.unit}</span>
                  </div>
                  <span className={`text-xs font-medium ml-2 ${item.current_stock <= item.min_stock && item.min_stock > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {fmtNum(item.current_stock)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Mobile App ─────────────────────────────────────────────────────────
export default function MobileSupervisorApp() {
  const [tab, setTab] = useState<Tab>('stock');
  const [items, setItems] = useState<StockItem[]>([]);
  const [menus, setMenus] = useState<EventMenu[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, menusRes, kitchensRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, category, unit, current_stock, min_stock, unit_cost').order('name'),
      supabase.from('event_menus').select('id, name, event_date, guest_count, status, location').order('event_date', { ascending: false }),
      supabase.from('kitchens').select('id, name').order('name'),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as StockItem[]);
    if (kitchensRes.data) setKitchens(kitchensRes.data as Kitchen[]);
    if (menusRes.data) {
      const menusWithCount = await Promise.all((menusRes.data as any[]).map(async m => {
        const { count } = await supabase.from('event_menu_dishes').select('*', { count: 'exact', head: true }).eq('menu_id', m.id);
        return { ...m, dish_count: (count || 0) - 1 };
      }));
      setMenus(menusWithCount);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const tabs = [
    { id: 'stock' as Tab, label: 'Estoque', icon: Package },
    { id: 'movement' as Tab, label: 'Movimentação', icon: TrendingUp },
    { id: 'inventory' as Tab, label: 'Inventário', icon: ClipboardList },
    { id: 'menus' as Tab, label: 'Cardápios', icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1008] px-4 pt-safe-top pb-3 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-lg gold-text tracking-wide">RONDELLO</h1>
          <p className="text-[10px] text-amber-200/60 uppercase tracking-widest -mt-0.5">buffet</p>
        </div>
        <button onClick={handleSignOut} className="p-2 text-amber-200/60 hover:text-amber-200 transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {tab === 'stock' && <StockTab items={items} kitchens={kitchens} onDone={load} />}
            {tab === 'movement' && <MovementTab items={items} kitchens={kitchens} onDone={load} />}
            {tab === 'inventory' && <InventoryTab items={items} onDone={load} />}
            {tab === 'menus' && <MenusTab menus={menus} />}
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border pb-safe-bottom">
        <div className="grid grid-cols-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-0.5 py-3 transition-colors ${tab === id ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Estoque ─────────────────────────────────────────────────────────────
type StockView = 'items' | 'history';

function StockTab({ items, kitchens, onDone }: { items: StockItem[]; kitchens: Kitchen[]; onDone: () => void }) {
  const [stockView, setStockView] = useState<StockView>('items');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [detailItem, setDetailItem] = useState<StockItem | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const categories = [...new Set(items.map(i => i.category))].sort();
  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || i.category === filterCat;
    return matchSearch && matchCat;
  });
  const lowCount = items.filter(i => i.current_stock <= i.min_stock && i.min_stock > 0).length;

  if (stockView === 'history') {
    return <StockHistory onBack={() => setStockView('items')} />;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-foreground">Estoque</h2>
          {lowCount > 0 && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertTriangle className="w-3 h-3" />{lowCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTransferOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-medium text-foreground hover:bg-amber-50 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> Transferir
          </button>
          <button
            onClick={() => setStockView('history')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-medium text-foreground hover:bg-amber-50 transition-colors"
          >
            <History className="w-3.5 h-3.5" /> Histórico
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 h-11 bg-white rounded-xl"
          placeholder="Buscar item..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {['all', ...categories].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterCat === cat ? 'bg-foreground text-background border-foreground' : 'bg-white text-muted-foreground border-border'}`}
          >
            {cat === 'all' ? 'Todos' : cat}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Itens', value: filtered.length },
          { label: 'Valor', value: fmtCur(filtered.reduce((s, i) => s + i.current_stock * i.unit_cost, 0)) },
          { label: 'Baixo', value: filtered.filter(i => i.current_stock <= i.min_stock && i.min_stock > 0).length, danger: true },
        ].map(({ label, value, danger }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-base font-bold mt-0.5 ${danger && Number(value) > 0 ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Items list */}
      <div className="space-y-1">
        {filtered.map(item => {
          const isLow = item.current_stock <= item.min_stock && item.min_stock > 0;
          return (
            <button
              key={item.id}
              onClick={() => setDetailItem(item)}
              className="w-full bg-white rounded-xl border border-border p-3 flex items-center gap-3 text-left active:bg-amber-50 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLow ? 'bg-destructive' : 'bg-success'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${isLow ? 'text-destructive' : 'text-foreground'}`}>
                  {fmtNum(item.current_stock)}
                </p>
                <p className="text-[10px] text-muted-foreground">{item.unit}</p>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhum item encontrado</p>
        )}
      </div>

      {/* Item detail dialog */}
      <ItemDetailDialog item={detailItem} onClose={() => setDetailItem(null)} />

      {/* Transfer dialog */}
      <TransferDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        items={items}
        kitchens={kitchens}
        onDone={() => { setTransferOpen(false); onDone(); }}
      />
    </div>
  );
}

// ─── Stock History ────────────────────────────────────────────────────────────
type Movement = { type: 'entrada' | 'saida'; date: string; qty: number; ref: string | null; item_name: string; unit: string };

function StockHistory({ onBack }: { onBack: () => void }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [entries, outputs] = await Promise.all([
        supabase.from('stock_entries').select('created_at, quantity, supplier, stock_items(name, unit)').order('created_at', { ascending: false }).limit(30),
        supabase.from('stock_outputs').select('created_at, quantity, employee_name, event_name, stock_items(name, unit)').order('created_at', { ascending: false }).limit(30),
      ]);
      const movs: Movement[] = [
        ...((entries.data || []).map((e: any) => ({
          type: 'entrada' as const,
          date: e.created_at,
          qty: e.quantity,
          ref: e.supplier,
          item_name: e.stock_items?.name || '?',
          unit: e.stock_items?.unit || '',
        }))),
        ...((outputs.data || []).map((o: any) => ({
          type: 'saida' as const,
          date: o.created_at,
          qty: o.quantity,
          ref: o.employee_name || o.event_name,
          item_name: o.stock_items?.name || '?',
          unit: o.stock_items?.unit || '',
        }))),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 40);
      setMovements(movs);
      setLoading(false);
    };
    load();
  }, []);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-foreground">Histórico de Movimentações</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : movements.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma movimentação registrada</p>
      ) : (
        <div className="space-y-1.5">
          {movements.map((m, i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.type === 'entrada' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                {m.type === 'entrada'
                  ? <TrendingUp className="w-4 h-4 text-success" />
                  : <TrendingDown className="w-4 h-4 text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.item_name}</p>
                {m.ref && <p className="text-xs text-muted-foreground truncate">{m.ref}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${m.type === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                  {m.type === 'entrada' ? '+' : '-'}{m.qty} {m.unit}
                </p>
                <p className="text-[10px] text-muted-foreground">{fmtDate(m.date)} {fmtTime(m.date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Transfer Dialog ──────────────────────────────────────────────────────────
function TransferDialog({ open, onClose, items, kitchens, onDone }: {
  open: boolean; onClose: () => void;
  items: StockItem[]; kitchens: Kitchen[];
  onDone: () => void;
}) {
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [fromKitchen, setFromKitchen] = useState('');
  const [toKitchen, setToKitchen] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedItem = items.find(i => i.id === itemId);

  const handleSave = async () => {
    if (!itemId) { toast.error('Selecione um item'); return; }
    const quantity = parseFloat(qty);
    if (!quantity || quantity <= 0) { toast.error('Quantidade inválida'); return; }
    if (!toKitchen) { toast.error('Selecione o destino'); return; }
    if (selectedItem && quantity > selectedItem.current_stock) {
      toast.error(`Estoque insuficiente (disponível: ${selectedItem.current_stock} ${selectedItem.unit})`);
      return;
    }
    setSaving(true);
    const fromName = kitchens.find(k => k.id === fromKitchen)?.name || 'Estoque Central';
    const toName = kitchens.find(k => k.id === toKitchen)?.name || '?';
    await supabase.from('stock_outputs').insert({
      item_id: itemId,
      quantity,
      employee_name: `Transferência: ${fromName} → ${toName}`,
    } as any);
    await supabase.from('stock_items').update({ current_stock: (selectedItem?.current_stock || 0) - quantity } as any).eq('id', itemId);
    toast.success(`Transferência registrada: ${fromName} → ${toName}`);
    setItemId(''); setQty(''); setFromKitchen(''); setToKitchen('');
    setSaving(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" /> Transferência entre Centros de Custo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Item *</label>
            <ItemCombobox items={items} value={itemId} onChange={setItemId} />
            {selectedItem && (
              <p className="text-xs text-muted-foreground px-1">Estoque: <strong>{fmtNum(selectedItem.current_stock)} {selectedItem.unit}</strong></p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Quantidade *</label>
            <div className="flex gap-2">
              <Input
                type="number" inputMode="decimal" step="any"
                className="h-11 rounded-xl text-base flex-1"
                placeholder="0" value={qty} onChange={e => setQty(e.target.value)}
              />
              {selectedItem && (
                <div className="h-11 px-4 rounded-xl border border-border bg-muted/30 flex items-center text-sm text-muted-foreground flex-shrink-0">
                  {selectedItem.unit}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Origem</label>
              <Select value={fromKitchen} onValueChange={setFromKitchen}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Central" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Estoque Central</SelectItem>
                  {kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Destino *</label>
              <Select value={toKitchen} onValueChange={setToKitchen}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="w-full h-12 text-base font-semibold rounded-xl" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowLeftRight className="w-4 h-4 mr-2" />}
            Transferir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Item Detail Dialog ───────────────────────────────────────────────────────
function ItemDetailDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);

  useEffect(() => {
    if (!item) return;
    setLoadingMovs(true);
    Promise.all([
      supabase.from('stock_entries').select('id, created_at, quantity, supplier').eq('item_id', item.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('stock_outputs').select('id, created_at, quantity, employee_name, event_name').eq('item_id', item.id).order('created_at', { ascending: false }).limit(5),
    ]).then(([entries, outputs]) => {
      const movs = [
        ...((entries.data || []).map((e: any) => ({ type: 'entrada', date: e.created_at, qty: e.quantity, ref: e.supplier }))),
        ...((outputs.data || []).map((o: any) => ({ type: 'saida', date: o.created_at, qty: o.quantity, ref: o.employee_name || o.event_name }))),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
      setMovements(movs);
      setLoadingMovs(false);
    });
  }, [item]);

  if (!item) return null;
  const isLow = item.current_stock <= item.min_stock && item.min_stock > 0;

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="text-left">{item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Estoque', value: `${item.current_stock} ${item.unit}`, highlight: isLow },
              { label: 'Mínimo', value: `${item.min_stock} ${item.unit}`, highlight: false },
              { label: 'Custo', value: fmtCur(item.unit_cost), highlight: false },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`rounded-xl p-3 border ${highlight ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'}`}>
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className={`text-sm font-bold mt-0.5 ${highlight ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Últimas movimentações</p>
            {loadingMovs ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : movements.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma movimentação</p>
            ) : (
              <div className="space-y-1">
                {movements.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    {m.type === 'entrada'
                      ? <TrendingUp className="w-3.5 h-3.5 text-success flex-shrink-0" />
                      : <TrendingDown className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
                    <span className={`text-sm font-medium ${m.type === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                      {m.type === 'entrada' ? '+' : '-'}{m.qty}
                    </span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{m.ref || '—'}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {new Date(m.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab: Movimentação ────────────────────────────────────────────────────────
function MovementTab({ items, kitchens, onDone }: { items: StockItem[]; kitchens: Kitchen[]; onDone: () => void }) {
  const [type, setType] = useState<'entrada' | 'saida'>('entrada');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [ref, setRef] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedItem = items.find(i => i.id === itemId);

  const handleSave = async () => {
    if (!itemId) { toast.error('Selecione um item'); return; }
    const quantity = parseFloat(qty);
    if (!quantity || quantity <= 0) { toast.error('Quantidade inválida'); return; }
    setSaving(true);
    if (type === 'entrada') {
      await supabase.from('stock_entries').insert({
        item_id: itemId,
        quantity,
        unit_cost: selectedItem?.unit_cost || 0,
        supplier: ref.trim() || null,
      } as any);
      await supabase.from('stock_items').update({ current_stock: (selectedItem?.current_stock || 0) + quantity } as any).eq('id', itemId);
    } else {
      if (selectedItem && quantity > selectedItem.current_stock) {
        toast.error(`Estoque insuficiente (disponível: ${selectedItem.current_stock} ${selectedItem.unit})`);
        setSaving(false);
        return;
      }
      await supabase.from('stock_outputs').insert({
        item_id: itemId,
        quantity,
        employee_name: ref.trim() || null,
      } as any);
      await supabase.from('stock_items').update({ current_stock: (selectedItem?.current_stock || 0) - quantity } as any).eq('id', itemId);
    }
    toast.success(type === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!');
    setItemId(''); setQty(''); setRef('');
    setSaving(false);
    onDone();
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-foreground">Movimentação</h2>

      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2 bg-muted/30 rounded-xl p-1.5">
        {(['entrada', 'saida'] as const).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${type === t ? (t === 'entrada' ? 'bg-success text-white shadow-sm' : 'bg-destructive text-white shadow-sm') : 'text-muted-foreground'}`}
          >
            {t === 'entrada' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {t === 'entrada' ? 'Entrada' : 'Saída'}
          </button>
        ))}
      </div>

      {/* Item */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Item *</label>
        <ItemCombobox items={items} value={itemId} onChange={setItemId} />
        {selectedItem && (
          <p className={`text-xs px-1 ${selectedItem.current_stock <= selectedItem.min_stock && selectedItem.min_stock > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            Estoque atual: <strong>{fmtNum(selectedItem.current_stock)} {selectedItem.unit}</strong>
            {selectedItem.current_stock <= selectedItem.min_stock && selectedItem.min_stock > 0 && ' ⚠ Abaixo do mínimo'}
          </p>
        )}
      </div>

      {/* Quantity */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Quantidade *</label>
        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            className="h-11 rounded-xl text-base flex-1"
            placeholder="0"
            value={qty}
            onChange={e => setQty(e.target.value)}
          />
          {selectedItem && (
            <div className="h-11 px-4 rounded-xl border border-border bg-muted/30 flex items-center text-sm text-muted-foreground flex-shrink-0">
              {selectedItem.unit}
            </div>
          )}
        </div>
      </div>

      {/* Reference */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {type === 'entrada' ? 'Fornecedor' : 'Responsável / Evento'}
          <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
        </label>
        <Input
          className="h-11 rounded-xl text-base"
          placeholder={type === 'entrada' ? 'Ex: Fornecedor ABC' : 'Ex: Maria / Casamento Silva'}
          value={ref}
          onChange={e => setRef(e.target.value)}
        />
      </div>

      <Button
        className={`w-full h-12 text-base font-semibold rounded-xl ${type === 'saida' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
        {type === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}
      </Button>
    </div>
  );
}

// ─── Tab: Inventário ──────────────────────────────────────────────────────────
type InvView = 'list' | 'counting';

function InventoryTab({ items, onDone }: { items: StockItem[]; onDone: () => void }) {
  const [invView, setInvView] = useState<InvView>('list');
  const [history, setHistory] = useState<InventoryCount[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [activeCountId, setActiveCountId] = useState<string | null>(null);

  const loadHistory = async () => {
    setHistLoading(true);
    const { data } = await supabase.from('inventory_counts' as any)
      .select('id, date, status, counted_by, notes, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setHistory(data as InventoryCount[]);
    setHistLoading(false);
  };

  useEffect(() => { loadHistory(); }, []);

  const startNew = async () => {
    const { data, error } = await supabase.from('inventory_counts' as any)
      .insert({ status: 'in_progress' })
      .select('id')
      .single();
    if (error || !data) { toast.error('Erro ao iniciar inventário'); return; }
    setActiveCountId((data as any).id);
    setInvView('counting');
  };

  if (invView === 'counting') {
    return (
      <InventoryCounting
        items={items}
        countId={activeCountId}
        onDone={() => { loadHistory(); setInvView('list'); onDone(); }}
        onCancel={() => setInvView('list')}
      />
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Inventários</h2>
        <Button size="sm" className="h-9 text-xs gap-1.5" onClick={startNew}>
          <Plus className="w-3.5 h-3.5" /> Novo Inventário
        </Button>
      </div>

      {histLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum inventário realizado ainda.</p>
          <Button onClick={startNew}>
            <Plus className="w-4 h-4 mr-1" /> Iniciar primeiro inventário
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(inv => (
            <div key={inv.id} className="bg-white rounded-xl border border-border p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(inv.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  {inv.counted_by && (
                    <p className="text-xs text-muted-foreground mt-0.5">por {inv.counted_by}</p>
                  )}
                  {inv.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{inv.notes}</p>
                  )}
                  {inv.completed_at && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Concluído às {new Date(inv.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <Badge
                  variant={inv.status === 'completed' ? 'default' : 'secondary'}
                  className="text-[10px] flex-shrink-0"
                >
                  {inv.status === 'completed' ? 'Concluído' : 'Em progresso'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InventoryCounting({ items, countId, onDone, onCancel }: {
  items: StockItem[];
  countId: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(false);

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const groups = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, StockItem[]>);
  const changedCount = Object.keys(counts).filter(id => counts[id] !== '').length;

  const handleSave = async () => {
    const entries = Object.entries(counts).filter(([, v]) => v !== '');
    if (entries.length === 0) { toast.error('Nenhuma contagem alterada'); return; }
    setSaving(true);

    if (countId) {
      const countItemsData = entries.map(([id, val]) => {
        const sysStock = items.find(i => i.id === id)?.current_stock || 0;
        const counted = parseFloat(val);
        return { count_id: countId, item_id: id, system_stock: sysStock, counted_stock: counted, difference: counted - sysStock };
      });
      await supabase.from('inventory_count_items' as any).insert(countItemsData);
      await supabase.from('inventory_counts' as any).update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', countId);
    }

    for (const [id, val] of entries) {
      const qty = parseFloat(val);
      if (isNaN(qty)) continue;
      await supabase.from('stock_items').update({ current_stock: qty } as any).eq('id', id);
    }

    toast.success(`${entries.length} itens atualizados!`);
    setSaved(true);
    setSaving(false);
    setTimeout(() => { setSaved(false); onDone(); }, 1500);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-foreground flex-1">Nova Contagem</h2>
        {changedCount > 0 && (
          <Badge variant="secondary" className="text-xs">{changedCount} alterados</Badge>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 h-11 bg-white rounded-xl"
          placeholder="Filtrar item..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <p className="text-xs text-muted-foreground px-1">Deixe em branco para não alterar. Preencha apenas o que foi contado.</p>

      {Object.entries(groups).map(([cat, catItems]) => (
        <div key={cat} className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-1">{cat}</p>
          {catItems.map(item => {
            const isLow = item.current_stock <= item.min_stock && item.min_stock > 0;
            return (
              <div key={item.id} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5 ${isLow ? 'bg-destructive' : 'bg-success'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Atual: {fmtNum(item.current_stock)} {item.unit}</p>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="—"
                  value={counts[item.id] ?? ''}
                  onChange={e => setCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                  className="w-20 h-9 text-right text-sm font-semibold bg-amber-50 border border-amber-200 rounded-lg px-2 outline-none focus:border-primary focus:bg-white transition-colors"
                />
              </div>
            );
          })}
        </div>
      ))}

      {changedCount > 0 && (
        <div className="sticky bottom-4">
          <Button
            className="w-full h-12 text-base font-semibold rounded-xl shadow-lg"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : saved ? <CheckCircle2 className="w-5 h-5 mr-2" /> : null}
            Salvar {changedCount} contagem{changedCount !== 1 ? 'ns' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Cardápios ───────────────────────────────────────────────────────────
type SeparationRow = { itemName: string; unit: string; needed: number; tagId: string | null; tagName: string | null; tagColor: string | null };

function MenusTab({ menus }: { menus: EventMenu[] }) {
  const [selectedMenu, setSelectedMenu] = useState<EventMenu | null>(null);
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [separationView, setSeparationView] = useState(false);
  const [separationRows, setSeparationRows] = useState<SeparationRow[]>([]);

  const openMenu = async (menu: EventMenu) => {
    setSelectedMenu(menu);
    setSeparationView(false);
    setSeparationRows([]);
    setLoadingDishes(true);
    const { data } = await supabase
      .from('event_menu_dishes')
      .select('section_name, planned_quantity, planned_unit, sheet_id, technical_sheets(name, yield_quantity)')
      .eq('menu_id', menu.id)
      .order('sort_order');
    const dishList: MenuDish[] = (data || []).map((d: any) => ({
      sheet_name: d.technical_sheets?.name || '?',
      planned_quantity: d.planned_quantity,
      planned_unit: d.planned_unit,
      section_name: d.section_name,
    })).filter((d: MenuDish) => d.sheet_name !== 'MANTIMENTOS');
    setDishes(dishList);

    // Fetch ingredients with tags for separation view
    const sheetIds = (data || []).map((d: any) => d.sheet_id).filter(Boolean);
    if (sheetIds.length > 0) {
      const [siRes, tagsRes] = await Promise.all([
        supabase.from('technical_sheet_items').select('sheet_id, item_id, quantity, section, tag_id').in('sheet_id', sheetIds).in('section', ['receita', null as any]),
        supabase.from('tags').select('id, name, color'),
      ]);
      const tagsMap: Record<string, { name: string; color: string }> = {};
      (tagsRes.data || []).forEach((t: any) => { tagsMap[t.id] = { name: t.name, color: t.color }; });

      // Get stock item names
      const itemIds = [...new Set((siRes.data || []).map((i: any) => i.item_id).filter(Boolean))];
      const { data: stockData } = await supabase.from('stock_items').select('id, name, unit').in('id', itemIds);
      const stockMap: Record<string, { name: string; unit: string }> = {};
      (stockData || []).forEach((s: any) => { stockMap[s.id] = { name: s.name, unit: s.unit }; });

      // Build per-tag totals
      const totals: Record<string, SeparationRow> = {};
      (siRes.data || []).forEach((si: any) => {
        if (si.section === 'decoracao') return;
        const dishData = (data || []).find((d: any) => d.sheet_id === si.sheet_id);
        if (!dishData) return;
        const yieldQty = dishData.technical_sheets?.yield_quantity || 1;
        const scale = dishData.planned_quantity / yieldQty;
        const needed = (si.quantity || 0) * scale;
        const tag = si.tag_id ? tagsMap[si.tag_id] : null;
        const key = `${si.item_id}::${si.tag_id || ''}`;
        const stock = stockMap[si.item_id];
        if (!totals[key]) {
          totals[key] = { itemName: stock?.name || si.item_id, unit: stock?.unit || 'un', needed: 0, tagId: si.tag_id || null, tagName: tag?.name || null, tagColor: tag?.color || null };
        }
        totals[key].needed += needed;
      });
      setSeparationRows(Object.values(totals).sort((a, b) => (a.tagName || 'Zzz').localeCompare(b.tagName || 'Zzz') || a.itemName.localeCompare(b.itemName)));
    }
    setLoadingDishes(false);
  };

  const fmtDate = (d: string | null) => d
    ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Sem data';

  // Group dishes by section
  const sections = dishes.reduce((acc, d) => {
    const sec = d.section_name || 'Geral';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(d);
    return acc;
  }, {} as Record<string, MenuDish[]>);

  // Group separation rows by tag
  const separationByTag = separationRows.reduce((acc, r) => {
    const key = r.tagId || '__none__';
    if (!acc[key]) acc[key] = { tagName: r.tagName, tagColor: r.tagColor, rows: [] };
    acc[key].rows.push(r);
    return acc;
  }, {} as Record<string, { tagName: string | null; tagColor: string | null; rows: SeparationRow[] }>);

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-bold text-foreground">Cardápios ({menus.length})</h2>

      {menus.length === 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">Nenhum cardápio criado</p>
      )}

      {menus.map(menu => (
        <button
          key={menu.id}
          onClick={() => openMenu(menu)}
          className="w-full bg-white rounded-xl border border-border p-4 text-left active:bg-amber-50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-semibold text-foreground text-sm leading-snug flex-1">{menu.name}</p>
            <Badge variant={menu.status === 'draft' ? 'secondary' : 'default'} className="text-[10px] flex-shrink-0">
              {menu.status === 'draft' ? 'Rascunho' : menu.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(menu.event_date)}</span>
            {menu.location && <span>📍 {menu.location}</span>}
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{menu.guest_count} convidados</span>
            <span className="flex items-center gap-1"><ChefHat className="w-3 h-3" />{menu.dish_count} pratos</span>
          </div>
        </button>
      ))}

      {/* Menu detail dialog */}
      <Dialog open={selectedMenu !== null} onOpenChange={() => { setSelectedMenu(null); setSeparationView(false); }}>
        <DialogContent className="max-w-sm mx-4 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-left text-base leading-snug pr-6">{selectedMenu?.name}</DialogTitle>
          </DialogHeader>
          {selectedMenu && (
            <div className="space-y-3 overflow-y-auto flex-1">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(selectedMenu.event_date)}</span>
                {selectedMenu.location && <span>📍 {selectedMenu.location}</span>}
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedMenu.guest_count} convidados</span>
              </div>

              {loadingDishes ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : (
                <>
                  {/* Toggle buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSeparationView(false)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${!separationView ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    >
                      {dishes.length} Pratos
                    </button>
                    {separationRows.length > 0 && (
                      <button
                        onClick={() => setSeparationView(true)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${separationView ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                      >
                        Lista de Separação
                      </button>
                    )}
                  </div>

                  {!separationView ? (
                    dishes.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Nenhum prato cadastrado</p>
                    ) : (
                      Object.entries(sections).map(([section, sectionDishes]) => (
                        <div key={section}>
                          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mt-3 mb-1.5 flex items-center gap-1.5">
                            <span className="flex-1 border-b border-amber-200 pb-0.5">{section}</span>
                            <span className="text-muted-foreground font-normal normal-case tracking-normal">{sectionDishes.length} pratos</span>
                          </p>
                          <div className="space-y-0.5">
                            {sectionDishes.map((d, i) => (
                              <div key={i} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                                <ChefHat className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                <p className="text-sm text-foreground font-medium flex-1 truncate">{d.sheet_name}</p>
                                <span className="text-xs text-muted-foreground flex-shrink-0">{d.planned_quantity} {d.planned_unit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    /* Separation view grouped by tag */
                    <div className="space-y-3">
                      {Object.entries(separationByTag)
                        .sort(([a], [b]) => {
                          if (a === '__none__') return 1;
                          if (b === '__none__') return -1;
                          return (separationByTag[a].tagName || '').localeCompare(separationByTag[b].tagName || '');
                        })
                        .map(([key, section]) => (
                          <div key={key}>
                            <div className="flex items-center gap-2 mb-1.5">
                              {section.tagColor ? (
                                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: section.tagColor }}>
                                  <span className="w-2 h-2 rounded-full" style={{ background: section.tagColor }} />
                                  {section.tagName}
                                </span>
                              ) : (
                                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sem tag</span>
                              )}
                            </div>
                            <div className="space-y-0.5 pl-4">
                              {section.rows.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0">
                                  <span className="flex-1 text-sm text-foreground">{r.itemName}</span>
                                  <span className="text-xs font-semibold text-foreground">{fmtNum(r.needed)}</span>
                                  <span className="text-xs text-muted-foreground">{r.unit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
