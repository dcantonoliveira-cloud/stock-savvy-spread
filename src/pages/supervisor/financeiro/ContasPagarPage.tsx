import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, TrendingDown, Clock, CheckCircle2, AlertTriangle, Search, RefreshCw, Trash2, ChevronDown } from 'lucide-react';
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
          onCreated={newBills => { setBills(prev => [...prev, ...newBills]); setShowModal(false); }}
        />
      )}
    </div>
  );
}

// ---------- Combobox genérico ----------
function Combobox({
  value, onChange, options, placeholder, allowCreate = false, createLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  allowCreate?: boolean;
  createLabel?: string;
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState(value);
  const ref                   = useRef<HTMLDivElement>(null);

  // sync when parent resets
  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  const showCreate = allowCreate && query.trim() && !options.some(o => o.toLowerCase() === query.toLowerCase());

  const select = (v: string) => { onChange(v); setQuery(v); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          className="w-full h-9 px-3 pr-8 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={query}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
      </div>
      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-xl shadow-lg overflow-hidden max-h-44 overflow-y-auto">
          {filtered.map(o => (
            <button key={o} onMouseDown={() => select(o)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
              {o}
            </button>
          ))}
          {showCreate && (
            <button onMouseDown={() => select(query.trim())}
              className="w-full text-left px-3 py-2 text-sm text-primary font-medium hover:bg-primary/5 border-t border-border transition-colors">
              {createLabel ?? 'Criar'} &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Modal em lote ----------
type BillRow = {
  id: string;
  desc: string;
  supplier: string;
  category: string;
  amount: string;
  dueDate: string;
  recurring: boolean;
  recurrence: string;
};

const newRow = (): BillRow => ({
  id: crypto.randomUUID(),
  desc: '', supplier: '', category: 'outros', amount: '',
  dueDate: new Date().toISOString().slice(0, 10),
  recurring: false, recurrence: 'monthly',
});

function NewBillModal({ onClose, onCreated }: { onClose: () => void; onCreated: (bills: Bill[]) => void }) {
  const [rows,           setRows]         = useState<BillRow[]>([newRow()]);
  const [saving,         setSaving]       = useState(false);
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);
  const [customCats,     setCustomCats]   = useState<string[]>([]);

  // Carrega fornecedores já usados
  useEffect(() => {
    supabase.from('bills_payable' as any).select('supplier').then(({ data }) => {
      const names = [...new Set(((data ?? []) as any[]).map((r: any) => r.supplier).filter(Boolean))] as string[];
      setKnownSuppliers(names);
    });
  }, []);

  const allCategories = [
    ...CATEGORIES.map(c => c.label),
    ...customCats,
  ];

  const updateRow = (id: string, patch: Partial<BillRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const addRow = () => setRows(prev => [...prev, newRow()]);

  const removeRow = (id: string) => setRows(prev => prev.length === 1 ? prev : prev.filter(r => r.id !== id));

  const save = async () => {
    const valid = rows.filter(r => r.desc.trim() && r.amount && parseFloat(r.amount.replace(',', '.')) > 0 && r.dueDate);
    if (valid.length === 0) { toast.error('Preencha ao menos uma linha completa'); return; }

    setSaving(true);
    const payload = valid.map(r => {
      // Resolve categoria: pode ser label ou value
      const catMatch = CATEGORIES.find(c => c.label === r.category || c.value === r.category);
      return {
        description: r.desc.trim(),
        supplier: r.supplier.trim() || null,
        category: catMatch ? catMatch.value : r.category.toLowerCase().replace(/\s+/g, '_'),
        amount: parseFloat(r.amount.replace(',', '.')),
        due_date: r.dueDate,
        recurring: r.recurring,
        recurrence: r.recurring ? r.recurrence : null,
        notes: null,
      };
    });

    const { data, error } = await supabase
      .from('bills_payable' as any)
      .insert(payload)
      .select('*');

    if (error) { toast.error('Erro ao salvar'); setSaving(false); return; }
    toast.success(`${(data as any[]).length} conta${(data as any[]).length !== 1 ? 's' : ''} adicionada${(data as any[]).length !== 1 ? 's' : ''}`);
    onCreated(data as Bill[]);
  };

  const totalValid = rows.filter(r => r.desc.trim() && parseFloat(r.amount.replace(',', '.')) > 0).length;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">Lançamento em lote</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Adicione várias contas de uma vez. Linhas incompletas são ignoradas.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Column headers */}
        <div className="px-5 py-2 bg-muted/30 border-b border-border grid grid-cols-[1fr_140px_130px_100px_110px_36px] gap-2 shrink-0">
          {['Descrição *','Fornecedor','Categoria','Valor *','Vencimento *',''].map((h, i) => (
            <span key={i} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="overflow-y-auto flex-1 divide-y divide-border/50">
          {rows.map((row, idx) => {
            const hasError = row.desc.trim() && (!row.amount || parseFloat(row.amount.replace(',', '.')) <= 0);
            return (
              <div key={row.id} className={`px-5 py-2.5 grid grid-cols-[1fr_140px_130px_100px_110px_36px] gap-2 items-center ${hasError ? 'bg-red-50/30' : ''}`}>
                {/* Descrição */}
                <input
                  className="h-9 w-full px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={row.desc}
                  onChange={e => updateRow(row.id, { desc: e.target.value })}
                  placeholder={`Conta ${idx + 1}`}
                  autoFocus={idx === rows.length - 1 && idx > 0}
                />

                {/* Fornecedor combobox */}
                <Combobox
                  value={row.supplier}
                  onChange={v => updateRow(row.id, { supplier: v })}
                  options={knownSuppliers}
                  placeholder="Fornecedor"
                  allowCreate
                  createLabel="Usar"
                />

                {/* Categoria combobox */}
                <Combobox
                  value={(() => {
                    const cat = CATEGORIES.find(c => c.value === row.category);
                    return cat ? cat.label : row.category;
                  })()}
                  onChange={v => {
                    const cat = CATEGORIES.find(c => c.label === v);
                    if (cat) { updateRow(row.id, { category: cat.value }); }
                    else {
                      updateRow(row.id, { category: v });
                      if (!customCats.includes(v) && !CATEGORIES.find(c => c.label === v)) {
                        setCustomCats(prev => [...new Set([...prev, v])]);
                      }
                    }
                  }}
                  options={allCategories}
                  placeholder="Categoria"
                  allowCreate
                  createLabel="Criar"
                />

                {/* Valor */}
                <input
                  type="number"
                  className="h-9 w-full px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={row.amount}
                  onChange={e => updateRow(row.id, { amount: e.target.value })}
                  placeholder="0,00"
                  min="0"
                  step="0.01"
                />

                {/* Vencimento */}
                <input
                  type="date"
                  className="h-9 w-full px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={row.dueDate}
                  onChange={e => updateRow(row.id, { dueDate: e.target.value })}
                />

                {/* Remove */}
                <button onClick={() => removeRow(row.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground/40 hover:text-red-500 transition-colors disabled:opacity-20"
                  disabled={rows.length === 1}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-4 shrink-0">
          <button onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
            <Plus className="w-4 h-4" /> Adicionar linha
          </button>
          <div className="flex items-center gap-3">
            {totalValid > 0 && (
              <span className="text-xs text-muted-foreground">
                {totalValid} conta{totalValid !== 1 ? 's' : ''} pronta{totalValid !== 1 ? 's' : ''}
              </span>
            )}
            <button onClick={save} disabled={saving || totalValid === 0}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : `Salvar${totalValid > 1 ? ` ${totalValid} contas` : ' conta'}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
