import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Package, Calendar, MapPin, Users,
  ChevronRight, CheckCircle2, Clock, AlertTriangle, X,
  Truck, Loader2, SkipForward, Check,
} from 'lucide-react';
import { toast } from 'sonner';

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

// ── Event card ───────────────────────────────────────────────────────────────

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

// ── Separation modal ─────────────────────────────────────────────────────────

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

        for (const item of separated) {
          const { data: si } = await supabase
            .from('stock_items').select('current_stock').eq('id', item.item_id).single();
          if (si) {
            const newQty = Math.max(0, (si as any).current_stock - item.separated_quantity!);
            await supabase.from('stock_items').update({ current_stock: newQty } as any).eq('id', item.item_id);
          }
        }
      }

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

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-2">
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
                        {item.planned_quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {item.stock_items?.unit} necessário
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

          {done.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Concluídos ({done.length})
              </p>
              {done.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-xl border mb-2 ${
                    item.status === 'skipped' ? 'border-border bg-muted/30' : 'border-success/20 bg-success/5'
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
                          : `${item.separated_quantity?.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${item.stock_items?.unit} separado`
                        }
                      </p>
                    </div>
                  </div>
                  {item.status === 'separated' && item.separated_quantity !== item.planned_quantity && (
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">Ajustado</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

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
                  <span>Necessário: <strong className="text-foreground">{activeItem.planned_quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {activeItem.stock_items?.unit}</strong></span>
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
                  type="number" inputMode="decimal"
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

// ── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeeEventsPage() {
  const { user } = useAuth();
  const [assignedEvents, setAssignedEvents] = useState<AssignedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEvent, setOpenEvent] = useState<AssignedEvent | null>(null);

  useEffect(() => {
    if (user) loadAssignedEvents();
  }, [user]);

  const loadAssignedEvents = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: myItems } = await supabase
        .from('event_separation_items')
        .select('id, menu_id, item_id, planned_quantity, separated_quantity, status, notes, assigned_to, stock_items(name, unit, current_stock)')
        .eq('assigned_to', user.id)
        .order('created_at');

      const { data: legacyMenus } = await supabase
        .from('event_menus')
        .select('id, name, location, event_date, guest_count, status, assigned_at')
        .eq('assigned_to', user.id)
        .in('status', ['assigned', 'dispatched'])
        .order('event_date', { ascending: true });

      const perItemMenuIds = [...new Set((myItems || []).map((i: any) => i.menu_id))];
      const legacyMenuIds = (legacyMenus || [])
        .map((m: any) => m.id)
        .filter((id: string) => !perItemMenuIds.includes(id));
      const allMenuIds = [...perItemMenuIds, ...legacyMenuIds];

      if (allMenuIds.length === 0) { setAssignedEvents([]); setLoading(false); return; }

      const { data: menuDetails } = await supabase
        .from('event_menus')
        .select('id, name, location, event_date, guest_count, status, assigned_at')
        .in('id', allMenuIds)
        .in('status', ['assigned', 'dispatched'])
        .order('event_date', { ascending: true });

      if (!menuDetails?.length) { setAssignedEvents([]); setLoading(false); return; }

      const eventsWithItems = await Promise.all((menuDetails as any[]).map(async menu => {
        let sepItems: SeparationItem[];
        if (perItemMenuIds.includes(menu.id)) {
          sepItems = ((myItems || []).filter((i: any) => i.menu_id === menu.id)) as SeparationItem[];
        } else {
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
      setLoading(false);
    }
  };

  return (
    <div className="pb-8">
      <div className="mb-5">
        <h2 className="text-xl font-display font-bold text-foreground">Eventos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Separações de cardápio atribuídas a você</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : assignedEvents.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum evento atribuído</p>
          <p className="text-sm mt-1">Quando o supervisor atribuir um evento você verá aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignedEvents.map(event => (
            <SeparationEventCard
              key={event.id}
              event={event}
              onOpen={() => setOpenEvent(event)}
            />
          ))}
        </div>
      )}

      {openEvent && (
        <SeparationModal
          event={openEvent}
          onClose={() => setOpenEvent(null)}
          onUpdate={loadAssignedEvents}
        />
      )}
    </div>
  );
}
