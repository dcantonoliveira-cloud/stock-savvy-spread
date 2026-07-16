import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie, FunnelChart, Funnel, LabelList,
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const COLORS = ['#B8922A','#2E4A7A','#3D5C38','#D4AA50','#8C7B6A','#7A2C1E','#1E5C5A','#7A6240','#5C3D8A','#2C5C7A','#4A7A3D','#7A4A2C'];
const VALUE_RANGES = [
  { l: 'Todos', mn: 0, mx: Infinity },
  { l: 'Até R$20K', mn: 0, mx: 20000 },
  { l: 'R$20–40K', mn: 20000, mx: 40000 },
  { l: 'R$40–60K', mn: 40000, mx: 60000 },
  { l: 'R$60–80K', mn: 60000, mx: 80000 },
  { l: 'R$80–100K', mn: 80000, mx: 100000 },
  { l: 'Acima R$100K', mn: 100000, mx: Infinity },
];

const fmBRL = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(2)}M`
  : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(1)}K`
  : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmFull = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const pct = (n: number, d: number) => d ? `${(n / d * 100).toFixed(1)}%` : '—';
const fmtNum = (v: number) => v.toLocaleString('pt-BR');
const fmtDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

const isFechado = (s: string) => s === 'confirmed' || s === 'completed';
const isAberto  = (s: string) => s === 'lead' || s === 'negotiating' || s === 'tasting_scheduled';
const isNFechou = (s: string) => s === 'lost' || s === 'cancelled';
const monthOf = (d: string) => Number(d.slice(5, 7)) - 1;
const yearOf  = (d: string) => Number(d.slice(0, 4));

const STATUS_LABEL: Record<string, string> = {
  lead: '1º Contato', negotiating: 'Negociando', tasting_scheduled: 'Degustação',
  confirmed: 'Confirmado', completed: 'Realizado', lost: 'Perdido', cancelled: 'Cancelado',
};
const STATUS_COLOR: Record<string, string> = {
  lead: 'bg-blue-50 text-blue-700 border-blue-100',
  negotiating: 'bg-amber-50 text-amber-700 border-amber-100',
  tasting_scheduled: 'bg-purple-50 text-purple-700 border-purple-100',
};

interface ClientBI { name: string | null; zip_code: string | null; source: string | null; }
interface EventBI {
  id: string;
  event_name: string | null;
  status: string;
  event_date: string | null;
  event_type: string | null;
  location_text: string | null;
  location_id: string | null;
  location: { name: string } | null;
  guest_count: number | null;
  total_value: number | null;
  contract_signed_date: string | null;
  created_at: string;
  client_id: string | null;
  clients: ClientBI | null;
}

type TabKey = 'geral' | 'fechados' | 'aberto' | 'nfechou' | 'clientes' | 'kpis';

