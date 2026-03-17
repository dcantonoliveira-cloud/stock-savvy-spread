import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Check, ArrowLeft,
  Search, ScanBarcode, Package, Calendar, MapPin, Users,
  ChevronRight, CheckCircle2, Clock, AlertTriangle, X,
  Truck, Loader2, SkipForward
} from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES } from '@/types/inventory';
import BarcodeScanner from '@/components/BarcodeScanner';

type StockItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  image_url: string | null;
  barcode: string | null;
};

type Kitchen = { id: string; name: string };
type Location = { id: string; item_id: string; kitchen_id: string; current_stock: number };

type SeparationItem = {
  id: string;
  menu_id: string;
  item_id: string;
  planned_quantity: number;
  separated_quantity: number | null;
  status: 'pending' | 'separated' | 'skipped';
  notes: string | null;
  stock_items: { name: string; unit: string; current_stock: number } | null;
};

type AssignedEvent = {
  id: string;
  name: string;
  location: string | null;
  event_date: string | null;
  guest_count: number;
  status: string;
  assigned_at: string;
  separation_items: SeparationItem[];
};

const CATEGORY_EMOJIS: Record<string, string> = {
  'Carnes': '🥩', 'Bebidas': '🥤', 'Frios': '🧀', 'Hortifruti': '🥬',
  'Secos': '🌾', 'Descartáveis': '🥤', 'Limpeza': '🧹', 'Outros': '📦',
};

// ─── Separation Flow ──────────────────────────────────────────────────────────

