import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, TrendingUp, Clock, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

// Para cada evento: total_value - soma dos pagamentos confirmados = saldo devedor
type EventBalance = {
  id: string;
  event_name: string;
  client_name: string | null;
  event_date: string | null;
  total_value: number;
  paid: number;
  outstanding: number; // total_value - paid
  status: string | null;
};

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
const fmtMonth = (d: string) => {
  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const [y, m] = d.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
};
const today = new Date().toISOString().slice(0, 10);

export default function ContasReceberPage() {
  const navigate = useNavigate();
  const [events, setEvents]   = useState<EventBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'aberto' | 'vencido'>('aberto');
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);

    // Busca eventos ativos com valor definido
    const { data: eventsData } = await supabase
      .from('events')
      .select('id, event_name, event_date, total_value, status, clients(name)')
      .in('status', ['confirmed', 'negotiating', 'completed'])
      .not('total_value', 'is', null)
      .gt('total_value', 0)
      .order('event_date', { ascending: true });

    if (!eventsData || eventsData.length === 0) { setLoading(false); return; }

    // Busca todos os pagamentos confirmados desses eventos
    const eventIds = (eventsData as any[]).map((e: any) => e.id);
    const { data: paymentsData } = await supabase
      .from('event_payments' as any)
      .select('event_id, value')
      .in('event_id', eventIds)
      .eq('is_confirmed', true);

    // Agrupa pagamentos por evento
    const paidByEvent: Record<string, number> = {};
    ((paymentsData ?? []) as any[]).forEach((p: any) => {
      paidByEvent[p.event_id] = (paidByEvent[p.event_id] ?? 0) + p.value;
    });

    const balances: EventBalance[] = ((eventsData as any[]))
      .map((e: any) => {
        const paid = paidByEvent[e.id] ?? 0;
        const outstanding = Math.max(0, (e.total_value ?? 0) - paid);
        return {
          id: e.id,
          event_name: e.event_name ?? '—',
          client_name: (e.clients as any)?.name ?? null,
          event_date: e.event_date,
          total_value: e.total_value ?? 0,
          paid,
          outstanding,
          status: e.status,
        };
      })
      .filter(e => e.outstanding > 0); // só quem ainda deve algo

    setEvents(balances);

    // Abre o mês atual por padrão
    const currentPrefix = today.slice(0, 7);
    setOpenMonths(new Set([currentPrefix]));

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isPastEvent = (e: EventBalance) =>
    e.event_date !== null && e.event_date < today;

  // Aba "Em aberto" = evento ainda não aconteceu (ou não tem data)
  // Aba "Vencidos" = evento já passou mas ainda tem saldo
  const filtered = events.filter(e =>
    tab === 'vencido' ? isPastEvent(e) : !isPastEvent(e)
  );

  // Agrupa por mês do evento
  const byMonth: Record<string, EventBalance[]> = {};
  filtered.forEach(e => {
    const key = e.event_date ? e.event_date.slice(0, 7) : 'sem-data';
    (byMonth[key] ??= []).push(e);
  });
  const monthKeys = Object.keys(byMonth).sort();

  const toggleMonth = (k: string) =>
    setOpenMonths(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const totalAberto  = events.filter(e => !isPastEvent(e)).reduce((s, e) => s + e.outstanding, 0);
  const totalVencido = events.filter(e => isPastEvent(e)).reduce((s, e) => s + e.outstanding, 0);
  const totalRecebido = events.reduce((s, e) => s + e.paid, 0);

  const TAB = [
    { key: 'aberto',  label: 'Em aberto',  count: events.filter(e => !isPastEvent(e)).length },
    { key: 'vencido', label: 'Vencidos',   count: events.filter(e => isPastEvent(e)).length },
  ] as const;

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-xl font-bold text-foreground">Contas a Receber</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Saldo devedor por evento</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">A receber</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-amber-600">{fmtBRL(totalAberto)}</p>
          <p className="text-xs text-muted-foreground mt-1">{events.filter(e => !isPastEvent(e)).length} eventos com saldo</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Vencidos</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-red-500">{fmtBRL(totalVencido)}</p>
          <p className="text-xs text-muted-foreground mt-1">{events.filter(e => isPastEvent(e)).length} eventos passados com saldo</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Já recebido</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">{fmtBRL(totalRecebido)}</p>
          <p className="text-xs text-muted-foreground mt-1">De {events.length} eventos com saldo aberto</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TAB.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted bg-white border border-border'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${tab === t.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table by month */}
      {loading ? (
        <div className="bg-white border border-border rounded-2xl py-16 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl py-16 text-center text-sm text-muted-foreground">
          {tab === 'aberto' ? 'Nenhum evento com saldo em aberto.' : 'Nenhum evento vencido com saldo.'}
        </div>
      ) : (
        <div className="space-y-3">
          {monthKeys.map(key => {
            const monthEvents = byMonth[key];
            const monthTotal = monthEvents.reduce((s, e) => s + e.outstanding, 0);
            const isOpen = openMonths.has(key);

            return (
              <div key={key} className="bg-white border border-border rounded-2xl overflow-hidden">
                {/* Month header */}
                <button
                  onClick={() => toggleMonth(key)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm font-semibold text-foreground">
                      {key === 'sem-data' ? 'Sem data' : fmtMonth(key + '-01')}
                    </span>
                    <span className="text-xs text-muted-foreground">{monthEvents.length} evento{monthEvents.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-amber-600">{fmtBRL(monthTotal)}</span>
                </button>

                {isOpen && (
                  <>
                    {/* Header row */}
                    <div className="px-5 py-2 bg-muted/20 border-t border-border grid grid-cols-[110px_1fr_110px_110px_110px] gap-3">
                      {['Data do evento','Evento / Cliente','Valor total','Pago','Saldo'].map((h, i) => (
                        <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 ${i >= 2 ? 'text-right' : ''}`}>{h}</span>
                      ))}
                    </div>

                    <div className="divide-y divide-border/50">
                      {monthEvents.map(e => {
                        const pct = e.total_value > 0 ? Math.round((e.paid / e.total_value) * 100) : 0;
                        return (
                          <div key={e.id} className="px-5 py-3 grid grid-cols-[110px_1fr_110px_110px_110px] gap-3 items-center hover:bg-slate-50 transition-colors group">
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {e.event_date ? fmtDate(e.event_date) : '—'}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{e.event_name}</p>
                              {e.client_name && <p className="text-xs text-muted-foreground truncate">{e.client_name}</p>}
                              {/* Barra de progresso */}
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden max-w-[100px]">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-muted-foreground">{pct}% pago</span>
                                <button onClick={() => navigate(`/events/${e.id}`)}
                                  className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-[10px] text-primary hover:underline transition-opacity">
                                  <ExternalLink className="w-3 h-3" />ver
                                </button>
                              </div>
                            </div>
                            <span className="text-sm tabular-nums text-right text-muted-foreground">{fmtBRL(e.total_value)}</span>
                            <span className="text-sm tabular-nums text-right text-emerald-600">+{fmtBRL(e.paid)}</span>
                            <span className="text-sm font-bold tabular-nums text-right text-amber-600">{fmtBRL(e.outstanding)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Month subtotal */}
                    <div className="px-5 py-2.5 border-t border-border bg-muted/10 flex justify-end gap-6">
                      <span className="text-xs text-muted-foreground font-semibold">Total do mês</span>
                      <span className="text-sm font-bold tabular-nums text-amber-600">{fmtBRL(monthTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