// ── Tooltip ───────────────────────────────────────────────────────────────────
const Tip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? '#333' }}>
          {p.name}: <strong>{formatter ? formatter(p.value, p.name) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ── KPI card ──────────────────────────────────────────────────────────────────
function KCard({ label, value, sub, color = '', trend }: { label: string; value: string; sub?: string; color?: string; trend?: 'up' | 'down' | 'flat' }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4 flex flex-col gap-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <div className="flex items-end gap-1.5">
        <p className={`text-xl font-bold ${color || 'text-foreground'}`}>{value}</p>
        {trend === 'up'   && <TrendingUp  className="w-3.5 h-3.5 text-emerald-500 mb-0.5" />}
        {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-500 mb-0.5" />}
        {trend === 'flat' && <Minus        className="w-3.5 h-3.5 text-muted-foreground mb-0.5" />}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SH({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-foreground mb-3">{children}</p>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BIDashboard() {
  const [all, setAll] = useState<EventBI[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('geral');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLocal, setFilterLocal] = useState('');
  const [filterRange, setFilterRange] = useState(0);

  const load = async () => {
    setLoading(true);

    const [evRes, clRes, locRes] = await Promise.all([
      supabase
        .from('events' as any)
        .select('id, event_name, status, event_date, event_type, location_text, location_id, guest_count, total_value, contract_signed_date, created_at, client_id')
        .order('event_date', { ascending: false }),
      supabase.from('clients' as any).select('id, name, zip_code, source'),
      supabase.from('event_locations' as any).select('id, name'),
    ]);

    console.log('[BI] events:', evRes.data?.length, 'error:', evRes.error?.message);

    const clientById: Record<string, ClientBI> = {};
    (clRes.data ?? []).forEach((c: any) => { clientById[c.id] = { name: c.name, zip_code: c.zip_code, source: c.source }; });

    const locById: Record<string, string> = {};
    (locRes.data ?? []).forEach((l: any) => { locById[l.id] = l.name; });

    const events = (evRes.data ?? []).map((e: any) => ({
      ...e,
      location: e.location_id ? { name: locById[e.location_id] ?? null } : null,
      clients: e.client_id ? (clientById[e.client_id] ?? null) : null,
    }));

    setAll(events as EventBI[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const locName = (e: EventBI) => e.location_text || (e.location as any)?.name || null;

  const anos  = useMemo(() => [...new Set(all.filter(e => e.event_date).map(e => yearOf(e.event_date!)))].sort(), [all]);
  const tipos = useMemo(() => [...new Set(all.map(e => e.event_type).filter(Boolean))].sort(), [all]);
  const locais = useMemo(() => [...new Set(all.map(e => locName(e)).filter(Boolean))].sort(), [all]);

  const ev = useMemo(() => {
    const range = VALUE_RANGES[filterRange];
    return all.filter(e => {
      if (filterYear && e.event_date && yearOf(e.event_date) !== Number(filterYear)) return false;
      if (filterMonth && e.event_date && monthOf(e.event_date) !== Number(filterMonth) - 1) return false;
      if (filterType && e.event_type !== filterType) return false;
      if (filterLocal && locName(e) !== filterLocal) return false;
      if (filterRange > 0 && ((e.total_value ?? 0) < range.mn || (e.total_value ?? 0) >= range.mx)) return false;
      return true;
    });
  }, [all, filterYear, filterMonth, filterType, filterLocal, filterRange]);

  const fc  = useMemo(() => ev.filter(e => isFechado(e.status) && (e.total_value ?? 0) > 500), [ev]);
  const ab  = useMemo(() => ev.filter(e => isAberto(e.status)), [ev]);
  const nf  = useMemo(() => ev.filter(e => isNFechou(e.status)), [ev]);
  const ticketMedio = fc.length ? avg(fc.map(e => e.total_value ?? 0)) : 0;

  const clearFilters = () => { setFilterYear(''); setFilterMonth(''); setFilterType(''); setFilterLocal(''); setFilterRange(0); };
  const hasFilter = filterYear || filterMonth || filterType || filterLocal || filterRange > 0;

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Carregando BI...</div>
  );

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'geral',    label: 'Visão Geral' },
    { key: 'fechados', label: 'Fechados' },
    { key: 'aberto',   label: 'Em Aberto' },
    { key: 'nfechou',  label: 'Não Fechou' },
    { key: 'clientes', label: 'Clientes' },
    { key: 'kpis',     label: 'KPIs' },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        {[
          { value: filterYear,  onChange: setFilterYear,  opts: anos.map(a => ({ v: String(a), l: String(a) })),          placeholder: 'Todos os anos' },
          { value: filterMonth, onChange: setFilterMonth, opts: MONTHS.map((m, i) => ({ v: String(i + 1), l: m })),       placeholder: 'Todos os meses' },
          { value: filterType,  onChange: setFilterType,  opts: tipos.map(t => ({ v: t!, l: t! })),                       placeholder: 'Todos os tipos' },
          { value: filterLocal, onChange: setFilterLocal, opts: locais.map(l => ({ v: l!, l: l! })),                      placeholder: 'Todos os locais' },
        ].map(({ value, onChange, opts, placeholder }) => (
          <select key={placeholder} value={value} onChange={e => onChange(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">{placeholder}</option>
            {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
        <select value={filterRange} onChange={e => setFilterRange(Number(e.target.value))}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
          {VALUE_RANGES.map((r, i) => <option key={i} value={i}>{r.l}</option>)}
        </select>
        {hasFilter && (
          <button onClick={clearFilters} className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
            ✕ Limpar
          </button>
        )}
        <button onClick={load} className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'geral'    && <TabGeral    ev={ev} fc={fc} ab={ab} all={all} locName={locName} ticketMedio={ticketMedio} />}
      {tab === 'fechados' && <TabFechados ev={ev} fc={fc} locName={locName} />}
      {tab === 'aberto'   && <TabAberto  ab={ab} ev={ev} fc={fc} ticketMedio={ticketMedio} />}
      {tab === 'nfechou'  && <TabNFechou nf={nf} ev={ev} />}
      {tab === 'clientes' && <TabClientes ev={ev} fc={fc} ab={ab} all={all} />}
      {tab === 'kpis'     && <TabKpis    ev={ev} fc={fc} ab={ab} nf={nf} all={all} ticketMedio={ticketMedio} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: VISÃO GERAL
// ══════════════════════════════════════════════════════════════════════════════
function TabGeral({ ev, fc, ab, all, locName, ticketMedio }: {
  ev: EventBI[]; fc: EventBI[]; ab: EventBI[]; all: EventBI[];
  locName: (e: EventBI) => string | null; ticketMedio: number;
}) {
  const hoje = new Date();
  const Y = hoje.getFullYear();
  const rT = sum(fc.map(e => e.total_value ?? 0));
  const txConv = ev.length ? (fc.length / ev.length * 100).toFixed(1) : '0';
  const futFC = fc.filter(e => e.event_date && yearOf(e.event_date) >= Y);
  const carteira = sum(futFC.map(e => e.total_value ?? 0));
  const pipelineEstimado = ticketMedio * ab.length;

  function contaFechados(anoEvento: number, dataCorte: Date) {
    return all.filter(e => {
      if (!isFechado(e.status)) return false;
      const dtF = e.contract_signed_date ? new Date(e.contract_signed_date) : null;
      if (!dtF || dtF > dataCorte) return false;
      return e.event_date ? yearOf(e.event_date) === anoEvento : false;
    });
  }

  const corte1 = new Date(hoje); corte1.setFullYear(Y - 1);
  const corte2 = new Date(hoje); corte2.setFullYear(Y - 2);
  const pipeCards = [
    { titulo: `Eventos de ${Y}`,     atual: contaFechados(Y,   hoje), comp1: contaFechados(Y-1, corte1), comp2: contaFechados(Y-2, corte2) },
    { titulo: `Eventos de ${Y + 1}`, atual: contaFechados(Y+1, hoje), comp1: contaFechados(Y,   corte1), comp2: contaFechados(Y-1, corte2) },
    { titulo: `Eventos de ${Y + 2}`, atual: contaFechados(Y+2, hoje), comp1: contaFechados(Y+1, corte1), comp2: contaFechados(Y,   corte2) },
  ];

  // Funil de conversão
  const totalLeads = all.filter(e => e.status === 'lead').length;
  const totalNeg   = all.filter(e => e.status === 'negotiating').length;
  const totalDeg   = all.filter(e => e.status === 'tasting_scheduled').length;
  const totalFech  = all.filter(e => isFechado(e.status)).length;
  const funnelData = [
    { name: '1º Contato', value: totalLeads + totalNeg + totalDeg + totalFech, fill: '#2E4A7A' },
    { name: 'Negociando', value: totalNeg + totalDeg + totalFech, fill: '#B8922A' },
    { name: 'Degustação', value: totalDeg + totalFech, fill: '#D4AA50' },
    { name: 'Fechado', value: totalFech, fill: '#3D5C38' },
  ];

  // Receita por mês (eventos fechados por mês do evento)
  const recMes = MONTHS.map((m, i) => ({
    name: m,
    receita: sum(fc.filter(e => e.event_date && monthOf(e.event_date) === i).map(e => e.total_value ?? 0)) / 1000,
    qtd: fc.filter(e => e.event_date && monthOf(e.event_date) === i).length,
  }));

  const diasArr = all
    .filter(e => e.contract_signed_date && e.created_at && isFechado(e.status))
    .map(e => Math.round((new Date(e.contract_signed_date!).getTime() - new Date(e.created_at).getTime()) / 86400000))
    .filter(d => d >= 0);
  const avgDias = diasArr.length ? Math.round(avg(diasArr)) : null;

  return (
    <div className="space-y-6">
      {/* KPIs topo */}
      <div className="grid grid-cols-5 gap-3">
        <KCard label="Receita Total"      value={fmBRL(rT)}            sub={`${fc.length} contratos fechados`}    color="text-emerald-600" />
        <KCard label="Ticket Médio"       value={fmBRL(ticketMedio)}   sub="por contrato fechado"                  color="text-amber-600" />
        <KCard label="Pipeline Estimado"  value={fmBRL(pipelineEstimado)} sub={`${ab.length} eventos × ticket médio`} color="text-primary" />
        <KCard label="Carteira Futura"    value={fmBRL(carteira)}      sub={`${futFC.length} confirmados`}          color="text-primary" />
        <KCard label="Taxa de Conversão"  value={`${txConv}%`}         sub={`${fc.length} de ${ev.length} eventos`} />
      </div>

      {/* Pipeline antecipado */}
      <div>
        <SH>Pipeline antecipado — contratos fechados vs mesmo período anos anteriores</SH>
        <div className="grid grid-cols-3 gap-3">
          {pipeCards.map(({ titulo, atual, comp1, comp2 }) => {
            const qA = atual.length, vA = sum(atual.map(e => e.total_value ?? 0));
            const q1 = comp1.length, v1 = sum(comp1.map(e => e.total_value ?? 0));
            const q2 = comp2.length;
            const diff = qA - q1;
            const diffCls = diff > 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : diff < 0 ? 'text-red-600 bg-red-50 border-red-100' : 'text-muted-foreground bg-muted border-border';
            return (
              <div key={titulo} className="bg-white border border-border rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{titulo}</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-foreground">{qA}</p>
                  <p className="text-sm text-muted-foreground mb-0.5">fechados</p>
                </div>
                {vA > 0 && <p className="text-xs text-muted-foreground">{fmBRL(vA)} em carteira</p>}
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${diffCls}`}>
                  {diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : '= mesmo ritmo'} vs ano anterior
                </span>
                <div className="pt-2 border-t border-border space-y-1 text-[10px] text-muted-foreground">
                  <div>Ano anterior: <strong>{q1}</strong>{v1 > 0 ? ` · ${fmBRL(v1)}` : ''}</div>
                  <div>2 anos atrás: <strong>{q2}</strong></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Funil */}
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Funil de conversão (todos os tempos)</SH>
          <div className="space-y-2 mt-2">
            {funnelData.map((f, i) => (
              <div key={f.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-foreground font-medium">{f.name}</span>
                  <span className="text-muted-foreground">{f.value}</span>
                </div>
                <div className="h-5 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${funnelData[0].value ? (f.value / funnelData[0].value * 100) : 0}%`, background: f.fill }} />
                </div>
                {i < funnelData.length - 1 && (
                  <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                    {funnelData[0].value ? `${(f.value / funnelData[0].value * 100).toFixed(0)}% chegaram aqui` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Receita por mês */}
        <div className="bg-white border border-border rounded-xl p-5 col-span-2">
          <SH>Receita por mês do evento (R$ mil)</SH>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={recMes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip content={<Tip />} formatter={(v: any, n: string) => [n === 'receita' ? `R$ ${v}K` : v, n === 'receita' ? 'Receita' : 'Eventos']} />
              <Bar dataKey="receita" name="receita" fill="#B8922A" radius={[3, 3, 0, 0]} />
              <Bar dataKey="qtd" name="qtd" fill="#2E4A7A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {avgDias != null && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-3 text-sm text-amber-800 flex items-center gap-2">
          <span className="font-semibold">⏱</span>
          Tempo médio do cadastro ao fechamento: <strong>{avgDias} dias</strong>
          <span className="text-xs text-amber-600 ml-2">· {diasArr.length} contratos analisados</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: FECHADOS
// ══════════════════════════════════════════════════════════════════════════════
function TabFechados({ ev, fc, locName }: { ev: EventBI[]; fc: EventBI[]; locName: (e: EventBI) => string | null }) {
  const rT = sum(fc.map(e => e.total_value ?? 0));
  const tM = fc.length ? avg(fc.map(e => e.total_value ?? 0)) : 0;
  const cr = ev.length ? fc.length / ev.length * 100 : 0;
  const tMax = fc.length ? Math.max(...fc.map(e => e.total_value ?? 0)) : 0;

  // Sazonalidade
  const sazonData = MONTHS.map((m, i) => {
    const mes = fc.filter(e => e.event_date && monthOf(e.event_date) === i);
    return { name: m, qtd: mes.length, receita: sum(mes.map(e => e.total_value ?? 0)) / 1000 };
  });

  // Por tipo
  const porTipo: Record<string, { q: number; v: number }> = {};
  fc.forEach(e => { const t = e.event_type || 'N/D'; if (!porTipo[t]) porTipo[t] = { q: 0, v: 0 }; porTipo[t].q++; porTipo[t].v += e.total_value ?? 0; });
  const tipoArr = Object.entries(porTipo).sort((a, b) => b[1].v - a[1].v).slice(0, 8);
  const tipoData = tipoArr.map(([name, { q, v }]) => ({ name: name.length > 16 ? name.slice(0, 14) + '…' : name, q, v: Math.round(v / 1000) }));

  // Por local
  const porLocal: Record<string, { q: number; v: number }> = {};
  fc.forEach(e => { const l = locName(e) || 'N/D'; if (!porLocal[l]) porLocal[l] = { q: 0, v: 0 }; porLocal[l].q++; porLocal[l].v += e.total_value ?? 0; });
  const localArr = Object.entries(porLocal).sort((a, b) => b[1].q - a[1].q).slice(0, 15);

  // Histograma tickets
  const bins = [0, 10000, 20000, 30000, 40000, 50000, 60000, 80000, 100000, 150000, Infinity];
  const binLabels = ['<10K', '10-20K', '20-30K', '30-40K', '40-50K', '50-60K', '60-80K', '80-100K', '100-150K', '>150K'];
  const histData = binLabels.map((name, i) => ({
    name, qtd: fc.filter(e => (e.total_value ?? 0) >= bins[i] && (e.total_value ?? 0) < bins[i + 1]).length,
  }));

  // Evolução mensal 24 meses
  const evolMap: Record<string, { q: number; v: number }> = {};
  fc.filter(e => e.event_date).forEach(e => {
    const k = `${yearOf(e.event_date!)}-${String(monthOf(e.event_date!) + 1).padStart(2, '0')}`;
    if (!evolMap[k]) evolMap[k] = { q: 0, v: 0 };
    evolMap[k].q++; evolMap[k].v += e.total_value ?? 0;
  });
  const evolKeys = Object.keys(evolMap).sort().slice(-24);
  const evolData = evolKeys.map(k => {
    const [yr, m] = k.split('-');
    return { name: `${MONTHS[Number(m) - 1]}/${yr.slice(2)}`, q: evolMap[k].q, v: Math.round(evolMap[k].v / 1000) };
  });

  // Ticket médio por tipo
  const ticketPorTipo = tipoArr.map(([name, { q, v }]) => ({
    name: name.length > 14 ? name.slice(0, 12) + '…' : name, ticket: q ? Math.round(v / q / 1000) : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <KCard label="Receita Total"     value={fmBRL(rT)}        sub={`${fc.length} contratos`}       color="text-emerald-600" />
        <KCard label="Ticket Médio"      value={fmBRL(tM)}        sub="por contrato fechado"             color="text-amber-600" />
        <KCard label="Maior Contrato"    value={fmBRL(tMax)}      sub="maior ticket fechado"             />
        <KCard label="Taxa de Conversão" value={`${cr.toFixed(1)}%`} sub={`${fc.length} de ${ev.length}`} />
      </div>

      {/* Sazonalidade */}
      <div className="bg-white border border-border rounded-xl p-5">
        <SH>Sazonalidade — eventos e receita por mês (R$K)</SH>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sazonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis yAxisId="q" orientation="left" tick={{ fontSize: 10, fill: '#888' }} allowDecimals={false} />
            <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 10, fill: '#888' }} />
            <Tooltip content={<Tip />} />
            <Legend />
            <Bar yAxisId="q" dataKey="qtd" name="Eventos" fill="#2E4A7A" radius={[3, 3, 0, 0]}>
              {sazonData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
            <Line yAxisId="v" type="monotone" dataKey="receita" name="Receita R$K" stroke="#B8922A" strokeWidth={2} dot={{ r: 3 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Por tipo — quantidade */}
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Por tipo — quantidade</SH>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tipoData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#555' }} width={90} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="q" name="Qtd" fill="#2E4A7A" radius={[0, 3, 3, 0]}>
                {tipoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Por tipo — ticket médio */}
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Ticket médio por tipo (R$K)</SH>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ticketPorTipo} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#555' }} width={90} />
              <Tooltip content={<Tip />} formatter={(v: any) => [`R$ ${v}K`, 'Ticket Médio']} />
              <Bar dataKey="ticket" name="Ticket Médio R$K" fill="#B8922A" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Histograma tickets */}
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Distribuição de tickets</SH>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={histData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#888' }} />
              <YAxis tick={{ fontSize: 10, fill: '#888' }} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="qtd" name="Eventos" fill="#3D5C38" radius={[3, 3, 0, 0]}>
                {histData.map((d, i) => <Cell key={i} fill={d.qtd === Math.max(...histData.map(x => x.qtd)) ? '#B8922A' : '#3D5C38'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Por local */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border"><SH>Por local (top 15)</SH></div>
          <div className="max-h-[220px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  <th className="text-left px-4 py-2">Local</th>
                  <th className="text-right px-3 py-2">Qtd</th>
                  <th className="text-right px-3 py-2">Receita</th>
                  <th className="text-right px-3 py-2">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {localArr.map(([loc, { q, v }]) => (
                  <tr key={loc} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-foreground text-xs">{loc}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{q}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{fmBRL(v)}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{pct(q, fc.length)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Evolução mensal */}
      <div className="bg-white border border-border rounded-xl p-5">
        <SH>Evolução mensal — últimos 24 meses</SH>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={evolData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} interval={1} />
            <YAxis yAxisId="q" orientation="left" tick={{ fontSize: 10, fill: '#888' }} allowDecimals={false} />
            <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 10, fill: '#888' }} />
            <Tooltip content={<Tip />} />
            <Legend />
            <Line yAxisId="q" type="monotone" dataKey="q" name="Eventos" stroke="#2E4A7A" strokeWidth={2} dot={{ r: 2 }} />
            <Line yAxisId="v" type="monotone" dataKey="v" name="Receita R$K" stroke="#B8922A" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: EM ABERTO
// ══════════════════════════════════════════════════════════════════════════════
function TabAberto({ ab, ev, fc, ticketMedio }: { ab: EventBI[]; ev: EventBI[]; fc: EventBI[]; ticketMedio: number }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const Y = hoje.getFullYear();
  const futAb = ab.filter(e => !e.event_date || new Date(e.event_date) >= hoje);
  const pipelineEstimado = ticketMedio * ab.length;
  const pipelineFuturo   = ticketMedio * futAb.length;
  const txConv = ev.length ? (fc.length / ev.length * 100).toFixed(1) : '0';

  // Por status
  const leads = ab.filter(e => e.status === 'lead').length;
  const negs  = ab.filter(e => e.status === 'negotiating').length;
  const degs  = ab.filter(e => e.status === 'tasting_scheduled').length;

  // Por mês
  const porMes = MONTHS.map((m, i) => ({
    name: m,
    qtd: ab.filter(e => e.event_date && yearOf(e.event_date) === Y && monthOf(e.event_date) === i).length,
  }));

  // Por tipo
  const porTipo: Record<string, number> = {};
  ab.forEach(e => { const t = e.event_type || 'N/D'; porTipo[t] = (porTipo[t] ?? 0) + 1; });
  const tipoArr = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);

  // Lista completa em aberto com data futura
  const leadsList = ab
    .filter(e => e.event_date && new Date(e.event_date) >= hoje)
    .sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime());

  // Sem data
  const semData = ab.filter(e => !e.event_date).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KCard label="Em Aberto (total)"  value={`${ab.length}`}              sub={`${futAb.length} futuros · ${ab.filter(e => !e.event_date).length} sem data`} />
        <KCard label="Pipeline Estimado"  value={fmBRL(pipelineEstimado)}     sub={`${ab.length} × ticket médio`}  color="text-amber-600" />
        <KCard label="Pipeline Futuro"    value={fmBRL(pipelineFuturo)}       sub={`${futAb.length} eventos futuros`} color="text-primary" />
        <KCard label="Taxa de Conversão"  value={`${txConv}%`}               sub="histórico geral" />
      </div>

      {/* Funil em aberto por status */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{leads}</p>
          <p className="text-xs text-blue-600 font-medium mt-0.5">1º Contato</p>
          <p className="text-[10px] text-blue-500">{pct(leads, ab.length)} do pipeline</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{negs}</p>
          <p className="text-xs text-amber-600 font-medium mt-0.5">Negociando</p>
          <p className="text-[10px] text-amber-500">{pct(negs, ab.length)} do pipeline</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-700">{degs}</p>
          <p className="text-xs text-purple-600 font-medium mt-0.5">Degustação Agendada</p>
          <p className="text-[10px] text-purple-500">{pct(degs, ab.length)} do pipeline</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Em aberto por mês ({Y})</SH>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={porMes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="qtd" name="Em aberto" fill="#2E4A7A" radius={[3, 3, 0, 0]}>
                {porMes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Por tipo de evento</SH>
          <div className="space-y-2 mt-1">
            {tipoArr.map(([tipo, q], i) => (
              <div key={tipo} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-foreground flex-1 truncate">{tipo}</span>
                <span className="text-xs font-semibold">{q}</span>
                <span className="text-xs text-muted-foreground w-10 text-right">{pct(q, ab.length)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lista completa */}
      {leadsList.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <SH>Todos os eventos em aberto com data ({leadsList.length})</SH>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-border">
                <tr className="bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  <th className="text-left px-4 py-2.5">Nome</th>
                  <th className="text-center px-3 py-2.5">Tipo</th>
                  <th className="text-center px-3 py-2.5">Data</th>
                  <th className="text-center px-3 py-2.5">Status</th>
                  <th className="text-right px-4 py-2.5">Valor Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {leadsList.map(e => (
                  <tr key={e.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground">{e.event_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{e.event_type ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{e.event_date ? fmtDate(e.event_date) : '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[e.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                        {STATUS_LABEL[e.status] ?? e.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {e.total_value ? fmFull(e.total_value) : <span className="text-muted-foreground/40">≈ {fmBRL(ticketMedio)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sem data */}
      {semData.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border"><SH>Leads sem data marcada ({semData.length})</SH></div>
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-border">
                <tr className="bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  <th className="text-left px-4 py-2.5">Nome</th>
                  <th className="text-center px-3 py-2.5">Tipo</th>
                  <th className="text-center px-3 py-2.5">Status</th>
                  <th className="text-center px-3 py-2.5">Cadastrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {semData.map(e => (
                  <tr key={e.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground">{e.event_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{e.event_type ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[e.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                        {STATUS_LABEL[e.status] ?? e.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{fmtDate(e.created_at.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: NÃO FECHOU
// ══════════════════════════════════════════════════════════════════════════════
function TabNFechou({ nf, ev }: { nf: EventBI[]; ev: EventBI[] }) {
  const nfV = nf.filter(e => (e.total_value ?? 0) > 500);
  const perdido = sum(nfV.map(e => e.total_value ?? 0));
  const txNF = ev.length ? (nf.length / ev.length * 100).toFixed(1) : '0';

  const porMes = MONTHS.map((m, i) => ({ name: m, qtd: nf.filter(e => e.event_date && monthOf(e.event_date) === i).length }));

  const porTipo: Record<string, { q: number; v: number }> = {};
  nf.forEach(e => { const t = e.event_type || 'N/D'; if (!porTipo[t]) porTipo[t] = { q: 0, v: 0 }; porTipo[t].q++; porTipo[t].v += e.total_value ?? 0; });
  const tipoArr = Object.entries(porTipo).sort((a, b) => b[1].q - a[1].q).slice(0, 8);

  const porAno: Record<number, { q: number; v: number }> = {};
  nf.forEach(e => {
    if (e.event_date) { const a = yearOf(e.event_date); if (!porAno[a]) porAno[a] = { q: 0, v: 0 }; porAno[a].q++; porAno[a].v += e.total_value ?? 0; }
  });
  const anoData = Object.entries(porAno).sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([a, { q, v }]) => ({ name: a, qtd: q, perdido: Math.round(v / 1000) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <KCard label="Não fechou (total)" value={`${nf.length}`}   sub={`${txNF}% dos eventos`}    />
        <KCard label="Receita Perdida"    value={fmBRL(perdido)}    sub="valor estimado total"       color="text-red-600" />
        <KCard label="Com valor reg."     value={`${nfV.length}`}   sub={`${nf.length ? pct(nfV.length, nf.length) : '—'} dos não fechados`} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Não fechou por mês</SH>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={porMes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="qtd" name="Não fechou" fill="#7A2C1E" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Não fechou por ano</SH>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={anoData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis yAxisId="q" orientation="left" tick={{ fontSize: 10, fill: '#888' }} allowDecimals={false} />
              <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 10, fill: '#888' }} />
              <Tooltip content={<Tip />} />
              <Bar yAxisId="q" dataKey="qtd" name="Qtd" fill="#D4AA50" radius={[3, 3, 0, 0]} />
              <Line yAxisId="v" type="monotone" dataKey="perdido" name="Perdido R$K" stroke="#7A2C1E" strokeWidth={2} dot={{ r: 3 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border"><SH>Por tipo de evento</SH></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <th className="text-left px-4 py-2.5">Tipo</th>
              <th className="text-right px-4 py-2.5">Qtd</th>
              <th className="text-right px-4 py-2.5">Valor Perdido Est.</th>
              <th className="text-right px-4 py-2.5">% do total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {tipoArr.map(([tipo, { q, v }]) => (
              <tr key={tipo} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 text-foreground">{tipo}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{q}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{v > 500 ? fmFull(v) : '—'}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{pct(q, nf.length)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CLIENTES
// ══════════════════════════════════════════════════════════════════════════════
function TabClientes({ ev, fc, ab, all }: { ev: EventBI[]; fc: EventBI[]; ab: EventBI[]; all: EventBI[] }) {
  // Clientes com eventos (por client_id)
  const clientMap: Record<string, { name: string; events: EventBI[] }> = {};
  all.filter(e => e.client_id).forEach(e => {
    const id = e.client_id!;
    if (!clientMap[id]) clientMap[id] = { name: e.clients?.name ?? '—', events: [] };
    clientMap[id].events.push(e);
  });

  const clientList = Object.values(clientMap);
  const recorrentes = clientList.filter(c => c.events.filter(e => isFechado(e.status)).length >= 2);
  const novos = clientList.filter(c => c.events.filter(e => isFechado(e.status)).length === 1);

  // Top clientes por receita
  const topClientes = clientList
    .map(c => ({
      name: c.name,
      eventos: c.events.filter(e => isFechado(e.status)).length,
      receita: sum(c.events.filter(e => isFechado(e.status)).map(e => e.total_value ?? 0)),
    }))
    .filter(c => c.receita > 0)
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 15);

  // Por origem (source)
  const porOrigem: Record<string, { q: number; v: number }> = {};
  fc.forEach(e => {
    const s = e.clients?.source?.trim() || 'Não informado';
    if (!porOrigem[s]) porOrigem[s] = { q: 0, v: 0 };
    porOrigem[s].q++; porOrigem[s].v += e.total_value ?? 0;
  });
  const origemArr = Object.entries(porOrigem).sort((a, b) => b[1].q - a[1].q).slice(0, 10);
  const origemData = origemArr.map(([name, { q, v }]) => ({
    name: name.length > 18 ? name.slice(0, 16) + '…' : name, q, v: Math.round(v / 1000),
  }));

  // Por região (CEP — 5 primeiros dígitos)
  const porCep: Record<string, { q: number; v: number }> = {};
  fc.forEach(e => {
    const cep = e.clients?.zip_code?.replace(/\D/g, '').slice(0, 5) || null;
    if (!cep) return;
    if (!porCep[cep]) porCep[cep] = { q: 0, v: 0 };
    porCep[cep].q++; porCep[cep].v += e.total_value ?? 0;
  });
  const cepArr = Object.entries(porCep).sort((a, b) => b[1].q - a[1].q).slice(0, 15);
  const semCep = fc.filter(e => !e.clients?.zip_code).length;

  // Recorrência ao longo do tempo
  const hoje = new Date();
  const taxaRetorno = clientList.length ? (recorrentes.length / clientList.length * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* KPIs clientes */}
      <div className="grid grid-cols-4 gap-3">
        <KCard label="Clientes Cadastrados"  value={fmtNum(clientList.length)}      sub="com eventos no sistema" />
        <KCard label="Clientes Recorrentes"  value={`${recorrentes.length}`}         sub={`${taxaRetorno}% de retorno`} color="text-emerald-600" />
        <KCard label="Clientes Únicos"        value={`${novos.length}`}              sub="1 evento fechado" />
        <KCard label="Sem CEP cadastrado"     value={`${semCep}`}                    sub="dos fechados" color={semCep > 10 ? 'text-amber-600' : ''} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Por origem */}
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Por origem do cliente</SH>
          {origemData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma origem cadastrada</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={origemData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#555' }} width={100} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="q" name="Contratos" fill="#2E4A7A" radius={[0, 3, 3, 0]}>
                  {origemData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recorrência */}
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Recorrência — clientes com 2+ eventos fechados</SH>
          {recorrentes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum cliente recorrente ainda</p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto mt-1">
              {recorrentes.sort((a, b) => b.events.filter(e => isFechado(e.status)).length - a.events.filter(e => isFechado(e.status)).length).map((c, i) => {
                const eFechados = c.events.filter(e => isFechado(e.status));
                const total = sum(eFechados.map(e => e.total_value ?? 0));
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                      {eFechados.length}
                    </div>
                    <span className="text-xs font-medium text-foreground flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{fmBRL(total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Por região (CEP) */}
      {cepArr.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <SH>Por região (CEP)</SH>
            {semCep > 0 && <p className="text-[10px] text-amber-600 -mt-2">{semCep} contratos sem CEP cadastrado não aparecem aqui</p>}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                <th className="text-left px-4 py-2.5">CEP (prefixo)</th>
                <th className="text-right px-4 py-2.5">Contratos</th>
                <th className="text-right px-4 py-2.5">Receita</th>
                <th className="text-right px-4 py-2.5">Ticket Médio</th>
                <th className="text-right px-4 py-2.5">% do total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {cepArr.map(([cep, { q, v }]) => (
                <tr key={cep} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-mono text-sm text-foreground">{cep}xxx</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{q}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{fmFull(v)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{fmBRL(q ? v / q : 0)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{pct(q, fc.length)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top clientes por receita */}
      {topClientes.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border"><SH>Top clientes por receita</SH></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                <th className="text-left px-4 py-2.5">#</th>
                <th className="text-left px-4 py-2.5">Cliente</th>
                <th className="text-right px-4 py-2.5">Eventos</th>
                <th className="text-right px-4 py-2.5">Receita Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {topClientes.map((c, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{c.eventos}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground">{fmFull(c.receita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: KPIs
// ══════════════════════════════════════════════════════════════════════════════
function TabKpis({ ev, fc, ab, nf, all, ticketMedio }: {
  ev: EventBI[]; fc: EventBI[]; ab: EventBI[]; nf: EventBI[]; all: EventBI[]; ticketMedio: number;
}) {
  const rT = sum(fc.map(e => e.total_value ?? 0));
  const tMax = fc.length ? Math.max(...fc.map(e => e.total_value ?? 0)) : 0;
  const tMin = fc.filter(e => (e.total_value ?? 0) > 0).length
    ? Math.min(...fc.filter(e => (e.total_value ?? 0) > 0).map(e => e.total_value!)) : 0;
  const txConv = ev.length ? (fc.length / ev.length * 100).toFixed(1) : '0';
  const pipeline = ticketMedio * ab.length;
  const perdido = sum(nf.filter(e => (e.total_value ?? 0) > 500).map(e => e.total_value ?? 0));

  const guestsArr = fc.filter(e => (e.guest_count ?? 0) > 0);
  const totalGuests = sum(guestsArr.map(e => e.guest_count!));
  const avgGuests = guestsArr.length ? Math.round(avg(guestsArr.map(e => e.guest_count!))) : 0;
  const tmPorConv = totalGuests > 0 ? rT / totalGuests : 0;

  const diasArr = all
    .filter(e => e.contract_signed_date && e.created_at && isFechado(e.status))
    .map(e => Math.round((new Date(e.contract_signed_date!).getTime() - new Date(e.created_at).getTime()) / 86400000))
    .filter(d => d >= 0);
  const avgDias = diasArr.length ? Math.round(avg(diasArr)) : null;
  const medianaDias = diasArr.length ? [...diasArr].sort((a, b) => a - b)[Math.floor(diasArr.length / 2)] : null;

  // YoY atual vs anterior
  const hoje = new Date();
  const Y = hoje.getFullYear();
  const fcY  = all.filter(e => isFechado(e.status) && e.event_date && yearOf(e.event_date) === Y && (e.total_value ?? 0) > 500);
  const fcY1 = all.filter(e => isFechado(e.status) && e.event_date && yearOf(e.event_date) === Y - 1 && (e.total_value ?? 0) > 500);
  const rY  = sum(fcY.map(e => e.total_value ?? 0));
  const rY1 = sum(fcY1.map(e => e.total_value ?? 0));
  const yoyPct = rY1 > 0 ? ((rY - rY1) / rY1 * 100) : null;

  const KPIS = [
    { label: 'Receita Total (filtro)',    value: fmBRL(rT),             sub: `${fc.length} contratos`,          color: 'text-emerald-600' },
    { label: 'Ticket Médio',             value: fmBRL(ticketMedio),    sub: 'por contrato fechado',             color: 'text-amber-600' },
    { label: 'Maior Contrato',           value: fmBRL(tMax),           sub: 'maior ticket fechado',             color: '' },
    { label: 'Menor Contrato',           value: fmBRL(tMin),           sub: 'menor com valor registrado',       color: '' },
    { label: 'Taxa de Conversão',        value: `${txConv}%`,          sub: `${fc.length} de ${ev.length}`,    color: '' },
    { label: 'Pipeline Estimado',        value: fmBRL(pipeline),       sub: `${ab.length} em aberto`,           color: 'text-primary' },
    { label: 'Receita Perdida',          value: fmBRL(perdido),        sub: `${nf.length} não fecharam`,        color: 'text-red-600' },
    { label: 'Total de Convidados',      value: fmtNum(totalGuests),   sub: `média ${avgGuests}/evento`,        color: '' },
    { label: 'Receita por Convidado',    value: fmBRL(tmPorConv),      sub: 'ticket médio por pax',             color: '' },
    { label: 'Tempo Médio Fechar',       value: avgDias != null ? `${avgDias}d` : '—', sub: 'cadastro → contrato', color: '' },
    { label: 'Mediana Tempo Fechar',     value: medianaDias != null ? `${medianaDias}d` : '—', sub: 'mediana',  color: '' },
    { label: `Receita ${Y}`,             value: fmBRL(rY),             sub: yoyPct != null ? `${yoyPct > 0 ? '+' : ''}${yoyPct.toFixed(1)}% vs ${Y-1}` : `vs ${Y-1}: —`, color: yoyPct != null ? (yoyPct >= 0 ? 'text-emerald-600' : 'text-red-600') : '', trend: yoyPct != null ? (yoyPct > 0 ? 'up' : yoyPct < 0 ? 'down' : 'flat') : undefined },
  ];

  // Receita por ano
  const porAno: Record<number, { fc: number; v: number }> = {};
  all.filter(e => isFechado(e.status) && e.event_date && (e.total_value ?? 0) > 500).forEach(e => {
    const a = yearOf(e.event_date!);
    if (!porAno[a]) porAno[a] = { fc: 0, v: 0 };
    porAno[a].fc++; porAno[a].v += e.total_value ?? 0;
  });
  const anoData = Object.entries(porAno).sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([yr, { fc: q, v }]) => ({ name: yr, receita: Math.round(v / 1000), qtd: q, ticket: q ? Math.round(v / q / 1000) : 0 }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {KPIS.map(k => <KCard key={k.label} label={k.label} value={k.value} sub={k.sub} color={k.color} trend={k.trend} />)}
      </div>

      <div className="bg-white border border-border rounded-xl p-5">
        <SH>Receita e ticket médio por ano (R$K)</SH>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={anoData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis yAxisId="r" orientation="left" tick={{ fontSize: 10, fill: '#888' }} />
            <YAxis yAxisId="t" orientation="right" tick={{ fontSize: 10, fill: '#888' }} />
            <Tooltip content={<Tip />} formatter={(v: any, n: string) => [n.includes('R$K') ? `R$ ${v}K` : v, n]} />
            <Legend />
            <Bar yAxisId="r" dataKey="receita" name="Receita R$K" fill="#B8922A" radius={[3, 3, 0, 0]} />
            <Line yAxisId="t" type="monotone" dataKey="ticket" name="Ticket Médio R$K" stroke="#2E4A7A" strokeWidth={2} dot={{ r: 4 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
