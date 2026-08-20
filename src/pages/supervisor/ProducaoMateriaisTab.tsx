import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus, X, Package, LogOut, LogIn, Search,
  ChevronDown, ChevronUp, Loader2, AlertCircle,
} from 'lucide-react';

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

// ── Types ──────────────────────────────────────────────────────────────────────

type MaterialItem = {
  id: string; name: string; category: string;
  total_qty: number; available_qty: number; damaged_qty: number; unit: string;
};

type LoanItem = {
  id: string;
  material_item_id: string;
  item_name: string; item_unit: string;
  qty_out: number; qty_returned: number; qty_damaged: number;
};

type Loan = {
  id: string;
  production_order_id: string | null;
  order_title: string | null;
  event_name: string;
  responsible: string | null;
  date_out: string;
  date_return: string | null;
  status: string;
  notes: string | null;
  items: LoanItem[];
};

type Order = { id: string; title: string };

// ── Helpers ────────────────────────────────────────────────────────────────────

const LOAN_STATUS: Record<string, { label: string; cls: string }> = {
  planning:  { label: 'Reservado',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  active:    { label: 'Saiu',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  returned:  { label: 'Retornou',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelado',  cls: 'bg-muted text-muted-foreground border-border' },
};

const fmtDate = (d: string | null) => d ? d.slice(0, 10).split('-').reverse().join('/') : '—';

// ── Nova Locação Modal ─────────────────────────────────────────────────────────

function NovaLocacaoModal({ orders, items, onClose, onSaved }: {
  orders: Order[];
  items: MaterialItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [orderId, setOrderId]       = useState('');
  const [dateOut, setDateOut]       = useState('');
  const [dateReturn, setDateReturn] = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [lines, setLines]           = useState<{ item_id: string; qty: number }[]>([{ item_id: '', qty: 1 }]);
  const [search, setSearch]         = useState('');

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) && i.available_qty > 0
  );

  const addLine = () => setLines(prev => [...prev, { item_id: '', qty: 1 }]);
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const setLine = (idx: number, field: 'item_id' | 'qty', val: string | number) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));

  const save = async () => {
    if (!orderId) { toast.error('Selecione um pedido de produção'); return; }
    if (!dateOut)  { toast.error('Informe a data de saída'); return; }
    const validLines = lines.filter(l => l.item_id && l.qty > 0);
    if (!validLines.length) { toast.error('Adicione pelo menos um item'); return; }

    setSaving(true);
    try {
      const order = orders.find(o => o.id === orderId);
      const { data: loan, error: lErr } = await (supabase as any).from('material_loans').insert({
        company_id: COMPANY_ID,
        production_order_id: orderId,
        event_name: order?.title ?? 'Pedido',
        date_out: dateOut,
        date_return: dateReturn || null,
        notes: notes || null,
        status: 'planning',
      }).select('id').single();
      if (lErr) throw lErr;

      const itemRows = validLines.map(l => ({
        loan_id: loan.id,
        material_item_id: l.item_id,
        qty_out: l.qty,
        qty_returned: 0,
        qty_damaged: 0,
      }));
      const { error: iErr } = await (supabase as any).from('material_loan_items').insert(itemRows);
      if (iErr) throw iErr;

      // reduz available_qty de cada item
      for (const l of validLines) {
        await (supabase as any).rpc('decrement_material_qty', {
          p_item_id: l.item_id, p_qty: l.qty,
        }).catch(() => null); // fallback manual abaixo
        await (supabase as any)
          .from('material_items')
          .update({ available_qty: (items.find(i => i.id === l.item_id)?.available_qty ?? 0) - l.qty })
          .eq('id', l.item_id);
      }

      toast.success('Locação reservada!');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <p className="font-semibold text-sm">Nova Locação de Materiais</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Pedido de produção */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Pedido de Produção</label>
            <select value={orderId} onChange={e => setOrderId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Selecione…</option>
              {orders.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Data de Saída</label>
              <input type="date" value={dateOut} onChange={e => setDateOut(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Previsão de Retorno</label>
              <input type="date" value={dateReturn} onChange={e => setDateReturn(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens</label>
              <button onClick={addLine} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Adicionar item
              </button>
            </div>

            {/* busca rápida de item */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar itens disponíveis…"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => {
                const avail = items.find(i => i.id === line.item_id)?.available_qty ?? 0;
                const overQty = line.item_id && line.qty > avail;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <select value={line.item_id} onChange={e => setLine(idx, 'item_id', e.target.value)}
                      className="flex-1 px-2.5 py-2 rounded-xl border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="">Selecione um item…</option>
                      {filteredItems.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.available_qty} disp.)</option>
                      ))}
                    </select>
                    <input type="number" min={1} value={line.qty}
                      onChange={e => setLine(idx, 'qty', parseInt(e.target.value) || 1)}
                      className={`w-16 px-2 py-2 rounded-xl border text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/20 ${overQty ? 'border-red-400 text-red-600' : 'border-border'}`} />
                    <button onClick={() => removeLine(idx)} className="p-1.5 text-muted-foreground/40 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            {lines.some(l => l.item_id && l.qty > (items.find(i => i.id === l.item_id)?.available_qty ?? 0)) && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Qty acima do disponível</p>
            )}
          </div>

          {/* Obs */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">
            {saving ? 'Salvando…' : 'Reservar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entrada Modal (registrar retorno) ──────────────────────────────────────────

function EntradaModal({ loan, onClose, onSaved }: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lines, setLines] = useState(
    loan.items.map(i => ({ id: i.id, material_item_id: i.material_item_id, name: i.item_name, unit: i.item_unit,
      qty_out: i.qty_out, returned: i.qty_out - i.qty_returned, damaged: 0 }))
  );
  const [saving, setSaving] = useState(false);

  const set = (idx: number, field: 'returned' | 'damaged', val: number) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: Math.max(0, val) } : l));

  const save = async () => {
    setSaving(true);
    try {
      for (const l of lines) {
        await (supabase as any).from('material_loan_items')
          .update({ qty_returned: loan.items.find(i => i.id === l.id)!.qty_returned + l.returned, qty_damaged: l.damaged })
          .eq('id', l.id);
        // devolve ao estoque
        const { data: cur } = await (supabase as any).from('material_items').select('available_qty, damaged_qty').eq('id', l.material_item_id).single();
        if (cur) {
          await (supabase as any).from('material_items').update({
            available_qty: cur.available_qty + l.returned - l.damaged,
            damaged_qty:   cur.damaged_qty + l.damaged,
          }).eq('id', l.material_item_id);
        }
      }
      await (supabase as any).from('material_loans').update({ status: 'returned' }).eq('id', loan.id);
      toast.success('Entrada registrada!');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Registrar Entrada</p>
            <p className="text-xs text-muted-foreground mt-0.5">{loan.event_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">
            <span>Item</span><span className="text-center">Retornado</span><span className="text-center">Avariado</span>
          </div>
          {lines.map((l, idx) => (
            <div key={l.id} className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
              <div>
                <p className="text-sm text-foreground">{l.name}</p>
                <p className="text-xs text-muted-foreground">Saiu: {l.qty_out} {l.unit}</p>
              </div>
              <input type="number" min={0} max={l.qty_out} value={l.returned}
                onChange={e => set(idx, 'returned', parseInt(e.target.value) || 0)}
                className="w-full px-2 py-1.5 rounded-xl border border-border text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
              <input type="number" min={0} max={l.returned} value={l.damaged}
                onChange={e => set(idx, 'damaged', parseInt(e.target.value) || 0)}
                className="w-full px-2 py-1.5 rounded-xl border border-amber-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-200/50 text-amber-700" />
            </div>
          ))}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
            <LogIn className="w-4 h-4" />
            {saving ? 'Salvando…' : 'Confirmar Entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

export function ProducaoMateriaisTab({ orders }: { orders: { id: string; title: string }[] }) {
  const [subTab, setSubTab]         = useState<'estoque' | 'locacoes'>('locacoes');
  const [items, setItems]           = useState<MaterialItem[]>([]);
  const [loans, setLoans]           = useState<Loan[]>([]);
  const [loading, setLoading]       = useState(true);
  const [newModal, setNewModal]     = useState(false);
  const [entradaLoan, setEntradaLoan] = useState<Loan | null>(null);
  const [loanFilter, setLoanFilter] = useState<'all' | 'planning' | 'active' | 'returned'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: its }, { data: lns }] = await Promise.all([
      (supabase as any).from('material_items').select('*').order('category').order('name'),
      (supabase as any).from('material_loans')
        .select('*, material_loan_items(id, material_item_id, qty_out, qty_returned, qty_damaged, material_items(name, unit))')
        .eq('company_id', COMPANY_ID)
        .order('date_out', { ascending: false }),
    ]);

    setItems(its ?? []);
    setLoans((lns ?? []).map((l: any) => ({
      id: l.id,
      production_order_id: l.production_order_id,
      order_title: orders.find(o => o.id === l.production_order_id)?.title ?? null,
      event_name: l.event_name,
      responsible: l.responsible,
      date_out: l.date_out,
      date_return: l.date_return,
      status: l.status,
      notes: l.notes,
      items: (l.material_loan_items ?? []).map((li: any) => ({
        id: li.id,
        material_item_id: li.material_item_id,
        item_name: li.material_items?.name ?? '—',
        item_unit: li.material_items?.unit ?? 'unid',
        qty_out: li.qty_out,
        qty_returned: li.qty_returned,
        qty_damaged: li.qty_damaged,
      })),
    })));
    setLoading(false);
  }, [orders]);

  useEffect(() => { load(); }, [load]);

  const markSaida = async (loan: Loan) => {
    await (supabase as any).from('material_loans').update({ status: 'active', date_out: new Date().toISOString().slice(0, 10) }).eq('id', loan.id);
    toast.success('Saída registrada!');
    load();
  };

  const cancelLoan = async (loan: Loan) => {
    if (!confirm('Cancelar esta locação? O estoque será restaurado.')) return;
    // devolve ao estoque
    for (const li of loan.items) {
      const { data: cur } = await (supabase as any).from('material_items').select('available_qty').eq('id', li.material_item_id).single();
      if (cur) await (supabase as any).from('material_items').update({ available_qty: cur.available_qty + li.qty_out }).eq('id', li.material_item_id);
    }
    await (supabase as any).from('material_loans').update({ status: 'cancelled' }).eq('id', loan.id);
    toast.success('Locação cancelada');
    load();
  };

  const visibleLoans = loans.filter(l => loanFilter === 'all' || l.status === loanFilter);
  const filteredItems = items.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()) || i.category.toLowerCase().includes(itemSearch.toLowerCase()));

  // Agrupa por categoria para o estoque
  const byCategory = filteredItems.reduce<Record<string, MaterialItem[]>>((acc, i) => {
    (acc[i.category] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Sub-nav + actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
          {(['locacoes', 'estoque'] as const).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${subTab === t ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t === 'locacoes' ? 'Locações' : 'Estoque'}
            </button>
          ))}
        </div>
        <button onClick={() => setNewModal(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Nova Locação
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : subTab === 'estoque' ? (
        /* ── Estoque ── */
        <div className="space-y-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Buscar item ou categoria…"
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          {Object.entries(byCategory).map(([cat, catItems]) => (
            <div key={cat} className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">{cat}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-center">Disponível</th>
                    <th className="px-4 py-2 text-center">Total</th>
                    <th className="px-4 py-2 text-center">Avariado</th>
                    <th className="px-4 py-2 text-left">Unidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {catItems.map(item => {
                    const low = item.available_qty <= item.total_qty * 0.2;
                    return (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium text-foreground">{item.name}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`font-semibold tabular-nums ${item.available_qty === 0 ? 'text-red-500' : low ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {item.available_qty}
                          </span>
                          {low && item.available_qty > 0 && <span className="ml-1 text-amber-500 text-xs">⚠</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center text-muted-foreground tabular-nums">{item.total_qty}</td>
                        <td className="px-4 py-2.5 text-center text-amber-700 tabular-nums">{item.damaged_qty || '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{item.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {Object.keys(byCategory).length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Package className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhum item encontrado</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Locações ── */
        <div className="space-y-3">
          {/* Filtro de status */}
          <div className="flex gap-1 flex-wrap">
            {(['all', 'planning', 'active', 'returned'] as const).map(s => (
              <button key={s} onClick={() => setLoanFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${loanFilter === s ? 'bg-foreground text-white border-transparent' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                {s === 'all' ? 'Todas' : LOAN_STATUS[s]?.label}
              </button>
            ))}
          </div>

          {visibleLoans.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Package className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhuma locação encontrada</p>
              <button onClick={() => setNewModal(true)} className="text-xs text-primary hover:underline mt-1">Criar nova locação</button>
            </div>
          )}

          {visibleLoans.map(loan => {
            const cfg = LOAN_STATUS[loan.status] ?? LOAN_STATUS.planning;
            const expanded = expandedId === loan.id;
            return (
              <div key={loan.id} className="bg-white border border-border rounded-2xl overflow-hidden">
                {/* Header do card */}
                <div
                  className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : loan.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground truncate">{loan.event_name}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                    {loan.order_title && (
                      <p className="text-xs text-muted-foreground mt-0.5">Pedido: {loan.order_title}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Saída: {fmtDate(loan.date_out)}{loan.date_return ? ` · Retorno: ${fmtDate(loan.date_return)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {loan.status === 'planning' && (
                      <>
                        <button onClick={e => { e.stopPropagation(); markSaida(loan); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors">
                          <LogOut className="w-3.5 h-3.5" /> Saída
                        </button>
                        <button onClick={e => { e.stopPropagation(); cancelLoan(loan); }}
                          className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {loan.status === 'active' && (
                      <button onClick={e => { e.stopPropagation(); setEntradaLoan(loan); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors">
                        <LogIn className="w-3.5 h-3.5" /> Entrada
                      </button>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Itens expandidos */}
                {expanded && (
                  <div className="border-t border-border/60 px-4 py-3 bg-muted/20 space-y-1.5">
                    {loan.items.map(li => (
                      <div key={li.id} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{li.item_name}</span>
                        <span className="text-muted-foreground tabular-nums text-xs">
                          {li.qty_out} {li.item_unit}
                          {li.qty_returned > 0 && <span className="text-emerald-600 ml-2">✓ {li.qty_returned} retornado</span>}
                          {li.qty_damaged > 0 && <span className="text-amber-600 ml-2">⚠ {li.qty_damaged} avariado</span>}
                        </span>
                      </div>
                    ))}
                    {loan.notes && <p className="text-xs text-muted-foreground mt-2 italic">{loan.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {newModal && (
        <NovaLocacaoModal
          orders={orders}
          items={items}
          onClose={() => setNewModal(false)}
          onSaved={load}
        />
      )}
      {entradaLoan && (
        <EntradaModal
          loan={entradaLoan}
          onClose={() => setEntradaLoan(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
