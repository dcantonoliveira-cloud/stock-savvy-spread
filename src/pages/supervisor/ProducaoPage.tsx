import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, ChefHat, CalendarDays, DollarSign, Loader2, X, CheckCircle2, Trash2, TrendingUp, CreditCard, Banknote, Smartphone, UtensilsCrossed, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

type Status = 'pending' | 'in_progress' | 'done';
type FilterType = Status | 'financeiro';

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
  payment_method: string | null;
  status: Status;
  created_at: string;
}

interface EventOption { id: string; event_name: string; event_date: string }

const STATUS_CFG: Record<Status, { label: string; cls: string; next: Status; nextLabel: string }> = {
  pending:     { label: 'Pendente',    cls: 'bg-amber-50 text-amber-700 border-amber-200',       next: 'in_progress', nextLabel: 'Iniciar' },
  in_progress: { label: 'Em produção', cls: 'bg-blue-50 text-blue-700 border-blue-200',          next: 'done',        nextLabel: 'Concluir' },
  done:        { label: 'Pronto',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', next: 'pending',     nextLabel: 'Reabrir' },
};

const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro',  Icon: Banknote },
  { value: 'cartao',   label: 'Cartão',    Icon: CreditCard },
  { value: 'pix',      label: 'Pix',       Icon: Smartphone },
  { value: 'evento',   label: 'Evento',    Icon: UtensilsCrossed },
];

const fmtDate = (d: string) => { const [y,m,day] = d.split('-'); return `${day}/${m}/${y.slice(2)}`; };
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5';
const BLANK = { title: '', description: '', delivery_address: '', event_id: '', delivery_date: '', delivery_time: '', extra_value: '', payment_method: '' };

