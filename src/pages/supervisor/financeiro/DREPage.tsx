import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Info } from 'lucide-react';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number, base: number) => base > 0 ? `${((v / base) * 100).toFixed(1)}%` : '—';

type CatBreakdown = Record<string, number>;

type PeriodData = {
  receita_eventos: number;
  outras_receitas: number;
  receita_total: number;
  despesas_por_cat: CatBreakdown;
  despesas_manuais: number;
  despesas_total: number;
  resultado: number;
};

const CAT_LABELS: Record<string, string> = {
  pessoal: 'Pessoal', fornecedor: 'Fornecedores', aluguel: 'Aluguel',
  marketing: 'Marketing', operacional: 'Operacional', administrativo: 'Administrativo',
  imposto: 'Impostos', outros: 'Outros',
};

function emptyPeriod(): PeriodData {
  return { receita_eventos: 0, outras_receitas: 0, receita_total: 0,
    despesas_por_cat: {}, despesas_manuais: 0, despesas_total: 0, resultado: 0 };
}

export default function DREPage() {
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');
  const [month, setMonth]     = useState(now.getMonth());
  const [basis, setBasis]     = useState<'competencia' | 'caixa'>('competencia');
  const [annualData, setAnnualData]   = useState<PeriodData[]>(Array.from({length:12}, emptyPeriod));
  const [loading, setLoading] = useState(true);
  const [showBasisInfo, setShowBasisInfo] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const first = `${year}-01-01`;
      const last  = `${year}-12-31`;

      const [eventsRes, paymentsRes, cashRes, billsRes] = await Promise.all([
        // competência: valor total do evento no mês da festa
        supabase.from('events')
          .select('event_date, total_value')
          .gte('event_date', first).lte('event_date', last)
          .in('status', ['confirmed', 'completed']),
        // caixa: pagamentos confirmados pelo mês em que entraram
        supabase.from('event_payments' as any)
          .select('payment_date, value')
          .gte('payment_date', first).lte('payment_date', last)
          .eq('is_confirmed', true),
        // lançamentos manuais
        supabase.from('cash_flow_entries' as any)
          .select('date, amount, category')
          .gte('date', first).lte('date', last),
        // contas pagas (bills_payable)
        supabase.from('bills_payable' as any)
          .select('paid_date, amount, category')
          .eq('status', 'paid')
          .gte('paid_date', first).lte('paid_date', last),
      ]);

      const monthly: PeriodData[] = Array.from({length:12}, emptyPeriod);

      // Receita por mês
      if (basis === 'competencia') {
        ((eventsRes.data ?? []) as any[]).forEach((e: any) => {
          const m = parseInt(e.event_date?.slice(5, 7)) - 1;
          if (m >= 0 && m < 12) monthly[m].receita_eventos += e.total_value ?? 0;
        });
      } else {
        ((paymentsRes.data ?? []) as any[]).forEach((p: any) => {
          const m = parseInt(p.payment_date?.slice(5, 7)) - 1;
          if (m >= 0 && m < 12) monthly[m].receita_eventos += p.value ?? 0;
        });
      }

      // Outras receitas e despesas manuais (cash_flow_entries)
      ((cashRes.data ?? []) as any[]).forEach((e: any) => {
        const m = parseInt(e.date?.slice(5, 7)) - 1;
        if (m < 0 || m >= 12) return;
        if (e.amount > 0) monthly[m].outras_receitas += e.amount;
        else monthly[m].despesas_manuais += Math.abs(e.amount);
      });

      // Despesas por categoria (bills_payable pagas)
      ((billsRes.data ?? []) as any[]).forEach((b: any) => {
        const m = parseInt(b.paid_date?.slice(5, 7)) - 1;
        if (m < 0 || m >= 12) return;
        const cat = b.category ?? 'outros';
        monthly[m].despesas_por_cat[cat] = (monthly[m].despesas_por_cat[cat] ?? 0) + (b.amount ?? 0);
      });

      // Totais por mês
      monthly.forEach(d => {
        d.receita_total  = d.receita_eventos + d.outras_receitas;
        d.despesas_total = Object.values(d.despesas_por_cat).reduce((s, v) => s + v, 0) + d.despesas_manuais;
        d.resultado      = d.receita_total - d.despesas_total;
      });

      setAnnualData(monthly);
      setLoading(false);
    };
    load();
  }, [year, basis]);

  // Soma do período exibido
  const displayData: PeriodData = viewMode === 'annual'
    ? annualData.reduce((acc, d) => ({
        receita_eventos:  acc.receita_eventos  + d.receita_eventos,
        outras_receitas:  acc.outras_receitas  + d.outras_receitas,
        receita_total:    acc.receita_total    + d.receita_total,
        despesas_manuais: acc.despesas_manuais + d.despesas_manuais,
        despesas_total:   acc.despesas_total   + d.despesas_total,
        resultado:        acc.resultado        + d.resultado,
        despesas_por_cat: Object.entries(d.despesas_por_cat).reduce((a, [k, v]) => {
          a[k] = (a[k] ?? 0) + v; return a;
        }, { ...acc.despesas_por_cat }),
      }), emptyPeriod())
    : annualData[month] ?? emptyPeriod();

  const margem = displayData.receita_total > 0
    ? (displayData.resultado / displayData.receita_total * 100).toFixed(1)
    : '—';

  const allCats = Object.keys(displayData.despesas_por_cat).sort();

  type DreRow = { label: string; value: number | null; bold?: boolean; indent?: number; separator?: boolean; color?: string; pct?: boolean; pctBase?: number };

  const dreRows: DreRow[] = [
    { label: 'RECEITA BRUTA', value: displayData.receita_total, bold: true, color: 'text-emerald-600', indent: 0 },
    { label: basis === 'competencia' ? 'Valor contratado dos eventos' : 'Pagamentos recebidos', value: displayData.receita_eventos, indent: 1 },
    ...(displayData.outras_receitas > 0 ? [{ label: 'Outras receitas', value: displayData.outras_receitas, indent: 1 } as DreRow] : []),

    { label: '(-) DESPESAS OPERACIONAIS', value: -displayData.despesas_total, bold: true, color: 'text-red-500', indent: 0, separator: true },
    ...allCats.map(cat => ({
      label: CAT_LABELS[cat] ?? cat, value: -(displayData.despesas_por_cat[cat] ?? 0), indent: 1,
    } as DreRow)),
    ...(displayData.despesas_manuais > 0 ? [{ label: 'Lançamentos manuais', value: -displayData.despesas_manuais, indent: 1 } as DreRow] : []),

    { label: 'RESULTADO OPERACIONAL (EBITDA)', value: displayData.resultado, bold: true, separator: true, indent: 0,
      color: displayData.resultado >= 0 ? 'text-foreground' : 'text-red-500' },
    { label: 'Margem operacional', value: displayData.receita_total > 0 ? displayData.resultado / displayData.receita_total * 100 : null,
      indent: 1, pct: true, color: displayData.resultado >= 0 ? 'text-emerald-600' : 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">DRE — Demonstrativo de Resultado</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Resultado financeiro do exercício</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">

          {/* Base de cálculo com info */}
          <div className="relative flex items-center gap-2">
            <div className="flex gap-1 bg-muted p-1 rounded-xl">
              {(['competencia','caixa'] as const).map(b => (
                <button key={b} onClick={() => setBasis(b)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${basis === b ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                  {b === 'competencia' ? 'Competência' : 'Caixa'}
                </button>
              ))}
            </div>
            <button onMouseEnter={() => setShowBasisInfo(true)} onMouseLeave={() => setShowBasisInfo(false)}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              <Info className="w-4 h-4" />
            </button>
            {showBasisInfo && (
              <div className="absolute top-10 right-0 z-20 w-72 bg-foreground text-background text-xs rounded-xl p-3 leading-relaxed shadow-xl">
                <p className="font-semibold mb-1">Regime de Competência (padrão)</p>
                <p className="opacity-80 mb-2">A receita é reconhecida no mês em que o evento acontece, independente de quando o pagamento entrou. Mais preciso para análise do negócio.</p>
                <p className="font-semibold mb-1">Regime de Caixa</p>
                <p className="opacity-80">A receita é reconhecida quando o dinheiro efetivamente entra na conta (data do pagamento confirmado). Mais próximo do extrato bancário.</p>
              </div>
            )}
          </div>

          {/* Anual / Mensal */}
          <div className="flex gap-1 bg-muted p-1 rounded-xl">
            {(['annual','monthly'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === m ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {m === 'annual' ? 'Anual' : 'Mensal'}
              </button>
            ))}
          </div>

          {/* Ano */}
          <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-0.5">
            <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-semibold min-w-[52px] text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {viewMode === 'monthly' && (
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="h-9 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20">
              {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
        {[
          { label: 'Receita', value: displayData.receita_total, icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Despesas', value: displayData.despesas_total, icon: TrendingDown, color: 'text-red-500' },
          { label: 'Resultado', value: displayData.resultado, color: displayData.resultado >= 0 ? 'text-foreground' : 'text-red-500' },
          { label: 'Margem', value: null, display: `${margem}${typeof margem === 'string' && margem !== '—' ? '%' : ''}`,
            color: displayData.resultado >= 0 ? 'text-foreground' : 'text-red-500' },
        ].map((k, i) => (
          <div key={i} className="bg-white px-6 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">{k.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${k.color}`}>
              {loading ? '…' : (k.display ?? fmtBRL(k.value!))}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">

        {/* Tabela mensal */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Resultado por mês — {year}</p>
          </div>
          <div className="px-5 py-2.5 bg-muted/30 border-b border-border grid grid-cols-[56px_1fr_1fr_1fr_80px] gap-3">
            {['Mês','Receita','Despesas','Resultado','Margem'].map((h, i) => (
              <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i > 0 ? 'text-right' : ''}`}>{h}</span>
            ))}
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <>
              <div className="divide-y divide-border/50">
                {annualData.map((d, i) => {
                  const isCurrentMonth = viewMode === 'monthly' && month === i;
                  return (
                    <button key={i} onClick={() => { setViewMode('monthly'); setMonth(i); }}
                      className={`w-full px-5 py-2.5 grid grid-cols-[56px_1fr_1fr_1fr_80px] gap-3 items-center hover:bg-slate-50 transition-colors text-left ${isCurrentMonth ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''} ${d.resultado < 0 && (d.receita_total > 0 || d.despesas_total > 0) ? 'bg-red-50/20' : ''}`}>
                      <span className={`text-sm font-medium ${isCurrentMonth ? 'text-primary font-bold' : 'text-foreground'}`}>{MONTHS[i]}</span>
                      <span className="text-sm tabular-nums text-right text-emerald-600">{d.receita_total > 0 ? fmtBRL(d.receita_total) : '—'}</span>
                      <span className="text-sm tabular-nums text-right text-red-500">{d.despesas_total > 0 ? fmtBRL(d.despesas_total) : '—'}</span>
                      <span className={`text-sm font-semibold tabular-nums text-right ${d.resultado < 0 ? 'text-red-500' : 'text-foreground'}`}>
                        {(d.receita_total > 0 || d.despesas_total > 0) ? fmtBRL(d.resultado) : '—'}
                      </span>
                      <span className={`text-sm tabular-nums text-right ${d.resultado < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {d.receita_total > 0 ? `${(d.resultado / d.receita_total * 100).toFixed(0)}%` : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Total */}
              <div className="px-5 py-3 border-t border-border bg-muted/30 grid grid-cols-[56px_1fr_1fr_1fr_80px] gap-3">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="text-sm font-bold tabular-nums text-right text-emerald-600">{fmtBRL(displayData.receita_total)}</span>
                <span className="text-sm font-bold tabular-nums text-right text-red-500">{fmtBRL(displayData.despesas_total)}</span>
                <span className={`text-sm font-bold tabular-nums text-right ${displayData.resultado < 0 ? 'text-red-500' : 'text-foreground'}`}>{fmtBRL(displayData.resultado)}</span>
                <span className={`text-sm font-bold tabular-nums text-right ${displayData.resultado < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{margem}{margem !== '—' ? '%' : ''}</span>
              </div>
            </>
          )}
        </div>

        {/* DRE Estruturado */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground">
              DRE — {viewMode === 'annual' ? `Ano ${year}` : `${MONTHS_FULL[month]} ${year}`}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Regime de {basis === 'competencia' ? 'Competência' : 'Caixa'}</p>
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <div className="divide-y divide-border/40">
              {dreRows.map((row, i) => (
                <div key={i}>
                  {row.separator && <div className="h-px bg-foreground/10 mx-4 my-0" />}
                  <div
                    className={`flex items-center justify-between py-2.5 ${row.bold ? 'bg-muted/20' : ''}`}
                    style={{ paddingLeft: `${1.25 + (row.indent ?? 0) * 0.875}rem`, paddingRight: '1.25rem' }}
                  >
                    <span className={`text-sm ${row.bold ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                      {row.label}
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${row.color ?? 'text-foreground'}`}>
                      {row.value === null ? '—'
                        : row.pct ? `${(row.value as number).toFixed(1)}%`
                        : fmtBRL(row.value as number)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
