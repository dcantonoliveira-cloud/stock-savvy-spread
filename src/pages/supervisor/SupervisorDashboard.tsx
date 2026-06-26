import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight, ChevronLeft, UtensilsCrossed } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ── types ──────────────────────────────────────────────────────────────────
type EventRow = {
  id: string; event_name: string; event_date: string | null;
  status: string; guest_count: number | null; created_at: string;
};
type TastingRow = { id: string; scheduled_date: string; type: string | null };

const STATUS_LABEL: Record<string, string> = {
  lead: 'Lead', negotiating: 'Negociando',
  tasting_scheduled: 'Deg. agendada', confirmed: 'Confirmado',
  completed: 'Realizado', cancelled: 'Cancelado',
};
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_LONG  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS    = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [,m,day] = d.split('T')[0].split('-');
  return `${day}/${m}`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

// ── component ──────────────────────────────────────────────────────────────
export default function SupervisorDashboard() {
  const navigate  = useNavigate();
  const [events,   setEvents]   = useState<EventRow[]>([]);
  const [tastings, setTastings] = useState<TastingRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  // Calendar state
  const now = new Date();
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()); // 0-indexed

  useEffect(() => {
    const load = async () => {
      // Load 3 years of events (prev + current + next) — same pattern as EventsPage
      const [ev1, ev2, ev3, tsRes] = await Promise.all([
        supabase.from('events').select('id, event_name, event_date, status, guest_count, created_at')
          .gte('event_date', `${now.getFullYear() - 1}-01-01`).lte('event_date', `${now.getFullYear() - 1}-12-31`)
          .not('event_name', 'is', null).neq('event_name', ''),
        supabase.from('events').select('id, event_name, event_date, status, guest_count, created_at')
          .gte('event_date', `${now.getFullYear()}-01-01`).lte('event_date', `${now.getFullYear()}-12-31`)
          .not('event_name', 'is', null).neq('event_name', ''),
        supabase.from('events').select('id, event_name, event_date, status, guest_count, created_at')
          .gte('event_date', `${now.getFullYear() + 1}-01-01`).lte('event_date', `${now.getFullYear() + 1}-12-31`)
          .not('event_name', 'is', null).neq('event_name', ''),
        supabase.from('tasting_sessions' as any).select('id, scheduled_date, type').order('scheduled_date', { ascending: true }),
      ]);
      const allEvents = [
        ...((ev1.data ?? []) as EventRow[]),
        ...((ev2.data ?? []) as EventRow[]),
        ...((ev3.data ?? []) as EventRow[]),
      ];
      console.log('[dashboard] ev1', ev1.data?.length, ev1.error);
      console.log('[dashboard] ev2', ev2.data?.length, ev2.error);
      console.log('[dashboard] ev3', ev3.data?.length, ev3.error);
      console.log('[dashboard] total events', allEvents.length);
      setEvents(allEvents);
      setTastings((tsRes.data ?? []) as TastingRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const today     = now.toISOString().split('T')[0];
  const thisMonth = now.toISOString().slice(0, 7);

  // KPIs
  const activeEvents     = events.filter(e => e.status !== 'cancelled');
  const openBudgets      = activeEvents.filter(e => ['lead','negotiating'].includes(e.status));
  const confirmedEvents  = activeEvents.filter(e => ['confirmed','completed'].includes(e.status));
  const upcomingTastings = tastings.filter(t => t.scheduled_date >= today);
  const eventsThisMonth  = activeEvents.filter(e => e.event_date?.startsWith(thisMonth) && ['confirmed','completed'].includes(e.status)).length;

  // Chart data
  const chartData = MONTHS_SHORT.map((m, i) => {
    const prefix = `${chartYear}-${String(i + 1).padStart(2, '0')}`;
    return { month: m, eventos: activeEvents.filter(e => e.event_date?.startsWith(prefix) && ['confirmed','completed'].includes(e.status)).length };
  });

  // Calendar
  const calDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    return { firstDay, daysInMonth };
  }, [calYear, calMonth]);

  // Map date → events/tastings for current calendar month
  const calPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const eventsByDate: Record<string, EventRow[]> = {};
  activeEvents.filter(e => e.event_date?.startsWith(calPrefix)).forEach(e => {
    const d = e.event_date!.split('T')[0];
    if (!eventsByDate[d]) eventsByDate[d] = [];
    eventsByDate[d].push(e);
  });
  const tastingsByDate: Record<string, TastingRow[]> = {};
  tastings.filter(t => t.scheduled_date.startsWith(calPrefix)).forEach(t => {
    if (!tastingsByDate[t.scheduled_date]) tastingsByDate[t.scheduled_date] = [];
    tastingsByDate[t.scheduled_date].push(t);
  });

  // Selected day detail
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selectedDate = selectedDay
    ? `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;
  const selectedEvents   = selectedDate ? (eventsByDate[selectedDate]   ?? []) : [];
  const selectedTastings = selectedDate ? (tastingsByDate[selectedDate] ?? []) : [];

  // Pipeline
  const pipelineSteps = ['lead','negotiating','tasting_scheduled'];
  const pipelineMax   = Math.max(...pipelineSteps.map(s => activeEvents.filter(e => e.status === s).length), 1);

  // Timeline — recent open budgets + confirmed upcoming
  const timeline = [
    ...openBudgets.slice(0, 5).map(e => ({ label: e.event_name, sub: STATUS_LABEL[e.status], id: e.id, dot: 'bg-amber-400' })),
    ...activeEvents.filter(e => e.event_date && e.event_date >= today && e.status === 'confirmed').slice(0, 4)
      .map(e => ({ label: e.event_name, sub: `Confirmado · ${fmtDate(e.event_date)}`, id: e.id, dot: 'bg-emerald-500' })),
  ].slice(0, 9);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); setSelectedDay(null); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); setSelectedDay(null); };

  if (loading) return <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{greeting()}, Douglas</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
        {[
          { label: 'Eventos este mês', value: eventsThisMonth, sub: 'confirmados', path: '/events' },
          { label: 'Orçamentos abertos', value: openBudgets.length, sub: 'aguardando', path: '/orcamentos' },
          { label: 'Próximas degustações', value: upcomingTastings.length, sub: 'agendadas', path: '/tastings' },
          { label: 'Eventos confirmados', value: confirmedEvents.length, sub: 'no total', path: '/events' },
        ].map(k => (
          <div key={k.label} onClick={() => navigate(k.path)}
            className="bg-white px-6 py-5 cursor-pointer hover:bg-slate-50 transition-colors">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3">{k.label}</p>
            <p className="text-4xl font-bold tabular-nums text-foreground">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — chart + calendar */}
        <div className="lg:col-span-2 space-y-6">

          {/* Chart */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-semibold text-foreground">Eventos por mês</p>
                <p className="text-xs text-muted-foreground mt-0.5">Confirmados e realizados</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setChartYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold tabular-nums w-10 text-center">{chartYear}</span>
                <button onClick={() => setChartYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={20}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={20} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))', radius: 6 }}
                  contentStyle={{ background: 'white', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [v, 'Eventos']} />
                <Bar dataKey="eventos" fill="hsl(var(--foreground))" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Calendar */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            {/* Cal header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-semibold text-foreground">{MONTHS_LONG[calMonth]} {calYear}</p>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {/* Week day headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEK_DAYS.map(d => (
                  <p key={d} className="text-[10px] font-semibold uppercase text-muted-foreground/50 text-center py-1">{d}</p>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-y-1">
                {/* empty cells before first day */}
                {Array.from({ length: calDays.firstDay }).map((_, i) => <div key={`e${i}`} />)}

                {Array.from({ length: calDays.daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const hasEvent   = !!eventsByDate[dateStr];
                  const hasTasting = !!tastingsByDate[dateStr];
                  const isToday    = dateStr === today;
                  const isSelected = day === selectedDay;
                  const isPast     = dateStr < today;

                  return (
                    <div key={day} onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                      className={`relative flex flex-col items-center py-1 rounded-lg cursor-pointer transition-colors
                        ${isSelected ? 'bg-foreground text-white' : isToday ? 'bg-primary/10' : 'hover:bg-muted/60'}
                      `}>
                      <span className={`text-sm tabular-nums leading-tight
                        ${isSelected ? 'font-bold text-white' : isToday ? 'font-bold text-primary' : isPast ? 'text-muted-foreground/50' : 'text-foreground font-medium'}
                      `}>{day}</span>
                      {/* dots */}
                      {(hasEvent || hasTasting) && (
                        <div className="flex gap-0.5 mt-0.5">
                          {hasEvent   && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-foreground'}`} />}
                          {hasTasting && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/60' : 'bg-slate-400'}`} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-foreground" />
                  <span className="text-xs text-muted-foreground">Evento</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-xs text-muted-foreground">Degustação</span>
                </div>
              </div>
            </div>

            {/* Selected day detail */}
            {selectedDay && (selectedEvents.length > 0 || selectedTastings.length > 0) && (
              <div className="border-t border-border px-4 py-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
                  {String(selectedDay).padStart(2, '0')}/{String(calMonth + 1).padStart(2, '0')}
                </p>
                {selectedEvents.map(e => (
                  <div key={e.id} onClick={() => navigate(`/events/${e.id}`)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors group">
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{e.event_name}</span>
                    <span className="text-xs text-muted-foreground">{STATUS_LABEL[e.status] ?? e.status}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                  </div>
                ))}
                {selectedTastings.map(t => (
                  <div key={t.id} onClick={() => navigate(`/tastings/${t.id}`)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors group">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                    <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground flex-1">{t.type ?? 'Degustação'}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                  </div>
                ))}
              </div>
            )}
            {selectedDay && selectedEvents.length === 0 && selectedTastings.length === 0 && (
              <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground text-center">
                Nenhum evento neste dia.
              </div>
            )}
          </div>
        </div>

        {/* Right col */}
        <div className="space-y-6">

          {/* Pipeline */}
          <div className="bg-white border border-border rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Em negociação</p>
            <div className="space-y-3">
              {pipelineSteps.map(s => {
                const count = activeEvents.filter(e => e.status === s).length;
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</span>
                      <span className="text-xs font-bold tabular-nums text-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-foreground/70 rounded-full transition-all"
                        style={{ width: `${Math.round((count / pipelineMax) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total ativo</span>
                <span className="text-sm font-bold text-foreground">{activeEvents.length}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Linha do tempo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Orçamentos abertos e próximos</p>
            </div>
            <div className="px-5 py-4">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem atividade recente.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-4">
                    {timeline.map((item, i) => (
                      <div key={i} onClick={() => navigate(`/events/${item.id}`)}
                        className="flex gap-4 cursor-pointer group">
                        <div className={`shrink-0 w-2.5 h-2.5 rounded-full border-2 border-white mt-1 z-10 ${item.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground group-hover:underline truncate leading-tight">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming tastings */}
          {upcomingTastings.length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Degustações</p>
                <button onClick={() => navigate('/tastings')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Ver todas</button>
              </div>
              <div className="divide-y divide-border/60">
                {upcomingTastings.slice(0, 4).map(t => {
                  const diff = Math.round((new Date(t.scheduled_date + 'T12:00:00').getTime() - Date.now()) / 86400000);
                  return (
                    <div key={t.id} onClick={() => navigate(`/tastings/${t.id}`)}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors">
                      <UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{t.type ?? 'Degustação'}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{t.scheduled_date.split('T')[0].split('-').reverse().join('/')}</p>
                      </div>
                      <span className={`text-xs font-semibold ${diff <= 3 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : `${diff}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Open budgets */}
      {openBudgets.length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Orçamentos em aberto</p>
            <button onClick={() => navigate('/orcamentos')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Ver todos</button>
          </div>
          <div className="divide-y divide-border/50">
            {openBudgets.slice(0, 6).map(e => (
              <div key={e.id} onClick={() => navigate(`/events/${e.id}`)}
                className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 cursor-pointer transition-colors group">
                <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                  e.status === 'negotiating' ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-border text-muted-foreground bg-muted/40'
                }`}>{STATUS_LABEL[e.status]}</span>
                <p className="flex-1 text-sm font-medium text-foreground truncate">{e.event_name}</p>
                <p className="text-xs text-muted-foreground tabular-nums shrink-0">{fmtDate(e.event_date)}</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
