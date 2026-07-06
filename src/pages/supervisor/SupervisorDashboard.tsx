import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  ChevronRight, ChevronLeft, UtensilsCrossed,
  CalendarCheck, FileText, Clock, ArrowUpRight,
} from 'lucide-react';
import NotificationsPanel from '@/components/NotificationsPanel';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ── types ──────────────────────────────────────────────────────────────────
type EventRow = {
  id: string; event_name: string; event_date: string | null;
  status: string; guest_count: number | null; created_at: string;
};
type TastingRow = { id: string; scheduled_date: string; type: string | null };

import { STATUS_LABELS as STATUS_LABEL } from '@/lib/eventStatus';
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_LONG  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS    = ['D','S','T','Q','Q','S','S'];

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

// ── sub-components ─────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  accent?: 'default' | 'amber' | 'emerald' | 'blue';
  path: string;
  onClick: () => void;
}
function KpiCard({ label, value, sub, icon, accent = 'default', onClick }: KpiCardProps) {
  const accentMap = {
    default: 'text-foreground',
    amber:   'text-amber-600',
    emerald: 'text-emerald-600',
    blue:    'text-blue-600',
  };
  return (
    <div
      onClick={onClick}
      className="bg-white border border-border rounded-2xl px-5 py-5 shadow-sm cursor-pointer hover:shadow-md hover:border-foreground/20 transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-xl bg-muted text-muted-foreground group-hover:bg-foreground/5 transition-colors">
          {icon}
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      </div>
      <p className={`text-3xl font-bold tabular-nums ${accentMap[accent]}`}>{value}</p>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
      <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────
export default function SupervisorDashboard() {
  const navigate    = useNavigate();
  const { profile } = useAuth();
  const [events,   setEvents]   = useState<EventRow[]>([]);
  const [tastings, setTastings] = useState<TastingRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  const now = new Date();
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  useEffect(() => {
    const load = async () => {
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

  const activeEvents     = events.filter(e => e.status !== 'cancelled');
  const openBudgets      = activeEvents.filter(e => ['lead', 'negotiating'].includes(e.status));
const upcomingTastings = tastings.filter(t => t.scheduled_date >= today);
  const eventsThisMonth  = activeEvents.filter(e =>
    e.event_date?.startsWith(thisMonth) && ['confirmed', 'completed'].includes(e.status),
  ).length;

  const chartData = MONTHS_SHORT.map((m, i) => {
    const prefix = `${chartYear}-${String(i + 1).padStart(2, '0')}`;
    return {
      month: m,
      eventos: activeEvents.filter(e =>
        e.event_date?.startsWith(prefix) && ['confirmed', 'completed'].includes(e.status),
      ).length,
    };
  });

  const calDays = useMemo(() => {
    const firstDay    = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    return { firstDay, daysInMonth };
  }, [calYear, calMonth]);

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

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selectedDate = selectedDay
    ? `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;
  const selectedEvents   = selectedDate ? (eventsByDate[selectedDate]   ?? []) : [];
  const selectedTastings = selectedDate ? (tastingsByDate[selectedDate] ?? []) : [];

  const pipelineSteps = ['lead', 'negotiating', 'tasting_scheduled'];
  const pipelineMax   = Math.max(...pipelineSteps.map(s => activeEvents.filter(e => e.status === s).length), 1);

  const nextConfirmed = activeEvents
    .filter(e => e.event_date && e.event_date >= today && e.status === 'confirmed')
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))
    .slice(0, 5);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
    setSelectedDay(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {greeting()}, {profile?.display_name?.split(' ')[0] ?? 'bem-vindo'}
          </h1>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Eventos este mês"
          value={eventsThisMonth}
          sub="confirmados e realizados"
          icon={<CalendarCheck className="w-4 h-4" />}
          accent="emerald"
          path="/events"
          onClick={() => navigate('/events')}
        />
        <KpiCard
          label="Orçamentos abertos"
          value={openBudgets.length}
          sub="aguardando fechamento"
          icon={<FileText className="w-4 h-4" />}
          accent="amber"
          path="/orcamentos"
          onClick={() => navigate('/orcamentos')}
        />
        <KpiCard
          label="Próximas degustações"
          value={upcomingTastings.length}
          sub="agendadas"
          icon={<UtensilsCrossed className="w-4 h-4" />}
          accent="blue"
          path="/tastings"
          onClick={() => navigate('/tastings')}
        />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — chart + calendar + pipeline + next events */}
        <div className="lg:col-span-2 space-y-6">

          {/* Chart */}
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-semibold text-foreground">Eventos por mês</p>
                <p className="text-xs text-muted-foreground mt-0.5">Confirmados e realizados</p>
              </div>
              <div className="flex items-center gap-0.5 bg-muted rounded-xl p-1">
                <button
                  onClick={() => setChartYear(y => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-muted-foreground"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-semibold tabular-nums w-12 text-center text-foreground">{chartYear}</span>
                <button
                  onClick={() => setChartYear(y => y + 1)}
                  className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-muted-foreground"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={196}>
              <BarChart data={chartData} barSize={18} margin={{ left: -8, right: 0, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={22}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', radius: 6 }}
                  contentStyle={{
                    background: 'white',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  formatter={(v: number) => [v, 'Eventos']}
                />
                <Bar dataKey="eventos" fill="hsl(var(--foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Calendar */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-semibold text-foreground">
                {MONTHS_LONG[calMonth]} {calYear}
              </p>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-7 mb-2">
                {WEEK_DAYS.map((d, i) => (
                  <p key={i} className="text-[10px] font-bold uppercase text-muted-foreground/40 text-center">{d}</p>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {Array.from({ length: calDays.firstDay }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: calDays.daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr    = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const hasEvent   = !!eventsByDate[dateStr];
                  const hasTasting = !!tastingsByDate[dateStr];
                  const isToday    = dateStr === today;
                  const isSelected = day === selectedDay;
                  const isPast     = dateStr < today;

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                      className={[
                        'relative flex flex-col items-center py-1.5 rounded-lg transition-colors w-full',
                        isSelected
                          ? 'bg-foreground text-white'
                          : isToday
                          ? 'bg-primary/10 ring-1 ring-primary/30'
                          : 'hover:bg-muted/70',
                      ].join(' ')}
                    >
                      <span className={[
                        'text-xs tabular-nums font-medium leading-none',
                        isSelected ? 'text-white' : isToday ? 'text-primary font-bold' : isPast ? 'text-muted-foreground/40' : 'text-foreground',
                      ].join(' ')}>
                        {day}
                      </span>
                      {(hasEvent || hasTasting) && (
                        <div className="flex gap-0.5 mt-1">
                          {hasEvent   && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-foreground'}`} />}
                          {hasTasting && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/50' : 'bg-amber-400'}`} />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-foreground" />
                  <span className="text-[11px] text-muted-foreground">Evento</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] text-muted-foreground">Degustação</span>
                </div>
              </div>
            </div>

            {selectedDay && (selectedEvents.length > 0 || selectedTastings.length > 0) && (
              <div className="border-t border-border px-4 pt-3 pb-2 space-y-1 bg-muted/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2 px-1">
                  {String(selectedDay).padStart(2, '0')}/{String(calMonth + 1).padStart(2, '0')}
                </p>
                {selectedEvents.map(e => (
                  <div
                    key={e.id}
                    onClick={() => navigate(`/events/${e.id}`)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-border/50 hover:border-foreground/20 cursor-pointer transition-all group shadow-sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{e.event_name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{STATUS_LABEL[e.status] ?? e.status}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0" />
                  </div>
                ))}
                {selectedTastings.map(t => (
                  <div
                    key={t.id}
                    onClick={() => navigate(`/tastings/${t.id}`)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-amber-100 hover:border-amber-300 cursor-pointer transition-all group shadow-sm"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-sm text-foreground flex-1">{t.type ?? 'Degustação'}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
            {selectedDay && selectedEvents.length === 0 && selectedTastings.length === 0 && (
              <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground text-center bg-muted/10">
                Nenhum evento neste dia.
              </div>
            )}
          </div>

          {/* Pipeline + Next events side by side below calendar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Pipeline */}
            <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold text-foreground">Pipeline</p>
                <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  {activeEvents.length} ativos
                </span>
              </div>
              <div className="space-y-4">
                {pipelineSteps.map((s, idx) => {
                  const count = activeEvents.filter(e => e.status === s).length;
                  const pct   = Math.round((count / pipelineMax) * 100);
                  const colors = ['bg-slate-300', 'bg-amber-400', 'bg-orange-400'];
                  return (
                    <div key={s}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-muted-foreground">{STATUS_LABEL[s]}</span>
                        <span className="text-xs font-bold tabular-nums text-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${colors[idx]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Next confirmed events */}
            <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Próximos eventos</p>
                <button
                  onClick={() => navigate('/events')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Ver todos
                </button>
              </div>
              {nextConfirmed.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento confirmado.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {nextConfirmed.map(e => {
                    const diff = e.event_date
                      ? Math.round((new Date(e.event_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <div
                        key={e.id}
                        onClick={() => navigate(`/events/${e.id}`)}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-muted/30 cursor-pointer transition-colors group"
                      >
                        <div className="shrink-0 w-8 text-center">
                          <p className="text-[10px] font-bold text-muted-foreground/50 uppercase leading-none">
                            {e.event_date ? MONTHS_SHORT[parseInt(e.event_date.split('-')[1]) - 1] : '—'}
                          </p>
                          <p className="text-base font-bold text-foreground tabular-nums leading-tight">
                            {e.event_date ? e.event_date.split('-')[2].replace(/^0/, '') : '—'}
                          </p>
                        </div>
                        <div className="w-px h-8 bg-border shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{e.event_name}</p>
                          {e.guest_count && (
                            <p className="text-xs text-muted-foreground">{e.guest_count} convidados</p>
                          )}
                        </div>
                        {diff !== null && (
                          <span className={`text-xs font-semibold shrink-0 ${diff <= 7 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : `${diff}d`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right col — notifications full height */}
        <div className="flex flex-col">
          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1">
            <NotificationsPanel fullHeight />
          </div>
        </div>
      </div>

      {/* ── Open budgets table ── */}
      {openBudgets.length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Orçamentos em aberto</p>
              <p className="text-xs text-muted-foreground mt-0.5">{openBudgets.length} aguardando fechamento</p>
            </div>
            <button
              onClick={() => navigate('/orcamentos')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Ver todos <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-border/40">
            {openBudgets.slice(0, 6).map(e => (
              <div
                key={e.id}
                onClick={() => navigate(`/events/${e.id}`)}
                className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20 cursor-pointer transition-colors group"
              >
                <span className={[
                  'shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg',
                  e.status === 'negotiating'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-muted/60 text-muted-foreground border border-border',
                ].join(' ')}>
                  {STATUS_LABEL[e.status]}
                </span>
                <p className="flex-1 text-sm font-medium text-foreground truncate">{e.event_name}</p>
                {e.guest_count && (
                  <p className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:block">
                    {e.guest_count} conv.
                  </p>
                )}
                <p className="text-xs text-muted-foreground tabular-nums shrink-0">{fmtDate(e.event_date)}</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground shrink-0 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming (clock icon) — remaining open budgets warning ── */}
      {openBudgets.length > 6 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Há mais {openBudgets.length - 6} orçamentos aguardando.{' '}
          <button onClick={() => navigate('/orcamentos')} className="underline underline-offset-2">
            Ver todos
          </button>
        </div>
      )}
    </div>
  );
}