function SeparationEventCard({ event, onOpen }: { event: AssignedEvent; onOpen: () => void }) {
  const total = event.separation_items.length;
  const done = event.separation_items.filter(i => i.status !== 'pending').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = pct === 100;

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-2xl border p-4 shadow-sm transition-all active:scale-[0.98] ${
        isComplete
          ? 'bg-success/5 border-success/30'
          : 'bg-white border-primary/30 hover:border-primary/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Package className={`w-4 h-4 flex-shrink-0 ${isComplete ? 'text-success' : 'text-primary'}`} />
            <p className="font-semibold text-foreground truncate">{event.name}</p>
            {isComplete && <Badge className="text-[10px] bg-success/10 text-success border-success/20 flex-shrink-0">Concluído</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
            {event.event_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(event.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />{event.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />{event.guest_count} convidados
            </span>
          </div>
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-success' : 'bg-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{done} de {total} itens separados</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}

function SeparationModal({ event, onClose, onUpdate }: {
  event: AssignedEvent;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<SeparationItem[]>(event.separation_items);
  const [activeItem, setActiveItem] = useState<SeparationItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDispatch, setConfirmingDispatch] = useState(false);

  const pending = items.filter(i => i.status === 'pending');
  const done = items.filter(i => i.status !== 'pending');
  const allDone = pending.length === 0;

  const handleSeparate = async (skip = false) => {
    if (!activeItem) return;
    if (!skip && (!quantity || parseFloat(quantity) <= 0)) {
      toast.error('Informe a quantidade separada');
      return;
    }
    setSaving(true);

    const qty = skip ? null : parseFloat(quantity);
    const newStatus = skip ? 'skipped' : 'separated';

    const { error } = await supabase
      .from('event_separation_items')
      .update({
        status: newStatus,
        separated_quantity: qty,
        separated_at: new Date().toISOString(),
        separated_by: user?.id,
        notes: notes.trim() || null,
      } as any)
      .eq('id', activeItem.id);

    if (error) {
      toast.error('Erro ao registrar');
      setSaving(false);
      return;
    }

    // Update local state
    setItems(prev => prev.map(i => i.id === activeItem.id
      ? { ...i, status: newStatus, separated_quantity: qty, notes: notes.trim() || null }
      : i
    ));

    toast.success(skip ? `${activeItem.stock_items?.name} pulado` : `✅ ${qty} ${activeItem.stock_items?.unit} de ${activeItem.stock_items?.name}`);
    setActiveItem(null);
    setQuantity('');
    setNotes('');
    setSaving(false);
    onUpdate();
  };

  const handleConfirmDispatch = async () => {
    setConfirmingDispatch(true);
    try {
      // Insert movements to event_stock_movements
      const separated = items.filter(i => i.status === 'separated' && i.separated_quantity != null);
      if (separated.length > 0) {
        await supabase.from('event_stock_movements').insert(
          separated.map(i => ({
            menu_id: event.id,
            item_id: i.item_id,
            movement_type: 'dispatch',
            planned_quantity: i.planned_quantity,
            actual_quantity: i.separated_quantity,
            created_by: profile?.display_name || 'Funcionário',
          })) as any
        );

        // Deduct from stock
        for (const item of separated) {
          const { data: si } = await supabase
            .from('stock_items')
            .select('current_stock')
            .eq('id', item.item_id)
            .single();
          if (si) {
            const newQty = Math.max(0, (si as any).current_stock - item.separated_quantity!);
            await supabase.from('stock_items').update({ current_stock: newQty } as any).eq('id', item.item_id);
          }
        }
      }

      // Update menu status to dispatched
      await supabase.from('event_menus').update({
        status: 'dispatched',
        dispatched_at: new Date().toISOString(),
        dispatched_by: profile?.display_name || 'Funcionário',
      } as any).eq('id', event.id);

      toast.success('Saída confirmada! Estoque atualizado.');
      onUpdate();
      onClose();
    } catch (err) {
      toast.error('Erro ao confirmar saída');
      console.error(err);
    } finally {
      setConfirmingDispatch(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Separação — {event.name}
          </DialogTitle>
          {event.event_date && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(event.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              {event.location && ` · ${event.location}`}
            </p>
          )}
        </DialogHeader>

        {/* Progress */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{done.length} de {items.length} separados</span>
            <span className="font-medium text-primary">{Math.round((done.length / items.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.round((done.length / items.length) * 100)}%` }}
            />
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-2">
          {/* Pending items */}
          {pending.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Pendentes ({pending.length})
              </p>
              {pending.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveItem(item); setQuantity(item.planned_quantity.toString()); setNotes(''); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border bg-white hover:border-primary/40 hover:bg-primary/3 transition-all mb-2 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{item.stock_items?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.planned_quantity.toFixed(3)} {item.stock_items?.unit} necessário
                        {item.stock_items?.current_stock != null && (
                          <span className={` · ${item.stock_items.current_stock >= item.planned_quantity ? 'text-success' : 'text-destructive'}`}>
                            {item.stock_items.current_stock} em estoque
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Done items */}
          {done.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Concluídos ({done.length})
              </p>
              {done.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-xl border mb-2 ${
                    item.status === 'skipped'
                      ? 'border-border bg-muted/30'
                      : 'border-success/20 bg-success/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.status === 'skipped' ? 'bg-muted' : 'bg-success/10'
                    }`}>
                      {item.status === 'skipped'
                        ? <X className="w-4 h-4 text-muted-foreground" />
                        : <CheckCircle2 className="w-4 h-4 text-success" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium text-sm truncate ${item.status === 'skipped' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {item.stock_items?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.status === 'skipped'
                          ? 'Pulado'
                          : `${item.separated_quantity?.toFixed(3)} ${item.stock_items?.unit} separado`
                        }
                      </p>
                    </div>
                  </div>
                  {item.status === 'separated' && item.separated_quantity !== item.planned_quantity && (
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">
                      Ajustado
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-white">
          {allDone ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20">
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                <p className="text-sm text-success font-medium">Todos os itens foram processados!</p>
              </div>
              <Button
                className="w-full h-12 text-base bg-primary hover:bg-primary/90"
                onClick={handleConfirmDispatch}
                disabled={confirmingDispatch}
              >
                {confirmingDispatch
                  ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  : <Truck className="w-4 h-4 mr-2" />
                }
                Confirmar Saída do Estoque
              </Button>
            </div>
          ) : (
            <p className="text-xs text-center text-muted-foreground">
              Toque em um item para registrar a separação
            </p>
          )}
        </div>
      </DialogContent>

      {/* Item separation dialog */}
      <Dialog open={!!activeItem} onOpenChange={o => { if (!o) { setActiveItem(null); setQuantity(''); setNotes(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Separar Item
            </DialogTitle>
          </DialogHeader>

          {activeItem && (
            <div className="space-y-4">
              <div className="bg-accent rounded-xl p-3">
                <p className="font-semibold text-foreground">{activeItem.stock_items?.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>Necessário: <strong className="text-foreground">{activeItem.planned_quantity.toFixed(3)} {activeItem.stock_items?.unit}</strong></span>
                  {activeItem.stock_items?.current_stock != null && (
                    <span className={activeItem.stock_items.current_stock >= activeItem.planned_quantity ? 'text-success' : 'text-destructive'}>
                      Em estoque: {activeItem.stock_items.current_stock} {activeItem.stock_items.unit}
                    </span>
                  )}
                </div>
                {activeItem.stock_items?.current_stock != null &&
                  activeItem.stock_items.current_stock < activeItem.planned_quantity && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-warning">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Estoque insuficiente — separe o que tiver disponível
                    </div>
                  )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Quantidade separada ({activeItem.stock_items?.unit}) *
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  className="h-14 text-2xl text-center font-bold rounded-xl"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Observação (opcional)</label>
                <Input
                  className="h-11 rounded-xl"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Só tinha metade disponível..."
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-muted-foreground"
                  onClick={() => handleSeparate(true)}
                  disabled={saving}
                >
                  <SkipForward className="w-4 h-4 mr-1.5" />
                  Pular
                </Button>
                <Button
                  className="flex-1 h-12 text-base"
                  onClick={() => handleSeparate(false)}
                  disabled={saving || !quantity}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function EmployeeDashboard() {
  const { user, permissions, profile } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assignedEvents, setAssignedEvents] = useState<AssignedEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [openEvent, setOpenEvent] = useState<AssignedEvent | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [mode, setMode] = useState<'entry' | 'output' | 'transfer' | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [eventName, setEventName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [barcodeTimeout, setBarcodeTimeout] = useState<NodeJS.Timeout | null>(null);

  const [tfFromKitchen, setTfFromKitchen] = useState('');
  const [tfToKitchen, setTfToKitchen] = useState('');

  const loadData = async () => {
    const [itemsRes, kitchensRes, locsRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, category, unit, current_stock, image_url, barcode' as any).order('name'),
      supabase.from('kitchens').select('id, name').order('name'),
      supabase.from('stock_item_locations').select('id, item_id, kitchen_id, current_stock'),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as unknown as StockItem[]);
    if (kitchensRes.data) setKitchens(kitchensRes.data as Kitchen[]);
    if (locsRes.data) setLocations(locsRes.data as Location[]);
  };

  const loadAssignedEvents = async () => {
    if (!user) return;
    setLoadingEvents(true);
    try {
      // Strategy: find all separation items assigned to this user, then load the menus
      const { data: myItems } = await supabase
        .from('event_separation_items')
        .select('id, menu_id, item_id, planned_quantity, separated_quantity, status, notes, assigned_to, stock_items(name, unit, current_stock)')
        .eq('assigned_to', user.id)
        .order('created_at');

      // Also load menus where assigned_to = user.id for backward compatibility (old assignments without per-item assigned_to)
      const { data: legacyMenus } = await supabase
        .from('event_menus')
        .select('id, name, location, event_date, guest_count, status, assigned_at')
        .eq('assigned_to', user.id)
        .in('status', ['assigned', 'dispatched'])
        .order('event_date', { ascending: true });

      // Collect distinct menu IDs from per-item assignments
      const perItemMenuIds = [...new Set((myItems || []).map((i: any) => i.menu_id))];

      // Also get legacy menu IDs not already covered
      const legacyMenuIds = (legacyMenus || [])
        .map((m: any) => m.id)
        .filter((id: string) => !perItemMenuIds.includes(id));

      const allMenuIds = [...perItemMenuIds, ...legacyMenuIds];

      if (allMenuIds.length === 0) {
        setAssignedEvents([]);
        setLoadingEvents(false);
        return;
      }

      // Load menu metadata for all menus
      const { data: menuDetails } = await supabase
        .from('event_menus')
        .select('id, name, location, event_date, guest_count, status, assigned_at')
        .in('id', allMenuIds)
        .in('status', ['assigned', 'dispatched'])
        .order('event_date', { ascending: true });

      if (!menuDetails || menuDetails.length === 0) {
        setAssignedEvents([]);
        setLoadingEvents(false);
        return;
      }

      const eventsWithItems = await Promise.all((menuDetails as any[]).map(async menu => {
        let sepItems: SeparationItem[];
        if (perItemMenuIds.includes(menu.id)) {
          // Use per-item filtered items (only this user's items)
          sepItems = ((myItems || []).filter((i: any) => i.menu_id === menu.id)) as SeparationItem[];
        } else {
          // Legacy: load all items for the menu (no per-item assignment)
          const { data: allItems } = await supabase
            .from('event_separation_items')
            .select('id, menu_id, item_id, planned_quantity, separated_quantity, status, notes, stock_items(name, unit, current_stock)')
            .eq('menu_id', menu.id)
            .order('created_at');
          sepItems = (allItems || []) as SeparationItem[];
        }
        return { ...menu, separation_items: sepItems } as AssignedEvent;
      }));

      setAssignedEvents(eventsWithItems);
    } catch (err) {
      console.error('Erro ao carregar eventos:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { loadAssignedEvents(); }, [user]);

  // Physical barcode reader support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Enter' && barcodeBuffer.length >= 8) {
        handleBarcodeScan(barcodeBuffer);
        setBarcodeBuffer('');
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        setBarcodeBuffer(prev => prev + e.key);
        if (barcodeTimeout) clearTimeout(barcodeTimeout);
        const timeout = setTimeout(() => setBarcodeBuffer(''), 300);
        setBarcodeTimeout(timeout);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeBuffer, barcodeTimeout]);

  const handleBarcodeScan = (barcode: string) => {
    const found = items.find(i => i.barcode === barcode);
    if (found) {
      setSearch('');
      setSelectedCategory(null);
      setSelectedItem(found);
      toast.success(`📦 ${found.name}`);
    } else {
      toast.error(`Código ${barcode} não encontrado`);
    }
  };

  const categories = CATEGORIES.filter(cat => items.some(i => i.category === cat));
  const categoryItems = selectedCategory ? items.filter(i => i.category === selectedCategory) : [];
  const searchResults = search ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : [];

  const handleAction = (item: StockItem, action: 'entry' | 'output' | 'transfer') => {
    setSelectedItem(item);
    setMode(action);
    setQuantity('');
    setNotes('');
    setEventName('');
    setTfFromKitchen('');
    setTfToKitchen('');
  };

  const getLocationStock = (itemId: string, kitchenId: string) => {
    return locations.find(l => l.item_id === itemId && l.kitchen_id === kitchenId)?.current_stock ?? 0;
  };

  const handleSubmit = async () => {
    if (!selectedItem || !user || !quantity || parseFloat(quantity) <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }
    setSubmitting(true);

    if (mode === 'entry') {
      const { error } = await supabase.from('stock_entries').insert({
        item_id: selectedItem.id,
        quantity: parseFloat(quantity),
        notes: notes.trim() || null,
        registered_by: user.id,
      });
      if (error) toast.error('Erro ao registrar entrada');
      else toast.success(`✅ Entrada de ${quantity} ${selectedItem.unit} de ${selectedItem.name}`);
    } else if (mode === 'output') {
      const { error } = await supabase.from('stock_outputs').insert({
        item_id: selectedItem.id,
        quantity: parseFloat(quantity),
        employee_name: profile?.display_name || user.email || '',
        event_name: eventName.trim() || null,
        notes: notes.trim() || null,
        registered_by: user.id,
      });
      if (error) toast.error('Erro ao registrar saída');
      else toast.success(`✅ Saída de ${quantity} ${selectedItem.unit} de ${selectedItem.name}`);
    } else if (mode === 'transfer') {
      if (!tfFromKitchen || !tfToKitchen) { toast.error('Selecione origem e destino'); setSubmitting(false); return; }
      if (tfFromKitchen === tfToKitchen) { toast.error('Origem e destino devem ser diferentes'); setSubmitting(false); return; }
      const qty = parseFloat(quantity);
      const fromStock = getLocationStock(selectedItem.id, tfFromKitchen);
      if (qty > fromStock) { toast.error(`Estoque insuficiente na origem (disponível: ${fromStock})`); setSubmitting(false); return; }
      const { error: tfError } = await supabase.from('stock_transfers').insert({
        item_id: selectedItem.id,
        from_kitchen_id: tfFromKitchen,
        to_kitchen_id: tfToKitchen,
        quantity: qty,
        transferred_by: profile?.display_name || user.email || '',
        notes: notes.trim() || null,
      } as any);
      if (tfError) { toast.error('Erro ao registrar transferência'); setSubmitting(false); return; }
      const fromLoc = locations.find(l => l.item_id === selectedItem.id && l.kitchen_id === tfFromKitchen);
      if (fromLoc) await supabase.from('stock_item_locations').update({ current_stock: fromLoc.current_stock - qty } as any).eq('id', fromLoc.id);
      const toLoc = locations.find(l => l.item_id === selectedItem.id && l.kitchen_id === tfToKitchen);
      if (toLoc) await supabase.from('stock_item_locations').update({ current_stock: toLoc.current_stock + qty } as any).eq('id', toLoc.id);
      else await supabase.from('stock_item_locations').insert({ item_id: selectedItem.id, kitchen_id: tfToKitchen, current_stock: qty } as any);
      const fromName = kitchens.find(k => k.id === tfFromKitchen)?.name;
      const toName = kitchens.find(k => k.id === tfToKitchen)?.name;
      toast.success(`✅ ${qty} ${selectedItem.unit} de ${selectedItem.name} transferidos de ${fromName} → ${toName}`);
    }

    setSubmitting(false);
    setMode(null);
    setSelectedItem(null);
    loadData();
  };

  const ItemCard = ({ item }: { item: StockItem }) => (
    <div
      className="flex flex-col items-center rounded-2xl bg-card border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-95"
      onClick={() => setSelectedItem(item)}
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-accent flex items-center justify-center mb-2">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">{CATEGORY_EMOJIS[item.category] || '📦'}</span>
        )}
      </div>
      <p className="text-xs font-medium text-foreground text-center leading-tight line-clamp-2">{item.name}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{item.current_stock} {item.unit}</p>
    </div>
  );

  const showChooseAction = selectedItem && mode === null;
  const hasKitchens = kitchens.length >= 2;

  return (
    <div className="pb-8">
      <div className="text-center py-3">
        <h2 className="text-lg font-display font-bold text-foreground">
          Olá, {profile?.display_name?.split(' ')[0]} 👋
        </h2>
      </div>

      {/* ── SEPARAÇÕES ATRIBUÍDAS ── */}
      {!loadingEvents && assignedEvents.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Separações para você</p>
            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
              {assignedEvents.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {assignedEvents.map(event => (
              <SeparationEventCard
                key={event.id}
                event={event}
                onOpen={() => setOpenEvent(event)}
              />
            ))}
          </div>
          <div className="h-px bg-border my-5" />
        </div>
      )}

      {/* ── ESTOQUE REGULAR ── */}
      {/* Search + Scanner */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-10 h-11 text-sm rounded-xl"
            placeholder="Buscar item..."
            value={search}
            onChange={e => { setSearch(e.target.value); if (e.target.value) setSelectedCategory(null); }}
          />
        </div>
        <Button
          variant="outline"
          size="lg"
          className="h-11 px-4 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => setScannerOpen(true)}
        >
          <ScanBarcode className="w-5 h-5" />
        </Button>
      </div>

      {/* Search results */}
      {search && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">{searchResults.length} resultado(s)</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {searchResults.map(item => <ItemCard key={item.id} item={item} />)}
          </div>
          {searchResults.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum item encontrado.</p>}
        </div>
      )}

      {/* Category grid */}
      {!search && !selectedCategory && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">Selecione uma categoria</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {categories.map(cat => {
              const count = items.filter(i => i.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="flex flex-col items-center justify-center rounded-2xl bg-card border border-border p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-95"
                >
                  <span className="text-4xl mb-2">{CATEGORY_EMOJIS[cat] || '📦'}</span>
                  <p className="font-medium text-foreground text-sm">{cat}</p>
                  <p className="text-xs text-muted-foreground">{count} {count === 1 ? 'item' : 'itens'}</p>
                </button>
              );
            })}
          </div>
          {categories.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum item cadastrado.</p>}
        </div>
      )}

      {/* Items in category */}
      {!search && selectedCategory && (
        <div>
          <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-2 text-sm text-primary mb-4 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Voltar às categorias
          </button>
          <p className="text-sm text-muted-foreground mb-3">
            {CATEGORY_EMOJIS[selectedCategory]} {selectedCategory} · {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'itens'}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {categoryItems.map(item => <ItemCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleBarcodeScan} />

      {/* Choose action dialog */}
      <Dialog open={!!showChooseAction} onOpenChange={open => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-[320px] mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">{selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground -mt-2">
            Estoque: {selectedItem?.current_stock} {selectedItem?.unit}
          </p>
          <div className="flex flex-col gap-3 pt-2 w-full">
            {permissions.can_entry && (
              <Button size="lg" className="h-14 text-base rounded-xl bg-success text-success-foreground hover:bg-success/90 w-full justify-center" onClick={() => setMode('entry')}>
                <ArrowUpCircle className="w-5 h-5 mr-3 flex-shrink-0" /> Entrada
              </Button>
            )}
            {permissions.can_output && (
              <Button size="lg" className="h-14 text-base rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full justify-center" onClick={() => setMode('output')}>
                <ArrowDownCircle className="w-5 h-5 mr-3 flex-shrink-0" /> Saída
              </Button>
            )}
            {hasKitchens && (
              <Button size="lg" variant="outline" className="h-14 text-base rounded-xl border-primary/30 text-primary hover:bg-primary/10 w-full justify-center" onClick={() => setMode('transfer')}>
                <ArrowRightLeft className="w-5 h-5 mr-3 flex-shrink-0" /> Transferir
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Entry/Output quantity dialog */}
      <Dialog open={mode === 'entry' || mode === 'output'} onOpenChange={open => { if (!open) { setMode(null); setSelectedItem(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === 'entry' ? <><ArrowUpCircle className="w-5 h-5 text-success" /> Entrada</> : <><ArrowDownCircle className="w-5 h-5 text-destructive" /> Saída</>}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-accent rounded-lg p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-card flex items-center justify-center">
                  {selectedItem.image_url ? <img src={selectedItem.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">{CATEGORY_EMOJIS[selectedItem.category] || '📦'}</span>}
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedItem.name}</p>
                  <p className="text-xs text-muted-foreground">Estoque: {selectedItem.current_stock} {selectedItem.unit}</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Quantidade ({selectedItem.unit}) *</label>
                <Input type="number" inputMode="decimal" className="h-14 text-2xl text-center font-bold rounded-xl" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" autoFocus />
              </div>
              {mode === 'output' && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Evento (opcional)</label>
                  <Input className="h-11 rounded-xl" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Ex: Casamento Silva" />
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Obs (opcional)</label>
                <Input className="h-11 rounded-xl" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações" />
              </div>
              <Button className="w-full h-14 text-lg rounded-xl" onClick={handleSubmit} disabled={submitting || !quantity}>
                <Check className="w-5 h-5 mr-2" />{submitting ? 'Registrando...' : 'Confirmar'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={mode === 'transfer'} onOpenChange={open => { if (!open) { setMode(null); setSelectedItem(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-primary" /> Transferir</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-accent rounded-lg p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-card flex items-center justify-center">
                  {selectedItem.image_url ? <img src={selectedItem.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">{CATEGORY_EMOJIS[selectedItem.category] || '📦'}</span>}
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedItem.name}</p>
                  <p className="text-xs text-muted-foreground">Estoque geral: {selectedItem.current_stock} {selectedItem.unit}</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">De (Origem) *</label>
                <Select value={tfFromKitchen} onValueChange={setTfFromKitchen}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione a cozinha de origem" /></SelectTrigger>
                  <SelectContent>{kitchens.map(k => { const stock = getLocationStock(selectedItem.id, k.id); return (<SelectItem key={k.id} value={k.id}>{k.name} ({stock} {selectedItem.unit})</SelectItem>); })}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Para (Destino) *</label>
                <Select value={tfToKitchen} onValueChange={setTfToKitchen}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione a cozinha de destino" /></SelectTrigger>
                  <SelectContent>{kitchens.filter(k => k.id !== tfFromKitchen).map(k => (<SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Quantidade ({selectedItem.unit}) *</label>
                <Input type="number" inputMode="decimal" className="h-14 text-2xl text-center font-bold rounded-xl" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" autoFocus />
                {tfFromKitchen && <p className="text-xs text-muted-foreground mt-1 text-center">Disponível na origem: {getLocationStock(selectedItem.id, tfFromKitchen)} {selectedItem.unit}</p>}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Obs (opcional)</label>
                <Input className="h-11 rounded-xl" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Urgente para evento" />
              </div>
              <Button className="w-full h-14 text-lg rounded-xl" onClick={handleSubmit} disabled={submitting || !quantity || !tfFromKitchen || !tfToKitchen}>
                <ArrowRightLeft className="w-5 h-5 mr-2" />{submitting ? 'Transferindo...' : 'Confirmar Transferência'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Separation modal */}
      {openEvent && (
        <SeparationModal
          event={openEvent}
          onClose={() => setOpenEvent(null)}
          onUpdate={() => { loadAssignedEvents(); loadData(); }}
        />
      )}
    </div>
  );
}
