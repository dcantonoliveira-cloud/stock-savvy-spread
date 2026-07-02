import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  TrendingUp, TrendingDown, Wallet, Building2, Clock, AlertTriangle, ExternalLink,
  ArrowDownCircle, ArrowUpCircle, ArrowRight, ChevronRight, Eye, EyeOff,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
  PieChart, Pie, Cell,
} from 'recharts';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtK = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);
const fmtDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const today = new Date().toISOString().slice(0, 10);
const todayDate = new Date();

export default function FinanceiroPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showValues, setShowValues] = useState(false);

  // KPIs
  const [receita, setReceita] = useState(0);
  const [despesa, setDespesa] = useState(0);
  const [saldoContas, setSaldoContas] = useState(0);
  const [totalAReceber, setTotalAReceber] = useState(0);
  const [totalAPagar, setTotalAPagar] = useState(0);

  // Charts
  const [chartData, setChartData] = useState<{ label: string; receita: number; despesa: number }[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<{ name: string; value: number }[]>([]);

  // Lists
  const [accounts, setAccounts] = useState<{ id: string; name: string; bank_name: string | null; balance: number; color: string }[]>([]);
  const [billsReceivable, setBillsReceivable] = useState<{ id: string; event_name: string; client_name: string | null; payment_date: string | null; value: number; event_id: string }[]>([]);
  const [billsPayable, setBillsPayable] = useState<{ id: string; description: string; supplier: string | null; due_date: string; amount: number; category: string }[]>([]);
  const [upcoming, setUpcoming] = useState<{ date: string; label: string; amount: number; type: 'in' | 'out' }[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date();
      const mm = (m: number) => String(m + 1).padStart(2, '0');
      const currentPrefix = `${now.getFullYear()}-${mm(now.getMonth())}`;
      const sixStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const sixStart = `${sixStartDate.getFullYear()}-${mm(sixStartDate.getMonth())}-01`;
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const next30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30).toISOString().slice(0, 10);

      const [
        { data: payments6 },
        { data: cash6 },
        { data: accs },
        { data: epFuture },
        { data: bills },
      ] = await Promise.all([
        supabase.from('event_payments' as any).select('payment_date, value').gte('payment_date', sixStart).lte('payment_date', last).eq('is_confirmed', true),
        supabase.from('cash_flow_entries' as any).select('date, amount, category').gte('date', sixStart).lte('date', last),
        supabase.from('bank_accounts' as any).select('id, name, bank_name, balance, color').eq('active', true).order('name'),
        supabase.from('event_payments' as any)
          .select('id, event_id, payment_date, value, events(event_name, clients(name))')
          .eq('is_confirmed', false).gte('payment_date', today).lte('payment_date', next30).order('payment_date'),
        supabase.from('bills_payable' as any)
          .select('id, description, supplier, due_date, amount, category')
          .neq('status', 'paid').lte('due_date', next30).order('due_date'),
      ]);

      const pays = (payments6 ?? []) as any[];
      const cash = (cash6 ?? []) as any[];

      // KPIs — só o mês atual (filtrado do range de 6 meses)
      const curPays = pays.filter((p: any) => (p.payment_date ?? '').slice(0, 7) === currentPrefix);
      const curCash = cash.filter((e: any) => (e.date ?? '').slice(0, 7) === currentPrefix);
      const receitaMes = curPays.reduce((s: number, p: any) => s + p.value, 0)
        + curCash.filter((e: any) => e.amount > 0).reduce((s: number, e: any) => s + e.amount, 0);
      const despesaMes = Math.abs(curCash.filter((e: any) => e.amount < 0).reduce((s: number, e: any) => s + e.amount, 0));
      setReceita(receitaMes);
      setDespesa(despesaMes);
      setSaldoContas(((accs ?? []) as any[]).reduce((s: number, a: any) => s + a.balance, 0));
      setTotalAReceber(((epFuture ?? []) as any[]).reduce((s: number, p: any) => s + p.value, 0));
      setTotalAPagar(((bills ?? []) as any[]).reduce((s: number, b: any) => s + b.amount, 0));

      // Gráfico dos últimos 6 meses — agrega receitas/despesas por mês
      const chart = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return { label: MONTHS[d.getMonth()], receita: 0, despesa: 0, prefix: `${d.getFullYear()}-${mm(d.getMonth())}` };
      });
      const idxByPrefix: Record<string, number> = {};
      chart.forEach((c, i) => { idxByPrefix[c.prefix] = i; });
      pays.forEach((p: any) => {
        const i = idxByPrefix[(p.payment_date ?? '').slice(0, 7)];
        if (i != null) chart[i].receita += p.value;
      });
      cash.forEach((e: any) => {
        const i = idxByPrefix[(e.date ?? '').slice(0, 7)];
        if (i == null) return;
        if (e.amount > 0) chart[i].receita += e.amount;
        else chart[i].despesa += Math.abs(e.amount);
      });
      setChartData(chart.map(({ prefix, ...rest }) => rest));

      // Despesas por categoria — mês atual
      const catMap: Record<string, number> = {};
      curCash.filter((e: any) => e.amount < 0).forEach((e: any) => {
        const cat = e.category ?? 'outros';
        catMap[cat] = (catMap[cat] ?? 0) + Math.abs(e.amount);
      });
      setExpensesByCategory(Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5));

      setAccounts((accs ?? []) as any[]);
      setBillsReceivable(((epFuture ?? []) as any[]).slice(0, 5).map((p: any) => ({
        id: p.id, event_name: (p.events as any)?.event_name ?? '—',
        client_name: (p.events as any)?.clients?.name ?? null,
        payment_date: p.payment_date, value: p.value, event_id: p.event_id,
      })));
      setBillsPayable(((bills ?? []) as any[]).slice(0, 5));

      // Upcoming combined
      const up: typeof upcoming = [
        ...((epFuture ?? []) as any[]).slice(0, 3).map((p: any) => ({
          date: p.payment_date ?? '', label: `Pgto — ${(p.events as any)?.event_name ?? 'Evento'}`,
          amount: p.value, type: 'in' as const,
        })),
        ...((bills ?? []) as any[]).slice(0, 3).map((b: any) => ({
          date: b.due_date, label: b.description, amount: b.amount, type: 'out' as const,
        })),
      ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
      setUpcoming(up);

      setLoading(false);
    };
    load();
  }, []);

  const resultado = receita - despesa;
  const blur = !showValues ? 'blur-sm select-none pointer-events-none' : '';

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão geral · {MONTHS[todayDate.getMonth()]} {todayDate.getFullYear()}
          </p>
        </div>
        <button
          onClick={() => setShowValues(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-muted-foreground hover:bg-muted/30 transition-colors text-xs font-medium"
          title={showValues ? 'Ocultar valores' : 'Mostrar valores'}
        >
          {showValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showValues ? 'Ocultar' : 'Mostrar valores'}
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-6 gap-px bg-border rounded-2xl overflow-hidden border border-border">
        {[
          { label: 'Receitas', value: receita, icon: TrendingUp, color: 'text-emerald-600', sub: 'Este mês' },
          { label: 'Despesas', value: despesa, icon: TrendingDown, color: 'text-red-500', sub: 'Este mês' },
          { label: 'Resultado', value: resultado, icon: Wallet, color: resultado >= 0 ? 'text-foreground' : 'text-red-500', sub: 'Este mês' },
          { label: 'Saldo em Conta', value: saldoContas, icon: Building2, color: 'text-foreground', sub: 'Contas ativas' },
          { label: 'A Receber', value: totalAReceber, icon: ArrowDownCircle, color: 'text-amber-600', sub: 'Próx. 30 dias', path: '/financeiro/contas-receber' },
          { label: 'A Pagar', value: totalAPagar, icon: ArrowUpCircle, color: 'text-red-500', sub: 'Próx. 30 dias', path: '/financeiro/contas-pagar' },
        ].map(k => (
          <button key={k.label} onClick={() => k.path && navigate(k.path)}
            className={`bg-white px-5 py-4 text-left transition-colors ${k.path ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default'}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <k.icon className={`w-3.5 h-3.5 ${k.color}`} />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{k.label}</p>
            </div>
            <p className={`text-xl font-bold tabular-nums ${k.color} ${loading ? 'opacity-30' : ''} ${blur} transition-all duration-200`}>{fmtBRL(k.value)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</p>
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-[1fr_300px_280px] gap-5">

        {/* Cash flow bar */}
        <div className="bg-white border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">Fluxo de Caixa — últimos 6 meses</p>
            <button onClick={() => navigate('/financeiro/fluxo')}
              className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ver detalhes <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 4, left: 0, bottom: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#e2e8f0" />
              <Bar dataKey="receita" name="Entradas" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="despesa" name="Saídas" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense pie */}
        <div className="bg-white border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Despesas por categoria</p>
          {expensesByCategory.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              {loading ? 'Carregando...' : 'Sem despesas este mês'}
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={expensesByCategory} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60}>
                    {expensesByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {expensesByCategory.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[11px] text-muted-foreground capitalize truncate">{c.name}</span>
                    </div>
                    <span className={`text-[11px] font-semibold tabular-nums ${blur} transition-all duration-200`}>{fmtBRL(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Contas Bancárias */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Contas Bancárias</p>
            <button onClick={() => navigate('/financeiro/extrato')}
              className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Gerenciar <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {accounts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground px-4">
              <Building2 className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
              Nenhuma conta cadastrada
              <br /><button onClick={() => navigate('/financeiro/extrato')} className="text-primary hover:underline text-xs mt-1">Adicionar conta</button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {accounts.map(a => (
                <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: a.color ?? '#6366f1' }}>
                    <Building2 className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                    {a.bank_name && <p className="text-xs text-muted-foreground">{a.bank_name}</p>}
                  </div>
                  <p className={`text-sm font-bold tabular-nums shrink-0 ${a.balance >= 0 ? 'text-emerald-600' : 'text-red-500'} ${blur} transition-all duration-200`}>{fmtBRL(a.balance)}</p>
                </div>
              ))}
              <div className="px-4 py-2.5 flex justify-between items-center bg-muted/30">
                <span className="text-xs font-semibold text-muted-foreground">Total disponível</span>
                <span className={`text-sm font-bold tabular-nums ${saldoContas >= 0 ? 'text-foreground' : 'text-red-500'} ${blur} transition-all duration-200`}>{fmtBRL(saldoContas)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom tables */}
      <div className="grid grid-cols-[1fr_1fr_360px] gap-5">

        {/* Contas a receber */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold text-foreground">Contas a Receber</p>
            </div>
            <button onClick={() => navigate('/financeiro/contas-receber')}
              className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Ver todas <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : billsReceivable.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum recebimento próximo</div>
          ) : (
            <div className="divide-y divide-border/50">
              {billsReceivable.map(b => (
                <div key={b.id} className="px-4 py-2.5 grid grid-cols-[80px_1fr_90px] gap-2 items-center hover:bg-slate-50 transition-colors group">
                  <span className="text-xs tabular-nums text-muted-foreground">{b.payment_date ? fmtDate(b.payment_date) : '—'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{b.event_name}</p>
                    {b.client_name && <p className="text-[11px] text-muted-foreground truncate">{b.client_name}</p>}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <span className={`text-xs font-semibold tabular-nums text-emerald-600 ${blur} transition-all duration-200`}>+{fmtBRL(b.value)}</span>
                    <button onClick={() => navigate(`/events/${b.event_id}`)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-primary transition-all">
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contas a pagar */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-red-500" />
              <p className="text-sm font-semibold text-foreground">Contas a Pagar</p>
            </div>
            <button onClick={() => navigate('/financeiro/contas-pagar')}
              className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Ver todas <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : billsPayable.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma conta próxima</div>
          ) : (
            <div className="divide-y divide-border/50">
              {billsPayable.map(b => {
                const overdue = b.due_date < today;
                return (
                  <div key={b.id} className={`px-4 py-2.5 grid grid-cols-[80px_1fr_90px] gap-2 items-center hover:bg-slate-50 transition-colors ${overdue ? 'bg-red-50/30' : ''}`}>
                    <div>
                      <span className={`text-xs tabular-nums ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>{fmtDate(b.due_date)}</span>
                      {overdue && <p className="text-[10px] text-red-500 font-semibold">Vencida</p>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{b.description}</p>
                      {b.supplier && <p className="text-[11px] text-muted-foreground truncate">{b.supplier}</p>}
                    </div>
                    <span className={`text-xs font-semibold tabular-nums text-right text-red-500 ${blur} transition-all duration-200`}>−{fmtBRL(b.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Próximos */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Próximos 30 dias</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Recebimentos e pagamentos</p>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : upcoming.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum item nos próximos 30 dias</div>
          ) : (
            <div className="divide-y divide-border/50">
              {upcoming.map((u, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {u.type === 'in' ? (
                      <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <ArrowUpCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{u.label}</p>
                      <p className="text-[11px] text-muted-foreground">{fmtDate(u.date)}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold tabular-nums shrink-0 ${u.type === 'in' ? 'text-emerald-600' : 'text-red-500'} ${blur} transition-all duration-200`}>
                    {u.type === 'in' ? '+' : '−'}{fmtBRL(u.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Fluxo de Caixa',   icon: Wallet,         path: '/financeiro/fluxo',          desc: 'Entradas e saídas' },
          { label: 'Conciliação',       icon: Clock,          path: '/financeiro/conciliacao',     desc: 'Conferir com banco' },
          { label: 'DRE',              icon: TrendingUp,     path: '/financeiro/dre',             desc: 'Resultado do exercício' },
          { label: 'Relatórios',        icon: TrendingDown,   path: '/financeiro/relatorios',      desc: 'Exportar dados' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3 hover:bg-muted/30 hover:border-primary/20 transition-all text-left group">
            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
              <item.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  );
}
