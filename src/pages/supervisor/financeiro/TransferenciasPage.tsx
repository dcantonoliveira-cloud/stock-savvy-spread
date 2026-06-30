import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, ArrowRight, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

type Account = { id: string; name: string; bank_name: string | null; balance: number; color: string };
type Transfer = {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  from_account: { name: string } | null;
  to_account: { name: string } | null;
};

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

export default function TransferenciasPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: accs }, { data: trans }] = await Promise.all([
      supabase.from('bank_accounts' as any).select('id, name, bank_name, balance, color').eq('active', true).order('name'),
      supabase.from('bank_transfers' as any)
        .select('id, date, amount, description, from_account:from_account_id(name), to_account:to_account_id(name)')
        .order('date', { ascending: false })
        .limit(100),
    ]);
    setAccounts((accs ?? []) as Account[]);
    setTransfers((trans ?? []) as Transfer[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteTransfer = async (id: string) => {
    await supabase.from('bank_transfers' as any).delete().eq('id', id);
    setTransfers(prev => prev.filter(t => t.id !== id));
    toast.success('Transferência removida');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Transferências</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Movimentação entre contas bancárias</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Nova transferência
        </button>
      </div>

      {/* Contas */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {accounts.map(a => (
            <div key={a.id} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: a.color ?? '#6366f1' }}>
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                  {a.bank_name && <p className="text-xs text-muted-foreground">{a.bank_name}</p>}
                </div>
              </div>
              <p className="text-xl font-bold tabular-nums text-foreground">{fmtBRL(a.balance)}</p>
            </div>
          ))}
        </div>
      )}

      {accounts.length === 0 && !loading && (
        <div className="bg-white border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Cadastre contas bancárias no Extrato Bancário para fazer transferências.
        </div>
      )}

      {/* Histórico */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Histórico de transferências</p>
        </div>
        <div className="px-5 py-3 bg-muted/30 border-b border-border grid grid-cols-[100px_1fr_1fr_120px_36px] gap-3">
          {['Data','Origem','Destino','Valor',''].map((h, i) => (
            <span key={i} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i === 3 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : transfers.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma transferência registrada.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {transfers.map(t => (
              <div key={t.id} className="px-5 py-3 grid grid-cols-[100px_1fr_1fr_120px_36px] gap-3 items-center hover:bg-slate-50 transition-colors group">
                <span className="text-sm tabular-nums text-muted-foreground">{fmtDate(t.date)}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm text-foreground truncate">{(t.from_account as any)?.name ?? '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate">{(t.to_account as any)?.name ?? '—'}</span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-right text-foreground">{fmtBRL(t.amount)}</span>
                <button onClick={() => deleteTransfer(t.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <TransferModal
          accounts={accounts}
          onClose={() => setShowModal(false)}
          onCreated={t => { setTransfers(prev => [t, ...prev]); load(); setShowModal(false); }}
        />
      )}
    </div>
  );
}

function TransferModal({ accounts, onClose, onCreated }: {
  accounts: Account[];
  onClose: () => void;
  onCreated: (t: Transfer) => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!from || !to || !amount) { toast.error('Preencha todos os campos'); return; }
    if (from === to) { toast.error('Origem e destino não podem ser iguais'); return; }
    const num = parseFloat(amount.replace(',', '.'));
    if (isNaN(num) || num <= 0) { toast.error('Valor inválido'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('bank_transfers' as any)
      .insert({ from_account_id: from, to_account_id: to, amount: num, date, description: desc || null })
      .select('id, date, amount, description, from_account:from_account_id(name), to_account:to_account_id(name)').single();
    if (error) { toast.error('Erro ao salvar'); setSaving(false); return; }
    toast.success('Transferência registrada');
    onCreated(data as Transfer);
  };

  const inputCls = 'w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Nova transferência</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">

          {accounts.length < 2 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Cadastre pelo menos 2 contas bancárias no Extrato Bancário.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">De (origem)</label>
                <select className={inputCls} value={from} onChange={e => setFrom(e.target.value)}>
                  <option value="">Selecione…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Para (destino)</label>
                <select className={inputCls} value={to} onChange={e => setTo(e.target.value)}>
                  <option value="">Selecione…</option>
                  {accounts.filter(a => a.id !== from).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Valor (R$)</label>
                  <input type="number" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Data</label>
                  <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Descrição</label>
                <input className={inputCls} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Motivo da transferência" />
              </div>
              <button onClick={save} disabled={saving}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving ? 'Salvando...' : 'Transferir'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
