import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Users, BarChart3, DollarSign, ExternalLink, CheckCircle2, X, Pencil, Save, Target } from 'lucide-react';
import BIDashboard from './BIDashboard';
import { getStatus } from '@/lib/eventStatus';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { toast } from 'sonner';

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
export default function EstatisticasPage() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<'originais' | 'bi'>('originais');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tastings, setTastings] = useState<any[]>([]);
  const [tastingRange, setTastingRange] = useState<'3m' | '1a' | 'all'>('1a');
  const [activeCell, setActiveCell] = useState<{ key: string; month: number } | null>(null);

  // ── Break-even & Metas ──────────────────────────────────────────────────────
  const [breakEven, setBreakEven] = useState<number | null>(null);
  const [breakEvenInput, setBreakEvenInput] = useState('');
  const [editingBE, setEditingBE] = useState(false);
  const [savingBE, setSavingBE] = useState(false);

  interface Metas { eventos: number | null; faturamento: number | null; ticket: number | null }
  const [metas, setMetas] = useState<Metas>({ eventos: null, faturamento: null, ticket: null });
  const [metasInput, setMetasInput] = useState<Metas>({ eventos: null, faturamento: null, ticket: null });
  const [editingMetas, setEditingMetas] = useState(false);
  const [savingMetas, setSavingMetas] = useState(false);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('company_settings').select('key, value').in('key', ['break_even', 'metas']);
    data?.forEach((row: any) => {
      if (row.key === 'break_even') {
        const v = Number(row.value?.monthly ?? row.value);
        setBreakEven(isNaN(v) ? null : v);
        setBreakEvenInput(isNaN(v) ? '' : String(v));
      }
      if (row.key === 'metas') {
        const m = row.value as Metas;
        setMetas(m);
        setMetasInput({ ...m });
      }
    });
  }, []);

  const saveBE = async () => {
    const val = Number(breakEvenInput.replace(/\D/g, ''));
    if (!val || val <= 0) { toast.error('Digite um valor válido'); return; }
    setSavingBE(true);
    const { error } = await supabase.from('company_settings').upsert(
      { key: 'break_even', value: { monthly: val } },
      { onConflict: 'company_id,key' }
    );
    if (error) { toast.error('Erro ao salvar: ' + error.message); }
    else { setBreakEven(val); setEditingBE(false); toast.success('Ponto de equilíbrio salvo'); }
    setSavingBE(false);
  };

  const saveMetas = async () => {
    setSavingMetas(true);
    const { error } = await supabase.from('company_settings').upsert(
      { key: 'metas', value: metasInput },
      { onConflict: 'company_id,key' }
    );
    if (error) { toast.error('Erro ao salvar: ' + error.message); }
    else { setMetas({ ...metasInput }); setEditingMetas(false); toast.success('Metas salvas'); }
    setSavingMetas(false);
  };

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
      await loadSettings();
      setLoading(false);
    };
    load();
  }, [year, loadSettings]);

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
  const ticketMedio = totalGuests ? totalRev / totalGuests : 0;

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
        e.contract_signed_date != null &&
        monthOf(e.contract_signed_date) === i &&
        e.status !== 'cancelled' && e.status !== 'lost' && e.status !== 'not_closed'
      );

      // Degustações: sessões distintas no mês
      const sessionsList: Array<{ id: string; date: string; type: string | null }> = [];
      for (const [sid, sd] of sessionMap) {
        if (sd.date.startsWith(`${year}`) && monthOf(sd.date) === i)
          sessionsList.push({ id: sid, ...sd });
      }

      // Eventos em degustação: apenas novos (situation_snapshot = 'new') do mês
      const tastingEventsList = tastings.filter((t: any) => {
        if (t.situation_snapshot !== 'new') return false;
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

  // Faturamento por mês do evento (event_date) — para o gráfico break-even
  // Inclui eventos confirmados, concluídos e com contrato assinado (mesmo futuros)
  const fatPorMesEvento = useMemo(() => MONTHS.map((_, i) => {
    const mes = events.filter(e =>
      e.event_date && monthOf(e.event_date) === i &&
      (e.status === 'confirmed' || e.status === 'completed' || e.contract_signed)
    );
    return Math.round(mes.reduce((s, e) => s + (e.total_value ?? 0), 0));
  }), [events]);

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
    <div className="p-6 space-y-6 overflow-x-hidden">

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

          {/* ── Seção 4: Ponto de Equilíbrio ── */}
          <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Ponto de Equilíbrio Mensal</p>
                <p className="text-xs text-muted-foreground mt-0.5">Compare o faturamento mensal com seu ponto de equilíbrio</p>
              </div>
              {!editingBE ? (
                <button onClick={() => { setEditingBE(true); setBreakEvenInput(breakEven ? String(breakEven) : ''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                  {breakEven ? 'Editar' : 'Definir ponto'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <input
                    type="number" value={breakEvenInput} onChange={e => setBreakEvenInput(e.target.value)}
                    placeholder="Ex: 50000"
                    className="w-32 text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button onClick={saveBE} disabled={savingBE}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary/90 disabled:opacity-40">
                    <Save className="w-3.5 h-3.5" />{savingBE ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button onClick={() => setEditingBE(false)} className="text-xs text-muted-foreground hover:text-foreground px-2">Cancelar</button>
                </div>
              )}
            </div>
            {breakEven && (
              <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#B8922A] inline-block"/>Faturamento mensal</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-500 border-dashed inline-block" style={{borderTop:'2px dashed #ef4444',height:0}}/>Ponto de equilíbrio</div>
              </div>
            )}
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={MONTHS.map((m, i) => ({ name: m, fat: fatPorMesEvento[i] }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => [fmtBRL(v), 'Faturamento previsto']} />
                <Bar dataKey="fat" name="Faturamento" fill="#B8922A" radius={[3,3,0,0]} />
                {breakEven && <ReferenceLine y={breakEven} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={2} label={{ value: `PE R$${(breakEven/1000).toFixed(0)}K`, position: 'right', fontSize: 10, fill: '#ef4444' }} />}
              </BarChart>
            </ResponsiveContainer>
            {breakEven && (() => {
              const mesesAbaixo = fatPorMesEvento.filter(v => v > 0 && v < breakEven!).length;
              const mesesAcima  = fatPorMesEvento.filter(v => v >= breakEven!).length;
              const fatTotal    = fatPorMesEvento.reduce((s, v) => s + v, 0);
              const beAnual  = breakEven * 12;
              return (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                  <div className="rounded-xl border border-border p-3 text-center">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Meses acima do PE</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{mesesAcima}</p>
                  </div>
                  <div className="rounded-xl border border-border p-3 text-center">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Meses abaixo do PE</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">{mesesAbaixo}</p>
                  </div>
                  <div className="rounded-xl border border-border p-3 text-center">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Fat. vs meta anual</p>
                    <p className={`text-2xl font-bold mt-1 ${fatTotal >= beAnual ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {Math.round(fatTotal / beAnual * 100)}%
                    </p>
                  </div>
                </div>
              );
            })()}
            {!breakEven && (
              <p className="text-center text-sm text-muted-foreground py-4">Defina seu ponto de equilíbrio mensal para ver a comparação.</p>
            )}
          </div>

          {/* ── Seção 5: Metas ── */}
          <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Metas do Ano</p>
                <p className="text-xs text-muted-foreground mt-0.5">Defina suas metas e acompanhe o progresso</p>
              </div>
              {!editingMetas ? (
                <button onClick={() => { setEditingMetas(true); setMetasInput({ ...metas }); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                  <Pencil className="w-3.5 h-3.5" />Editar metas
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={saveMetas} disabled={savingMetas}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary/90 disabled:opacity-40">
                    <Save className="w-3.5 h-3.5" />{savingMetas ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button onClick={() => setEditingMetas(false)} className="text-xs text-muted-foreground hover:text-foreground px-2">Cancelar</button>
                </div>
              )}
            </div>
            {editingMetas ? (
              <div className="grid grid-cols-3 gap-4">
                {([
                  { key: 'eventos',     label: 'Eventos realizados', prefix: '', suffix: 'eventos' },
                  { key: 'faturamento', label: 'Faturamento anual',  prefix: 'R$', suffix: '' },
                  { key: 'ticket',      label: 'Ticket médio/convidado', prefix: 'R$', suffix: '' },
                ] as const).map(({ key, label, prefix }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    <div className="flex items-center gap-1.5">
                      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
                      <input
                        type="number" value={metasInput[key] ?? ''}
                        onChange={e => setMetasInput(prev => ({ ...prev, [key]: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="—"
                        className="w-full text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Eventos realizados', meta: metas.eventos,     atual: totalEvents,  suffix: '', fmt: (v: number) => String(v) },
                  { label: 'Faturamento anual',  meta: metas.faturamento, atual: totals.faturamento, suffix: '', fmt: fmtBRL },
                  { label: 'Ticket / convidado', meta: metas.ticket,      atual: ticketMedio,  suffix: '', fmt: fmtBRL },
                ].map(({ label, meta, atual, fmt }) => {
                  const pct = meta && meta > 0 ? Math.min(Math.round(atual / meta * 100), 100) : null;
                  const over = meta && meta > 0 ? atual > meta : false;
                  return (
                    <div key={label} className="rounded-xl border border-border p-4 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</p>
                      <div className="flex items-end gap-1">
                        <p className={`text-xl font-bold ${over ? 'text-emerald-600' : 'text-foreground'}`}>{fmt(atual)}</p>
                        {meta && <p className="text-xs text-muted-foreground mb-0.5">/ {fmt(meta)}</p>}
                      </div>
                      {pct !== null ? (
                        <>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${over ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <p className={`text-xs font-semibold ${over ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                            {pct}%{over ? ' ✓ Meta atingida!' : ' da meta'}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Meta não definida</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Seção 6: Degustações ── */}
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

      {tab === 'bi' && <BIDashboard />}

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
  const isBigTable = activeCell.key === 'contratos' || activeCell.key === 'faturamento' || activeCell.key === 'orcamentos';
  const isContratosOrFat = activeCell.key === 'contratos' || activeCell.key === 'faturamento';

  const contratosMes = (activeCell.key === 'orcamentos')
    ? (row._orcList as ContratoRow[])
    : isContratosOrFat
    ? (row._contratosList as ContratoRow[])
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
        style={{ maxWidth: isBigTable ? '960px' : '420px', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <p className="font-semibold text-foreground text-sm">{titles[activeCell.key]}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isBigTable && (
          contratosMes.length === 0
            ? <p className="px-5 py-10 text-sm text-muted-foreground text-center">Nenhum item neste mês.</p>
            : <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      <th className="text-left px-3 py-2.5 w-[90px]">Data Evento</th>
                      <th className="text-left px-3 py-2.5">Nome</th>
                      <th className="text-center px-2 py-2.5 w-[90px]">Tipo</th>
                      <th className="text-center px-2 py-2.5 w-[50px]">Pax</th>
                      <th className="text-center px-2 py-2.5 w-[60px]">R$/Pax</th>
                      <th className="text-center px-2 py-2.5 w-[90px]">Status</th>
                      <th className="text-center px-2 py-2.5 w-[70px]">Fechamento</th>
                      <th className="text-center px-2 py-2.5 w-[100px]">Total</th>
                      <th className="text-center px-2 py-2.5 w-[60px]">Pgto</th>
                      <th className="px-2 py-2.5 w-[36px]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {[...contratosMes].sort((a, b) => {
                      const aKey = activeCell.key === 'orcamentos' ? (a.event_date ?? '') : (a.contract_signed_date ?? '');
                      const bKey = activeCell.key === 'orcamentos' ? (b.event_date ?? '') : (b.contract_signed_date ?? '');
                      return aKey.localeCompare(bKey);
                    }).map(e => {
                      const st = getStatus(e.status);
                      return (
                        <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">{fmtDate(e.event_date)}</td>
                          <td className="px-3 py-2.5 font-medium text-foreground">{e.event_name ?? '—'}</td>
                          <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">{e.event_type ?? '—'}</td>
                          <td className="px-2 py-2.5 text-center text-muted-foreground">{e.guest_count ?? '—'}</td>
                          <td className="px-2 py-2.5 text-center text-muted-foreground text-xs">
                            {e.price_per_person != null ? e.price_per_person.toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">{fmtMes(e.contract_signed_date)}</td>
                          <td className="px-2 py-2.5 text-center text-xs font-semibold text-foreground">
                            {e.total_value != null ? e.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <PgtoBadge total={e.total_value} paid={e.paid_value} full={e.is_paid_in_full} />
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button onClick={() => onNavigate(e.id)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Abrir evento">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {isBigTable && (() => {
                    const totalVal  = contratosMes.reduce((s, e) => s + (e.total_value ?? 0), 0);
                    const totalPax  = contratosMes.reduce((s, e) => s + (e.guest_count ?? 0), 0);
                    const count     = contratosMes.filter(e => e.total_value != null).length;
                    const ticketMed = count > 0 ? totalVal / count : 0;
                    const ticketPax = totalPax > 0 ? totalVal / totalPax : 0;
                    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    return (
                      <tfoot>
                        <tr className="border-t-2 border-border bg-muted/30 font-semibold text-xs">
                          <td colSpan={3} className="px-3 py-2.5 text-foreground">{contratosMes.length} {activeCell.key === 'orcamentos' ? 'orçamentos' : 'contratos'}</td>
                          <td className="px-2 py-2.5 text-center text-foreground">{totalPax.toLocaleString('pt-BR')}</td>
                          <td colSpan={3} />
                          <td className="px-2 py-2.5 text-center text-foreground">{fmt(totalVal)}</td>
                          <td colSpan={2} />
                        </tr>
                        <tr className="bg-muted/10 text-[10px] text-muted-foreground border-t border-border/40">
                          <td colSpan={3} className="px-3 py-1.5 text-muted-foreground">Tickets médios</td>
                          <td colSpan={1} />
                          <td className="px-2 py-1.5 text-center">
                            <span className="text-[9px] block text-muted-foreground/60">por pax</span>
                            <span className="font-semibold text-foreground">{ticketPax > 0 ? fmt(ticketPax) : '—'}</span>
                          </td>
                          <td colSpan={2} />
                          <td className="px-2 py-1.5 text-center">
                            <span className="text-[9px] block text-muted-foreground/60">por contrato</span>
                            <span className="font-semibold text-foreground">{ticketMed > 0 ? fmt(ticketMed) : '—'}</span>
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
        )}

        {!isBigTable && (() => {
          type SimpleItem = { label: string; sub?: string; id?: string };
          let items: SimpleItem[] = [];
          if (activeCell.key === 'degustacoes')
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
