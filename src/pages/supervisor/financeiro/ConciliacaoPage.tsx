import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronLeft, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

type Item = {
  id: string;
  real_id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  reconciled: boolean;
  _source: 'cash_flow' | 'event_payment';
};

export default function ConciliacaoPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const last = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    const [{ data: cashData }, { data: payData }] = await Promise.all([
      supabase.from('cash_flow_entries' as any)
        .select('id, date, description, amount, category, reconciled')
        .gte('date', first).lte('date', last)
        .order('date', { ascending: false }),
      supabase.from('event_payments' as any)
        .select('id, payment_date, value, payment_type, reconciled, events(event_name)')
        .gte('payment_date', first).lte('payment_date', last)
        .eq('is_confirmed', true)
        .order('payment_date', { ascending: false }),
    ]);

    const cash: Item[] = ((cashData ?? []) as any[]).map(e => ({
      id: `cf_${e.id}`, real_id: e.id,
      date: e.date, description: e.description, amount: e.amount,
      category: e.category, reconciled: e.reconciled ?? false, _source: 'cash_flow',
    }));

    const pays: Item[] = ((payData ?? []) as any[]).map(p => ({
      id: `ep_${p.id}`, real_id: p.id,
      date: p.payment_date,
      description: `Pgto — ${(p.events as any)?.event_name ?? 'Evento'}`,
      amount: p.value, category: p.payment_type ?? 'event_payment',
      reconciled: p.reconciled ?? false, _source: 'event_payment',
    }));

    const all = [...cash, ...pays].sort((a, b) => b.date.localeCompare(a.date));
    setItems(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [year, month]);

  const toggle = async (item: Item) => {
    setSaving(item.id);
    const newVal = !item.reconciled;
    const table = item._source === 'event_payment' ? 'event_payments' : 'cash_flow_entries';
    const { error } = await supabase.from(table as any).update({ reconciled: newVal }).eq('id', item.real_id);
    if (error) { toast.error('Erro'); setSaving(null); return; }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, reconciled: newVal } : i));
    setSaving(null);
  };

  const markAll = async () => {
    const pending = filtered.filter(i => !i.reconciled);
    if (pending.length === 0) return;
    for (const item of pending) {
      const table = item._source === 'event_payment' ? 'event_payments' : 'cash_flow_entries';
      await supabase.from(table as any).update({ reconciled: true }).eq('id', item.real_id);
    }
    setItems(prev => prev.map(i => filtered.find(f => f.id === i.id) ? { ...i, reconciled: true } : i));
    toast.success(`${pending.length} item(s) conciliado(s)`);
  };

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const filtered = items.filter(i => {
    if (filter === 'pending') return !i.reconciled;
    if (filter === 'done') return i.reconciled;
    return true;
  });

  const totalReconciled = items.filter(i => i.reconciled).length;
  const totalPending = items.filter(i => !i.reconciled).length;
  const pct = items.length > 0 ? Math.round((totalReconciled / items.length) * 100) : 0;

  const FILTER_TABS = [
    { key: 'pending', label: 'Pendentes', count: totalPending },
    { key: 'done',    label: 'Conciliados', count: totalReconciled },
    { key: 'all',     label: 'Todos', count: items.length },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Conciliação Bancária</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Confira os lançamentos com o extrato do banco</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold min-w-[130px] text-center">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="p-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Progress */}
      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Progresso de conciliação</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totalReconciled} de {items.length} lançamentos conferidos</p>
          </div>
          <span className="text-2xl font-bold text-foreground tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-muted-foreground">{totalReconciled} conciliados</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-muted-foreground">{totalPending} pendentes</span>
          </div>
          {totalPending > 0 && (
            <button onClick={markAll}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
              <Check className="w-3.5 h-3.5" /> Conciliar todos
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          {FILTER_TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === t.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${filter === t.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>{t.count}</span>
            </button>
          ))}
        </div>

        <div className="px-5 py-3 bg-muted/30 border-b border-border grid grid-cols-[100px_1fr_120px_110px_40px] gap-3">
          {['Data','Descrição','Categoria','Valor',''].map((h, i) => (
            <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i === 3 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {filter === 'pending' ? 'Nenhum lançamento pendente. Mês totalmente conciliado! ✓' : 'Nenhum item.'}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(item => (
              <div key={item.id} className={`px-5 py-3 grid grid-cols-[100px_1fr_120px_110px_40px] gap-3 items-center hover:bg-slate-50 transition-colors group ${item.reconciled ? 'opacity-50' : ''}`}>
                <span className="text-sm tabular-nums text-muted-foreground">{fmtDate(item.date)}</span>
                <div className="min-w-0">
                  <p className={`text-sm truncate ${item.reconciled ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>{item.description}</p>
                  {item._source === 'event_payment' && (
                    <span className="text-[10px] text-emerald-600 font-semibold">Evento</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate">{item.category}</span>
                <span className={`text-sm font-semibold tabular-nums text-right ${item.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {item.amount >= 0 ? '+' : ''}{fmtBRL(item.amount)}
                </span>
                <button
                  onClick={() => toggle(item)}
                  disabled={saving === item.id}
                  title={item.reconciled ? 'Desmarcar' : 'Marcar como conciliado'}
                  className={`p-1.5 rounded-lg transition-all ${item.reconciled ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'opacity-0 group-hover:opacity-100 hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600'}`}>
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
