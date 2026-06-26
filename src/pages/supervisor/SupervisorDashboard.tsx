import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { fmtCur } from '@/lib/format';
import {
  CalendarDays, TrendingUp, Users, AlertTriangle,
  ChevronRight, Package, UtensilsCrossed, Clock,
} from 'lucide-react';

// ── types ──────────────────────────────────────────────────────────────────
type EventRow = {
  id: string; event_name: string; event_date: string | null;
  status: string; responsible_person: string | null; guest_count: number | null;
};
type TastingRow = { id: string; scheduled_date: string; type: string | null; max_couples: number | null };
type StockItem  = { id: string; name: string; category: string; current_stock: number; min_stock: number; unit: string };

const STATUS_LABEL: Record<string, string> = {
  lead: 'Lead', negotiating: 'Negociando',
  tasting_scheduled: 'Deg. agendada', confirmed: 'Confirmado',
  completed: 'Realizado', cancelled: 'Cancelado',
};
const PIPELINE_ORDER = ['lead', 'negotiating', 'tasting_scheduled', 'confirmed', 'completed'];
const PIPELINE_COLOR: Record<string, string> = {
  lead: 'bg-slate-400', negotiating: 'bg-amber-400',
  tasting_scheduled: 'bg-blue-400', confirmed: 'bg-emerald-500', completed: 'bg-emerald-700',
};
const PIPELINE_TEXT: Record<string, string> = {
  lead: 'text-slate-600', negotiating: 'text-amber-600',
  tasting_scheduled: 'text-blue-600', confirmed: 'text-emerald-600', completed: 'text-emerald-700',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

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
  return `Em ${diff}d`;
}

