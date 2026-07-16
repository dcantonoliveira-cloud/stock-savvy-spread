import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { RefreshCw } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const COLORS = ['#B8922A','#2E4A7A','#3D5C38','#D4AA50','#8C7B6A','#7A2C1E','#1E5C5A','#7A6240','#5C3D8A','#2C5C7A'];
const VALUE_RANGES = [
  { l: 'Todos', mn: 0, mx: Infinity },
  { l: 'Até R$20K', mn: 0, mx: 20000 },
  { l: 'R$20–40K', mn: 20000, mx: 40000 },
  { l: 'R$40–60K', mn: 40000, mx: 60000 },
  { l: 'R$60–80K', mn: 60000, mx: 80000 },
  { l: 'R$80–100K', mn: 80000, mx: 100000 },
  { l: 'Acima R$100K', mn: 100000, mx: Infinity },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmBRL = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(2)}M`
  : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(1)}K`
  : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmFull = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const pct = (n: number, d: number) => d ? `${(n / d * 100).toFixed(1)}%` : '—';

const isFechado = (s: string) => s === 'confirmed' || s === 'completed';
const isAberto  = (s: string) => s === 'lead' || s === 'negotiating' || s === 'tasting_scheduled';
const isNFechou = (s: string) => s === 'lost' || s === 'cancelled';

const monthOf = (d: string) => Number(d.slice(5, 7)) - 1;
const yearOf  = (d: string) => Number(d.slice(0, 4));

// ── Types ──────────────────────────────────────────────────────────────────────
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
}

type TabKey = 'geral' | 'fechados' | 'aberto' | 'nfechou' | 'kpis';

// ── Tooltip ────────────────────────────────────────────────────────────────────
const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? '#333' }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

