import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, CreditCard, Pencil, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

type Card = {
  id: string; name: string; bank_name: string | null; last_four: string | null;
  limit_amount: number | null; due_day: number | null; closing_day: number | null;
  color: string; active: boolean;
};

type Expense = {
  id: string; credit_card_id: string; description: string; amount: number;
  date: string; category: string; installments: number; installment_current: number; paid: boolean;
};

const EXPENSE_CATS = ['alimentação','combustível','marketing','fornecedor','serviços','equipamento','outros'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const COLORS = ['#8b5cf6','#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316','#64748b'];

export default function CartoesPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editCard, setEditCard] = useState<Card | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: cardsData }, { data: expData }] = await Promise.all([
      supabase.from('credit_cards' as any).select('*').eq('active', true).order('name'),
      supabase.from('credit_card_expenses' as any).select('*').order('date', { ascending: false }),
    ]);
    const c = (cardsData ?? []) as Card[];
    setCards(c);
    if (c.length > 0 && !selectedCard) setSelectedCard(c[0].id);
    setExpenses((expData ?? []) as Expense[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const card = cards.find(c => c.id === selectedCard);
  const cardExpenses = expenses.filter(e => e.credit_card_id === selectedCard);
  const totalUsed = cardExpenses.filter(e => !e.paid).reduce((s, e) => s + e.amount, 0);
  const limitPct = card?.limit_amount ? Math.min(100, Math.round((totalUsed / card.limit_amount) * 100)) : null;

  const togglePaid = async (id: string, paid: boolean) => {
    await supabase.from('credit_card_expenses' as any).update({ paid: !paid }).eq('id', id);
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, paid: !paid } : e));
  };

  const deleteExpense = async (id: string) => {
    await supabase.from('credit_card_expenses' as any).delete().eq('id', id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast.success('Despesa removida');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cartões</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão de cartões de crédito</p>
        </div>
        <button onClick={() => { setEditCard(null); setShowCardModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo cartão
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : cards.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Nenhum cartão cadastrado</p>
          <p className="text-xs text-muted-foreground mb-4">Adicione seus cartões de crédito corporativos</p>
          <button onClick={() => { setEditCard(null); setShowCardModal(true); }}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
            Adicionar cartão
          </button>
        </div>
      ) : (
        <div className="flex gap-6 items-start">

          {/* Cards list */}
          <div className="w-72 shrink-0 space-y-3">
            {cards.map(c => {
              const used = expenses.filter(e => e.credit_card_id === c.id && !e.paid).reduce((s, e) => s + e.amount, 0);
              const pct = c.limit_amount ? Math.min(100, Math.round((used / c.limit_amount) * 100)) : null;
              return (
                <button key={c.id} onClick={() => setSelectedCard(c.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${selectedCard === c.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-white border-border hover:bg-muted/20'}`}>

                  {/* Card visual */}
                  <div className="rounded-xl p-4 text-white mb-3 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${c.color ?? '#8b5cf6'}, ${c.color ?? '#8b5cf6'}99)` }}>
                    <CreditCard className="w-5 h-5 opacity-70 mb-3" />
                    <p className="text-sm font-bold tracking-widest">{c.last_four ? `•••• •••• •••• ${c.last_four}` : '•••• •••• •••• ••••'}</p>
                    <p className="text-xs opacity-70 mt-1">{c.name}</p>
                    {c.due_day && <p className="absolute top-3 right-3 text-[10px] opacity-60">Vence dia {c.due_day}</p>}
                  </div>

                  {c.limit_amount && (
                    <>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Limite usado</span>
                        <span className="font-semibold text-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: (pct ?? 0) > 80 ? '#ef4444' : c.color ?? '#8b5cf6' }} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{fmtBRL(used)} usados</span>
                        <span className="text-muted-foreground">{fmtBRL(c.limit_amount - used)} disponível</span>
                      </div>
                    </>
                  )}

                  <button onClick={e => { e.stopPropagation(); setEditCard(c); setShowCardModal(true); }}
                    className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                </button>
              );
            })}
          </div>

          {/* Expenses */}
          <div className="flex-1 min-w-0 space-y-4">
            {card && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{card.name} — Despesas</p>
                <button onClick={() => setShowExpenseModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-border bg-white hover:bg-muted transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Adicionar despesa
                </button>
              </div>
            )}

            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-muted/30 border-b border-border grid grid-cols-[100px_1fr_110px_110px_36px] gap-3">
                {['Data','Descrição','Categoria','Valor',''].map((h, i) => (
                  <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i === 3 ? 'text-right' : ''}`}>{h}</span>
                ))}
              </div>
              {cardExpenses.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma despesa neste cartão.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {cardExpenses.map(e => (
                    <div key={e.id} className={`px-5 py-3 grid grid-cols-[100px_1fr_110px_110px_36px] gap-3 items-center hover:bg-slate-50 transition-colors group ${e.paid ? 'opacity-50' : ''}`}>
                      <span className="text-sm tabular-nums text-muted-foreground">{fmtDate(e.date)}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm truncate ${e.paid ? 'line-through text-muted-foreground' : 'font-medium text-foreground'}`}>{e.description}</p>
                          {e.installments > 1 && (
                            <span className="text-[10px] text-muted-foreground shrink-0">{e.installment_current}/{e.installments}x</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{e.category}</span>
                      <div className="text-right">
                        <button onClick={() => togglePaid(e.id, e.paid)}
                          className={`text-sm font-semibold tabular-nums ${e.paid ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {fmtBRL(e.amount)}
                        </button>
                        {e.paid && <p className="text-[10px] text-emerald-600 font-semibold">Pago</p>}
                      </div>
                      <button onClick={() => deleteExpense(e.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCardModal && (
        <CardModal card={editCard} onClose={() => setShowCardModal(false)} onSaved={() => { setShowCardModal(false); load(); }} />
      )}
      {showExpenseModal && selectedCard && (
        <ExpenseModal cardId={selectedCard} onClose={() => setShowExpenseModal(false)}
          onCreated={e => { setExpenses(prev => [e, ...prev]); setShowExpenseModal(false); }} />
      )}
    </div>
  );
}

function CardModal({ card, onClose, onSaved }: { card: Card | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(card?.name ?? '');
  const [bank, setBank] = useState(card?.bank_name ?? '');
  const [lastFour, setLastFour] = useState(card?.last_four ?? '');
  const [limit, setLimit] = useState(card ? String(card.limit_amount ?? '') : '');
  const [dueDay, setDueDay] = useState(card ? String(card.due_day ?? '') : '');
  const [closingDay, setClosingDay] = useState(card ? String(card.closing_day ?? '') : '');
  const [color, setColor] = useState(card?.color ?? '#8b5cf6');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name) { toast.error('Nome obrigatório'); return; }
    setSaving(true);
    const payload = {
      name, bank_name: bank || null, last_four: lastFour || null,
      limit_amount: limit ? parseFloat(limit) : null,
      due_day: dueDay ? parseInt(dueDay) : null,
      closing_day: closingDay ? parseInt(closingDay) : null,
      color,
    };
    let error;
    if (card) {
      ({ error } = await supabase.from('credit_cards' as any).update(payload).eq('id', card.id));
    } else {
      ({ error } = await supabase.from('credit_cards' as any).insert(payload));
    }
    if (error) { toast.error('Erro'); setSaving(false); return; }
    toast.success(card ? 'Cartão atualizado' : 'Cartão adicionado');
    onSaved();
  };

  const inputCls = 'w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">{card ? 'Editar cartão' : 'Novo cartão'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Nome *</label>
              <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Bradesco Visa" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Banco</label>
              <input className={inputCls} value={bank} onChange={e => setBank(e.target.value)} placeholder="Bradesco" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">4 últimos dígitos</label>
              <input className={inputCls} value={lastFour} onChange={e => setLastFour(e.target.value.slice(0,4))} maxLength={4} placeholder="1234" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Dia vencimento</label>
              <input type="number" className={inputCls} value={dueDay} onChange={e => setDueDay(e.target.value)} min="1" max="31" placeholder="10" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Dia fechamento</label>
              <input type="number" className={inputCls} value={closingDay} onChange={e => setClosingDay(e.target.value)} min="1" max="31" placeholder="3" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Limite (R$)</label>
            <input type="number" className={inputCls} value={limit} onChange={e => setLimit(e.target.value)} min="0" step="0.01" placeholder="5.000,00" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Cor</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {saving ? 'Salvando...' : card ? 'Salvar' : 'Adicionar cartão'}
          </button>
        </div>
      </div>
    </div>, document.body
  );
}

function ExpenseModal({ cardId, onClose, onCreated }: { cardId: string; onClose: () => void; onCreated: (e: Expense) => void }) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cat, setCat] = useState('outros');
  const [installments, setInstallments] = useState('1');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!desc || !amount) { toast.error('Preencha os campos'); return; }
    const num = parseFloat(amount.replace(',', '.'));
    const inst = parseInt(installments) || 1;
    if (isNaN(num)) { toast.error('Valor inválido'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('credit_card_expenses' as any)
      .insert({ credit_card_id: cardId, description: desc, amount: num, date, category: cat, installments: inst, installment_current: 1 })
      .select('*').single();
    if (error) { toast.error('Erro'); setSaving(false); return; }
    toast.success('Despesa adicionada');
    onCreated(data as Expense);
  };

  const inputCls = 'w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Nova despesa no cartão</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Descrição *</label>
            <input className={inputCls} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Material de limpeza" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Valor (R$) *</label>
              <input type="number" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} step="0.01" placeholder="0,00" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Parcelas</label>
              <input type="number" className={inputCls} value={installments} onChange={e => setInstallments(e.target.value)} min="1" max="48" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Data</label>
              <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Categoria</label>
              <select className={inputCls} value={cat} onChange={e => setCat(e.target.value)}>
                {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>, document.body
  );
}
