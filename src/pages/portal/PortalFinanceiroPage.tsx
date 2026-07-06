import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Clock } from 'lucide-react';
import type { PortalContextType } from './ClientPortalLayout';

type Payment = { id: string; value: number; payment_date: string; is_confirmed: boolean; notes: string | null; type: string };

const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

export default function PortalFinanceiroPage() {
  const { event } = useOutletContext<PortalContextType>();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!event) return;
    (supabase.from as any)('event_payments')
      .select('id, value, payment_date, is_confirmed, notes, type')
      .eq('event_id', event.id)
      .order('payment_date')
      .then(({ data }: any) => { setPayments(data ?? []); setLoading(false); });
  }, [event]);

  if (!event) return null;

  const total      = event.total_value ?? 0;
  const confirmed  = payments.filter(p => p.is_confirmed);
  const scheduled  = payments.filter(p => !p.is_confirmed);
  const paid       = confirmed.reduce((s, p) => s + p.value, 0);
  const outstanding = total - paid;
  const pct         = total > 0 ? Math.round((paid / total) * 100) : 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-black text-foreground">Financeiro</h1>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Valor total',    value: fmtBRL(total),       color: 'text-foreground' },
          { label: 'Pago',           value: fmtBRL(paid),        color: 'text-emerald-600' },
          { label: 'Saldo restante', value: fmtBRL(outstanding), color: outstanding > 0 ? 'text-amber-600' : 'text-emerald-600' },
        ].map((k, i) => (
          <div key={i} className="bg-white border border-border rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">{k.label}</p>
            <p className={`text-lg font-bold tabular-nums ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de progresso */}
      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Progresso de pagamento</p>
          <p className="text-sm font-bold text-emerald-600">{pct}%</p>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Pagamentos confirmados */}
          {confirmed.length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Pagamentos realizados
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {confirmed.map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{fmtDate(p.payment_date)}</p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                    </div>
                    <span className="text-sm font-bold tabular-nums text-emerald-600">+{fmtBRL(p.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parcelas agendadas */}
          {scheduled.length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" /> Parcelas agendadas
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {scheduled.map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{fmtDate(p.payment_date)}</p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                    </div>
                    <span className="text-sm font-bold tabular-nums text-amber-600">{fmtBRL(p.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payments.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhum pagamento registrado ainda.
            </div>
          )}
        </>
      )}
    </div>
  );
}