// ─── Financial Tab ─────────────────────────────────────────────────────────────
function FinanceiroView({ orders }: { orders: Order[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => setChecked(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }), []);

  const withExtra = orders.filter(o => o.extra_value != null && o.extra_value > 0);
  const total     = withExtra.reduce((s, o) => s + (o.extra_value ?? 0), 0);
  const done      = orders.filter(o => o.status === 'done' && (o.extra_value ?? 0) > 0);
  const doneTotal = done.reduce((s, o) => s + (o.extra_value ?? 0), 0);

  const byMethod: Record<string, number> = {};
  for (const o of withExtra) {
    const k = o.payment_method ?? 'sem_forma';
    byMethod[k] = (byMethod[k] ?? 0) + (o.extra_value ?? 0);
  }

  const methodLabel: Record<string, string> = {
    dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'Pix', evento: 'Evento', sem_forma: 'Sem forma',
  };

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Total em extras</p>
          <p className="text-2xl font-bold text-foreground">{fmtBRL(total)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{withExtra.length} pedido{withExtra.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Prontos</p>
          <p className="text-2xl font-bold text-emerald-600">{fmtBRL(doneTotal)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{done.length} pedido{done.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">A receber</p>
          <p className="text-2xl font-bold text-amber-600">{fmtBRL(total - doneTotal)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">em aberto</p>
        </div>
      </div>

      {/* By payment method */}
      {Object.keys(byMethod).length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <p className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/30 border-b border-border">
            Por forma de pagamento
          </p>
          {Object.entries(byMethod)
            .sort(([,a],[,b]) => b - a)
            .map(([method, val]) => (
              <div key={method} className="flex items-center justify-between px-5 py-3 border-b border-border/50 last:border-0">
                <span className="text-sm font-medium text-foreground">{methodLabel[method] ?? method}</span>
                <span className="text-sm font-bold text-foreground">{fmtBRL(val)}</span>
              </div>
            ))}
        </div>
      )}

      {/* Orders with extra */}
      {withExtra.length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <p className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/30 border-b border-border">
            Pedidos com extra
          </p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border/50">
              {withExtra
                .sort((a,b) => b.delivery_date.localeCompare(a.delivery_date))
                .map(o => {
                  const cfg = STATUS_CFG[o.status];
                  const pm  = PAYMENT_METHODS.find(m => m.value === o.payment_method);
                  return (
                    <tr key={o.id}
                      onClick={() => toggle(o.id)}
                      className={`cursor-pointer transition-colors select-none ${checked.has(o.id) ? 'bg-emerald-50' : 'hover:bg-muted/10'}`}>
                      <td className="px-5 py-3">
                        <p className={`font-medium ${checked.has(o.id) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{o.title}</p>
                        {pm && <p className="text-xs text-muted-foreground mt-0.5">{pm.label}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(o.delivery_date)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold whitespace-nowrap">
                        {checked.has(o.id)
                          ? <span className="text-emerald-600 flex items-center justify-end gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{fmtBRL(o.extra_value!)}</span>
                          : <span className="text-emerald-600">{fmtBRL(o.extra_value!)}</span>
                        }
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {withExtra.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Nenhum pedido com valor extra cadastrado.
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SupervisorProducaoPage() {
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [eventSearch, setEventSearch]   = useState('');
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [showDrop, setShowDrop]   = useState(false);
  const [filter, setFilter]       = useState<FilterType>('pending');
  const [search, setSearch]       = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)('production_orders')
      .select('*, events(event_name)')
      .eq('company_id', COMPANY_ID)
      .order('delivery_date').order('delivery_time');
    setOrders((data ?? []).map((o: any) => ({ ...o, event_name: o.events?.event_name ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const sub = (supabase as any)
      .channel('production_supervisor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders' }, load)
      .subscribe();
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (eventSearch.length < 2) { setEventOptions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await (supabase.from as any)('events')
        .select('id, event_name, event_date')
        .ilike('event_name', `%${eventSearch}%`)
        .eq('company_id', COMPANY_ID)
        .order('event_date').limit(8);
      setEventOptions(data ?? []);
      setShowDrop(true);
    }, 300);
    return () => clearTimeout(t);
  }, [eventSearch]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const openEdit = (o: Order) => {
    setEditingId(o.id);
    setForm({
      title:            o.title,
      description:      o.description ?? '',
      delivery_address: o.delivery_address ?? '',
      event_id:         o.event_id ?? '',
      delivery_date:    o.delivery_date,
      delivery_time:    o.delivery_time ?? '',
      extra_value:      o.extra_value != null ? String(o.extra_value) : '',
      payment_method:   o.payment_method ?? '',
    });
    setEventSearch(o.event_name ?? '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.delivery_date) return;
    setSaving(true);
    const payload = {
      title:            form.title,
      description:      form.description || null,
      delivery_address: form.delivery_address || null,
      event_id:         form.event_id || null,
      delivery_date:    form.delivery_date,
      delivery_time:    form.delivery_time || null,
      extra_value:      form.extra_value ? parseFloat(form.extra_value.replace(',', '.')) : null,
      payment_method:   form.payment_method || null,
    };
    if (editingId) {
      const { error } = await (supabase.from as any)('production_orders').update(payload).eq('id', editingId);
      if (error) { toast.error('Erro ao salvar pedido'); setSaving(false); return; }
      toast.success('Pedido atualizado!');
    } else {
      const { error } = await (supabase.from as any)('production_orders').insert({ company_id: COMPANY_ID, ...payload, status: 'pending' });
      if (error) { toast.error('Erro ao criar pedido'); setSaving(false); return; }
      toast.success('Pedido criado!');
    }
    setSaving(false);
    setModalOpen(false);
    setEditingId(null);
    setForm(BLANK);
    setEventSearch('');
    load();
  };

  const cycleStatus = async (order: Order) => {
    const next = STATUS_CFG[order.status].next;
    await (supabase.from as any)('production_orders').update({ status: next }).eq('id', order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o));
  };

  const deleteOrder = async (id: string) => {
    if (!confirm('Excluir este pedido?')) return;
    const { error } = await (supabase.from as any)('production_orders')
      .delete()
      .eq('id', id);
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    setOrders(prev => prev.filter(o => o.id !== id));
    toast.success('Pedido excluído');
  };

  const today = new Date().toISOString().slice(0, 10);
  const STATUS_ORDER: Record<Status, number> = { pending: 0, in_progress: 1, done: 2 };

  const isStatusFilter = (f: FilterType): f is Status => f !== 'financeiro';

  const filtered = isStatusFilter(filter)
    ? orders
        .filter(o =>
          o.status === filter &&
          (search === '' || o.title.toLowerCase().includes(search.toLowerCase()) || (o.event_name ?? '').toLowerCase().includes(search.toLowerCase())),
        )
        .sort((a, b) => {
          const dateDiff = a.delivery_date.localeCompare(b.delivery_date);
          if (dateDiff !== 0) return dateDiff;
          const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          if (sd !== 0) return sd;
          return (a.delivery_time ?? '').localeCompare(b.delivery_time ?? '');
        })
    : [];

  const overdue     = filtered.filter(o => o.delivery_date < today && o.status !== 'done');
  const todayOrders = filtered.filter(o => o.delivery_date === today);
  const future      = filtered.filter(o => o.delivery_date > today);
  const doneOrders  = filtered.filter(o => o.status === 'done');

  const pending    = orders.filter(o => o.status === 'pending').length;
  const inProgress = orders.filter(o => o.status === 'in_progress').length;

  const SectionHeader = ({ label, color }: { label: string; color: string }) => (
    <tr>
      <td colSpan={6} className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest ${color} bg-muted/20 border-y border-border/50`}>
        {label}
      </td>
    </tr>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produção</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pending > 0 && `${pending} pendente${pending > 1 ? 's' : ''}`}
            {pending > 0 && inProgress > 0 && ' · '}
            {inProgress > 0 && `${inProgress} em produção`}
            {pending === 0 && inProgress === 0 && 'Tudo em dia'}
          </p>
        </div>
        <button onClick={() => { setForm(BLANK); setEventSearch(''); setEditingId(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo pedido
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {filter !== 'financeiro' && (
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input className="w-full pl-8 pr-3 py-2 rounded-xl border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        )}
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
          {(['pending', 'in_progress', 'done', 'financeiro'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filter === f ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {f === 'financeiro' ? <><TrendingUp className="w-3 h-3" />Financeiro</> : STATUS_CFG[f].label}
            </button>
          ))}
        </div>
      </div>

      {/* Financial view */}
      {filter === 'financeiro' && (
        loading
          ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          : <FinanceiroView orders={orders} />
      )}

      {/* Orders table */}
      {filter !== 'financeiro' && (
        loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Nenhum pedido encontrado.</div>
        ) : (
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  <th className="text-left px-5 py-3">Pedido</th>
                  <th className="text-left px-4 py-3">Evento</th>
                  <th className="text-center px-4 py-3">Entrega</th>
                  <th className="text-center px-4 py-3">Extra</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(() => {
                  const Row = (o: (typeof filtered)[0]) => {
                    const cfg = STATUS_CFG[o.status];
                    const isLate = o.delivery_date < today && o.status !== 'done';
                    const pm = PAYMENT_METHODS.find(m => m.value === o.payment_method);
                    return (
                      <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-foreground">{o.title}</p>
                          {o.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{o.description}</p>}
                          {o.delivery_address && <p className="text-xs text-blue-600 mt-0.5">📍 {o.delivery_address}</p>}
                          {pm && <p className="text-xs text-muted-foreground/70 mt-0.5">{pm.label}</p>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {o.event_name ? <span className="flex items-center gap-1"><ChefHat className="w-3 h-3" />{o.event_name}</span> : '—'}
                        </td>
                        <td className={`px-4 py-3 text-center text-xs font-medium ${isLate ? 'text-red-500' : 'text-muted-foreground'}`}>
                          <span className="flex items-center justify-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {fmtDate(o.delivery_date)}{o.delivery_time ? ` ${o.delivery_time.slice(0,5)}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-medium text-emerald-600">
                          {o.extra_value != null ? fmtBRL(o.extra_value) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => cycleStatus(o)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap">
                              {cfg.nextLabel}
                            </button>
                            <button onClick={() => openEdit(o)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteOrder(o.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  };

                  if (filter === 'done') {
                    return <>{doneOrders.map(Row)}</>;
                  }
                  return (
                    <>
                      {overdue.length > 0 && <><SectionHeader label="⚠ Atrasados" color="text-red-500" />{overdue.map(Row)}</>}
                      {todayOrders.length > 0 && <><SectionHeader label="Hoje" color="text-primary" />{todayOrders.map(Row)}</>}
                      {future.length > 0 && <><SectionHeader label="Próximos" color="text-muted-foreground" />{future.map(Row)}</>}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setModalOpen(false); setEditingId(null); }}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <p className="font-semibold text-sm">{editingId ? 'Editar pedido' : 'Novo pedido de produção'}</p>
              <button onClick={() => { setModalOpen(false); setEditingId(null); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Título *</label>
                <input className={inputCls} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: Bolo de 3 andares, brigadeiros..." required />
              </div>

              <div>
                <label className={labelCls}>Descrição</label>
                <textarea className={inputCls + ' resize-none'} rows={3} value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Quantidade, sabor, detalhes..." />
              </div>

              <div>
                <label className={labelCls}>Endereço de entrega</label>
                <input className={inputCls} value={form.delivery_address}
                  onChange={e => setForm(p => ({ ...p, delivery_address: e.target.value }))}
                  placeholder="Rua, número, bairro..." />
              </div>

              <div ref={searchRef} className="relative">
                <label className={labelCls}>Evento (opcional)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input className={inputCls + ' pl-8'} value={eventSearch}
                    onChange={e => { setEventSearch(e.target.value); if (!e.target.value) setForm(p => ({ ...p, event_id: '' })); }}
                    onFocus={() => eventOptions.length > 0 && setShowDrop(true)}
                    placeholder="Buscar evento..." />
                </div>
                {form.event_id && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Evento vinculado
                  </p>
                )}
                {showDrop && eventOptions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                    {eventOptions.map(ev => (
                      <button key={ev.id} type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                        onClick={() => { setForm(p => ({ ...p, event_id: ev.id })); setEventSearch(ev.event_name); setShowDrop(false); }}>
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

              <div>
                <label className={labelCls}>Forma de pagamento</label>
                <div className="flex gap-2 flex-wrap">
                  {PAYMENT_METHODS.map(({ value, label }) => (
                    <button key={value} type="button"
                      onClick={() => setForm(p => ({ ...p, payment_method: p.payment_method === value ? '' : value }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        form.payment_method === value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-white text-muted-foreground border-border hover:border-primary/40'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving ? 'Criando...' : 'Criar pedido'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
