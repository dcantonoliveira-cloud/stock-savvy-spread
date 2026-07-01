import { useEffect, useRef, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ChevronLeft, ChevronRight, TrendingUp, Users, BarChart3, DollarSign, Lock } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v: number) => v.toLocaleString('pt-BR');

// ── Types ─────────────────────────────────────────────────────────────────────
interface EventRow {
  id: string;
  status: string;
  event_date: string | null;
  event_type: string | null;
  guest_count: number | null;
  professional_count: number | null;
  total_value: number | null;
  contract_signed: boolean;
  product_name: string | null;
  created_at: string;
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
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<'originais' | 'bi'>('originais');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tastings, setTastings] = useState<any[]>([]);
  const [tastingRange, setTastingRange] = useState<'3m' | '1a' | 'all'>('1a');
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
      const [evtRes, tastRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, status, event_date, event_type, guest_count, professional_count, total_value, contract_signed, product_name, created_at')
          .gte('event_date', `${year}-01-01`)
          .lte('event_date', `${year}-12-31`),
        supabase
          .from('tasting_session_events' as any)
          .select('event_id, status, tasting_sessions(scheduled_date, type)'),
      ]);
      setEvents((evtRes.data ?? []) as EventRow[]);
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
    value: completed.filter(e => e.event_date && new Date(e.event_date).getMonth() === i).length,
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

  // Tabela mensal
  const monthlyTable = useMemo(() => MONTHS.map((_, i) => {
    const mo = events.filter(e => e.event_date && new Date(e.event_date).getMonth() === i);
    const fechados = mo.filter(e => e.contract_signed || ['confirmed','completed'].includes(e.status));
    const rev = fechados.reduce((s, e) => s + (e.total_value ?? 0), 0);
    return {
      orcamentos: mo.length,
      contratos: fechados.length,
      degustacoes: 0, // preenchido abaixo
      faturamento: rev,
    };
  }), [events]);

  // Degustações por mês (contagem de tasting_session_events no ano)
  const tastingsByMonth = useMemo(() => {
    const counts = Array(12).fill(0);
    tastings.forEach((t: any) => {
      const d = (t.tasting_sessions as any)?.scheduled_date;
      if (d && d.startsWith(`${year}`)) {
        const m = new Date(d).getMonth();
        counts[m]++;
      }
    });
    return counts;
  }, [tastings, year]);

  const tableRows = useMemo(() => monthlyTable.map((m, i) => ({
    ...m,
    degustacoes: tastingsByMonth[i],
  })), [monthlyTable, tastingsByMonth]);

  const totals = useMemo(() => ({
    orcamentos: tableRows.reduce((s, r) => s + r.orcamentos, 0),
    contratos:  tableRows.reduce((s, r) => s + r.contratos, 0),
    degustacoes:tableRows.reduce((s, r) => s + r.degustacoes, 0),
    faturamento:tableRows.reduce((s, r) => s + r.faturamento, 0),
  }), [tableRows]);

  // Degustações section
  const now = new Date();
  const tastingFiltered = useMemo(() => {
    if (tastingRange === '3m') {
      const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3);
      return tastings.filter((t: any) => {
        const d = (t.tasting_sessions as any)?.scheduled_date;
        return d && new Date(d) >= cutoff;
      });
    }
    if (tastingRange === '1a') {
      const cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear() - 1);
      return tastings.filter((t: any) => {
        const d = (t.tasting_sessions as any)?.scheduled_date;
        return d && new Date(d) >= cutoff;
      });
    }
    return tastings;
  }, [tastings, tastingRange]);

  const tastingQtd   = tastingFiltered.length;
  const newClients   = new Set(tastingFiltered.map((t: any) => t.event_id)).size;
  const closedFromT  = tastingFiltered.filter((t: any) => t.status === 'confirmed' || t.status === 'completed').length;
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
                  {[
                    { label: 'Orçamentos cadastrados', key: 'orcamentos' as const, fmt: (v: number) => v || '—' },
                    { label: 'Contratos fechados',     key: 'contratos'  as const, fmt: (v: number) => v || '—' },
                    { label: 'Degustações',            key: 'degustacoes'as const, fmt: (v: number) => v || '—' },
                    { label: 'Faturamento vendido',    key: 'faturamento'as const, fmt: (v: number) => v ? fmtBRL(v) : '—' },
                  ].map(({ label, key, fmt }) => (
                    <tr key={key} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground sticky left-0 bg-white z-10">{label}</td>
                      {tableRows.map((row, i) => (
                        <td key={i} className="px-3 py-3 text-center text-muted-foreground">
                          {fmt(row[key])}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center font-bold text-foreground sticky right-0 bg-slate-50 border-l border-border">
                        {fmt(totals[key])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
