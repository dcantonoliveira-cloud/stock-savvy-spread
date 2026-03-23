import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowRightLeft, Plus, Loader2, X, Check, RotateCcw, Trash2, PackageOpen
} from 'lucide-react';
import { toast } from 'sonner';

type MaterialItem = { id: string; name: string; unit: string; available_qty: number };

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
  active: { label: 'Ativo', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  returned: { label: 'Devolvido', color: 'bg-green-100 text-green-700 border-green-200' },
  partial: { label: 'Parcial', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export default function EmprestimosPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'returned'>('all');

  // New loan dialog
  const [newDialog, setNewDialog] = useState(false);
  const [nForm, setNForm] = useState({ event_name: '', responsible: '', date_out: new Date().toISOString().split('T')[0], notes: '' });
  const [nItems, setNItems] = useState<{ material_item_id: string; qty_out: number }[]>([{ material_item_id: '', qty_out: 1 }]);
  const [saving, setSaving] = useState(false);

  // Return dialog
  const [returnDialog, setReturnDialog] = useState(false);
  const [returnLoan, setReturnLoan] = useState<Loan | null>(null);
  const [returnItems, setReturnItems] = useState<LoanItem[]>([]);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returning, setReturning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [loansRes, itemsRes] = await Promise.all([
      supabase.from('material_loans' as any).select('*').order('date_out', { ascending: false }),
      supabase.from('material_items' as any).select('id, name, unit, available_qty').order('name'),
    ]);
    const rawLoans = (loansRes.data || []) as any[];
    if (itemsRes.data) setMaterialItems(itemsRes.data as MaterialItem[]);

    // Load loan items for each loan
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

  // ── New Loan ──
  const handleNewLoan = async () => {
    if (!nForm.event_name.trim()) { toast.error('Nome do evento é obrigatório'); return; }
    const validItems = nItems.filter(i => i.material_item_id && i.qty_out > 0);
    if (validItems.length === 0) { toast.error('Adicione ao menos um item'); return; }
    setSaving(true);
    try {
      const { data: loan, error: loanErr } = await supabase
        .from('material_loans' as any)
        .insert({
          event_name: nForm.event_name.trim(),
          responsible: nForm.responsible.trim() || null,
          date_out: nForm.date_out,
          notes: nForm.notes.trim() || null,
          status: 'active',
        })
        .select().single();
      if (loanErr || !loan) throw loanErr || new Error('Erro ao criar empréstimo');

      const { error: itemsErr } = await supabase.from('material_loan_items' as any).insert(
        validItems.map(i => ({ loan_id: (loan as any).id, material_item_id: i.material_item_id, qty_out: i.qty_out, qty_returned: 0, qty_damaged: 0 }))
      );
      if (itemsErr) throw itemsErr;

      // Decrease available_qty for each item
      for (const i of validItems) {
        const mat = materialItems.find(m => m.id === i.material_item_id);
        if (mat) {
          await supabase.from('material_items' as any)
            .update({ available_qty: Math.max(0, mat.available_qty - i.qty_out) })
            .eq('id', i.material_item_id);
        }
      }

      toast.success('Empréstimo registrado!');
      setNewDialog(false);
      setNForm({ event_name: '', responsible: '', date_out: new Date().toISOString().split('T')[0], notes: '' });
      setNItems([{ material_item_id: '', qty_out: 1 }]);
      load();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Tente novamente'));
    }
    setSaving(false);
  };

  // ── Return ──
  const openReturn = (loan: Loan) => {
    setReturnLoan(loan);
    setReturnItems(loan.items.map(i => ({ ...i, qty_returned: i.qty_out - i.qty_returned, qty_damaged: 0 })));
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnDialog(true);
  };

  const handleReturn = async () => {
    if (!returnLoan) return;
    setReturning(true);
    try {
      for (const ri of returnItems) {
        if (!ri.id) continue;
        const original = returnLoan.items.find(i => i.id === ri.id);
        const prevReturned = original?.qty_returned ?? 0;
        await supabase.from('material_loan_items' as any).update({
          qty_returned: prevReturned + ri.qty_returned,
          qty_damaged: (original?.qty_damaged ?? 0) + ri.qty_damaged,
        }).eq('id', ri.id);

        // Update available_qty and damaged_qty
        const mat = materialItems.find(m => m.id === ri.material_item_id);
        if (mat) {
          await supabase.from('material_items' as any).update({
            available_qty: mat.available_qty + ri.qty_returned,
            damaged_qty: ri.qty_damaged,
          }).eq('id', ri.material_item_id);
        }
      }

      // Determine new status
      const totalOut = returnLoan.items.reduce((s, i) => s + i.qty_out, 0);
      const totalReturned = returnItems.reduce((s, i) => s + i.qty_returned, 0) +
        returnLoan.items.reduce((s, i) => s + i.qty_returned, 0);
      const newStatus = totalReturned >= totalOut ? 'returned' : 'partial';

      await supabase.from('material_loans' as any).update({
        status: newStatus,
        date_return: returnDate,
      }).eq('id', returnLoan.id);

      toast.success(newStatus === 'returned' ? 'Devolução total registrada!' : 'Devolução parcial registrada!');
      setReturnDialog(false);
      load();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Tente novamente'));
    }
    setReturning(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este empréstimo?')) return;
    await supabase.from('material_loans' as any).delete().eq('id', id);
    toast.success('Empréstimo removido');
    load();
  };

  const filtered = loans.filter(l => filter === 'all' || l.status === filter || (filter === 'active' && l.status === 'partial'));
  const activeCount = loans.filter(l => l.status === 'active' || l.status === 'partial').length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold gold-text">Empréstimos</h1>
            <p className="text-muted-foreground mt-0.5">
              {activeCount > 0
                ? <span>{activeCount} empréstimo{activeCount !== 1 ? 's' : ''} ativo{activeCount !== 1 ? 's' : ''}</span>
                : 'Nenhum empréstimo ativo'}
            </p>
          </div>
        </div>
        <Button onClick={() => setNewDialog(true)} className="gold-button">
          <Plus className="w-4 h-4 mr-2" />Novo Empréstimo
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
          <p className="font-medium">Nenhum empréstimo encontrado</p>
          <p className="text-sm mt-1">Registre a saída de materiais para eventos</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs whitespace-nowrap">DATA SAÍDA</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs w-full min-w-[180px]">EVENTO</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs whitespace-nowrap">RESPONSÁVEL</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs">ITENS</th>
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">STATUS</th>
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs w-28">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(loan => {
                  const st = STATUS_LABEL[loan.status] || STATUS_LABEL.active;
                  return (
                    <tr key={loan.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {new Date(loan.date_out + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {loan.date_return && (
                          <div className="text-[10px] text-green-600 mt-0.5">
                            Dev: {new Date(loan.date_return + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-medium text-foreground">{loan.event_name}</td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{loan.responsible || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="space-y-0.5">
                          {loan.items.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                          {loan.items.map((li, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{li.qty_out}x</span> {li.item_name}
                              {li.qty_returned > 0 && (
                                <span className="text-green-600 ml-1">(dev: {li.qty_returned + (loan.items.find(i => i.id === li.id)?.qty_returned ?? 0)})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {loan.status !== 'returned' && (
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => openReturn(loan)}>
                              <RotateCcw className="w-3 h-3 mr-1" />Devolver
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleDelete(loan.id)}>
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

      {/* New Loan Dialog */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Empréstimo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Evento *</Label>
              <Input className="mt-1" placeholder="Ex: Casamento Silva" value={nForm.event_name} onChange={e => setNForm(f => ({ ...f, event_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Input className="mt-1" placeholder="Nome..." value={nForm.responsible} onChange={e => setNForm(f => ({ ...f, responsible: e.target.value }))} />
              </div>
              <div>
                <Label>Data de Saída</Label>
                <Input className="mt-1" type="date" value={nForm.date_out} onChange={e => setNForm(f => ({ ...f, date_out: e.target.value }))} />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setNItems(prev => [...prev, { material_item_id: '', qty_out: 1 }])}>
                  <Plus className="w-3 h-3 mr-1" />Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {nItems.map((ni, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      className="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={ni.material_item_id}
                      onChange={e => setNItems(prev => prev.map((p, i) => i === idx ? { ...p, material_item_id: e.target.value } : p))}
                    >
                      <option value="">Selecionar item...</option>
                      {materialItems.map(m => (
                        <option key={m.id} value={m.id}>{m.name} (disp: {m.available_qty} {m.unit})</option>
                      ))}
                    </select>
                    <Input
                      type="number" min={1} className="w-20"
                      value={ni.qty_out}
                      onChange={e => setNItems(prev => prev.map((p, i) => i === idx ? { ...p, qty_out: Number(e.target.value) } : p))}
                    />
                    <Button variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0"
                      onClick={() => setNItems(prev => prev.filter((_, i) => i !== idx))}>
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea className="mt-1" rows={2} placeholder="Notas..." value={nForm.notes} onChange={e => setNForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNewDialog(false)}>Cancelar</Button>
              <Button onClick={handleNewLoan} disabled={saving} className="gold-button">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Registrar Saída
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialog} onOpenChange={setReturnDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Devolução — {returnLoan?.event_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Data de Devolução</Label>
              <Input className="mt-1" type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-2 block">Itens devolvidos</Label>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-semibold">ITEM</th>
                      <th className="text-center px-2 py-2 text-xs text-muted-foreground font-semibold">SAIU</th>
                      <th className="text-center px-2 py-2 text-xs text-muted-foreground font-semibold">VOLTOU</th>
                      <th className="text-center px-2 py-2 text-xs text-muted-foreground font-semibold">DANIF.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {returnItems.map((ri, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-sm font-medium">{ri.item_name}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{ri.qty_out}</td>
                        <td className="px-2 py-2">
                          <Input type="number" min={0} max={ri.qty_out} className="w-16 text-center h-7 text-sm"
                            value={ri.qty_returned}
                            onChange={e => setReturnItems(prev => prev.map((p, i) => i === idx ? { ...p, qty_returned: Number(e.target.value) } : p))} />
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" min={0} className="w-16 text-center h-7 text-sm"
                            value={ri.qty_damaged}
                            onChange={e => setReturnItems(prev => prev.map((p, i) => i === idx ? { ...p, qty_damaged: Number(e.target.value) } : p))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReturnDialog(false)}>Cancelar</Button>
              <Button onClick={handleReturn} disabled={returning} className="gold-button">
                {returning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Confirmar Devolução
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
