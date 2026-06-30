import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Download, TrendingUp, TrendingDown, Users, Calendar, DollarSign, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from 'recharts';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtK = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);

const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

type ReportPeriod = 'month' | 'quarter' | 'year';

export default function RelatoriosPage() {
  const now = new Date();
  const [period, setPeriod] = useState<ReportPeriod>('year');
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);

  const [monthlyRevenue, setMonthlyRevenue] = useState<{ label: string; receita: number; despesa: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [eventStats, setEventStats] = useState({ total: 0, confirmed: 0, revenue: 0, avgValue: 0, totalGuests: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const first = `${year}-01-01`;
      const last = `${year}-12-31`;

      const [{ data: payments }, { data: cashEntries }, { data: events }] = await Promise.all([
        supabase.from('event_payments' as any).select('payment_date, value').gte('payment_date', first).lte('payment_date', last).eq('is_confirmed', true),
        supabase.from('cash_flow_entries' as any).select('date, amount, category').gte('date', first).lte('date', last),
        supabase.from('events').select('status, total_value, guest_count').gte('event_date', first).lte('event_date', last),
      ]);

      // Monthly revenue
      const monthly = MONTHS.map((label, m) => {
        const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
        const receita = ((payments ?? []) as any[]).filter(p => p.payment_date?.startsWith(prefix)).reduce((s: number, p: any) => s + p.value, 0);
        const posManual = ((cashEntries ?? []) as any[]).filter(e => e.date?.startsWith(prefix) && e.amount > 0).reduce((s: number, e: any) => s + e.amount, 0);
        const despesa = Math.abs(((cashEntries ?? []) as any[]).filter(e => e.date?.startsWith(prefix) && e.amount < 0).reduce((s: number, e: any) => s + e.amount, 0));
        return { label, receita: receita + posManual, despesa };
      });
      setMonthlyRevenue(monthly);

      // Category breakdown of expenses
      const catMap: Record<string, number> = {};
      ((cashEntries ?? []) as any[]).filter(e => e.amount < 0).forEach((e: any) => {
        const cat = e.category ?? 'outros';
        catMap[cat] = (catMap[cat] ?? 0) + Math.abs(e.amount);
      });
      const breakdown = Object.entries(catMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
      setCategoryBreakdown(breakdown);

      // Event stats
      const evs = (events ?? []) as any[];
      const confirmed = evs.filter(e => e.status === 'confirmed' || e.status === 'completed');
      const totalRevenue = confirmed.reduce((s: number, e: any) => s + (e.total_value ?? 0), 0);
      setEventStats({
        total: evs.length,
        confirmed: confirmed.length,
        revenue: totalRevenue,
        avgValue: confirmed.length > 0 ? totalRevenue / confirmed.length : 0,
        totalGuests: confirmed.reduce((s: number, e: any) => s + (e.guest_count ?? 0), 0),
      });

      setLoading(false);
    };
    load();
  }, [year]);

  const totalReceita = monthlyRevenue.reduce((s, m) => s + m.receita, 0);
  const totalDespesa = monthlyRevenue.reduce((s, m) => s + m.despesa, 0);
  const totalLucro = totalReceita - totalDespesa;
  const margem = totalReceita > 0 ? Math.round((totalLucro / totalReceita) * 100) : 0;

  const printReport = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Relatórios Financeiros</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão consolidada do desempenho financeiro</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="h-9 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={printReport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Receita total', value: fmtBRL(totalReceita), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Despesas totais', value: fmtBRL(totalDespesa), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Lucro líquido', value: fmtBRL(totalLucro), icon: DollarSign, color: totalLucro >= 0 ? 'text-foreground' : 'text-red-500', bg: 'bg-muted' },
          { label: 'Margem', value: `${margem}%`, icon: BarChart2, color: margem >= 0 ? 'text-primary' : 'text-red-500', bg: 'bg-primary/5' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-border rounded-2xl p-5">
            <div className={`w-9 h-9 ${k.bg} rounded-xl flex items-center justify-center mb-3`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <p className="text-xs text-muted-foreground font-medium mb-1">{k.label}</p>
            <p className={`text-xl font-bold tabular-nums ${k.color}`}>{loading ? '…' : k.value}</p>
          </div>
        ))}
      </div>

      {/* Event Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de eventos', value: String(eventStats.total), icon: Calendar },
          { label: 'Confirmados', value: String(eventStats.confirmed), icon: Calendar },
          { label: 'Valor médio por evento', value: fmtBRL(eventStats.avgValue), icon: DollarSign },
          { label: 'Total de convidados', value: eventStats.totalGuests.toLocaleString('pt-BR'), icon: Users },
        ].map(k => (
          <div key={k.label} className="bg-white border border-border rounded-2xl px-5 py-4 flex items-center gap-3">
            <k.icon className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-lg font-bold tabular-nums text-foreground mt-0.5">{loading ? '…' : k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-[1fr_360px] gap-6">

        {/* Revenue chart */}
        <div className="bg-white border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Receita vs Despesas mensais — {year}</p>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyRevenue} margin={{ top: 0, right: 8, left: 8, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="despesa" name="Despesas" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expense breakdown pie */}
        <div className="bg-white border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Despesas por categoria</p>
          {loading || categoryBreakdown.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              {loading ? 'Carregando...' : 'Sem despesas registradas'}
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                    {categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {categoryBreakdown.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-muted-foreground capitalize">{c.name}</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-foreground">{fmtBRL(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Resultado mensal detalhado — {year}</p>
        </div>
        <div className="px-5 py-3 bg-muted/30 border-b border-border grid grid-cols-[60px_1fr_1fr_1fr_100px] gap-3">
          {['Mês','Receita','Despesas','Resultado','Margem'].map((h, i) => (
            <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i > 0 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <>
            <div className="divide-y divide-border/50">
              {monthlyRevenue.map((d, i) => {
                const lucro = d.receita - d.despesa;
                const marg = d.receita > 0 ? Math.round((lucro / d.receita) * 100) : null;
                return (
                  <div key={i} className={`px-5 py-3 grid grid-cols-[60px_1fr_1fr_1fr_100px] gap-3 items-center hover:bg-slate-50 transition-colors ${lucro < 0 && (d.receita > 0 || d.despesa > 0) ? 'bg-red-50/20' : ''}`}>
                    <span className="text-sm font-medium text-foreground">{d.label}</span>
                    <span className="text-sm tabular-nums text-right text-emerald-600">{d.receita > 0 ? fmtBRL(d.receita) : '—'}</span>
                    <span className="text-sm tabular-nums text-right text-red-500">{d.despesa > 0 ? fmtBRL(d.despesa) : '—'}</span>
                    <span className={`text-sm font-semibold tabular-nums text-right ${lucro < 0 ? 'text-red-500' : 'text-foreground'}`}>
                      {(d.receita > 0 || d.despesa > 0) ? fmtBRL(lucro) : '—'}
                    </span>
                    <span className={`text-sm tabular-nums text-right ${marg !== null && marg < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {marg !== null ? `${marg}%` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-border bg-muted/30 grid grid-cols-[60px_1fr_1fr_1fr_100px] gap-3">
              <span className="text-sm font-bold text-foreground">Total</span>
              <span className="text-sm font-bold tabular-nums text-right text-emerald-600">{fmtBRL(totalReceita)}</span>
              <span className="text-sm font-bold tabular-nums text-right text-red-500">{fmtBRL(totalDespesa)}</span>
              <span className={`text-sm font-bold tabular-nums text-right ${totalLucro < 0 ? 'text-red-500' : 'text-foreground'}`}>{fmtBRL(totalLucro)}</span>
              <span className={`text-sm font-bold tabular-nums text-right ${margem < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{margem}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
