import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Check, X, ChevronDown, ChevronRight, Info, HelpCircle } from 'lucide-react';

// ── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ title, tooltip }: { title: string; tooltip: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{title}</span>
      <div className="flex-1 h-px bg-border" />
      <div className="relative">
        <button
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
        {show && (
          <div className="absolute right-0 top-5 z-30 w-64 p-3 bg-foreground text-background text-xs rounded-xl shadow-lg leading-relaxed">
            {tooltip}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface EventFinanceiro {
  guest_count: number | null;
  children_50_pct: number | null;
  price_per_person: number | null;
  professional_count: number | null;
  professional_meal_value: number | null;
  pricing_mode: string | null;
  contract_value: number | null;
}

interface AdditionalValue {
  id: string;
  description: string;
  value: number;
  sort_order: number;
}

interface Payment {
  id: string;
  payment_date: string | null;
  value: number;
  type: string;
  is_confirmed: boolean;
  notes: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PAYMENT_TYPES: Record<string, { label: string; color: string }> = {
  payment:   { label: 'Pagamento',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  tasting:   { label: 'Degustação', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  deposit:   { label: 'Entrada',    color: 'bg-blue-50 text-blue-700 border-blue-200' },
  other:     { label: 'Outro',      color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const inputCls =
  'h-9 px-3 text-sm bg-background border border-border rounded-lg ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

// ── Main ───────────────────────────────────────────────────────────────────────

export default function EventFinanceiroTab({
  eventId,
  event,
  onUpdateEvent,
}: {
  eventId: string;
  event: EventFinanceiro;
  onUpdateEvent: (field: string, value: any) => void;
}) {
  const [additionals, setAdditionals] = useState<AdditionalValue[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showScheduled, setShowScheduled] = useState(false);

  // New row state
  const [newDesc, setNewDesc] = useState('');
  const [newAddVal, setNewAddVal] = useState('');
  const [newPayDate, setNewPayDate] = useState('');
  const [newPayVal, setNewPayVal] = useState('');
  const [newPayType, setNewPayType] = useState('payment');
  const [newPayNotes, setNewPayNotes] = useState('');
  const [newSchedDate, setNewSchedDate] = useState('');
  const [newSchedVal, setNewSchedVal] = useState('');
  const [newSchedNotes, setNewSchedNotes] = useState('');

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      const [addRes, payRes] = await Promise.all([
        supabase.from('event_additional_values' as any)
          .select('id, description, value, sort_order')
          .eq('event_id', eventId)
          .order('sort_order'),
        supabase.from('event_payments' as any)
          .select('id, payment_date, value, type, is_confirmed, notes')
          .eq('event_id', eventId)
          .order('payment_date', { ascending: true }),
      ]);
      setAdditionals(addRes.data ?? []);
      setPayments(payRes.data ?? []);
      setLoadingData(false);
    })();
  }, [eventId]);

  // ── Calculations ─────────────────────────────────────────────────────────────

  const pricingMode = event.pricing_mode ?? 'per_person';

  const baseValue = pricingMode === 'fixed'
    ? (event.contract_value ?? 0)
    : (
        ((event.guest_count ?? 0) * (event.price_per_person ?? 0)) +
        ((event.children_50_pct ?? 0) * (event.price_per_person ?? 0) * 0.5) +
        ((event.professional_count ?? 0) * (event.professional_meal_value ?? 0))
      );

  const addTotal = additionals.reduce((s, a) => s + Number(a.value), 0);
  const totalValue = baseValue + addTotal;

  const confirmed = payments.filter(p => p.is_confirmed);
  const scheduled = payments.filter(p => !p.is_confirmed);
  const paidTotal = confirmed.reduce((s, p) => s + Number(p.value), 0);
  const balance = totalValue - paidTotal;
  const pctPaid = totalValue > 0 ? Math.min((paidTotal / totalValue) * 100, 100) : 0;

  // ── Handlers — additionals ───────────────────────────────────────────────────

  const addAdditional = async () => {
    if (!newDesc.trim() || !newAddVal) return;
    const maxOrder = additionals.length > 0 ? Math.max(...additionals.map(a => a.sort_order)) + 10 : 10;
    const { data, error } = await supabase.from('event_additional_values' as any)
      .insert({ event_id: eventId, description: newDesc.trim(), value: Number(newAddVal), sort_order: maxOrder })
      .select('id, description, value, sort_order').single();
    if (error) { toast.error(error.message); return; }
    setAdditionals(prev => [...prev, data as AdditionalValue]);
    setNewDesc(''); setNewAddVal('');
  };

  const updateAdditional = (id: string, field: string, value: any) => {
    setAdditionals(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    const key = 'add_' + id + field;
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      await supabase.from('event_additional_values' as any).update({ [field]: value }).eq('id', id);
    }, 800);
  };

  const deleteAdditional = async (id: string) => {
    setAdditionals(prev => prev.filter(a => a.id !== id));
    await supabase.from('event_additional_values' as any).delete().eq('id', id);
  };

  // ── Handlers — payments ──────────────────────────────────────────────────────

  const addPayment = async (isScheduled = false) => {
    const date = isScheduled ? newSchedDate : newPayDate;
    const val = isScheduled ? newSchedVal : newPayVal;
    const notes = isScheduled ? newSchedNotes : newPayNotes;
    if (!val) return;
    const { data, error } = await supabase.from('event_payments' as any)
      .insert({
        event_id: eventId,
        payment_date: date || null,
        value: Number(val),
        type: isScheduled ? 'payment' : newPayType,
        is_confirmed: !isScheduled,
        notes: notes || null,
      })
      .select('id, payment_date, value, type, is_confirmed, notes').single();
    if (error) { toast.error(error.message); return; }
    setPayments(prev => [...prev, data as Payment].sort((a, b) =>
      (a.payment_date ?? '').localeCompare(b.payment_date ?? '')));
    if (isScheduled) { setNewSchedDate(''); setNewSchedVal(''); setNewSchedNotes(''); }
    else { setNewPayDate(''); setNewPayVal(''); setNewPayNotes(''); setNewPayType('payment'); }
  };

  const confirmPayment = async (p: Payment) => {
    setPayments(prev => prev.map(x => x.id === p.id ? { ...x, is_confirmed: true } : x));
    await supabase.from('event_payments' as any).update({ is_confirmed: true }).eq('id', p.id);
    toast.success('Recebimento confirmado');
  };

  const deletePayment = async (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    await supabase.from('event_payments' as any).delete().eq('id', id);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loadingData) return <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">

      {/* Banner informativo */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
        <div>
          <p className="font-semibold mb-0.5">Como funciona o Financeiro</p>
          <p className="text-blue-700/80">
            Há dois modos de cobrança: <strong>por convidado</strong> (preço/pax × quantidade) ou <strong>valor fixo</strong> (pacote negociado diretamente).
            O modo é configurado na Ficha Técnica e afeta o cálculo aqui. Em ambos os casos, valores adicionais são somados por cima
            e os pagamentos registrados abaixo determinam o saldo e o percentual pago exibido na lista de eventos.
          </p>
        </div>
      </div>

      {/* ── Modo de cobrança (leitura — configurado na Ficha Técnica) ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border border-border rounded-xl text-sm">
        <span className="text-muted-foreground/60 text-xs font-semibold uppercase tracking-wide">Modo de cobrança:</span>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
          pricingMode === 'per_person'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-purple-50 text-purple-700 border-purple-200'
        }`}>
          {pricingMode === 'per_person' ? 'Por convidado' : 'Valor fixo'}
        </span>
        <span className="text-xs text-muted-foreground">
          {pricingMode === 'per_person'
            ? `${event.guest_count ?? 0} conv × ${fmtBRL(event.price_per_person ?? 0)}`
            : `Pacote: ${fmtBRL(event.contract_value ?? 0)}`}
        </span>
        <span className="text-xs text-muted-foreground/50 ml-auto">Altere na aba Ficha Técnica</span>
      </div>

      {/* ── Resumo financeiro ── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <SectionHeader
          title="Resumo Financeiro"
          tooltip="Totalizadores calculados em tempo real. O saldo é o que ainda falta receber. O % pago é o mesmo indicador exibido na lista de eventos."
        />

        <div className="grid grid-cols-4 gap-4 mb-5">
          <div className="p-4 rounded-xl bg-muted/40 border border-border">
            <p className="text-[11px] uppercase font-semibold text-muted-foreground/70 mb-1">Valor Final</p>
            <p className="text-xl font-bold">{fmtBRL(totalValue)}</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-[11px] uppercase font-semibold text-emerald-600/70 mb-1">Valor Pago</p>
            <p className="text-xl font-bold text-emerald-700">{fmtBRL(paidTotal)}</p>
          </div>
          <div className={`p-4 rounded-xl border ${balance > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
            <p className={`text-[11px] uppercase font-semibold mb-1 ${balance > 0 ? 'text-amber-600/70' : 'text-emerald-600/70'}`}>Saldo</p>
            <p className={`text-xl font-bold ${balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{fmtBRL(balance)}</p>
          </div>
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex flex-col justify-between">
            <p className="text-[11px] uppercase font-semibold text-blue-600/70 mb-1">% Pago</p>
            <p className="text-xl font-bold text-blue-700">{pctPaid.toFixed(0)}%</p>
            <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pctPaid}%` }} />
            </div>
          </div>
        </div>

        {/* Breakdown do valor */}
        <div className="border border-border rounded-xl overflow-hidden text-sm">
          <div className="grid grid-cols-2 bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground/60">
            <span>Composição do valor final</span>
            <span className="text-right">Valor</span>
          </div>
          {pricingMode === 'per_person' ? (
            <>
              {(event.guest_count ?? 0) > 0 && (
                <div className="grid grid-cols-2 px-4 py-2.5 border-t border-border/50">
                  <span className="text-muted-foreground">{event.guest_count} convidados × {fmtBRL(event.price_per_person ?? 0)}</span>
                  <span className="text-right font-medium">{fmtBRL((event.guest_count ?? 0) * (event.price_per_person ?? 0))}</span>
                </div>
              )}
              {(event.children_50_pct ?? 0) > 0 && (
                <div className="grid grid-cols-2 px-4 py-2.5 border-t border-border/50">
                  <span className="text-muted-foreground">{event.children_50_pct} crianças (50% do pax)</span>
                  <span className="text-right font-medium">{fmtBRL((event.children_50_pct ?? 0) * (event.price_per_person ?? 0) * 0.5)}</span>
                </div>
              )}
              {(event.professional_count ?? 0) > 0 && (
                <div className="grid grid-cols-2 px-4 py-2.5 border-t border-border/50">
                  <span className="text-muted-foreground">{event.professional_count} profissionais × {fmtBRL(event.professional_meal_value ?? 0)}</span>
                  <span className="text-right font-medium">{fmtBRL((event.professional_count ?? 0) * (event.professional_meal_value ?? 0))}</span>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 px-4 py-2.5 border-t border-border/50">
              <span className="text-muted-foreground">Valor do contrato (pacote fixo)</span>
              <span className="text-right font-medium">{fmtBRL(event.contract_value ?? 0)}</span>
            </div>
          )}
          {additionals.map(a => (
            <div key={a.id} className="grid grid-cols-2 px-4 py-2.5 border-t border-border/50">
              <span className="text-muted-foreground">{a.description}</span>
              <span className="text-right font-medium">{fmtBRL(Number(a.value))}</span>
            </div>
          ))}
          <div className="grid grid-cols-2 px-4 py-2.5 border-t border-border bg-muted/20 font-semibold">
            <span>Total</span>
            <span className="text-right">{fmtBRL(totalValue)}</span>
          </div>
        </div>
      </div>

      {/* ── Valores Adicionais ── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <SectionHeader
          title="Valores Adicionais"
          tooltip="Itens cobrados além do contrato base: frete, aluguel de equipamentos, upgrades, taxa de deslocamento, etc. Cada item é somado ao valor final automaticamente."
        />
        <p className="text-xs text-muted-foreground mb-4">Adicione valores além do contrato base, como frete, upgrades, entre outros.</p>

        {additionals.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden mb-3">
            <div className="grid grid-cols-[1fr_200px_40px] bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground/60 gap-3">
              <span>Descrição</span><span>Valor</span><span />
            </div>
            {additionals.map(a => (
              <div key={a.id} className="group grid grid-cols-[1fr_200px_40px] px-4 py-2.5 border-t border-border/50 gap-3 items-center hover:bg-muted/20">
                <span className="text-sm">{a.description}</span>
                <span className="text-sm font-medium">{fmtBRL(Number(a.value))}</span>
                <button onClick={() => deleteAdditional(a.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* New row */}
        <div className="flex gap-2 items-center">
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addAdditional(); }}
            placeholder="Descrição do valor adicional..." className={inputCls + ' flex-1'} />
          <div className="relative w-36">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
            <input type="number" value={newAddVal} onChange={e => setNewAddVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addAdditional(); }}
              placeholder="0,00" className={inputCls + ' w-full pl-8'} />
          </div>
          <button onClick={addAdditional}
            className="h-9 px-3 flex items-center gap-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 whitespace-nowrap transition-colors">
            <Plus className="w-3.5 h-3.5" />Adicionar
          </button>
        </div>
      </div>

      {/* ── Pagamentos ── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <SectionHeader
          title="Pagamentos"
          tooltip="Registre cada pagamento recebido. O tipo ajuda a identificar a origem (entrada, degustação, parcela). Esses valores são somados no 'Valor Pago' do resumo."
        />
        <p className="text-xs text-muted-foreground mb-4">Registre os pagamentos já recebidos com data e valor.</p>

        {confirmed.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden mb-3">
            <div className="grid grid-cols-[160px_1fr_160px_130px_40px] bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground/60 gap-3">
              <span>Data</span><span>Observação</span><span>Valor</span><span>Tipo</span><span />
            </div>
            {confirmed.map(p => (
              <div key={p.id} className="group grid grid-cols-[160px_1fr_160px_130px_40px] px-4 py-2.5 border-t border-border/50 gap-3 items-center hover:bg-muted/20">
                <span className="text-sm">{fmtDate(p.payment_date)}</span>
                <span className="text-sm text-muted-foreground truncate">{p.notes ?? '—'}</span>
                <span className="text-sm font-medium">{fmtBRL(Number(p.value))}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border w-fit ${PAYMENT_TYPES[p.type]?.color ?? PAYMENT_TYPES.other.color}`}>
                  {PAYMENT_TYPES[p.type]?.label ?? p.type}
                </span>
                <button onClick={() => deletePayment(p.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* New payment */}
        <div className="flex gap-2 items-center flex-wrap">
          <input type="date" value={newPayDate} onChange={e => setNewPayDate(e.target.value)}
            className={inputCls + ' w-44'} />
          <input value={newPayNotes} onChange={e => setNewPayNotes(e.target.value)}
            placeholder="Observação..." className={inputCls + ' flex-1 min-w-[140px]'} />
          <input type="number" value={newPayVal} onChange={e => setNewPayVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addPayment(); }}
            placeholder="Valor (R$)" className={inputCls + ' w-36'} />
          <select value={newPayType} onChange={e => setNewPayType(e.target.value)}
            className={inputCls + ' w-36'}>
            {Object.entries(PAYMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={() => addPayment()}
            className="h-9 px-3 flex items-center gap-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 whitespace-nowrap transition-colors">
            <Plus className="w-3.5 h-3.5" />Adicionar
          </button>
        </div>
      </div>

      {/* ── Agendamento de recebíveis ── */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowScheduled(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
        >
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Agendamento de recebíveis</p>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/40" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cadastre pagamentos agendados. Enquanto estiverem agendados, não contam como recebidos.
              Clique em <strong>Confirmar recebimento</strong> quando o valor entrar.
            </p>
          </div>
          {showScheduled ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-4" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-4" />}
        </button>

        {showScheduled && (
          <div className="px-6 pb-6 border-t border-border">
            {scheduled.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum recebível agendado.</p>
            )}
            {scheduled.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden mt-4 mb-4">
                <div className="grid grid-cols-[160px_1fr_160px_150px_40px] bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground/60 gap-3">
                  <span>Data Prevista</span><span>Observação</span><span>Valor</span><span /><span />
                </div>
                {scheduled.map(p => (
                  <div key={p.id} className="group grid grid-cols-[160px_1fr_160px_150px_40px] px-4 py-2.5 border-t border-border/50 gap-3 items-center hover:bg-muted/20">
                    <span className="text-sm">{fmtDate(p.payment_date)}</span>
                    <span className="text-sm text-muted-foreground truncate">{p.notes ?? '—'}</span>
                    <span className="text-sm font-medium">{fmtBRL(Number(p.value))}</span>
                    <button onClick={() => confirmPayment(p)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                      <Check className="w-3 h-3" />Confirmar recebimento
                    </button>
                    <button onClick={() => deletePayment(p.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 items-center flex-wrap mt-3">
              <input type="date" value={newSchedDate} onChange={e => setNewSchedDate(e.target.value)}
                className={inputCls + ' w-44'} />
              <input value={newSchedNotes} onChange={e => setNewSchedNotes(e.target.value)}
                placeholder="Observação..." className={inputCls + ' flex-1 min-w-[140px]'} />
              <input type="number" value={newSchedVal} onChange={e => setNewSchedVal(e.target.value)}
                placeholder="Valor (R$)" className={inputCls + ' w-36'} />
              <button onClick={() => addPayment(true)}
                className="h-9 px-3 flex items-center gap-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 whitespace-nowrap transition-colors">
                <Plus className="w-3.5 h-3.5" />Agendar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
