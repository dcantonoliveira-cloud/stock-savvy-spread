import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChefHat, Plus, Clock, CalendarDays, CheckCircle2, Loader2, X, DollarSign, Search } from 'lucide-react';
import { toast } from 'sonner';

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

type Status = 'pending' | 'in_progress' | 'done';

interface Order {
  id: string;
  title: string;
  description: string | null;
  event_id: string | null;
  event_name?: string | null;
  delivery_date: string;
  delivery_time: string | null;
  extra_value: number | null;
  status: Status;
  created_at: string;
}

interface EventOption { id: string; event_name: string; event_date: string }

const STATUS_CFG: Record<Status, { label: string; dot: string; badge: string }> = {
  pending:     { label: 'Pendente',      dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'Em produção',   dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  done:        { label: 'Pronto',        dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
};

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5';

const BLANK_FORM = { title: '', description: '', event_id: '', delivery_date: '', delivery_time: '', extra_value: '' };

export default function ProducaoPage() {
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(BLANK_FORM);
  const [eventSearch, setEventSearch] = useState('');
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Status | 'all'>('all');
  const searchRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => { load(); }, []);

  // Event search
  useEffect(() => {
    if (eventSearch.length < 2) { setEventOptions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await (supabase.from as any)('events')
        .select('id, event_name, event_date')
        .ilike('event_name', `%${eventSearch}%`)
        .eq('company_id', COMPANY_ID)
        .in('status', ['confirmed', 'negotiating', 'tasting_scheduled'])
        .order('event_date', { ascending: true })
        .limit(8);
      setEventOptions(data ?? []);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(t);
  }, [eventSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openNew = () => { setForm(BLANK_FORM); setEventSearch(''); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.delivery_date) return;
    setSaving(true);
    const { error } = await (supabase.from as any)('production_orders').insert({
      company_id:    COMPANY_ID,
      title:         form.title,
      description:   form.description || null,
      event_id:      form.event_id || null,
      delivery_date: form.delivery_date,
      delivery_time: form.delivery_time || null,
      extra_value:   form.extra_value ? parseFloat(form.extra_value.replace(',', '.')) : null,
      status:        'pending',
    });
    if (error) { toast.error('Erro ao criar pedido'); setSaving(false); return; }
    toast.success('Pedido criado!');
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const cycleStatus = async (order: Order) => {
    const next: Record<Status, Status> = { pending: 'in_progress', in_progress: 'done', done: 'pending' };
    const newStatus = next[order.status];
    await (supabase.from as any)('production_orders').update({ status: newStatus }).eq('id', order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
  };

  const today = new Date().toISOString().slice(0, 10);

  const filtered = orders.filter(o => activeFilter === 'all' || o.status === activeFilter);
  const overdue  = filtered.filter(o => o.delivery_date < today && o.status !== 'done');
  const upcoming = filtered.filter(o => o.delivery_date >= today || o.status === 'done');

  const OrderCard = ({ order }: { order: Order }) => {
    const cfg = STATUS_CFG[order.status];
    const isLate = order.delivery_date < today && order.status !== 'done';
    return (
      <div className={`bg-white border rounded-2xl p-4 space-y-3 ${isLate ? 'border-red-200' : 'border-border'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight">{order.title}</p>
            {order.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{order.description}</p>}
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
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-lg font-bold text-foreground">Produção</h1>
          <p className="text-xs text-muted-foreground">{orders.filter(o => o.status !== 'done').length} pedidos em aberto</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Novo pedido
        </button>
      </div>

      {/* Filter tabs */}
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
        <div className="space-y-4">
          {overdue.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">Atrasados</p>
              <div className="space-y-3">{overdue.map(o => <OrderCard key={o.id} order={o} />)}</div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              {overdue.length > 0 && <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Próximos</p>}
              <div className="space-y-3">{upcoming.map(o => <OrderCard key={o.id} order={o} />)}</div>
            </div>
          )}
        </div>
      )}

      {/* Modal novo pedido */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" onClick={() => setModalOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white w-full rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto sm:max-w-md"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-border flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
              <p className="font-semibold text-sm">Novo pedido de produção</p>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Título *</label>
                <input className={inputCls} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Bolo de 3 andares, brigadeiros..." required />
              </div>

              <div>
                <label className={labelCls}>Descrição</label>
                <textarea className={inputCls + ' resize-none'} rows={2} value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Detalhes, quantidade, sabor..." />
              </div>

              {/* Event search */}
              <div ref={searchRef} className="relative">
                <label className={labelCls}>Evento (opcional)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input className={inputCls + ' pl-8'} value={eventSearch}
                    onChange={e => { setEventSearch(e.target.value); if (!e.target.value) setForm(p => ({ ...p, event_id: '' })); }}
                    onFocus={() => eventOptions.length > 0 && setShowDropdown(true)}
                    placeholder="Buscar evento..." />
                </div>
                {form.event_id && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Evento vinculado
                  </p>
                )}
                {showDropdown && eventOptions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                    {eventOptions.map(ev => (
                      <button key={ev.id} type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                        onClick={() => { setForm(p => ({ ...p, event_id: ev.id })); setEventSearch(ev.event_name); setShowDropdown(false); }}>
                        <p className="text-sm font-medium">{ev.event_name}</p>
                        {ev.event_date && <p className="text-xs text-muted-foreground">{fmtDate(ev.event_date)}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data de entrega *</label>
                  <input className={inputCls} type="date" value={form.delivery_date}
                    onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))} required />
                </div>
                <div>
                  <label className={labelCls}>Horário</label>
                  <input className={inputCls} type="time" value={form.delivery_time}
                    onChange={e => setForm(p => ({ ...p, delivery_time: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Valor do extra (R$)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input className={inputCls + ' pl-8'} type="text" inputMode="decimal"
                    value={form.extra_value} placeholder="0,00"
                    onChange={e => setForm(p => ({ ...p, extra_value: e.target.value }))} />
                </div>
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 mt-2">
                {saving ? 'Criando...' : 'Criar pedido'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