// ── KPI card ───────────────────────────────────────────────────────────────────
function KCard({ label, value, sub, color = '' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4 flex flex-col gap-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className={`text-xl font-bold ${color || 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SH({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-foreground mb-3">{children}</p>;
}

// ── Main ───────────────────────────────────────────────────────────────────────
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
    const { data } = await supabase
      .from('events' as any)
      .select('id, event_name, status, event_date, event_type, location_text, location_id, location:location_id(name), guest_count, total_value, contract_signed_date, created_at')
      .order('event_date', { ascending: false });
    setAll((data ?? []) as EventBI[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Resolve location name: prefer location_text, fallback to joined location.name
  const locName = (e: Event) => e.location_text || (e.location as any)?.name || null;

  // ── Filter options ─────────────────────────────────────────────────────────
  const anos  = useMemo(() => [...new Set(all.filter(e => e.event_date).map(e => yearOf(e.event_date!)))].sort(), [all]);
  const tipos  = useMemo(() => [...new Set(all.map(e => e.event_type).filter(Boolean))].sort(), [all]);
  const locais = useMemo(() => [...new Set(all.map(e => locName(e)).filter(Boolean))].sort(), [all]);

  // ── Filtered dataset ───────────────────────────────────────────────────────
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

  const clearFilters = () => { setFilterYear(''); setFilterMonth(''); setFilterType(''); setFilterLocal(''); setFilterRange(0); };
  const hasFilter = filterYear || filterMonth || filterType || filterLocal || filterRange > 0;

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
      Carregando BI...
    </div>
  );

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'geral',    label: 'Visão Geral' },
    { key: 'fechados', label: 'Fechados' },
    { key: 'aberto',   label: 'Em Aberto' },
    { key: 'nfechou',  label: 'Não Fechou' },
    { key: 'kpis',     label: 'KPIs' },
  ];

  return (
    <div className="space-y-4">

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-2">
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Todos os meses</option>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <select value={filterLocal} onChange={e => setFilterLocal(e.target.value)}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Todos os locais</option>
          {locais.map(l => <option key={l!} value={l!}>{l}</option>)}
        </select>
        <select value={filterRange} onChange={e => setFilterRange(Number(e.target.value))}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
          {VALUE_RANGES.map((r, i) => <option key={i} value={i}>{r.l}</option>)}
        </select>
        {hasFilter && (
          <button onClick={clearFilters}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
            ✕ Limpar
          </button>
        )}
        <button onClick={load}
          className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
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

      {/* Content */}
      {tab === 'geral'    && <TabGeral    ev={ev} fc={fc} ab={ab} all={all} />}
      {tab === 'fechados' && <TabFechados ev={ev} fc={fc} />}
      {tab === 'aberto'   && <TabAberto  ab={ab} ev={ev} />}
      {tab === 'nfechou'  && <TabNFechou nf={nf} ev={ev} />}
      {tab === 'kpis'     && <TabKpis    ev={ev} fc={fc} ab={ab} nf={nf} all={all} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: VISÃO GERAL
// ══════════════════════════════════════════════════════════════════════════════
function TabGeral({ ev, fc, ab, all }: { ev: EventBI[]; fc: EventBI[]; ab: EventBI[]; all: EventBI[] }) {
  const hoje = new Date();
  const Y = hoje.getFullYear();

  const rT  = sum(fc.map(e => e.total_value ?? 0));
  const tM  = fc.length ? avg(fc.map(e => e.total_value ?? 0)) : 0;
  const txConv = ev.length ? (fc.length / ev.length * 100).toFixed(1) : '0';
  const futFC = fc.filter(e => e.event_date && yearOf(e.event_date) >= Y);
  const carteira = sum(futFC.map(e => e.total_value ?? 0));

  // Pipeline antecipado
  function contaFechados(anoEvento: number, dataCorte: Date) {
    return all.filter(e => {
      if (!isFechado(e.status)) return false;
      const dtF = e.contract_signed_date ? new Date(e.contract_signed_date) : null;
      if (!dtF || dtF > dataCorte) return false;
      const anoEv = e.event_date ? yearOf(e.event_date) : 0;
      return anoEv === anoEvento;
    });
  }

  const corte1 = new Date(hoje); corte1.setFullYear(Y - 1);
  const corte2 = new Date(hoje); corte2.setFullYear(Y - 2);

  const pipeCards = [
    { titulo: `Eventos de ${Y}`,     atual: contaFechados(Y,   hoje), comp1: contaFechados(Y - 1, corte1), lbl1: `Mesmo período ${Y-1}`, comp2: contaFechados(Y - 2, corte2), lbl2: `Mesmo período ${Y-2}` },
    { titulo: `Eventos de ${Y + 1}`, atual: contaFechados(Y + 1, hoje), comp1: contaFechados(Y,   corte1), lbl1: `Mesmo período ${Y-1}`, comp2: contaFechados(Y - 1, corte2), lbl2: `Mesmo período ${Y-2}` },
    { titulo: `Eventos de ${Y + 2}`, atual: contaFechados(Y + 2, hoje), comp1: contaFechados(Y + 1, corte1), lbl1: `Mesmo período ${Y-1}`, comp2: contaFechados(Y,   corte2), lbl2: `Mesmo período ${Y-2}` },
  ];

  // Conversão por mês (contrato fechado no mês)
  const convMes = MONTHS.map((m, i) => {
    const total = ev.filter(e => e.contract_signed_date && monthOf(e.contract_signed_date) === i);
    const fechados = total.filter(e => isFechado(e.status));
    return { name: m, total: total.length, fechados: fechados.length };
  });

  // Tempo médio para fechar
  const diasArr = all
    .filter(e => e.contract_signed_date && e.created_at && isFechado(e.status))
    .map(e => Math.round((new Date(e.contract_signed_date!).getTime() - new Date(e.created_at).getTime()) / (86400000)));
  const avgDias = diasArr.length ? Math.round(avg(diasArr)) : null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KCard label="Receita Total"     value={fmBRL(rT)}      sub={`${fc.length} contratos`}       color="text-emerald-600" />
        <KCard label="Ticket Médio"      value={fmBRL(tM)}      sub="por evento fechado"              color="text-amber-600" />
        <KCard label="Taxa de Conversão" value={`${txConv}%`}   sub={`${fc.length} de ${ev.length} eventos`} />
        <KCard label="Carteira Futura"   value={fmBRL(carteira)} sub={`${futFC.length} eventos confirmados`} color="text-primary" />
      </div>

      {/* Pipeline antecipado */}
      <div>
        <SH>Pipeline antecipado</SH>
        <div className="grid grid-cols-3 gap-3">
          {pipeCards.map(({ titulo, atual, comp1, lbl1, comp2, lbl2 }) => {
            const qA = atual.length;
            const vA = sum(atual.map(e => e.total_value ?? 0));
            const q1 = comp1.length;
            const v1 = sum(comp1.map(e => e.total_value ?? 0));
            const q2 = comp2.length;
            const v2 = sum(comp2.map(e => e.total_value ?? 0));
            const diff = qA - q1;
            const diffCls = diff > 0 ? 'text-emerald-600 bg-emerald-50' : diff < 0 ? 'text-red-600 bg-red-50' : 'text-muted-foreground bg-muted';
            return (
              <div key={titulo} className="bg-white border border-border rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">{titulo}</p>
                <p className="text-2xl font-bold text-foreground">{qA} <span className="text-sm font-normal text-muted-foreground">fechados</span></p>
                {vA > 0 && <p className="text-xs text-muted-foreground">{fmBRL(vA)} em carteira</p>}
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${diffCls}`}>
                  {diff > 0 ? `+${diff}` : diff === 0 ? '= mesmo ritmo' : diff} vs mesmo período
                </span>
                <div className="pt-2 border-t border-border space-y-1 text-[10px] text-muted-foreground">
                  <div>{lbl1}: <strong>{q1}</strong>{v1 > 0 ? ` · ${fmBRL(v1)}` : ''}</div>
                  <div>{lbl2}: <strong>{q2}</strong>{v2 > 0 ? ` · ${fmBRL(v2)}` : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversão por mês */}
      <div className="bg-white border border-border rounded-xl p-5">
        <SH>Contratos fechados por mês</SH>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={convMes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="fechados" name="Fechados" fill="#B8922A" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {avgDias != null && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-4 text-sm text-amber-800">
          Tempo médio do cadastro até o fechamento: <strong>{avgDias} dias</strong>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: FECHADOS
// ══════════════════════════════════════════════════════════════════════════════
function TabFechados({ ev, fc }: { ev: EventBI[]; fc: EventBI[] }) {
  const rT = sum(fc.map(e => e.total_value ?? 0));
  const tM = fc.length ? avg(fc.map(e => e.total_value ?? 0)) : 0;
  const cr = ev.length ? fc.length / ev.length * 100 : 0;

  // Sazonalidade
  const sazonData = MONTHS.map((m, i) => {
    const mes = fc.filter(e => e.event_date && monthOf(e.event_date) === i);
    const qtd = mes.length;
    const rev = sum(mes.map(e => e.total_value ?? 0));
    return { name: m, qtd, ticket: qtd ? Math.round(rev / qtd) : 0 };
  });

  // Por tipo
  const porTipo: Record<string, { q: number; v: number }> = {};
  fc.forEach(e => { const t = e.event_type || 'N/D'; if (!porTipo[t]) porTipo[t] = { q: 0, v: 0 }; porTipo[t].q++; porTipo[t].v += e.total_value ?? 0; });
  const tipoArr = Object.entries(porTipo).sort((a, b) => b[1].v - a[1].v).slice(0, 8);
  const tipoData = tipoArr.map(([name, { q, v }]) => ({ name: name.length > 16 ? name.slice(0, 14) + '…' : name, q, v }));

  // Por local
  const porLocal: Record<string, { q: number; v: number }> = {};
  fc.forEach(e => { const l = locName(e) || 'N/D'; if (!porLocal[l]) porLocal[l] = { q: 0, v: 0 }; porLocal[l].q++; porLocal[l].v += e.total_value ?? 0; });
  const localArr = Object.entries(porLocal).sort((a, b) => b[1].q - a[1].q).slice(0, 10);

  // Histograma tickets
  const bins = [0, 10000, 20000, 30000, 40000, 50000, 60000, 80000, 100000, 150000, Infinity];
  const binLabels = ['<10K', '10-20K', '20-30K', '30-40K', '40-50K', '50-60K', '60-80K', '80-100K', '100-150K', '>150K'];
  const histData = binLabels.map((name, i) => ({
    name,
    qtd: fc.filter(e => (e.total_value ?? 0) >= bins[i] && (e.total_value ?? 0) < bins[i + 1]).length,
  }));

  // Evolução mensal (por event_date, agrupado mês/ano)
  const evolMap: Record<string, { q: number; v: number }> = {};
  fc.filter(e => e.event_date).forEach(e => {
    const k = `${yearOf(e.event_date!)}-${String(monthOf(e.event_date!) + 1).padStart(2, '0')}`;
    if (!evolMap[k]) evolMap[k] = { q: 0, v: 0 };
    evolMap[k].q++;
    evolMap[k].v += e.total_value ?? 0;
  });
  const evolKeys = Object.keys(evolMap).sort().slice(-18);
  const evolData = evolKeys.map(k => {
    const [yr, m] = k.split('-');
    return { name: `${MONTHS[Number(m) - 1]}/${yr.slice(2)}`, q: evolMap[k].q, v: evolMap[k].v };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <KCard label="Receita Total"     value={fmBRL(rT)}       sub={`${fc.length} contratos`} color="text-emerald-600" />
        <KCard label="Ticket Médio"      value={fmBRL(tM)}       sub="por contrato fechado"     color="text-amber-600" />
        <KCard label="Taxa de Conversão" value={`${cr.toFixed(1)}%`} sub={`${fc.length} de ${ev.length}`} />
      </div>

      {/* Sazonalidade */}
      <div className="bg-white border border-border rounded-xl p-5">
        <SH>Sazonalidade — quantidade de eventos por mês</SH>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sazonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="qtd" name="Eventos" radius={[3, 3, 0, 0]}>
              {sazonData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Por tipo */}
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Por tipo de evento</SH>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tipoData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#555' }} width={90} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="q" name="Qtd" fill="#2E4A7A" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Histograma */}
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Distribuição de tickets</SH>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={histData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#888' }} />
              <YAxis tick={{ fontSize: 10, fill: '#888' }} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="qtd" name="Eventos" fill="#3D5C38" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Por local */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border"><SH>Por local</SH></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <th className="text-left px-4 py-2.5">Local</th>
              <th className="text-right px-4 py-2.5">Qtd</th>
              <th className="text-right px-4 py-2.5">Receita</th>
              <th className="text-right px-4 py-2.5">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {localArr.map(([loc, { q, v }]) => (
              <tr key={loc} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 text-foreground">{loc}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{q}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{fmFull(v)}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{pct(q, fc.length)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Evolução mensal */}
      <div className="bg-white border border-border rounded-xl p-5">
        <SH>Evolução mensal (últimos 18 meses)</SH>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={evolData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
            <YAxis tick={{ fontSize: 10, fill: '#888' }} allowDecimals={false} />
            <Tooltip content={<Tip />} />
            <Line type="monotone" dataKey="q" name="Eventos" stroke="#B8922A" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: EM ABERTO
// ══════════════════════════════════════════════════════════════════════════════
function TabAberto({ ab, ev }: { ab: EventBI[]; ev: EventBI[] }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const Y = hoje.getFullYear();
  const pipeline = sum(ab.map(e => e.total_value ?? 0));
  const futAb = ab.filter(e => !e.event_date || new Date(e.event_date) >= hoje);
  const txConv = ev.length ? (ev.filter(e => isFechado(e.status)).length / ev.length * 100).toFixed(1) : '0';

  // Por mês do ano atual
  const porMes = MONTHS.map((m, i) => ({
    name: m,
    qtd: ab.filter(e => e.event_date && yearOf(e.event_date) === Y && monthOf(e.event_date) === i).length,
  }));

  // Por tipo
  const porTipo: Record<string, number> = {};
  ab.forEach(e => { const t = e.event_type || 'N/D'; porTipo[t] = (porTipo[t] ?? 0) + 1; });
  const tipoArr = Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Lista de leads com data mais próxima
  const leads = ab
    .filter(e => e.event_date && new Date(e.event_date) >= hoje)
    .sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime())
    .slice(0, 15);

  const fmtDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  const STATUS_LABEL: Record<string, string> = {
    lead: '1º Contato', negotiating: 'Negociando', tasting_scheduled: 'Degustação agend.',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <KCard label="Em Aberto (total)"     value={`${ab.length}`}         sub={`${futAb.length} futuros`} />
        <KCard label="Pipeline"              value={fmBRL(pipeline)}         sub="valor estimado"            color="text-amber-600" />
        <KCard label="Taxa de Conversão"     value={`${txConv}%`}           sub="de todos os eventos"       />
        <KCard label="Sem data"              value={`${ab.filter(e => !e.event_date).length}`} sub="leads sem data marcada" />
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
              <Bar dataKey="qtd" name="Em aberto" fill="#2E4A7A" radius={[3, 3, 0, 0]} />
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
                <span className="text-xs font-semibold text-muted-foreground">{q}</span>
                <span className="text-xs text-muted-foreground w-10 text-right">{pct(q, ab.length)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {leads.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border"><SH>Próximos eventos em aberto</SH></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                <th className="text-left px-4 py-2.5">Nome</th>
                <th className="text-center px-3 py-2.5">Tipo</th>
                <th className="text-center px-3 py-2.5">Data</th>
                <th className="text-center px-3 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5">Valor Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {leads.map(e => (
                <tr key={e.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium text-foreground">{e.event_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{e.event_type ?? '—'}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{e.event_date ? fmtDate(e.event_date) : '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                    {e.total_value ? fmFull(e.total_value) : '—'}
                  </td>
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
// TAB: NÃO FECHOU
// ══════════════════════════════════════════════════════════════════════════════
function TabNFechou({ nf, ev }: { nf: EventBI[]; ev: EventBI[] }) {
  const nfV = nf.filter(e => (e.total_value ?? 0) > 500);
  const perdido = sum(nfV.map(e => e.total_value ?? 0));
  const txNF = ev.length ? (nf.length / ev.length * 100).toFixed(1) : '0';

  // Por mês (event_date)
  const porMes = MONTHS.map((m, i) => ({
    name: m,
    qtd: nf.filter(e => e.event_date && monthOf(e.event_date) === i).length,
  }));

  // Por tipo
  const porTipo: Record<string, { q: number; v: number }> = {};
  nf.forEach(e => { const t = e.event_type || 'N/D'; if (!porTipo[t]) porTipo[t] = { q: 0, v: 0 }; porTipo[t].q++; porTipo[t].v += e.total_value ?? 0; });
  const tipoArr = Object.entries(porTipo).sort((a, b) => b[1].q - a[1].q).slice(0, 8);

  // Por ano
  const porAno: Record<number, number> = {};
  nf.forEach(e => { if (e.event_date) { const a = yearOf(e.event_date); porAno[a] = (porAno[a] ?? 0) + 1; } });
  const anoData = Object.entries(porAno).sort((a, b) => Number(a[0]) - Number(b[0])).map(([a, q]) => ({ name: a, qtd: q }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <KCard label="Não fechou (total)" value={`${nf.length}`}        sub={`${txNF}% dos eventos`}  />
        <KCard label="Receita Perdida"    value={fmBRL(perdido)}         sub="valor estimado"          color="text-red-600" />
        <KCard label="Com valor reg."     value={`${nfV.length}`}        sub="dos que não fecharam"    />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-border rounded-xl p-5">
          <SH>Não fechou por mês (event_date)</SH>
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
            <BarChart data={anoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="qtd" name="Não fechou" fill="#D4AA50" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Por tipo */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border"><SH>Por tipo de evento</SH></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <th className="text-left px-4 py-2.5">Tipo</th>
              <th className="text-right px-4 py-2.5">Qtd</th>
              <th className="text-right px-4 py-2.5">Valor Est.</th>
              <th className="text-right px-4 py-2.5">%</th>
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
// TAB: KPIs
// ══════════════════════════════════════════════════════════════════════════════
function TabKpis({ ev, fc, ab, nf, all }: { ev: EventBI[]; fc: EventBI[]; ab: EventBI[]; nf: EventBI[]; all: EventBI[] }) {
  const rT      = sum(fc.map(e => e.total_value ?? 0));
  const tM      = fc.length ? avg(fc.map(e => e.total_value ?? 0)) : 0;
  const tMax    = fc.length ? Math.max(...fc.map(e => e.total_value ?? 0)) : 0;
  const tMin    = fc.filter(e => (e.total_value ?? 0) > 0).length
    ? Math.min(...fc.filter(e => (e.total_value ?? 0) > 0).map(e => e.total_value!)) : 0;
  const txConv  = ev.length ? (fc.length / ev.length * 100).toFixed(1) : '0';
  const pipeline = sum(ab.map(e => e.total_value ?? 0));
  const perdido  = sum(nf.filter(e => (e.total_value ?? 0) > 500).map(e => e.total_value ?? 0));

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

  const KPIS = [
    { label: 'Receita Total (filtro)',    value: fmBRL(rT),          sub: `${fc.length} contratos`,         color: 'text-emerald-600' },
    { label: 'Ticket Médio',             value: fmBRL(tM),          sub: 'por contrato fechado',            color: 'text-amber-600' },
    { label: 'Maior Ticket',             value: fmBRL(tMax),        sub: 'maior contrato fechado',          color: '' },
    { label: 'Menor Ticket',             value: fmBRL(tMin),        sub: 'menor contrato com valor',        color: '' },
    { label: 'Taxa de Conversão',        value: `${txConv}%`,       sub: `${fc.length} de ${ev.length}`,   color: '' },
    { label: 'Pipeline em Aberto',       value: fmBRL(pipeline),    sub: `${ab.length} eventos`,            color: 'text-primary' },
    { label: 'Receita Perdida',          value: fmBRL(perdido),     sub: `${nf.length} não fecharam`,       color: 'text-red-600' },
    { label: 'Total de Convidados',      value: fmtNum(totalGuests),sub: `média ${avgGuests} por evento`,   color: '' },
    { label: 'Receita por Convidado',    value: fmBRL(tmPorConv),   sub: 'ticket médio por pax',            color: '' },
    { label: 'Tempo Médio p/ Fechar',    value: avgDias != null ? `${avgDias} dias` : '—', sub: 'do cadastro ao contrato', color: '' },
    { label: 'Mediana Tempo Fechar',     value: medianaDias != null ? `${medianaDias} dias` : '—', sub: 'mediana',          color: '' },
    { label: 'Total de Eventos (filtro)',value: fmtNum(ev.length),  sub: 'todos os status',                 color: '' },
  ];

  // Receita por ano
  const porAno: Record<number, { fc: number; v: number }> = {};
  all.filter(e => isFechado(e.status) && e.event_date && (e.total_value ?? 0) > 500).forEach(e => {
    const a = yearOf(e.event_date!);
    if (!porAno[a]) porAno[a] = { fc: 0, v: 0 };
    porAno[a].fc++;
    porAno[a].v += e.total_value ?? 0;
  });
  const anoData = Object.entries(porAno).sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([yr, { fc: q, v }]) => ({ name: yr, receita: Math.round(v / 1000), qtd: q }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {KPIS.map(k => <KCard key={k.label} label={k.label} value={k.value} sub={k.sub} color={k.color} />)}
      </div>

      {/* Receita por ano */}
      <div className="bg-white border border-border rounded-xl p-5">
        <SH>Receita total por ano (R$ mil)</SH>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={anoData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis tick={{ fontSize: 11, fill: '#888' }} />
            <Tooltip content={<Tip />} formatter={(v: any, n: string) => [n === 'receita' ? `R$ ${v}K` : v, n === 'receita' ? 'Receita' : 'Contratos']} />
            <Legend />
            <Bar dataKey="receita" name="Receita (R$K)" fill="#B8922A" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function fmtNum(v: number) { return v.toLocaleString('pt-BR'); }
