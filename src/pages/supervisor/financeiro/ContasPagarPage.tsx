import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, TrendingDown, Clock, CheckCircle2, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

type Bill = {
  id: string;
  description: string;
  supplier: string | null;
  category: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  recurring: boolean;
  recurrence: string | null;
  notes: string | null;
};

const CATEGORIES = [
  { value: 'pessoal',      label: 'Pessoal' },
  { value: 'fornecedor',   label: 'Fornecedor' },
  { value: 'aluguel',      label: 'Aluguel' },
  { value: 'marketing',    label: 'Marketing' },
  { value: 'operacional',  label: 'Operacional' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'imposto',      label: 'Impostos' },
  { value: 'outros',       label: 'Outros' },
];

const CAT_COLOR: Record<string, string> = {
  pessoal: 'bg-blue-100 text-blue-700 border-blue-200',
  fornecedor: 'bg-orange-100 text-orange-700 border-orange-200',
  aluguel: 'bg-violet-100 text-violet-700 border-violet-200',
  marketing: 'bg-pink-100 text-pink-700 border-pink-200',
  operacional: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  administrativo: 'bg-slate-100 text-slate-700 border-slate-200',
  imposto: 'bg-red-100 text-red-700 border-red-200',
  outros: 'bg-gray-100 text-gray-700 border-gray-200',
};

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const today = new Date().toISOString().slice(0, 10);

