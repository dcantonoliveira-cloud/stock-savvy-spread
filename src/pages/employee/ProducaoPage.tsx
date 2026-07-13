import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChefHat, CalendarDays, Loader2, DollarSign } from 'lucide-react';

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

type Status = 'pending' | 'in_progress' | 'done';

interface Order {
  id: string;
  title: string;
  description: string | null;
  delivery_address: string | null;
  event_id: string | null;
  event_name?: string | null;
  delivery_date: string;
  delivery_time: string | null;
  extra_value: number | null;
  status: Status;
  created_at: string;
}

const STATUS_CFG: Record<Status, { label: string; badge: string }> = {
  pending:     { label: 'Pendente',    badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'Em produção', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  done:        { label: 'Pronto',      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
};

export default function ProducaoPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<Status | 'all'>('all');

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)('production_orders')
      .select('*, events(event_name)')
      .eq('company_id', COMPANY_ID)
      .order('delivery_date', { ascending: true })
      .order('delivery_time', { ascending: true });
    setOrders((data ?? []).map((o: any) => ({ ...o, event_name: o.events?.event_name ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const sub = (supabase as any)
      .channel('production_employee')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders' }, load)
      .subscribe();
    return () => sub.unsubscribe();
  }, []);

  const cycleStatus = async (order: Order) => {
    const next: Record<Status, Status> = { pending: 'in_progress', in_progress: 'done', done: 'pending' };
    const newStatus = next[order.status];
    await (supabase.from as any)('production_orders').update({ status: newStatus }).eq('id', order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
  };

  const today = new Date().toISOString().slice(0, 10);

  const filtered = orders
    .filter(o => activeFilter === 'all' || o.status === activeFilter)
    .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date) || (a.delivery_time ?? '').localeCompare(b.delivery_time ?? ''));

  const overdue  = filtered.filter(o => o.delivery_date < today && o.status !== 'done');
  const todayOrders = filtered.filter(o => o.delivery_date === today);
  const future   = filtered.filter(o => o.delivery_date > today);

  const OrderCard = ({ order }: { order: Order }) => {
    const cfg = STATUS_CFG[order.status];
    const isLate = order.delivery_date < today && order.status !== 'done';
    return (
      <div className={`bg-white border rounded-2xl p-4 space-y-3 ${isLate ? 'border-red-200' : 'border-border'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight">{order.title}</p>
            {order.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{order.description}</p>}
            {order.delivery_address && <p className="text-xs text-blue-600 mt-0.5 font-medium">📍 {order.delivery_address}</p>}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${cfg.badge}`}>{cfg.label}</span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className={`flex items-center gap-1 ${isLate ? 'text-red-500 font-medium' : ''}`}>
            <CalendarDays className="w-3.5 h-3.5" />
            {fmtDate(order.delivery_date)}{order.delivery_time ? ` às ${order.delivery_time.slice(0,5)}` : ''}
          </span>
          {order.event_name && (
            <span className="flex items-center gap-1">
              <ChefHat className="w-3.5 h-3.5" />
              {order.event_name}
            </span>
          )}
          {order.extra_value != null && (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <DollarSign className="w-3.5 h-3.5" />
              Extra: R$ {order.extra_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>

        <button
          onClick={() => cycleStatus(order)}
          className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors ${
            order.status === 'done'
              ? 'bg-muted text-muted-foreground hover:bg-muted/80'
              : order.status === 'in_progress'
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {order.status === 'pending' ? 'Iniciar produção' : order.status === 'in_progress' ? 'Marcar como pronto' : 'Reabrir'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="pt-1">
        <h1 className="text-lg font-bold text-foreground">Produção</h1>
        <p className="text-xs text-muted-foreground">{orders.filter(o => o.status !== 'done').length} pedidos em aberto</p>
      </div>

      <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
        {(['all', 'pending', 'in_progress', 'done'] as const).map(f => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              activeFilter === f ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'
            }`}>
            {f === 'all' ? 'Todos' : STATUS_CFG[f].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum pedido.</div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">⚠ Atrasados</p>
              <div className="space-y-3">{overdue.map(o => <OrderCard key={o.id} order={o} />)}</div>
            </div>
          )}
          {todayOrders.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Hoje</p>
              <div className="space-y-3">{todayOrders.map(o => <OrderCard key={o.id} order={o} />)}</div>
            </div>
          )}
          {future.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Próximos</p>
              <div className="space-y-3">{future.map(o => <OrderCard key={o.id} order={o} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
