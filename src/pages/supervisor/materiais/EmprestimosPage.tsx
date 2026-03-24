import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowRightLeft, Plus, Loader2, Check, RotateCcw, Trash2,
  PackageOpen, ArrowLeft, Package, Save, ClipboardList, Pencil,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

type MaterialItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  available_qty: number;
  total_qty: number;
  damaged_qty: number;
  image_url: string | null;
};

type LoanItem = {
  id?: string;
  material_item_id: string;
  item_name?: string;
  item_unit?: string;
  qty_out: number;
  qty_returned: number;
  qty_damaged: number;
};

type Loan = {
  id: string;
  event_name: string;
  responsible: string | null;
  date_out: string;
  date_return: string | null;
  status: string;
  notes: string | null;
  items: LoanItem[];
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:   { label: 'Ativo',      color: 'bg-amber-100 text-amber-700 border-amber-200' },
  returned: { label: 'Devolvido',  color: 'bg-green-100 text-green-700 border-green-200' },
  partial:  { label: 'Parcial',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  planning: { label: 'Planejando', color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export default function EmprestimosPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'returned'>('all');

  // Detail view
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [planQty, setPlanQty] = useState<Record<string, number>>({});
  const [savingPlan, setSavingPlan] = useState(false);

  // New loan dialog
  const [newDialog, setNewDialog] = useState(false);
  const [nForm, setNForm] = useState({
    event_name: '', responsible: '',
    date_out: new Date().toISOString().split('T')[0], notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Return dialog
  const [returnDialog, setReturnDialog] = useState(false);
  const [returnLoan, setReturnLoan] = useState<Loan | null>(null);
  const [returnItems, setReturnItems] = useState<LoanItem[]>([]);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returning, setReturning] = useState(false);
  const [editReturnMode, setEditReturnMode] = useState(false);

  const load = async () => {
    setLoading(true);
    const [loansRes, itemsRes] = await Promise.all([
      supabase.from('material_loans' as any).select('*').order('date_out', { ascending: false }),
      supabase.from('material_items' as any)
        .select('id, name, category, unit, available_qty, total_qty, damaged_qty, image_url')
        .order('category').order('name'),
    ]);

    const rawLoans = (loansRes.data || []) as any[];
    if (itemsRes.data) setMaterialItems(itemsRes.data as MaterialItem[]);

    if (rawLoans.length > 0) {
      const loanIds = rawLoans.map((l: any) => l.id);
      const { data: loanItemsData } = await supabase
        .from('material_loan_items' as any)
        .select('*, material_items(name, unit)')
        .in('loan_id', loanIds);
      const loanItemsMap: Record<string, LoanItem[]> = {};
      for (const li of (loanItemsData || []) as any[]) {
        if (!loanItemsMap[li.loan_id]) loanItemsMap[li.loan_id] = [];
        loanItemsMap[li.loan_id].push({
          id: li.id,
          material_item_id: li.material_item_id,
          item_name: li.material_items?.name,
          item_unit: li.material_items?.unit,
          qty_out: li.qty_out,
          qty_returned: li.qty_returned ?? 0,
          qty_damaged: li.qty_damaged ?? 0,
        });
      }
      setLoans(rawLoans.map((l: any) => ({ ...l, items: loanItemsMap[l.id] || [] })));
    } else {
      setLoans([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Open detail view ──
  const openDetail = async (loan: Loan) => {
    setSelectedLoan(loan);
    const qty: Record<string, number> = {};
    for (const li of loan.items) {
      qty[li.material_item_id] = li.qty_out;
    }
    // If no items yet, pre-populate from base list
    if (loan.items.length === 0) {
      try {
        const { data: baseList } = await supabase
          .from('material_base_list' as any)
          .select('material_item_id, qty');
        for (const b of (baseList || []) as any[]) {
          qty[b.material_item_id] = b.qty;
        }
      } catch {
        // base list table may not exist yet
      }
    }
    setPlanQty(qty);
  };

  // ── Save materials list ──
  const handleSavePlan = async () => {
    if (!selectedLoan) return;
    setSavingPlan(true);
    try {
      const planned = Object.entries(planQty).filter(([, q]) => q > 0);

      await supabase.from('material_loan_items' as any).delete().eq('loan_id', selectedLoan.id);

      if (planned.length > 0) {
        const { error } = await supabase.from('material_loan_items' as any).insert(
          planned.map(([material_item_id, qty]) => ({
            loan_id: selectedLoan.id,
            material_item_id,
            qty_out: qty,
            qty_returned: 0,
            qty_damaged: 0,
          }))
        );
        if (error) throw error;
      }

      const newStatus = planned.length > 0 ? 'active' : 'planning';
      await supabase.from('material_loans' as any)
        .update({ status: newStatus })
        .eq('id', selectedLoan.id);

      toast.success('Lista de materiais salva!');
      await load();
      setSelectedLoan(prev => {
        if (!prev) return null;
        const updated = loans.find(l => l.id === prev.id);
        return updated || prev;
      });
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'Tente novamente'));
    }
    setSavingPlan(false);
  };

  // ── New Loan ──
  const handleNewLoan = async () => {
    if (!nForm.event_name.trim()) { toast.error('Nome do evento é obrigatório'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('material_loans' as any).insert({
        event_name: nForm.event_name.trim(),
        responsible: nForm.responsible.trim() || null,
        date_out: nForm.date_out,
        notes: nForm.notes.trim() || null,
        status: 'planning',
      });
      if (error) throw error;
      toast.success('Evento criado! Agora monte a lista de materiais.');
      setNewDialog(false);
      setNForm({ event_name: '', responsible: '', date_out: new Date().toISOString().split('T')[0], notes: '' });
      load();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Tente novamente'));
    }
    setSaving(false);
  };

  // ── Open Return (new devolution) ──
  const openReturn = (loan: Loan, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReturnLoan(loan);
    // Show remaining to return (qty_out - already returned)
    setReturnItems(loan.items.map(i => ({
      ...i,
      qty_returned: Math.max(0, i.qty_out - i.qty_returned),
      qty_damaged: 0,
    })));
    setReturnDate(new Date().toISOString().split('T')[0]);
    setEditReturnMode(false);
    setReturnDialog(true);
  };

  // ── Open Edit Return (correct a past devolution) ──
  const openEditReturn = (loan: Loan, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReturnLoan(loan);
    // Show CURRENT total returned (user can only increase)
    setReturnItems(loan.items.map(i => ({ ...i })));
    setReturnDate(loan.date_return || new Date().toISOString().split('T')[0]);
    setEditReturnMode(true);
    setReturnDialog(true);
  };

  // ── Handle new devolution ──
  const handleReturn = async () => {
    if (!returnLoan) return;
    setReturning(true);
    try {
      // Step 1: Update each loan item and available_qty
      for (const ri of returnItems) {
        if (!ri.id) continue;
        const original = returnLoan.items.find(i => i.id === ri.id);
        const prevReturned = original?.qty_returned ?? 0;
        const prevDamaged = original?.qty_damaged ?? 0;

        await supabase.from('material_loan_items' as any).update({
          qty_returned: prevReturned + ri.qty_returned,
          qty_damaged: prevDamaged + ri.qty_damaged,
        }).eq('id', ri.id);

        const mat = materialItems.find(m => m.id === ri.material_item_id);
        if (mat) {
          await supabase.from('material_items' as any).update({
            available_qty: mat.available_qty + ri.qty_returned,
            damaged_qty: (mat.damaged_qty ?? 0) + ri.qty_damaged,
          }).eq('id', ri.material_item_id);
        }
      }

      // Step 2: Determine new status
      const totalOut = returnLoan.items.reduce((s, i) => s + i.qty_out, 0);
      const totalReturned =
        returnItems.reduce((s, i) => s + i.qty_returned, 0) +
        returnLoan.items.reduce((s, i) => s + i.qty_returned, 0);
      const newStatus = totalReturned >= totalOut ? 'returned' : 'partial';

      // Step 3: If fully returned, permanently subtract losses from total_qty
      if (newStatus === 'returned') {
        for (const ri of returnItems) {
          const original = returnLoan.items.find(i => i.id === ri.id);
          const prevReturned = original?.qty_returned ?? 0;
          const totalItemReturned = prevReturned + ri.qty_returned;
          const lost = ri.qty_out - totalItemReturned;
          if (lost > 0) {
            const mat = materialItems.find(m => m.id === ri.material_item_id);
            if (mat) {
              await supabase.from('material_items' as any).update({
                total_qty: Math.max(0, mat.total_qty - lost),
              }).eq('id', ri.material_item_id);
            }
          }
        }
      }

      await supabase.from('material_loans' as any).update({
        status: newStatus,
        date_return: returnDate,
      }).eq('id', returnLoan.id);

      toast.success(newStatus === 'returned' ? 'Devolução total registrada!' : 'Devolução parcial registrada!');
      setReturnDialog(false);
      if (selectedLoan?.id === returnLoan.id) setSelectedLoan(null);
      load();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Tente novamente'));
    }
    setReturning(false);
  };

  // ── Handle edit devolution (reverse losses for late returns) ──
  const handleEditReturn = async () => {
    if (!returnLoan) return;
    setReturning(true);
    try {
      for (const ri of returnItems) {
        if (!ri.id) continue;
        const original = returnLoan.items.find(i => i.id === ri.id);
        const oldReturned = original?.qty_returned ?? 0;
        const newReturned = Math.min(ri.qty_returned, ri.qty_out);
        const diff = newReturned - oldReturned; // positive = more came back

        await supabase.from('material_loan_items' as any).update({
          qty_returned: newReturned,
          qty_damaged: ri.qty_damaged,
        }).eq('id', ri.id);

        if (diff > 0) {
          const mat = materialItems.find(m => m.id === ri.material_item_id);
          if (mat) {
            await supabase.from('material_items' as any).update({
              total_qty: mat.total_qty + diff,   // undo the loss
              available_qty: mat.available_qty + diff,
            }).eq('id', ri.material_item_id);
          }
        }
      }

      // Recalculate status
      const totalOut = returnLoan.items.reduce((s, i) => s + i.qty_out, 0);
      const totalNewReturned = returnItems.reduce((s, i) => s + Math.min(i.qty_returned, i.qty_out), 0);
      const newStatus = totalNewReturned >= totalOut ? 'returned' : 'partial';

      await supabase.from('material_loans' as any).update({
        status: newStatus,
        date_return: returnDate,
      }).eq('id', returnLoan.id);

      toast.success('Devolução atualizada com sucesso!');
      setReturnDialog(false);
      setEditReturnMode(false);
      load();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Tente novamente'));
    }
    setReturning(false);
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Remover este evento?')) return;
    await supabase.from('material_loan_items' as any).delete().eq('loan_id', id);
    await supabase.from('material_loans' as any).delete().eq('id', id);
    toast.success('Evento removido');
    if (selectedLoan?.id === id) setSelectedLoan(null);
    load();
  };

  const filtered = loans.filter(l =>
    filter === 'all' ||
    l.status === filter ||
    (filter === 'active' && (l.status === 'partial' || l.status === 'planning'))
  );
  const activeCount = loans.filter(l => ['active', 'partial', 'planning'].includes(l.status)).length;

  const categories = Array.from(new Set(materialItems.map(i => i.category))).sort();
  const totalPlanned = Object.values(planQty).filter(q => q > 0).length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  // ── RETURN DIALOG (shared between new and edit) ────────────────────────────
  const ReturnDialogContent = (
    <Dialog open={returnDialog} onOpenChange={v => { setReturnDialog(v); if (!v) setEditReturnMode(false); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editReturnMode ? `Editar Devolução — ${returnLoan?.event_name}` : `Registrar Devolução — ${returnLoan?.event_name}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {editReturnMode && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Você pode aumentar a quantidade devolvida para itens que chegaram depois. O estoque será corrigido automaticamente.</span>
            </div>
          )}
          <div>
            <Label>Data de Devolução</Label>
            <Input className="mt-1" type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">
              {editReturnMode ? 'Total devolvido por item (pode aumentar)' : 'Itens devolvidos'}
            </Label>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-semibold">ITEM</th>
                    <th className="text-center px-2 py-2 text-xs text-muted-foreground font-semibold">SAIU</th>
                    <th className="text-center px-2 py-2 text-xs text-muted-foreground font-semibold">
                      {editReturnMode ? 'TOTAL VOLT.' : 'VOLTOU'}
                    </th>
                    <th className="text-center px-2 py-2 text-xs text-muted-foreground font-semibold">DANIF.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {returnItems.map((ri, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-sm font-medium">{ri.item_name}</td>
                      <td className="px-2 py-2 text-center text-muted-foreground">{ri.qty_out}</td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={editReturnMode ? (returnLoan?.items.find(i => i.id === ri.id)?.qty_returned ?? 0) : 0}
                          max={ri.qty_out}
                          className="w-16 text-center h-7 text-sm"
                          value={ri.qty_returned}
                          onChange={e => setReturnItems(prev => prev.map((p, i) =>
                            i === idx ? { ...p, qty_returned: Number(e.target.value) } : p
                          ))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          className="w-16 text-center h-7 text-sm"
                          value={ri.qty_damaged}
                          onChange={e => setReturnItems(prev => prev.map((p, i) =>
                            i === idx ? { ...p, qty_damaged: Number(e.target.value) } : p
                          ))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setReturnDialog(false); setEditReturnMode(false); }}>
              Cancelar
            </Button>
            <Button
              onClick={editReturnMode ? handleEditReturn : handleReturn}
              disabled={returning}
              className="gold-button"
            >
              {returning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {editReturnMode ? 'Salvar Correção' : 'Confirmar Devolução'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── EVENT DETAIL PAGE ─────────────────────────────────────────────────────
  if (selectedLoan) {
    const st = STATUS_LABEL[selectedLoan.status] || STATUS_LABEL.active;
    const isReturned = selectedLoan.status === 'returned';
    const isPartial = selectedLoan.status === 'partial';

    // Returned loan: show summary view
    if (isReturned || isPartial) {
      const totalOut = selectedLoan.items.reduce((s, i) => s + i.qty_out, 0);
      const totalReturned = selectedLoan.items.reduce((s, i) => s + i.qty_returned, 0);
      const totalLost = totalOut - totalReturned;
      const totalDamaged = selectedLoan.items.reduce((s, i) => s + i.qty_damaged, 0);

      return (
        <div>
          {/* Header */}
          <div className="flex items-start gap-3 mb-6">
            <button
              onClick={() => { setSelectedLoan(null); load(); }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 mt-0.5 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-display font-bold gold-text leading-tight">{selectedLoan.event_name}</h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>
                  {st.label}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                <span>📅 Saída: {new Date(selectedLoan.date_out + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                {selectedLoan.date_return && (
                  <span>✅ Retorno: {new Date(selectedLoan.date_return + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                )}
                {selectedLoan.responsible && <span>👤 {selectedLoan.responsible}</span>}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => openEditReturn(selectedLoan)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar Devolução
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{totalOut}</p>
              <p className="text-xs text-muted-foreground mt-1">Itens saíram</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${totalLost > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className={`text-2xl font-bold ${totalLost > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalLost}</p>
              <p className="text-xs text-muted-foreground mt-1">Itens perdidos</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${totalDamaged > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-2xl font-bold ${totalDamaged > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{totalDamaged}</p>
              <p className="text-xs text-muted-foreground mt-1">Itens avariados</p>
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h3 className="text-sm font-semibold">Detalhamento da Devolução</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ITEM</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SAIU</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">VOLTOU</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">PERDIDO</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">AVARIADO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {selectedLoan.items.map((item, idx) => {
                  const lost = item.qty_out - item.qty_returned;
                  return (
                    <tr key={idx} className={lost > 0 ? 'bg-red-50/30' : ''}>
                      <td className="px-4 py-3 font-medium">{item.item_name}</td>
                      <td className="px-3 py-3 text-center text-muted-foreground">{item.qty_out} <span className="text-xs">{item.item_unit}</span></td>
                      <td className="px-3 py-3 text-center text-green-600 font-semibold">{item.qty_returned}</td>
                      <td className="px-3 py-3 text-center">
                        {lost > 0 ? (
                          <span className="text-red-600 font-semibold">{lost}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {item.qty_damaged > 0 ? (
                          <span className="text-amber-600 font-semibold">{item.qty_damaged}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isPartial && (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => openReturn(selectedLoan)}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Registrar Mais Devoluções
              </Button>
            </div>
          )}

          {ReturnDialogContent}
        </div>
      );
    }

    // Planning/Active loan: show material planning view
    return (
      <div>
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => { setSelectedLoan(null); load(); }}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 mt-0.5 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-bold gold-text leading-tight">{selectedLoan.event_name}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>
                {st.label}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
              <span>📅 {new Date(selectedLoan.date_out + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              {selectedLoan.responsible && <span>👤 {selectedLoan.responsible}</span>}
              {selectedLoan.notes && <span className="italic">"{selectedLoan.notes}"</span>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => openReturn(selectedLoan)}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Devolução
          </Button>
        </div>

        {/* Summary bar */}
        <div className="bg-white rounded-xl border border-border p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardList className="w-4 h-4 text-primary" />
            <span>
              {totalPlanned === 0
                ? 'Nenhum item selecionado ainda'
                : `${totalPlanned} tipo${totalPlanned !== 1 ? 's' : ''} de material selecionado${totalPlanned !== 1 ? 's' : ''}`}
            </span>
          </div>
          <Button onClick={handleSavePlan} disabled={savingPlan} className="gold-button" size="sm">
            {savingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Lista
          </Button>
        </div>

        {/* Materials by category */}
        {materialItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhum material cadastrado</p>
            <p className="text-sm mt-1">Cadastre itens em Materiais → Inventário</p>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map(cat => {
              const catItems = materialItems.filter(i => i.category === cat);
              const catSelected = catItems.filter(i => (planQty[i.id] || 0) > 0).length;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      📦 {cat}
                    </h3>
                    {catSelected > 0 && (
                      <span className="text-xs text-primary font-medium">
                        {catSelected} selecionado{catSelected !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full">Material</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Disponível</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap w-28">Qtde Necessária</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {catItems.map(item => {
                          const qty = planQty[item.id] || 0;
                          const isSelected = qty > 0;
                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${isSelected ? 'bg-amber-50/40' : 'hover:bg-muted/10'}`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {item.image_url ? (
                                    <img src={item.image_url} alt={item.name}
                                      className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                                  ) : (
                                    <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                                      <Package className="w-4 h-4 text-muted-foreground/40" />
                                    </div>
                                  )}
                                  <span className={`font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {item.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                <span className={item.available_qty === 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                                  {item.available_qty}
                                </span>
                                <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <Input
                                  type="number"
                                  min={0}
                                  value={qty === 0 ? '' : qty}
                                  placeholder="0"
                                  className={`w-20 text-center h-8 text-sm mx-auto ${isSelected ? 'border-primary/50 bg-white' : ''}`}
                                  onChange={e => {
                                    const v = Math.max(0, Number(e.target.value) || 0);
                                    setPlanQty(prev => {
                                      const next = { ...prev };
                                      if (v === 0) delete next[item.id];
                                      else next[item.id] = v;
                                      return next;
                                    });
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end pt-2 pb-6">
              <Button onClick={handleSavePlan} disabled={savingPlan} className="gold-button">
                {savingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Lista de Materiais
              </Button>
            </div>
          </div>
        )}

        {ReturnDialogContent}
      </div>
    );
  }

  // ── EVENT LIST ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold gold-text">Eventos</h1>
            <p className="text-muted-foreground mt-0.5">
              {activeCount > 0
                ? `${activeCount} evento${activeCount !== 1 ? 's' : ''} ativo${activeCount !== 1 ? 's' : ''}`
                : 'Nenhum evento ativo'}
            </p>
          </div>
        </div>
        <Button onClick={() => setNewDialog(true)} className="gold-button">
          <Plus className="w-4 h-4 mr-2" />Novo Evento
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'active', 'returned'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Devolvidos'}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <PackageOpen className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum evento encontrado</p>
          <p className="text-sm mt-1">Crie um evento e monte a lista de materiais</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs whitespace-nowrap">DATA</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs w-full min-w-[180px]">EVENTO</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs whitespace-nowrap">RESPONSÁVEL</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs whitespace-nowrap">MATERIAIS</th>
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">STATUS</th>
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs w-36">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(loan => {
                  const st = STATUS_LABEL[loan.status] || STATUS_LABEL.active;
                  const isFullyReturned = loan.status === 'returned';
                  return (
                    <tr
                      key={loan.id}
                      className="hover:bg-amber-50/30 transition-colors cursor-pointer"
                      onClick={() => openDetail(loan)}
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {new Date(loan.date_out + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {loan.date_return && (
                          <div className="text-[10px] text-green-600 mt-0.5">
                            Dev: {new Date(loan.date_return + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium text-foreground">{loan.event_name}</span>
                        {loan.notes && <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{loan.notes}</p>}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{loan.responsible || '—'}</td>
                      <td className="px-3 py-3">
                        {loan.items.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Sem itens</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {loan.items.length} tipo{loan.items.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {isFullyReturned ? (
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2"
                              onClick={e => openEditReturn(loan, e)}>
                              <Pencil className="w-3 h-3 mr-1" />Editar Dev.
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2"
                              onClick={e => openReturn(loan, e)}>
                              <RotateCcw className="w-3 h-3 mr-1" />Devolver
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="w-7 h-7"
                            onClick={e => handleDelete(loan.id, e)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ReturnDialogContent}

      {/* New Event Dialog */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome do Evento *</Label>
              <Input className="mt-1" placeholder="Ex: Casamento Silva, Formatura Turma 2026..."
                value={nForm.event_name}
                onChange={e => setNForm(f => ({ ...f, event_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Input className="mt-1" placeholder="Nome..."
                  value={nForm.responsible}
                  onChange={e => setNForm(f => ({ ...f, responsible: e.target.value }))} />
              </div>
              <div>
                <Label>Data</Label>
                <Input className="mt-1" type="date"
                  value={nForm.date_out}
                  onChange={e => setNForm(f => ({ ...f, date_out: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea className="mt-1" rows={2} placeholder="Notas..."
                value={nForm.notes}
                onChange={e => setNForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
              💡 Após criar o evento, clique nele para montar a lista de materiais necessários.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setNewDialog(false)}>Cancelar</Button>
              <Button onClick={handleNewLoan} disabled={saving} className="gold-button">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Criar Evento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
