import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight, ChevronLeft, UtensilsCrossed, CalendarDays, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ── types ──────────────────────────────────────────────────────────────────
type EventRow = {
  id: string; event_name: string; event_date: string | null;
  status: string; responsible_person: string | null; guest_count: number | null;
  created_at: string;
};
type TastingRow = { id: string; scheduled_date: string; type: string | null };

const STATUS_LABEL: Record<string, string> = {
  lead: 'Lead', negotiating: 'Negociando',
  tasting_scheduled: 'Deg. agendada', confirmed: 'Confirmado',
  completed: 'Realizado', cancelled: 'Cancelado',
};
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${String(y).slice(2)}`;
}
function daysUntil(d: string) {
  const diff = Math.round((new Date(d + 'T12:00:00').getTime() - Date.now()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff < 0)  return `Há ${Math.abs(diff)}d`;
  return `${diff}d`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

// ── component ──────────────────────────────────────────────────────────────
export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const [events,   setEvents]   = useState<EventRow[]>([]);
  const [tastings, setTastings] = useState<TastingRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      const [evRes, tsRes] = await Promise.all([
        supabase.from('events')
          .select('id, event_name, event_date, status, responsible_person, guest_count, created_at')
          .not('event_name', 'is', null)
          .neq('event_name', '')
          .neq('status', 'cancelled'),
        supabase.from('tasting_sessions' as any)
          .select('id, scheduled_date, type')
          .order('scheduled_date', { ascending: true }),
      ]);
      if (evRes.data)  setEvents(evRes.data as EventRow[]);
      if (tsRes.data)  setTastings(tsRes.data as TastingRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  // KPIs
  const openBudgets      = events.filter(e => ['lead','negotiating'].includes(e.status));
  const confirmedEvents  = events.filter(e => ['confirmed','completed'].includes(e.status));
  const upcomingTastings = tastings.filter(t => t.scheduled_date >= today);
  const thisMonth        = new Date().toISOString().slice(0, 7);
  const eventsThisMonth  = events.filter(e => e.event_date?.startsWith(thisMonth) && ['confirmed','completed'].includes(e.status)).length;

  // Chart data — events per month for selected year
  const chartData = MONTHS.map((m, i) => {
    const prefix = `${chartYear}-${String(i + 1).padStart(2, '0')}`;
    const count  = events.filter(e => e.event_date?.startsWith(prefix) && ['confirmed','completed'].includes(e.status)).length;
    return { month: m, eventos: count };
  });

  // Agenda — next 60 days (events + tastings combined)
  const in60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
  type AgendaItem = { date: string; label: string; sub: string; id: string; kind: 'event' | 'tasting'; status?: string };
  const agenda: AgendaItem[] = [
    ...events.filter(e => e.event_date && e.event_date >= today && e.event_date <= in60 && ['confirmed','tasting_scheduled'].includes(e.status))
      .map(e => ({ date: e.event_date!, label: e.event_name, sub: STATUS_LABEL[e.status], id: e.id, kind: 'event' as const, status: e.status })),
    ...upcomingTastings.filter(t => t.scheduled_date <= in60)
      .map(t => ({ date: t.scheduled_date, label: `Degustação${t.type ? ` – ${t.type}` : ''}`, sub: '', id: t.id, kind: 'tasting' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);

  // Timeline — open budgets + upcoming confirmed, ordered by recency/date
  const timeline: { date: string; label: string; sub: string; id: string; dot: string }[] = [
    ...openBudgets.slice(0, 4).map(e => ({
      date: e.created_at, label: e.event_name,
      sub: STATUS_LABEL[e.status] + (e.responsible_person ? ` · ${e.responsible_person}` : ''),
      id: e.id, dot: 'bg-amber-400',
    })),
    ...events.filter(e => e.event_date && e.event_date >= today && e.event_date <= in60 && e.status === 'confirmed')
      .slice(0, 5).map(e => ({
        date: e.event_date!, label: e.event_name,
        sub: `Confirmado · ${fmtDate(e.event_date)}${e.guest_count ? ` · ${e.guest_count} conv.` : ''}`,
        id: e.id, dot: 'bg-emerald-500',
      })),
  ].slice(0, 8);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Carregando...</div>
  );

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{greeting()}, Douglas</h1>
        </div>
      </div>

      {/* KPIs — 4 clean numbers */}
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

        {/* Left col — chart + agenda */}
        <div className="lg:col-span-2 space-y-6">

          {/* Chart */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-semibold text-foreground">Eventos por mês</p>
                <p className="text-xs text-muted-foreground mt-0.5">Confirmados e realizados</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setChartYear(y => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold tabular-nums w-10 text-center">{chartYear}</span>
                <button onClick={() => setChartYear(y => y + 1)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={22}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', radius: 6 }}
                  contentStyle={{ background: 'white', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}
                  formatter={(v: number) => [v, 'Eventos']}
                />
                <Bar dataKey="eventos" fill="hsl(var(--foreground))" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mini agenda */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Próximos 60 dias</p>
              <p className="text-xs text-muted-foreground">{agenda.length} {agenda.length === 1 ? 'item' : 'itens'}</p>
            </div>
            {agenda.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Nada agendado nos próximos 60 dias.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {agenda.map(item => {
                  const diff = Math.round((new Date(item.date + 'T12:00:00').getTime() - Date.now()) / 86400000);
                  const urgent = diff <= 7;
                  return (
                    <div key={`${item.kind}-${item.id}`}
                      onClick={() => navigate(item.kind === 'event' ? `/events/${item.id}` : `/tastings/${item.id}`)}
                      className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 cursor-pointer transition-colors group">
                      <div className={`shrink-0 w-12 text-center`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wide ${urgent ? 'text-red-500' : 'text-muted-foreground'}`}>{daysUntil(item.date)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{fmtDate(item.date)}</p>
                      </div>
                      <div className={`shrink-0 w-1.5 h-1.5 rounded-full ${item.kind === 'tasting' ? 'bg-slate-400' : 'bg-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                        {item.sub && <p className="text-xs text-muted-foreground">{item.sub}</p>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 transition-colors" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right col — timeline */}
        <div className="space-y-6">

          {/* Open budgets quick stats */}
          <div className="bg-white border border-border rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Em negociação</p>
            <div className="space-y-1">
              {[
                { key: 'lead', label: 'Leads' },
                { key: 'negotiating', label: 'Negociando' },
                { key: 'tasting_scheduled', label: 'Deg. agendada' },
              ].map(s => {
                const count = events.filter(e => e.status === s.key).length;
                const max   = Math.max(...['lead','negotiating','tasting_scheduled'].map(k => events.filter(e => e.status === k).length), 1);
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{s.label}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-foreground/70 rounded-full" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-foreground w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Linha do tempo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Orçamentos abertos e confirmados</p>
            </div>
            <div className="px-5 py-4">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sem atividade recente.</p>
              ) : (
                <div className="relative">
                  {/* vertical line */}
                  <div className="absolute left-[6px] top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-5">
                    {timeline.map((item, i) => (
                      <div key={i} onClick={() => navigate(`/events/${item.id}`)}
                        className="flex gap-4 cursor-pointer group">
                        <div className={`shrink-0 w-3.5 h-3.5 rounded-full border-2 border-white mt-0.5 z-10 ${item.dot}`} />
                        <div className="min-w-0 flex-1 pb-1">
                          <p className="text-sm font-medium text-foreground group-hover:underline truncate leading-tight">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming tastings quick list */}
          {upcomingTastings.length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Degustações</p>
                <button onClick={() => navigate('/tastings')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Ver todas</button>
              </div>
              <div className="divide-y divide-border/60">
                {upcomingTastings.slice(0, 4).map(t => (
                  <div key={t.id} onClick={() => navigate(`/tastings/${t.id}`)}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{t.type ?? 'Degustação'}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{fmtDate(t.scheduled_date)}</p>
                    </div>
                    <span className={`text-[10px] font-bold ${
                      Math.round((new Date(t.scheduled_date + 'T12:00:00').getTime() - Date.now()) / 86400000) <= 3
                        ? 'text-red-500' : 'text-muted-foreground'
                    }`}>{daysUntil(t.scheduled_date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Open budgets table */}
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
                  e.status === 'negotiating'
                    ? 'border-amber-200 text-amber-700 bg-amber-50'
                    : 'border-border text-muted-foreground bg-muted/40'
                }`}>{STATUS_LABEL[e.status]}</span>
                <p className="flex-1 text-sm font-medium text-foreground truncate">{e.event_name}</p>
                {e.responsible_person && <p className="text-xs text-muted-foreground shrink-0 hidden md:block">{e.responsible_person}</p>}
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