export default function ContasPagarPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'aberto' | 'pago' | 'vencido'>('aberto');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bills_payable' as any)
      .select('*')
      .order('due_date', { ascending: true });
    setBills((data ?? []) as Bill[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markPaid = async (id: string) => {
    setMarking(id);
    const { error } = await supabase.from('bills_payable' as any)
      .update({ status: 'paid', paid_date: today }).eq('id', id);
    if (error) { toast.error('Erro'); setMarking(null); return; }
    setBills(prev => prev.map(b => b.id === id ? { ...b, status: 'paid', paid_date: today } : b));
    toast.success('Conta marcada como paga');
    setMarking(null);
  };

  const deleteBill = async (id: string) => {
    await supabase.from('bills_payable' as any).delete().eq('id', id);
    setBills(prev => prev.filter(b => b.id !== id));
    toast.success('Removido');
  };

  const isOverdue = (b: Bill) => b.status !== 'paid' && b.due_date < today;

  const filtered = bills
    .filter(b => {
      if (tab === 'pago') return b.status === 'paid';
      if (tab === 'vencido') return isOverdue(b);
      return b.status !== 'paid' && !isOverdue(b);
    })
    .filter(b => !search || b.description.toLowerCase().includes(search.toLowerCase()) || (b.supplier ?? '').toLowerCase().includes(search.toLowerCase()));

  const totalAberto = bills.filter(b => b.status !== 'paid' && !isOverdue(b)).reduce((s, b) => s + b.amount, 0);
  const totalVencido = bills.filter(b => isOverdue(b)).reduce((s, b) => s + b.amount, 0);
  const totalPago = bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.amount, 0);

  const TAB = [
    { key: 'aberto',  label: 'Em aberto', count: bills.filter(b => b.status !== 'paid' && !isOverdue(b)).length },
    { key: 'vencido', label: 'Vencidas',  count: bills.filter(b => isOverdue(b)).length },
    { key: 'pago',    label: 'Pagas',     count: bills.filter(b => b.status === 'paid').length },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Despesas e obrigações financeiras</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Nova conta
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">A pagar</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-amber-600">{fmtBRL(totalAberto)}</p>
          <p className="text-xs text-muted-foreground mt-1">{bills.filter(b => b.status !== 'paid' && !isOverdue(b)).length} contas</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Vencidas</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-red-500">{fmtBRL(totalVencido)}</p>
          <p className="text-xs text-muted-foreground mt-1">{bills.filter(b => isOverdue(b)).length} contas</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-slate-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Pago (total)</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-slate-600">{fmtBRL(totalPago)}</p>
          <p className="text-xs text-muted-foreground mt-1">{bills.filter(b => b.status === 'paid').length} contas</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4">
          <div className="flex gap-1">
            {TAB.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>
                {t.label}
                {t.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${tab === t.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-3 h-8 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 w-52" />
          </div>
        </div>

        <div className="px-5 py-3 bg-muted/30 border-b border-border grid grid-cols-[120px_1fr_130px_110px_130px_36px] gap-3">
          {['Vencimento','Descrição / Fornecedor','Categoria','Valor','',''].map((h, i) => (
            <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i >= 3 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma conta {tab === 'aberto' ? 'em aberto' : tab === 'vencido' ? 'vencida' : 'paga'}.
            {tab === 'aberto' && (
              <><br /><button onClick={() => setShowModal(true)} className="text-primary hover:underline text-sm mt-1">Adicionar conta</button></>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(b => {
              const overdue = isOverdue(b);
              return (
                <div key={b.id} className={`px-5 py-3 grid grid-cols-[120px_1fr_130px_110px_130px_36px] gap-3 items-center hover:bg-slate-50 transition-colors group ${overdue ? 'bg-red-50/30' : ''}`}>
                  <div>
                    <span className={`text-sm tabular-nums font-medium ${overdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {fmtDate(b.due_date)}
                    </span>
                    {overdue && <p className="text-[10px] text-red-500 font-semibold">Vencida</p>}
                    {b.status === 'paid' && b.paid_date && <p className="text-[10px] text-emerald-600">Pago {fmtDate(b.paid_date)}</p>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{b.description}</p>
                      {b.recurring && <RefreshCw className="w-3 h-3 text-muted-foreground shrink-0" title="Recorrente" />}
                    </div>
                    {b.supplier && <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.supplier}</p>}
                  </div>
                  <div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CAT_COLOR[b.category] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {CATEGORIES.find(c => c.value === b.category)?.label ?? b.category}
                    </span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-right text-red-500">−{fmtBRL(b.amount)}</span>
                  <div className="text-right">
                    {b.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />Pago
                      </span>
                    ) : (
                      <button onClick={() => markPaid(b.id)} disabled={marking === b.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50">
                        {marking === b.id ? 'Salvando…' : 'Marcar como pago'}
                      </button>
                    )}
                  </div>
                  <button onClick={() => deleteBill(b.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <NewBillModal
          onClose={() => setShowModal(false)}
          onCreated={b => { setBills(prev => [...prev, b]); setShowModal(false); }}
        />
      )}
    </div>
  );
}

function NewBillModal({ onClose, onCreated }: { onClose: () => void; onCreated: (b: Bill) => void }) {
  const [desc,      setDesc]      = useState('');
  const [supplier,  setSupplier]  = useState('');
  const [category,  setCategory]  = useState('outros');
  const [amount,    setAmount]    = useState('');
  const [dueDate,   setDueDate]   = useState(new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState('monthly');
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);

  const save = async () => {
    if (!desc || !amount || !dueDate) { toast.error('Preencha os campos obrigatórios'); return; }
    const num = parseFloat(amount.replace(',', '.'));
    if (isNaN(num) || num <= 0) { toast.error('Valor inválido'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('bills_payable' as any)
      .insert({ description: desc, supplier: supplier || null, category, amount: num, due_date: dueDate, recurring, recurrence: recurring ? recurrence : null, notes: notes || null })
      .select('*').single();
    if (error) { toast.error('Erro ao salvar'); setSaving(false); return; }
    toast.success('Conta adicionada');
    onCreated(data as Bill);
  };

  const inputCls = 'w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Nova conta a pagar</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Descrição *</label>
            <input className={inputCls} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Aluguel Junho" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Fornecedor</label>
              <input className={inputCls} value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nome do fornecedor" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Vencimento *</label>
              <input type="date" className={inputCls} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Categoria</label>
              <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Valor (R$) *</label>
              <input type="number" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" placeholder="0,00" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm text-foreground">Conta recorrente</span>
            </label>
            {recurring && (
              <select className="h-9 px-3 text-sm border border-border rounded-xl focus:outline-none" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
                <option value="monthly">Mensal</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Observações</label>
            <textarea className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? 'Salvando...' : 'Adicionar conta'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
