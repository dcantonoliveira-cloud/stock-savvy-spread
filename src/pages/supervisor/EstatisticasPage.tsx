import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ChevronLeft, ChevronRight, Users, BarChart3, DollarSign, Lock, ExternalLink, CheckCircle2, X } from 'lucide-react';
import { getStatus } from '@/lib/eventStatus';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v: number) => v.toLocaleString('pt-BR');

// Mês (0-11) a partir de uma data 'YYYY-MM-DD...' sem sofrer com timezone
const monthOf = (d: string) => Number(d.slice(5, 7)) - 1;

// ── Types ─────────────────────────────────────────────────────────────────────
interface EventRow {
  id: string;
  event_name: string | null;
  status: string;
  event_date: string | null;
  event_type: string | null;
  guest_count: number | null;
  professional_count: number | null;
  total_value: number | null;
  contract_signed: boolean;
  contract_signed_date: string | null;
  product_name: string | null;
  created_at: string;
}

interface ContratoRow {
  id: string;
  event_name: string | null;
  event_type: string | null;
  status: string;
  event_date: string | null;
  location_text: string | null;
  guest_count: number | null;
  price_per_person: number | null;
  total_value: number | null;
  paid_value: number | null;
  is_paid_in_full: boolean | null;
  contract_signed_date: string | null;
}

// ── Dot with label for line chart ─────────────────────────────────────────────
const LabelDot = (props: any) => {
  const { cx, cy, value } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="#0d9488" stroke="#fff" strokeWidth={2} />
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0d9488">{value}</text>
    </g>
  );
};

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const BI_URL = 'https://thriving-mandazi-69c510.netlify.app';
const RONDELLO_DOMAIN = 'rondellobuffet.com.br';

