import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtK = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);

type MonthData = {
  label: string; year: number; month: number;
  receita: number; custo: number; despesa: number; lucro: number;
};

export default function DREPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');
  const [month, setMonth] = useState(now.getMonth());
  // caixa = receita quando o pagamento entra; competencia = receita pelo mês do evento
  const [basis, setBasis] = useState<'caixa' | 'competencia'>('caixa');
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const first = `${year}-01-01`;
      const last = `${year}-12-31`;

      if (basis === 'caixa') {
        const [{ data: payments }, { data: cashEntries }] = await Promise.all([
          supabase.from('event_payments' as any)
            .select('payment_date, value')
            .gte('payment_date', first).lte('payment_date', last)
            .eq('is_confirmed', true),
          supabase.from('cash_flow_entries' as any)
            .select('date, amount, category')
            .gte('date', first).lte('date', last),
        ]);

        const monthsData: MonthData[] = MONTHS.map((label, m) => {
          const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
          const receita = ((payments ?? []) as any[])
            .filter(p => p.payment_date?.startsWith(prefix))
            .reduce((s: number, p: any) => s + p.value, 0);
          const posEntries = ((cashEntries ?? []) as any[])
            .filter(e => e.date?.startsWith(prefix) && e.amount > 0)
            .reduce((s: number, e: any) => s + e.amount, 0);
          const despesa = Math.abs(((cashEntries ?? []) as any[])
            .filter(e => e.date?.startsWith(prefix) && e.amount < 0)
            .reduce((s: number, e: any) => s + e.amount, 0));
          const totalReceita = receita + posEntries;
          return { label, year, month: m, receita: totalReceita, custo: 0, despesa, lucro: totalReceita - despesa };
        });
        setData(monthsData);
      } else {
        // Competência: valor total do evento no mês da festa
        const [{ data: events }, { data: cashEntries }] = await Promise.all([
          supabase.from('events')
            .select('event_date, total_value')
            .gte('event_date', first).lte('event_date', last)
            .in('status', ['confirmed', 'completed']),
          supabase.from('cash_flow_entries' as any)
            .select('date, amount, category')
            .gte('date', first).lte('date', last),
        ]);

        const monthsData: MonthData[] = MONTHS.map((label, m) => {
          const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
          const receita = ((events ?? []) as any[])
            .filter(e => e.event_date?.startsWith(prefix))
            .reduce((s: number, e: any) => s + (e.total_value ?? 0), 0);
          const despesa = Math.abs(((cashEntries ?? []) as any[])
            .filter(e => e.date?.startsWith(prefix) && e.amount < 0)
            .reduce((s: number, e: any) => s + e.amount, 0));
          return { label, year, month: m, receita, custo: 0, despesa, lucro: receita - despesa };
        });
        setData(monthsData);
      }

      setLoading(false);
    };
    load();
  }, [year, basis]);

  const totals = data.reduce((acc, d) => ({
    receita: acc.receita + d.receita,
    despesa: acc.despesa + d.despesa,
    lucro: acc.lucro + d.lucro,
  }), { receita: 0, despesa: 0, lucro: 0 });

  const margem = totals.receita > 0 ? Math.round((totals.lucro / totals.receita) * 100) : 0;
  const currentMonth = viewMode === 'monthly' ? data[month] : null;

  const DRE_ROWS = (d: { receita: number; despesa: number; lucro: number }) => [
    { label: 'RECEITA BRUTA', value: d.receita, bold: true, color: 'text-emerald-600', indent: 0 },
    { label: basis === 'caixa' ? 'Receita de eventos (recebido)' : 'Valor total dos eventos do mês', value: d.receita, bold: false, color: 'text-foreground', indent: 1 },
    { label: '(-) DESPESAS OPERACIONAIS', value: -d.despesa, bold: true, color: 'text-red-500', indent: 0 },
    { label: 'Despesas diversas', value: -d.despesa, bold: false, color: 'text-foreground', indent: 1 },
    { label: 'RESULTADO OPERACIONAL', value: d.lucro, bold: true, color: d.lucro >= 0 ? 'text-foreground' : 'text-red-500', indent: 0, separator: true },
    { label: 'Margem operacional', value: d.receita > 0 ? d.lucro / d.receita * 100 : 0, bold: false, color: d.lucro >= 0 ? 'text-emerald-600' : 'text-red-500', indent: 1, isPct: true },
  ];

  const displayData = currentMonth ?? totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">DRE — Demonstrativo de Resultado</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Resultado financeiro do exercício</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Base de cálculo */}
          <div className="flex gap-1 bg-muted p-1 rounded-xl" title="Caixa: receita quando o pagamento entra. Competência: receita no mês da festa.">
            <button onClick={() => setBasis('caixa')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${basis === 'caixa' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              Caixa
            </button>
            <button onClick={() => setBasis('competencia')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${basis === 'competencia' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              Competência
            </button>
          </div>

          <div className="flex gap-1 bg-muted p-1 rounded-xl">
            <button onClick={() => setViewMode('annual')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'annual' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              Anual
            </button>
            <button onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              Mensal
            </button>
          </div>

          {/* Year nav */}
          <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-0.5">
            <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-semibold min-w-[60px] text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {viewMode === 'monthly' && (
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="h-9 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20">
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Receita</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">{fmtBRL(displayData.receita)}</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Despesas</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-red-500">{fmtBRL(displayData.despesa)}</p>
        </div>
        <div className="bg-white px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Resultado</p>
          <p className={`text-2xl font-bold tabular-nums ${displayData.lucro >= 0 ? 'text-foreground' : 'text-red-500'}`}>{fmtBRL(displayData.lucro)}</p>
        </div>
        <div className="bg-white px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Margem</p>
          <p className={`text-2xl font-bold tabular-nums ${margem >= 0 ? 'text-foreground' : 'text-red-500'}`}>
            {viewMode === 'annual' ? margem : (displayData.receita > 0 ? Math.round((displayData.lucro / displayData.receita) * 100) : 0)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-6">

        {/* Chart */}
        <div className="bg-white border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Receita vs Despesas — {year}</p>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 0, right: 8, left: 8, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#e2e8f0" />
                <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="despesa" name="Despesas" fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="lucro" name="Resultado" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* DRE breakdown */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {viewMode === 'monthly' ? `${MONTHS[month]} ${year}` : `Ano ${year}`}
            </p>
          </div>
          <div className="divide-y divide-border/50">
            {DRE_ROWS(displayData).map((row, i) => (
              <div key={i}>
                {row.separator && <div className="h-px bg-foreground/10 mx-5" />}
                <div className={`px-5 py-3 flex items-center justify-between ${row.bold ? 'bg-muted/20' : ''}`}
                  style={{ paddingLeft: `${1.25 + row.indent * 0.75}rem` }}>
                  <span className={`text-sm ${row.bold ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{row.label}</span>
                  <span className={`text-sm font-semibold tabular-nums ${row.color}`}>
                    {row.isPct
                      ? `${(row.value as number).toFixed(1)}%`
                      : fmtBRL(row.value as number)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Resultado por mês — {year}</p>
        </div>
        <div className="px-5 py-3 bg-muted/30 border-b border-border grid grid-cols-[60px_1fr_1fr_1fr_100px] gap-3">
          {['Mês','Receita','Despesas','Resultado','Margem'].map((h, i) => (
            <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i > 0 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>
        <div className="divide-y divide-border/50">
          {data.map((d, i) => (
            <div key={i} className={`px-5 py-3 grid grid-cols-[60px_1fr_1fr_1fr_100px] gap-3 items-center hover:bg-slate-50 transition-colors ${d.lucro < 0 ? 'bg-red-50/20' : ''}`}>
              <span className="text-sm font-medium text-foreground">{d.label}</span>
              <span className="text-sm tabular-nums text-right text-emerald-600">{d.receita > 0 ? fmtBRL(d.receita) : '—'}</span>
              <span className="text-sm tabular-nums text-right text-red-500">{d.despesa > 0 ? fmtBRL(d.despesa) : '—'}</span>
              <span className={`text-sm font-semibold tabular-nums text-right ${d.lucro >= 0 ? 'text-foreground' : 'text-red-500'}`}>
                {d.receita > 0 || d.despesa > 0 ? fmtBRL(d.lucro) : '—'}
              </span>
              <span className={`text-sm tabular-nums text-right ${d.lucro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {d.receita > 0 ? `${Math.round((d.lucro / d.receita) * 100)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border bg-muted/30 grid grid-cols-[60px_1fr_1fr_1fr_100px] gap-3">
          <span className="text-sm font-bold text-foreground">Total</span>
          <span className="text-sm font-bold tabular-nums text-right text-emerald-600">{fmtBRL(totals.receita)}</span>
          <span className="text-sm font-bold tabular-nums text-right text-red-500">{fmtBRL(totals.despesa)}</span>
          <span className={`text-sm font-bold tabular-nums text-right ${totals.lucro >= 0 ? 'text-foreground' : 'text-red-500'}`}>{fmtBRL(totals.lucro)}</span>
          <span className={`text-sm font-bold tabular-nums text-right ${margem >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{margem}%</span>
        </div>
      </div>
    </div>
  );
}
