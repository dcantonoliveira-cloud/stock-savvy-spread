import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, TrendingUp, Clock, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { toast } from 'sonner';

type Bill = {
  id: string;
  event_id: string;
  event_name: string;
  client_name: string | null;
  event_date: string | null;
  payment_date: string | null;
  value: number;
  payment_type: string | null;
  is_confirmed: boolean;
  notes: string | null;
};

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
const today = new Date().toISOString().slice(0, 10);

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  parcela: 'Parcela',
  saldo_final: 'Saldo Final',
  reembolso: 'Reembolso',
  outros: 'Outros',
};

export default function ContasReceberPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'aberto' | 'recebido' | 'vencido'>('aberto');
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('event_payments' as any)
      .select('id, event_id, payment_date, value, payment_type, is_confirmed, notes, events(event_name, event_date, clients(name))')
      .order('payment_date', { ascending: true });
    if (error) { toast.error('Erro ao carregar'); setLoading(false); return; }
    const mapped: Bill[] = ((data ?? []) as any[]).map(p => ({
      id: p.id,
      event_id: p.event_id,
      event_name: (p.events as any)?.event_name ?? '—',
      client_name: (p.events as any)?.clients?.name ?? null,
      event_date: (p.events as any)?.event_date ?? null,
      payment_date: p.payment_date,
      value: p.value,
      payment_type: p.payment_type,
      is_confirmed: p.is_confirmed,
      notes: p.notes,
    }));
    setBills(mapped);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const confirm = async (id: string) => {
    setConfirming(id);
    const { error } = await supabase
      .from('event_payments' as any)
      .update({ is_confirmed: true })
      .eq('id', id);
    if (error) { toast.error('Erro ao confirmar'); setConfirming(null); return; }
    setBills(prev => prev.map(b => b.id === id ? { ...b, is_confirmed: true } : b));
    toast.success('Pagamento confirmado');
    setConfirming(null);
  };

  const isOverdue = (b: Bill) => !b.is_confirmed && b.payment_date && b.payment_date < today;

  const filtered = bills
    .filter(b => {
      if (tab === 'recebido') return b.is_confirmed;
      if (tab === 'vencido') return isOverdue(b);
      return !b.is_confirmed && !isOverdue(b);
    })
    .filter(b =>
      !search ||
      b.event_name.toLowerCase().includes(search.toLowerCase()) ||
      (b.client_name ?? '').toLowerCase().includes(search.toLowerCase())
    );

  const totalAberto = bills.filter(b => !b.is_confirmed && !isOverdue(b)).reduce((s, b) => s + b.value, 0);
  const totalRecebido = bills.filter(b => b.is_confirmed).reduce((s, b) => s + b.value, 0);
  const totalVencido = bills.filter(b => isOverdue(b)).reduce((s, b) => s + b.value, 0);

  const TAB = [
    { key: 'aberto',    label: 'Em aberto',  count: bills.filter(b => !b.is_confirmed && !isOverdue(b)).length },
    { key: 'vencido',   label: 'Vencidas',   count: bills.filter(b => isOverdue(b)).length },
    { key: 'recebido',  label: 'Recebidas',  count: bills.filter(b => b.is_confirmed).length },
  ] as const;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Contas a Receber</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Parcelas e saldos dos eventos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">A receber</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-amber-600">{fmtBRL(totalAberto)}</p>
          <p className="text-xs text-muted-foreground mt-1">{bills.filter(b => !b.is_confirmed && !isOverdue(b)).length} parcelas</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Vencidas</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-red-500">{fmtBRL(totalVencido)}</p>
          <p className="text-xs text-muted-foreground mt-1">{bills.filter(b => isOverdue(b)).length} parcelas</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Recebido</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">{fmtBRL(totalRecebido)}</p>
          <p className="text-xs text-muted-foreground mt-1">{bills.filter(b => b.is_confirmed).length} parcelas</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">

        {/* Tabs + search */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4">
          <div className="flex gap-1">
            {TAB.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>
                {t.label}
                {t.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${tab === t.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar evento ou cliente..."
              className="pl-8 pr-3 h-8 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 w-56"
            />
          </div>
        </div>

        {/* Header row */}
        <div className="px-5 py-3 bg-muted/30 border-b border-border grid grid-cols-[120px_1fr_140px_100px_130px_100px] gap-3">
          {['Vencimento','Evento / Cliente','Tipo','Valor','',''].map((h, i) => (
            <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i >= 3 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Nenhum registro.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(b => {
              const overdue = isOverdue(b);
              return (
                <div key={b.id} className={`px-5 py-3 grid grid-cols-[120px_1fr_140px_100px_130px_100px] gap-3 items-center hover:bg-slate-50 transition-colors group ${overdue ? 'bg-red-50/30' : ''}`}>

                  {/* Data */}
                  <div>
                    <span className={`text-sm tabular-nums font-medium ${overdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {b.payment_date ? fmtDate(b.payment_date) : '—'}
                    </span>
                    {overdue && <p className="text-[10px] text-red-500 font-semibold">Vencida</p>}
                  </div>

                  {/* Evento */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{b.event_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {b.client_name && <span className="text-xs text-muted-foreground truncate">{b.client_name}</span>}
                      <button onClick={() => navigate(`/events/${b.event_id}`)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-primary hover:underline transition-opacity">
                        <ExternalLink className="w-3 h-3" />ver
                      </button>
                    </div>
                  </div>

                  {/* Tipo */}
                  <span className="text-xs text-muted-foreground">{PAYMENT_TYPE_LABEL[b.payment_type ?? ''] ?? b.payment_type ?? '—'}</span>

                  {/* Valor */}
                  <span className="text-sm font-semibold tabular-nums text-right text-emerald-600">+{fmtBRL(b.value)}</span>

                  {/* Status / ação */}
                  <div className="text-right">
                    {b.is_confirmed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />Recebido
                      </span>
                    ) : (
                      <button
                        onClick={() => confirm(b.id)}
                        disabled={confirming === b.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50">
                        {confirming === b.id ? 'Confirmando…' : 'Confirmar recebimento'}
                      </button>
                    )}
                  </div>

                  {/* Notas */}
                  <span className="text-xs text-muted-foreground truncate text-right">{b.notes ?? ''}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