export default function EstatisticasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<'originais' | 'bi'>('originais');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tastings, setTastings] = useState<any[]>([]);
  const [tastingRange, setTastingRange] = useState<'3m' | '1a' | 'all'>('1a');
  const [activeCell, setActiveCell] = useState<{ key: string; month: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(1000);

  const isRondello = user?.email?.endsWith(`@${RONDELLO_DOMAIN}`) ?? false;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'resize' && typeof event.data.height === 'number') {
        setIframeHeight(event.data.height);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [evtRes, contratosRes, tastRes] = await Promise.all([
        // Eventos do ano: para orçamentos, gráficos e KPIs (por event_date)
        supabase
          .from('events')
          .select('id, event_name, status, event_date, event_type, guest_count, professional_count, total_value, contract_signed, contract_signed_date, product_name, created_at')
          .gte('event_date', `${year}-01-01`)
          .lte('event_date', `${year}-12-31`),
        // Contratos fechados no ano: filtrado por contract_signed_date (independente do event_date)
        supabase
          .from('events')
          .select('id, event_name, event_type, status, event_date, location_text, guest_count, price_per_person, total_value, paid_value, is_paid_in_full, contract_signed_date')
          .not('contract_signed_date', 'is', null)
          .gte('contract_signed_date', `${year}-01-01`)
          .lte('contract_signed_date', `${year}-12-31`)
          .order('contract_signed_date'),
        supabase
          .from('tasting_session_events' as any)
          .select('event_id, session_id, situation_snapshot, tasting_sessions!session_id(scheduled_date, type)'),
      ]);
      setEvents((evtRes.data ?? []) as EventRow[]);
      setContratos((contratosRes.data ?? []) as ContratoRow[]);
      setTastings((tastRes.data ?? []) as any[]);
      setLoading(false);
    };
    load();
  }, [year]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const completed = useMemo(() => events.filter(e => e.status === 'completed' || e.status === 'confirmed'), [events]);

  // Eventos por mês
  const byMonth = useMemo(() => MONTHS.map((m, i) => ({
    name: m,
    value: completed.filter(e => e.event_date && monthOf(e.event_date) === i).length,
  })), [completed]);

  // Tipos de evento %
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    completed.forEach(e => { if (e.event_type) counts[e.event_type] = (counts[e.event_type] ?? 0) + 1; });
    const total = completed.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ name: type, value: Math.round((count / total) * 100) }));
  }, [completed]);

  // KPIs do ano
  const totalEvents = completed.length;
  const totalGuests = completed.reduce((s, e) => s + (e.guest_count ?? 0), 0);
  const totalStaff  = completed.reduce((s, e) => s + (e.professional_count ?? 0), 0);
  const totalRev    = completed.reduce((s, e) => s + (e.total_value ?? 0), 0);
  const ticketMedio = totalEvents ? totalRev / totalEvents : 0;

  // Mapa de sessões distintas (session_id → {date, type})
  const sessionMap = useMemo(() => {
    const map = new Map<string, { date: string; type: string | null }>();
    tastings.forEach((t: any) => {
      if (!t.session_id || map.has(t.session_id)) return;
      const s = Array.isArray(t.tasting_sessions) ? t.tasting_sessions[0] : t.tasting_sessions;
      if (s?.scheduled_date) map.set(t.session_id, { date: s.scheduled_date, type: s.type });
    });
    return map;
  }, [tastings]);

  // Mapa event_id → event_name para lookup no popup
  const eventNameMap = useMemo(() => new Map(events.map(e => [e.id, e.event_name ?? e.id])), [events]);

  // Tabela mensal com listas detalhadas para popup
  const tableRows = useMemo(() => {
    return MONTHS.map((_, i) => {
      // Orçamentos: por event_date
      const orcList = events.filter(e => e.event_date && monthOf(e.event_date) === i);

      // Contratos fechados: query própria filtrada por contract_signed_date no ano
      const contratosList = contratos.filter(e =>
        e.contract_signed_date != null && monthOf(e.contract_signed_date) === i
      );

      // Degustações: sessões distintas no mês
      const sessionsList: Array<{ id: string; date: string; type: string | null }> = [];
      for (const [sid, sd] of sessionMap) {
        if (sd.date.startsWith(`${year}`) && monthOf(sd.date) === i)
          sessionsList.push({ id: sid, ...sd });
      }

      // Eventos em degustação: tasting_session_events do mês
      const tastingEventsList = tastings.filter((t: any) => {
        const s = Array.isArray(t.tasting_sessions) ? t.tasting_sessions[0] : t.tasting_sessions;
        const d = s?.scheduled_date;
        return d && d.startsWith(`${year}`) && monthOf(d) === i;
      });

      // Faturamento: soma dos contratos fechados no mês
      const faturamento = contratosList.reduce((s, e) => s + (e.total_value ?? 0), 0);

      return {
        orcamentos:   orcList.length,
        contratos:    contratosList.length,
        degustacoes:  sessionsList.length,
        eventos_deg:  tastingEventsList.length,
        faturamento,
        _orcList:     orcList,
        _contratosList: contratosList,
        _sessionsList: sessionsList,
        _tastingEventsList: tastingEventsList,
      };
    });
  }, [events, contratos, year, sessionMap, tastings]);

  const totals = useMemo(() => ({
    orcamentos:  tableRows.reduce((s, r) => s + r.orcamentos, 0),
    contratos:   tableRows.reduce((s, r) => s + r.contratos, 0),
    degustacoes: tableRows.reduce((s, r) => s + r.degustacoes, 0),
    eventos_deg: tableRows.reduce((s, r) => s + r.eventos_deg, 0),
    faturamento: tableRows.reduce((s, r) => s + r.faturamento, 0),
  }), [tableRows]);

  // Degustações section
  const now = new Date();
  const getTastingDate = (t: any) => {
    const session = Array.isArray(t.tasting_sessions) ? t.tasting_sessions[0] : t.tasting_sessions;
    return session?.scheduled_date ?? null;
  };

  const tastingFiltered = useMemo(() => {
    if (tastingRange === '3m') {
      const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3);
      return tastings.filter((t: any) => {
        const d = getTastingDate(t);
        return d && new Date(d) >= cutoff;
      });
    }
    if (tastingRange === '1a') {
      const cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear() - 1);
      return tastings.filter((t: any) => {
        const d = getTastingDate(t);
        return d && new Date(d) >= cutoff;
      });
    }
    return tastings;
  }, [tastings, tastingRange]);

  const eventStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    events.forEach(e => { map[e.id] = e.status; });
    return map;
  }, [events]);

  const tastingQtd   = tastingFiltered.length;
  const newClients   = new Set(tastingFiltered.map((t: any) => t.event_id)).size;
  const closedFromT  = tastingFiltered.filter((t: any) => {
    const st = eventStatusMap[t.event_id];
    return st === 'confirmed' || st === 'completed';
  }).length;
  const openFromT    = newClients - closedFromT;
  const conversionRate = newClients ? ((closedFromT / newClients) * 100).toFixed(0) : '0';
  const avgPerContract = closedFromT ? (newClients / closedFromT).toFixed(2) : '—';

  // Cardápios
  const menuData = useMemo(() => {
    const counts: Record<string, number> = {};
    completed.forEach(e => {
      const key = e.product_name?.trim() || 'Não especificado';
      counts[key] = (counts[key] ?? 0) + 1;
    });
    const total = completed.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
  }, [completed]);
  const menuTotal = menuData.reduce((s, r) => s + r.count, 0);
  const menuPctTotal = menuData.reduce((s, r) => s + r.pct, 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Estatísticas</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg font-semibold w-14 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {(['originais', 'bi'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t === 'originais' ? 'Originais' : 'Dashboard BI'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Carregando dados...
        </div>
      )}

      {!loading && tab === 'originais' && (
        <div className="space-y-8">

          {/* ── Seção 1: Gráficos ── */}
          <div className="grid grid-cols-2 gap-6">

            {/* Eventos por mês */}
            <div className="bg-white border border-border rounded-2xl p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Eventos por mês</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={byMonth} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone" dataKey="value" name="Eventos"
                    stroke="#0d9488" strokeWidth={2.5}
                    dot={<LabelDot />} activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* % Tipos de evento */}
            <div className="bg-white border border-border rounded-2xl p-5">
              <p className="text-sm font-semibold text-foreground mb-4">% tipos de evento por ano</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={typeData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="typeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#888' }} unit="%" />
                  <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`${v}%`, 'Participação']} />
                  <Area
                    type="monotone" dataKey="value" name="%" stroke="#6366f1" strokeWidth={2.5}
                    fill="url(#typeGrad)" dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Seção 2: Números do ano ── */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <p className="font-semibold text-foreground mb-0.5">Números do ano</p>
            <p className="text-xs text-muted-foreground mb-5">Números consolidados do ano selecionado</p>
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: BarChart3, label: 'QTD Eventos',    value: fmtNum(totalEvents), color: 'text-primary' },
                { icon: Users,     label: 'QTD Convidados', value: fmtNum(totalGuests), color: 'text-violet-600' },
                { icon: Users,     label: 'QTD Staffs',     value: fmtNum(totalStaff),  color: 'text-amber-600' },
                { icon: DollarSign,label: 'Ticket Médio',   value: fmtBRL(ticketMedio), color: 'text-emerald-600' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="rounded-xl border border-border p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</span>
                  </div>
                  <span className={`text-2xl font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Seção 3: Tabela mensal ── */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border">
              <p className="font-semibold text-foreground">Tabela mensal</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    <th className="text-left px-4 py-3 sticky left-0 bg-muted/30 z-10 min-w-[200px]">Métrica</th>
                    {MONTHS.map(m => <th key={m} className="text-center px-3 py-3 min-w-[60px]">{m}</th>)}
                    <th className="text-center px-4 py-3 sticky right-0 bg-slate-100 border-l border-border min-w-[90px]">Total Ano</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {([
                    { label: 'Orçamentos cadastrados', key: 'orcamentos',  fmt: (v: number) => v || '—' },
                    { label: 'Contratos fechados',     key: 'contratos',   fmt: (v: number) => v || '—' },
                    { label: 'Degustações',            key: 'degustacoes', fmt: (v: number) => v || '—' },
                    { label: 'Eventos em degustação',  key: 'eventos_deg', fmt: (v: number) => v || '—' },
                    { label: 'Faturamento vendido',    key: 'faturamento', fmt: (v: number) => v
                      ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '—' },
                  ] as const).map(({ label, key, fmt }) => (
                    <tr key={key} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground sticky left-0 bg-white z-10">{label}</td>
                      {tableRows.map((row, i) => {
                        const val = row[key as keyof typeof row] as number;
                        return (
                          <td
                            key={i}
                            onClick={() => val > 0 ? setActiveCell({ key, month: i }) : undefined}
                            className={`px-3 py-3 text-center text-muted-foreground transition-colors ${val > 0 ? 'cursor-pointer hover:bg-primary/5 hover:text-primary font-medium' : ''}`}
                          >
                            {fmt(val)}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center font-bold text-foreground sticky right-0 bg-slate-50 border-l border-border">
                        {fmt(totals[key as keyof typeof totals] as number)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Popup célula ── */}
          {activeCell && <CellPopup
            activeCell={activeCell}
            tableRows={tableRows}
            contratos={contratos}
            eventNameMap={eventNameMap}
            year={year}
            onClose={() => setActiveCell(null)}
            onNavigate={(id) => {
              setActiveCell(null);
              navigate(`/events/${id}`, { state: { from: '/estatisticas', fromLabel: 'Estatísticas' } });
            }}
          />}

          {/* ── Seção 4: Degustações ── */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-semibold text-foreground">Degustações</p>
                <p className="text-xs text-muted-foreground mt-0.5">Análise de todas as degustações</p>
              </div>
              <select
                value={tastingRange}
                onChange={e => setTastingRange(e.target.value as any)}
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="3m">Últimos 3 meses</option>
                <option value="1a">Último ano</option>
                <option value="all">Historicamente</option>
              </select>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Qtd Degustações',    value: tastingQtd,   color: 'text-primary' },
                { label: 'Clientes novos',      value: newClients,   color: 'text-violet-600' },
                { label: 'Novos Que Fecharam',  value: closedFromT,  color: 'text-emerald-600' },
                { label: 'Em aberto',           value: Math.max(0, openFromT), color: 'text-amber-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-border p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            {closedFromT > 0 && (
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-5 py-4 text-sm text-indigo-800">
                A cada <strong>{avgPerContract}</strong> clientes novos em degustações fechamos 1 contrato. O que configura uma conversão de <strong>{conversionRate}%</strong>.
              </div>
            )}
          </div>

          {/* ── Seção 5: Cardápios ── */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border">
              <p className="font-semibold text-foreground">Cardápios</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  <th className="text-left px-5 py-3">Tipo do cardápio</th>
                  <th className="text-right px-4 py-3">Qtd Eventos</th>
                  <th className="text-right px-5 py-3">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {menuData.map(({ name, count, pct }) => (
                  <tr key={name} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-2.5 text-foreground">{name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground">{count}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-muted-foreground">{pct}%</td>
                  </tr>
                ))}
                {menuData.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-muted-foreground text-sm">
                      Nenhum dado de cardápio disponível.
                    </td>
                  </tr>
                )}
              </tbody>
              {menuData.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                    <td className="px-5 py-3 text-foreground">Total</td>
                    <td className="px-4 py-3 text-right text-foreground">{menuTotal}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{menuPctTotal}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

        </div>
      )}

      {tab === 'bi' && (
        isRondello ? (
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <iframe
              ref={iframeRef}
              src={BI_URL}
              style={{ width: '100%', height: iframeHeight, border: 'none', display: 'block' }}
              title="Dashboard BI"
              allow="fullscreen"
            />
          </div>
        ) : (
          <div className="bg-white border border-border rounded-2xl p-16 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">Acesso restrito</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Este painel está disponível apenas para colaboradores do Rondello Buffet.
            </p>
          </div>
        )
      )}

    </div>
  );
}

// ── CellPopup ─────────────────────────────────────────────────────────────────
function PgtoBadge({ total, paid, full }: { total: number | null; paid: number | null; full: boolean | null }) {
  const t = total ?? 0;
  const p = paid ?? 0;
  const pct = t > 0 ? Math.round((p / t) * 100) : 0;
  if (full || pct >= 100)
    return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><CheckCircle2 className="w-3 h-3"/>100%</span>;
  if (pct === 0)
    return <span className="text-[11px] font-semibold text-amber-600">0%</span>;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[11px] font-semibold text-amber-600">{pct}%</span>
      <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CellPopup({ activeCell, tableRows, contratos, eventNameMap, onClose, onNavigate }: {
  activeCell: { key: string; month: number };
  tableRows: any[];
  contratos: ContratoRow[];
  eventNameMap: Map<string, string>;
  year: number;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const row = tableRows[activeCell.month];
  const monthLabel = MONTHS_FULL[activeCell.month];
  const isContratosOrFat = activeCell.key === 'contratos' || activeCell.key === 'faturamento';

  const contratosMes = isContratosOrFat
    ? contratos.filter(e => e.contract_signed_date != null && (Number(e.contract_signed_date.slice(5,7)) - 1) === activeCell.month)
    : [];

  const fmtDate = (d: string | null) => d ? `${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}` : '—';
  const fmtMes  = (d: string | null) => d ? `${d.slice(5,7)}/${d.slice(2,4)}` : '—';

  const titles: Record<string, string> = {
    orcamentos:  `Orçamentos — ${monthLabel}`,
    contratos:   `Contratos fechados — ${monthLabel}`,
    degustacoes: `Degustações — ${monthLabel}`,
    eventos_deg: `Eventos em degustação — ${monthLabel}`,
    faturamento: `Faturamento vendido — ${monthLabel}`,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full overflow-hidden flex flex-col"
        style={{ maxWidth: isContratosOrFat ? '960px' : '420px', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <p className="font-semibold text-foreground text-sm">{titles[activeCell.key]}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isContratosOrFat && (
          contratosMes.length === 0
            ? <p className="px-5 py-10 text-sm text-muted-foreground text-center">Nenhum contrato neste mês.</p>
            : <div className="overflow-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      <th className="text-left px-4 py-2.5">Data Evento</th>
                      <th className="text-left px-3 py-2.5">Nome</th>
                      <th className="text-left px-3 py-2.5">Local</th>
                      <th className="text-center px-3 py-2.5">Tipo</th>
                      <th className="text-center px-3 py-2.5">Pax</th>
                      <th className="text-center px-3 py-2.5">R$/Pax</th>
                      <th className="text-center px-3 py-2.5">Status</th>
                      <th className="text-center px-3 py-2.5">Fechamento</th>
                      <th className="text-center px-3 py-2.5">Total</th>
                      <th className="text-center px-3 py-2.5">Pgto</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {contratosMes.map(e => {
                      const st = getStatus(e.status);
                      return (
                        <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{fmtDate(e.event_date)}</td>
                          <td className="px-3 py-2.5 font-medium text-foreground">{e.event_name ?? '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[130px] truncate">{e.location_text ?? '—'}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{e.event_type ?? '—'}</td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground">{e.guest_count ?? '—'}</td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground text-xs">
                            {e.price_per_person != null ? `R$ ${e.price_per_person.toLocaleString('pt-BR')}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{fmtMes(e.contract_signed_date)}</td>
                          <td className="px-3 py-2.5 text-center text-xs font-semibold text-foreground">
                            {e.total_value != null ? e.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <PgtoBadge total={e.total_value} paid={e.paid_value} full={e.is_paid_in_full} />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => onNavigate(e.id)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Abrir evento">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {activeCell.key === 'faturamento' && (
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30 font-semibold text-xs">
                        <td colSpan={8} className="px-4 py-2.5 text-foreground">Total</td>
                        <td className="px-3 py-2.5 text-center text-foreground">
                          {contratosMes.reduce((s, e) => s + (e.total_value ?? 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
        )}

        {!isContratosOrFat && (() => {
          type SimpleItem = { label: string; sub?: string; id?: string };
          let items: SimpleItem[] = [];
          if (activeCell.key === 'orcamentos')
            items = row._orcList.map((e: any) => ({ label: e.event_name ?? '—', sub: fmtDate(e.event_date), id: e.id }));
          else if (activeCell.key === 'degustacoes')
            items = row._sessionsList.map((s: any) => ({ label: s.type ?? 'Sem tipo', sub: fmtDate(s.date) }));
          else if (activeCell.key === 'eventos_deg')
            items = row._tastingEventsList.map((t: any) => ({ label: eventNameMap.get(t.event_id) ?? '—', sub: t.situation_snapshot ?? undefined, id: t.event_id }));
          return (
            <div className="divide-y divide-border/50 overflow-y-auto">
              {items.length === 0 && <p className="px-5 py-10 text-sm text-muted-foreground text-center">Nenhum item.</p>}
              {items.map((item, idx) => (
                <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {item.sub && <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>}
                  </div>
                  {item.id && (
                    <button onClick={() => onNavigate(item.id!)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
