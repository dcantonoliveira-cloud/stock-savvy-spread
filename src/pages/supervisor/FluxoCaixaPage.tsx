import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, ChevronLeft, ChevronRight, ExternalLink, TrendingUp, TrendingDown, Wallet, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ── types ──────────────────────────────────────────────────────────────────
type Entry = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  event_id: string | null;
  events?: { event_name: string; event_date?: string | null; location_text?: string | null } | null;
  created_at: string;
  reconciled?: boolean;
  _source?: 'cash_flow' | 'event_payment';
  _readonly?: boolean;
  _ep_id?: string; // real event_payments.id for DB updates
};

type EventOption = { id: string; event_name: string; total_value: number | null };

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CATEGORY_LABEL: Record<string, string> = {
  event_payment: 'Pagamento de evento',
  manual: 'Lançamento manual',
  expense: 'Despesa',
  entrada: 'Entrada',
  parcela: 'Parcela',
  reembolso: 'Reembolso',
  outros: 'Outros',
};

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${String(y).slice(2)}`;
}

// ── component ──────────────────────────────────────────────────────────────
export default function FluxoCaixaPage() {
  const navigate  = useNavigate();
  const now       = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [entries,  setEntries]  = useState<Entry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const last  = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    const [cashRes, paymentsRes] = await Promise.all([
      supabase
        .from('cash_flow_entries' as any)
        .select('*, events(event_name)')
        .gte('date', first)
        .lte('date', last)
        .order('date', { ascending: false }),
      supabase
        .from('event_payments' as any)
        .select('id, event_id, payment_date, value, payment_type, is_confirmed, reconciled, events(event_name, event_date, location_text)')
        .gte('payment_date', first)
        .lte('payment_date', last)
        .eq('is_confirmed', true)
        .order('payment_date', { ascending: false }),
    ]);

    const cashEntries: Entry[] = ((cashRes.data ?? []) as any[]).map(e => ({ ...e, _source: 'cash_flow' }));

    const paymentEntries: Entry[] = ((paymentsRes.data ?? []) as any[]).map(p => ({
      id: `ep_${p.id}`,
      date: p.payment_date,
      description: `Pagamento — ${(p.events as any)?.event_name ?? 'Evento'}`,
      amount: p.value,
      category: p.payment_type ?? 'event_payment',
      event_id: p.event_id,
      events: p.events as any,
      created_at: p.payment_date,
      reconciled: p.reconciled ?? false,
      _source: 'event_payment',
      _readonly: true,
      _ep_id: p.id,
    }));

    const all = [...cashEntries, ...paymentEntries].sort(
      (a, b) => b.date.localeCompare(a.date)
    );
    setEntries(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [year, month]);

  // KPIs
  const entradas = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const saidas   = entries.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  const saldo    = entradas - saidas;

  // Chart — last 6 months
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - (5 - i), 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // We only have current month loaded, so use entries for current month
    return { month: MONTHS[d.getMonth()] };
  });

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const deleteEntry = async (id: string) => {
    await supabase.from('cash_flow_entries' as any).delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success('Lançamento removido');
  };

  const toggleReconciled = async (entry: Entry) => {
    const newVal = !entry.reconciled;
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, reconciled: newVal } : e));
    if (entry._source === 'event_payment' && entry._ep_id) {
      await supabase.from('event_payments' as any).update({ reconciled: newVal }).eq('id', entry._ep_id);
    } else {
      await supabase.from('cash_flow_entries' as any).update({ reconciled: newVal }).eq('id', entry.id);
    }
  };

  const eventPaymentsCount = entries.filter(e => e._source === 'event_payment').length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Entradas e saídas do mês</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Novo lançamento
        </button>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold min-w-[130px] text-center">
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} className="p-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Entradas</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">{fmtBRL(entradas)}</p>
          <p className="text-xs text-muted-foreground mt-1">{entries.filter(e => e.amount > 0).length} lançamentos</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Saídas</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-red-500">{fmtBRL(saidas)}</p>
          <p className="text-xs text-muted-foreground mt-1">{entries.filter(e => e.amount < 0).length} lançamentos</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-primary" />
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Saldo</p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${saldo >= 0 ? 'text-foreground' : 'text-red-500'}`}>{fmtBRL(saldo)}</p>
          <p className="text-xs text-muted-foreground mt-1">{entries.length} total</p>
        </div>
      </div>

      {/* Entries table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="grid grid-cols-[100px_1fr_160px_120px_36px_36px] gap-3 flex-1">
            {['Data','Descrição','Categoria','Valor','',''].map((h, i) => (
              <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i >= 3 ? 'text-right' : ''}`}>{h}</span>
            ))}
          </div>
          {eventPaymentsCount > 0 && (
            <span className="ml-3 shrink-0 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">
              {eventPaymentsCount} pagamento{eventPaymentsCount > 1 ? 's' : ''} de evento
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhum lançamento em {MONTHS[month]} {year}.<br />
            <button onClick={() => setShowModal(true)} className="text-primary hover:underline mt-1 text-sm">Adicionar lançamento</button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {entries.map(e => (
              <div key={e.id} className={`px-5 py-3 grid grid-cols-[100px_1fr_160px_120px_36px_36px] gap-3 items-center hover:bg-slate-50 transition-colors group ${e._source === 'event_payment' ? 'bg-emerald-50/30' : ''}`}>
                <span className="text-sm tabular-nums text-muted-foreground">{fmtDate(e.date)}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold shrink-0 ${e.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {e.amount >= 0 ? 'ENTRADA' : 'SAÍDA'}
                    </span>
                    <p className="text-sm font-medium truncate text-foreground">{e.description}</p>
                    {e._source === 'event_payment' && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">evento</span>
                    )}
                  </div>
                  {e._source === 'event_payment' && e.event_id ? (
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <button onClick={() => navigate(`/events/${e.event_id}`)}
                        className="text-xs text-primary hover:underline flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {e.events?.event_name ?? 'Ver evento'}
                      </button>
                      {e.events?.event_date && (
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(e.events.event_date.slice(0, 10))}
                        </span>
                      )}
                      {e.events?.location_text && (
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {e.events.location_text}
                        </span>
                      )}
                    </div>
                  ) : e.events?.event_name ? (
                    <button onClick={() => navigate(`/events/${e.event_id}`)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                      <ExternalLink className="w-3 h-3" />
                      {e.events.event_name}
                    </button>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground truncate">{CATEGORY_LABEL[e.category] ?? e.category}</span>
                <span className={`text-sm font-semibold tabular-nums text-right ${e.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {e.amount >= 0 ? '+' : ''}{fmtBRL(e.amount)}
                </span>
                {/* Conferido */}
                <button
                  onClick={() => toggleReconciled(e)}
                  title={e.reconciled ? 'Conferido — clique para desmarcar' : 'Marcar como conferido'}
                  className={`p-1.5 rounded-lg transition-all ${
                    e.reconciled
                      ? 'bg-emerald-100 text-emerald-600 ring-1 ring-emerald-300'
                      : 'opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                >
                  <Check className="w-4 h-4" strokeWidth={e.reconciled ? 2.5 : 2} />
                </button>
                {!e._readonly ? (
                  <button onClick={() => deleteEntry(e.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NewEntryModal
          onClose={() => setShowModal(false)}
          onCreated={(entry) => { setEntries(prev => [entry, ...prev]); setShowModal(false); }}
          defaultDate={`${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`}
        />
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
function NewEntryModal({ onClose, onCreated, defaultDate }: {
  onClose: () => void;
  onCreated: (e: Entry) => void;
  defaultDate: string;
}) {
  const [date,        setDate]        = useState(defaultDate);
  const [description, setDescription] = useState('');
  const [amount,      setAmount]      = useState('');
  const [type,        setType]        = useState<'entrada' | 'saida'>('entrada');
  const [category,    setCategory]    = useState('manual');
  const [eventId,     setEventId]     = useState('');
  const [events,      setEvents]      = useState<EventOption[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [eventSearch, setEventSearch] = useState('');

  useEffect(() => {
    supabase.from('events').select('id, event_name, total_value')
      .in('status', ['confirmed', 'negotiating', 'completed'])
      .not('event_name', 'is', null)
      .order('event_date', { ascending: false })
      .limit(200)
      .then(({ data }) => setEvents((data ?? []) as EventOption[]));
  }, []);

  const filteredEvents = events.filter(e =>
    e.event_name.toLowerCase().includes(eventSearch.toLowerCase())
  ).slice(0, 8);

  const handleEventSelect = (ev: EventOption) => {
    setEventId(ev.id);
    setDescription(`Pagamento — ${ev.event_name}`);
    setCategory('event_payment');
    setType('entrada');
    if (ev.total_value) setAmount(String(ev.total_value));
    setEventSearch(ev.event_name);
  };

  const save = async () => {
    if (!date || !description || !amount) { toast.error('Preencha todos os campos'); return; }
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount)) { toast.error('Valor inválido'); return; }
    setSaving(true);
    const finalAmount = type === 'saida' ? -Math.abs(numAmount) : Math.abs(numAmount);
    const { data, error } = await supabase
      .from('cash_flow_entries' as any)
      .insert({ date, description, amount: finalAmount, category, event_id: eventId || null })
      .select('*, events(event_name)').single();
    if (error) { toast.error('Erro ao salvar'); setSaving(false); return; }
    toast.success('Lançamento adicionado');
    onCreated(data as Entry);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Novo lançamento</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">

          {/* Tipo */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button onClick={() => setType('entrada')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'entrada' ? 'bg-emerald-600 text-white' : 'bg-white text-muted-foreground hover:bg-muted'}`}>
              + Entrada
            </button>
            <button onClick={() => setType('saida')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'saida' ? 'bg-red-500 text-white' : 'bg-white text-muted-foreground hover:bg-muted'}`}>
              − Saída
            </button>
          </div>

          {/* Vincular evento */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">
              Vincular a evento <span className="normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={eventSearch}
              onChange={e => { setEventSearch(e.target.value); if (!e.target.value) setEventId(''); }}
              placeholder="Buscar evento..."
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {eventSearch && !eventId && filteredEvents.length > 0 && (
              <div className="border border-border rounded-xl mt-1 overflow-hidden shadow-md bg-white">
                {filteredEvents.map(ev => (
                  <button key={ev.id} type="button"
                    onClick={() => handleEventSelect(ev)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2">
                    <span className="truncate">{ev.event_name}</span>
                    {ev.total_value && <span className="text-xs text-muted-foreground shrink-0">{fmtBRL(ev.total_value)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Data */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Descrição</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Pagamento entrada Beatrice e Lucas"
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          {/* Valor */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Valor (R$)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01"
              placeholder="0,00"
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Categoria</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="event_payment">Pagamento de evento</option>
              <option value="manual">Lançamento manual</option>
              <option value="expense">Despesa</option>
            </select>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar lançamento'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
