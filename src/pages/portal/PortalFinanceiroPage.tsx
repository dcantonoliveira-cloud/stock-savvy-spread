import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Clock, Receipt } from 'lucide-react';
import type { PortalContextType } from './ClientPortalLayout';

type Payment    = { id: string; value: number; payment_date: string; is_confirmed: boolean; notes: string | null; type: string };
type Additional = { id: string; description: string; value: number };

const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

export default function PortalFinanceiroPage() {
  const { event } = useOutletContext<PortalContextType>();
  const [payments,    setPayments]    = useState<Payment[]>([]);
  const [additionals, setAdditionals] = useState<Additional[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!event) return;
    Promise.all([
      (supabase.from as any)('event_payments')
        .select('id, value, payment_date, is_confirmed, notes, type')
        .eq('event_id', event.id)
        .order('payment_date'),
      (supabase.from as any)('event_additional_values')
        .select('id, description, value')
        .eq('event_id', event.id),
    ]).then(([{ data: p }, { data: a }]) => {
      setPayments(p ?? []);
      setAdditionals(a ?? []);
      setLoading(false);
    });
  }, [event]);

  if (!event) return null;

  const baseValue   = event.total_value ?? 0;
  const addTotal    = additionals.reduce((s, a) => s + a.value, 0);
  const total       = baseValue + addTotal;
  const confirmed   = payments.filter(p => p.is_confirmed);
  const scheduled   = payments.filter(p => !p.is_confirmed);
  const paid        = confirmed.reduce((s, p) => s + p.value, 0);
  const outstanding = total - paid;
  const pct         = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
      <h1 className="text-2xl font-black text-foreground">Financeiro</h1>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Valor total</p>
          <p className="text-base font-bold tabular-nums text-foreground">{fmtBRL(total)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/70 mb-1">Pago</p>
          <p className="text-base font-bold tabular-nums text-emerald-700">{fmtBRL(paid)}</p>
        </div>
        <div className={`border rounded-2xl p-4 ${outstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${outstanding > 0 ? 'text-red-400' : 'text-emerald-600/70'}`}>Saldo</p>
          <p className={`text-base font-bold tabular-nums ${outstanding > 0 ? 'text-red-500' : 'text-emerald-700'}`}>{fmtBRL(outstanding)}</p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Progresso de pagamento</p>
          <p className="text-sm font-bold text-emerald-600">{pct}%</p>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Extrato — composição do valor */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Composição do valor</p>
            </div>
            <div className="divide-y divide-border/50">
              {/* Base */}
              {event.guest_count && event.price_per_person ? (
                <div className="px-5 py-3 flex items-center justify-between">
                  <p className="text-sm text-foreground">{event.guest_count} convidados × {fmtBRL(event.price_per_person)}</p>
                  <p className="text-sm font-semibold tabular-nums">{fmtBRL(baseValue)}</p>
                </div>
              ) : (
                <div className="px-5 py-3 flex items-center justify-between">
                  <p className="text-sm text-foreground">Valor base</p>
                  <p className="text-sm font-semibold tabular-nums">{fmtBRL(baseValue)}</p>
                </div>
              )}
              {/* Adicionais */}
              {additionals.map(a => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                  <p className="text-sm text-foreground">{a.description}</p>
                  <p className="text-sm font-semibold tabular-nums text-amber-600">+{fmtBRL(a.value)}</p>
                </div>
              ))}
              {/* Total */}
              <div className="px-5 py-3.5 flex items-center justify-between bg-muted/30">
                <p className="text-sm font-bold text-foreground">Total</p>
                <p className="text-sm font-bold tabular-nums">{fmtBRL(total)}</p>
              </div>
            </div>
          </div>

          {/* Pagamentos confirmados */}
          {confirmed.length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="text-sm font-semibold text-foreground">Pagamentos realizados</p>
              </div>
              <div className="divide-y divide-border/50">
                {confirmed.map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{fmtDate(p.payment_date)}</p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.notes}</p>}
                    </div>
                    <span className="text-sm font-bold tabular-nums text-emerald-600 shrink-0">+{fmtBRL(p.value)}</span>
                  </div>
                ))}
                <div className="px-5 py-3 flex items-center justify-between bg-emerald-50/50">
                  <p className="text-xs font-bold text-emerald-700">Total pago</p>
                  <p className="text-sm font-bold tabular-nums text-emerald-700">{fmtBRL(paid)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Parcelas agendadas */}
          {scheduled.length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-semibold text-foreground">Parcelas agendadas</p>
              </div>
              <div className="divide-y divide-border/50">
                {scheduled.map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{fmtDate(p.payment_date)}</p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.notes}</p>}
                    </div>
                    <span className="text-sm font-bold tabular-nums text-amber-600 shrink-0">{fmtBRL(p.value)}</span>
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