// ── component ──────────────────────────────────────────────────────────────
export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const [events,   setEvents]   = useState<EventRow[]>([]);
  const [tastings, setTastings] = useState<TastingRow[]>([]);
  const [stock,    setStock]    = useState<StockItem[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const load = async () => {
      const [evRes, tsRes, stRes] = await Promise.all([
        supabase.from('events').select('id, event_name, event_date, status, responsible_person, guest_count')
          .not('status', 'eq', 'cancelled'),
        supabase.from('tasting_sessions' as any).select('id, scheduled_date, type, max_couples')
          .order('scheduled_date', { ascending: true }),
        supabase.from('stock_items').select('id, name, category, current_stock, min_stock, unit'),
      ]);
      if (evRes.data)  setEvents(evRes.data as EventRow[]);
      if (tsRes.data)  setTastings(tsRes.data as TastingRow[]);
      if (stRes.data)  setStock(stRes.data as StockItem[]);
      setLoading(false);
    };
    load();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const in60  = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

  // KPIs
  const openBudgets    = events.filter(e => ['lead','negotiating'].includes(e.status)).length;
  const confirmedMonth = events.filter(e => {
    if (e.status !== 'confirmed' && e.status !== 'completed') return false;
    const m = new Date().toISOString().slice(0, 7);
    return e.event_date?.startsWith(m);
  }).length;
  const upcomingTastings = tastings.filter(t => t.scheduled_date >= today).length;
  const lowStock = stock.filter(i => i.current_stock > 0 && i.min_stock > 0 && i.current_stock <= i.min_stock);

  // Agenda: próximos eventos + degustações (60 dias)
  type AgendaItem = { date: string; label: string; sub: string; id: string; kind: 'event' | 'tasting'; status?: string; urgent?: boolean };
  const agenda: AgendaItem[] = [
    ...events
      .filter(e => e.event_date && e.event_date >= today && e.event_date <= in60)
      .map(e => ({
        date: e.event_date!, label: e.event_name,
        sub: `${STATUS_LABEL[e.status] ?? e.status}${e.guest_count ? ` · ${e.guest_count} convidados` : ''}`,
        id: e.id, kind: 'event' as const, status: e.status,
        urgent: Math.round((new Date(e.event_date! + 'T12:00:00').getTime() - Date.now()) / 86400000) <= 7,
      })),
    ...tastings
      .filter(t => t.scheduled_date >= today && t.scheduled_date <= in60)
      .map(t => ({
        date: t.scheduled_date, label: `Degustação${t.type ? ` – ${t.type}` : ''}`,
        sub: t.max_couples ? `Até ${t.max_couples} casais` : '',
        id: t.id, kind: 'tasting' as const,
        urgent: Math.round((new Date(t.scheduled_date + 'T12:00:00').getTime() - Date.now()) / 86400000) <= 3,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Pipeline
  const pipeline = PIPELINE_ORDER.map(s => ({ status: s, count: events.filter(e => e.status === s).length }));
  const pipelineMax = Math.max(...pipeline.map(p => p.count), 1);

  // Open budgets list
  const openList = events
    .filter(e => ['lead','negotiating'].includes(e.status))
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))
    .slice(0, 6);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-muted-foreground text-sm">Carregando...</div>
  );

  return (
    <div className="space-y-6">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting()}, Douglas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<CalendarDays className="w-4 h-4" />}
          label="Eventos este mês"
          value={confirmedMonth}
          sub="confirmados"
          color="blue"
          onClick={() => navigate('/events')}
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Orçamentos abertos"
          value={openBudgets}
          sub="em negociação"
          color="amber"
          onClick={() => navigate('/orcamentos')}
        />
        <KpiCard
          icon={<UtensilsCrossed className="w-4 h-4" />}
          label="Degustações"
          value={upcomingTastings}
          sub="agendadas"
          color="purple"
          onClick={() => navigate('/tastings')}
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Alertas de estoque"
          value={lowStock.length}
          sub={lowStock.length === 0 ? 'tudo ok' : 'itens críticos'}
          color={lowStock.length > 0 ? 'red' : 'green'}
          onClick={() => navigate('/estoque')}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Agenda — 2/3 */}
        <div className="lg:col-span-2 bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Agenda — próximos 60 dias</span>
            </div>
            <span className="text-xs text-muted-foreground">{agenda.length} item{agenda.length !== 1 ? 's' : ''}</span>
          </div>
          {agenda.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Nenhum evento ou degustação nos próximos 60 dias.</div>
          ) : (
            <div className="divide-y divide-border/50">
              {agenda.map(item => (
                <div
                  key={`${item.kind}-${item.id}`}
                  onClick={() => navigate(item.kind === 'event' ? `/events/${item.id}` : `/tastings/${item.id}`)}
                  className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  {/* Date badge */}
                  <div className={`shrink-0 w-14 text-center rounded-xl py-1.5 ${item.urgent ? 'bg-red-50 border border-red-200' : 'bg-muted/50'}`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${item.urgent ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {daysUntil(item.date)}
                    </p>
                    <p className="text-xs font-bold text-foreground tabular-nums">{fmtDate(item.date)}</p>
                  </div>

                  {/* Kind icon */}
                  <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${item.kind === 'tasting' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    {item.kind === 'tasting'
                      ? <UtensilsCrossed className="w-3.5 h-3.5" />
                      : <CalendarDays className="w-3.5 h-3.5" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                  </div>

                  {item.status && (
                    <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      item.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                      item.status === 'tasting_scheduled' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  )}

                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Pipeline */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Pipeline comercial</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              {pipeline.filter(p => p.status !== 'completed').map(p => (
                <div key={p.status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${PIPELINE_TEXT[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    <span className="text-xs font-bold text-foreground tabular-nums">{p.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${PIPELINE_COLOR[p.status]}`}
                      style={{ width: `${Math.round((p.count / pipelineMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-border mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total no funil</span>
                <span className="text-sm font-bold text-foreground">{events.length}</span>
              </div>
            </div>
          </div>

          {/* Stock alerts */}
          {lowStock.length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-sm text-foreground">Estoque crítico</span>
              </div>
              <div className="divide-y divide-border/50">
                {lowStock.slice(0, 5).map(item => (
                  <div key={item.id} className="px-5 py-2.5 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold text-amber-500">{item.current_stock} {item.unit}</p>
                      <p className="text-[11px] text-muted-foreground">mín {item.min_stock}</p>
                    </div>
                  </div>
                ))}
                {lowStock.length > 5 && (
                  <div className="px-5 py-2.5 text-xs text-muted-foreground text-center">
                    +{lowStock.length - 5} itens
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Open budgets */}
      {openList.length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-sm text-foreground">Orçamentos em aberto</span>
            </div>
            <button onClick={() => navigate('/orcamentos')} className="text-xs text-primary hover:underline">Ver todos</button>
          </div>
          <div className="divide-y divide-border/50">
            {openList.map(e => (
              <div
                key={e.id}
                onClick={() => navigate(`/events/${e.id}`)}
                className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 cursor-pointer transition-colors group"
              >
                <div className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  e.status === 'negotiating' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {STATUS_LABEL[e.status]}
                </div>
                <p className="flex-1 text-sm font-medium text-foreground truncate">{e.event_name}</p>
                {e.responsible_person && (
                  <p className="text-xs text-muted-foreground shrink-0">{e.responsible_person}</p>
                )}
                <p className="text-xs text-muted-foreground tabular-nums shrink-0">{fmtDate(e.event_date)}</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── KpiCard ────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   val: 'text-blue-700'   },
  amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600', val: 'text-amber-700'  },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600',val: 'text-purple-700' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',     val: 'text-red-600'    },
  green:  { bg: 'bg-emerald-50',icon: 'bg-emerald-100 text-emerald-600',val:'text-emerald-700'},
};

function KpiCard({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode; label: string; value: number; sub: string;
  color: keyof typeof COLOR_MAP; onClick: () => void;
}) {
  const c = COLOR_MAP[color];
  return (
    <div
      onClick={onClick}
      className={`${c.bg} rounded-2xl p-5 cursor-pointer hover:brightness-95 transition-all border border-transparent hover:border-border`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.icon}`}>{icon}</div>
      </div>
      <p className={`text-3xl font-bold tabular-nums ${c.val}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
