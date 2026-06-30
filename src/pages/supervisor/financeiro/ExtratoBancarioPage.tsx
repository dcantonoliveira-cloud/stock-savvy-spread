import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, Building2, ChevronLeft, ChevronRight, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

type Account = {
  id: string; name: string; bank_name: string | null;
  account_type: string; balance: number; color: string; active: boolean;
};

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Conta Corrente' },
  { value: 'savings',  label: 'Poupança' },
  { value: 'cash',     label: 'Caixa' },
];

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

type Entry = { id: string; date: string; description: string; amount: number; category: string; _source: string };

export default function ExtratoBancarioPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const loadAccounts = async () => {
    setLoading(true);
    const { data } = await supabase.from('bank_accounts' as any).select('*').eq('active', true).order('name');
    const accs = (data ?? []) as Account[];
    setAccounts(accs);
    if (accs.length > 0 && !selected) setSelected(accs[0].id);
    setLoading(false);
  };

  useEffect(() => { loadAccounts(); }, []);

  useEffect(() => {
    if (!selected) return;
    const loadEntries = async () => {
      setLoadingEntries(true);
      const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const last = new Date(year, month + 1, 0).toISOString().slice(0, 10);

      const [{ data: cashData }, { data: payData }] = await Promise.all([
        supabase.from('cash_flow_entries' as any)
          .select('id, date, description, amount, category')
          .gte('date', first).lte('date', last)
          .order('date', { ascending: false }),
        supabase.from('event_payments' as any)
          .select('id, payment_date, value, payment_type, events(event_name)')
          .gte('payment_date', first).lte('payment_date', last)
          .eq('is_confirmed', true)
          .order('payment_date', { ascending: false }),
      ]);

      const cash: Entry[] = ((cashData ?? []) as any[]).map(e => ({ ...e, _source: 'manual' }));
      const pays: Entry[] = ((payData ?? []) as any[]).map(p => ({
        id: `ep_${p.id}`,
        date: p.payment_date,
        description: `Pgto — ${(p.events as any)?.event_name ?? 'Evento'}`,
        amount: p.value,
        category: p.payment_type ?? 'event_payment',
        _source: 'event',
      }));

      const all = [...cash, ...pays].sort((a, b) => b.date.localeCompare(a.date));
      setEntries(all);
      setLoadingEntries(false);
    };
    loadEntries();
  }, [selected, year, month]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const entradas = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const saidas   = entries.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  const acc = accounts.find(a => a.id === selected);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Extrato Bancário</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Movimentações por conta</p>
        </div>
        <button onClick={() => { setEditAccount(null); setShowAccountModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Nova conta
        </button>
      </div>

      {/* Accounts */}
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Nenhuma conta bancária</p>
          <p className="text-xs text-muted-foreground mb-4">Adicione suas contas para acompanhar o extrato</p>
          <button onClick={() => { setEditAccount(null); setShowAccountModal(true); }}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Adicionar conta
          </button>
        </div>
      ) : (
        <>
          {/* Account cards */}
          <div className="flex gap-3 flex-wrap">
            {accounts.map(a => (
              <button key={a.id} onClick={() => setSelected(a.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${selected === a.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-white border-border hover:bg-muted/30'}`}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: a.color ?? '#6366f1' }}>
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.bank_name ?? ACCOUNT_TYPES.find(t => t.value === a.account_type)?.label}</p>
                  <p className={`text-sm font-bold tabular-nums mt-0.5 ${a.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtBRL(a.balance)}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setEditAccount(a); setShowAccountModal(true); }}
                  className="ml-2 p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </button>
            ))}
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
            {acc && <span className="ml-4 text-sm text-muted-foreground">Saldo atual: <strong className={acc.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}>{fmtBRL(acc.balance)}</strong></span>}
          </div>

          {/* Mini KPIs */}
          <div className="grid grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
            <div className="bg-white px-6 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">Entradas</p>
              <p className="text-xl font-bold tabular-nums text-emerald-600">{fmtBRL(entradas)}</p>
            </div>
            <div className="bg-white px-6 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">Saídas</p>
              <p className="text-xl font-bold tabular-nums text-red-500">{fmtBRL(saidas)}</p>
            </div>
            <div className="bg-white px-6 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">Resultado do mês</p>
              <p className={`text-xl font-bold tabular-nums ${(entradas - saidas) >= 0 ? 'text-foreground' : 'text-red-500'}`}>{fmtBRL(entradas - saidas)}</p>
            </div>
          </div>

          {/* Entries table */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-muted/30 border-b border-border grid grid-cols-[100px_1fr_100px_110px] gap-3">
              {['Data','Descrição','Tipo','Valor'].map((h, i) => (
                <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i === 3 ? 'text-right' : ''}`}>{h}</span>
              ))}
            </div>
            {loadingEntries ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : entries.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma movimentação em {MONTHS[month]} {year}.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {entries.map(e => (
                  <div key={e.id} className="px-5 py-3 grid grid-cols-[100px_1fr_100px_110px] gap-3 items-center hover:bg-slate-50 transition-colors">
                    <span className="text-sm tabular-nums text-muted-foreground">{fmtDate(e.date)}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{e.description}</p>
                      {e._source === 'event' && (
                        <span className="text-[10px] text-emerald-600 font-semibold">Evento</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{e._source === 'manual' ? 'Manual' : 'Pagamento'}</span>
                    <span className={`text-sm font-semibold tabular-nums text-right ${e.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {e.amount >= 0 ? '+' : ''}{fmtBRL(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showAccountModal && (
        <AccountModal
          account={editAccount}
          onClose={() => setShowAccountModal(false)}
          onSaved={() => { setShowAccountModal(false); loadAccounts(); }}
        />
      )}
    </div>
  );
}

function AccountModal({ account, onClose, onSaved }: {
  account: Account | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(account?.name ?? '');
  const [bankName, setBankName] = useState(account?.bank_name ?? '');
  const [type, setType] = useState(account?.account_type ?? 'checking');
  const [balance, setBalance] = useState(account ? String(account.balance) : '0');
  const [color, setColor] = useState(account?.color ?? '#6366f1');
  const [saving, setSaving] = useState(false);

  const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#64748b'];

  const save = async () => {
    if (!name) { toast.error('Nome obrigatório'); return; }
    const num = parseFloat(balance.replace(',', '.'));
    setSaving(true);
    const payload = { name, bank_name: bankName || null, account_type: type, balance: isNaN(num) ? 0 : num, color };
    let error;
    if (account) {
      ({ error } = await supabase.from('bank_accounts' as any).update(payload).eq('id', account.id));
    } else {
      ({ error } = await supabase.from('bank_accounts' as any).insert(payload));
    }
    if (error) { toast.error('Erro ao salvar'); setSaving(false); return; }
    toast.success(account ? 'Conta atualizada' : 'Conta adicionada');
    onSaved();
  };

  const deactivate = async () => {
    if (!account) return;
    await supabase.from('bank_accounts' as any).update({ active: false }).eq('id', account.id);
    toast.success('Conta removida');
    onSaved();
  };

  const inputCls = 'w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{account ? 'Editar conta' : 'Nova conta bancária'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Nome da conta *</label>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Bradesco CC, Caixa" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Banco</label>
              <input className={inputCls} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bradesco, Itaú…" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Tipo</label>
              <select className={inputCls} value={type} onChange={e => setType(e.target.value)}>
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Saldo atual (R$)</label>
            <input type="number" className={inputCls} value={balance} onChange={e => setBalance(e.target.value)} step="0.01" placeholder="0,00" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? 'Salvando...' : account ? 'Salvar alterações' : 'Adicionar conta'}
          </button>

          {account && (
            <button onClick={deactivate}
              className="w-full py-2 text-sm text-red-500 hover:underline transition-colors">
              Remover conta
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
