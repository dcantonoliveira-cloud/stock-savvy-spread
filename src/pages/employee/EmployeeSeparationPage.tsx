import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ListChecks, ArrowLeft, ChevronRight, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { fmtNum } from '@/lib/format';

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

interface SepList {
  id: string;
  name: string;
  event_id: string | null;
  event_name?: string | null;
  status: 'draft' | 'in_progress' | 'done';
  created_at: string;
}

interface SepItemRow {
  id: string;
  raw_name: string;
  raw_unit: string | null;
  item_id: string | null;
  item_name?: string | null;
  requested_qty: number | null;
  separated_qty: number | null;
  note: string | null;
}

export default function EmployeeSeparationPage() {
  const { user, profile } = useAuth();
  const [lists, setLists] = useState<SepList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<SepItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)('separation_lists')
      .select('id, name, event_id, status, created_at, events(event_name)')
      .eq('company_id', COMPANY_ID)
      .in('status', ['in_progress', 'done'])
      .order('created_at', { ascending: false });
    setLists((data ?? []).map((l: any) => ({ ...l, event_name: l.events?.event_name ?? null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openList = async (id: string) => {
    setSelectedId(id);
    setItemsLoading(true);
    const { data } = await (supabase.from as any)('separation_list_items')
      .select('id, raw_name, raw_unit, item_id, requested_qty, separated_qty, note, stock_items(name)')
      .eq('list_id', id).order('sort_order');
    setItems((data ?? []).map((r: any) => ({ ...r, item_name: r.stock_items?.name ?? null })));
    setItemsLoading(false);
  };

  const setQty = (id: string, val: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, separated_qty: val === '' ? null : parseFloat(val) } : i));
  };

  const setNote = (id: string, val: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, note: val || null } : i));
  };

  const selectedList = lists.find(l => l.id === selectedId) ?? null;
  const doneCount = items.filter(i => i.separated_qty != null).length;

  const finalize = async () => {
    if (!selectedId || !user) return;
    const toRegister = items.filter(i => i.item_id && i.separated_qty != null && i.separated_qty > 0);
    if (toRegister.length === 0) { toast.error('Confirme a quantidade separada de pelo menos um item'); return; }
    setFinishing(true);

    for (const line of items) {
      await (supabase.from as any)('separation_list_items')
        .update({ separated_qty: line.separated_qty, note: line.note, separated_at: line.separated_qty != null ? new Date().toISOString() : null, separated_by: user.id })
        .eq('id', line.id);
    }

    let hasError = false;
    const today = new Date().toISOString().split('T')[0];
    for (const line of toRegister) {
      const noteText = [`Separação: ${selectedList?.name ?? ''}`, line.note].filter(Boolean).join(' — ');
      const { error } = await (supabase.from as any)('stock_outputs').insert({
        item_id: line.item_id, quantity: line.separated_qty,
        notes: noteText, employee_name: profile?.display_name || user.email || 'Funcionário',
        date: today, registered_by: user.id,
      });
      if (error) { console.error(error); hasError = true; }
    }

    await (supabase.from as any)('separation_lists').update({ status: 'done', finalized_at: new Date().toISOString() }).eq('id', selectedId);

    setFinishing(false);
    if (hasError) toast.error('Alguns itens tiveram erro ao dar baixa. Verifique com o supervisor.');
    else toast.success('Separação concluída! Estoque atualizado.');
    setSelectedId(null);
    load();
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  if (selectedId) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div>
          <h1 className="text-lg font-bold text-foreground">{selectedList?.name}</h1>
          {selectedList?.event_name && <p className="text-sm text-muted-foreground">{selectedList.event_name}</p>}
          <p className="text-xs text-muted-foreground mt-1">{doneCount}/{items.length} confirmados</p>
        </div>

        {itemsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-2.5">
            {items.map(row => {
              const confirmed = row.separated_qty != null;
              const under = confirmed && row.requested_qty != null && row.separated_qty! < row.requested_qty;
              return (
                <div key={row.id}
                  className={`bg-white rounded-2xl border p-4 transition-colors ${confirmed ? 'border-emerald-200 bg-emerald-50/40' : 'border-border'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{row.item_name ?? row.raw_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Pedido: {row.requested_qty != null ? `${fmtNum(row.requested_qty)} ${row.raw_unit ?? ''}` : 'sem quantidade definida'}
                      </p>
                    </div>
                    {confirmed && <CheckCircle2 className={`w-5 h-5 shrink-0 ${under ? 'text-amber-500' : 'text-emerald-500'}`} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" step="0.01" min="0" inputMode="decimal"
                      className="flex-1 px-3 py-2.5 rounded-xl border border-border text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Qtd. separada"
                      value={row.separated_qty ?? ''}
                      onChange={e => setQty(row.id, e.target.value)}
                    />
                    {row.requested_qty != null && (
                      <button type="button" onClick={() => setQty(row.id, String(row.requested_qty))}
                        className="px-3 py-2.5 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/40 whitespace-nowrap">
                        Bateu ({fmtNum(row.requested_qty)})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                    <input
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border/60 bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Observação (opcional)"
                      value={row.note ?? ''}
                      onChange={e => setNote(row.id, e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={finalize} disabled={finishing || selectedList?.status === 'done'}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 sticky bottom-20">
          {finishing ? 'Finalizando...' : selectedList?.status === 'done' ? 'Já finalizada' : 'Finalizar separação e dar baixa'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Separação</h1>
        <p className="text-sm text-muted-foreground">Listas de insumos pra separar pros eventos.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : lists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhuma lista de separação no momento.</div>
      ) : (
        <div className="space-y-2.5">
          {lists.map(l => (
            <button key={l.id} onClick={() => openList(l.id)}
              className="w-full bg-white rounded-2xl border border-border p-4 flex items-center gap-3 text-left hover:border-primary/40 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ListChecks className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  {l.event_name ? `${l.event_name} · ` : ''}{fmtDate(l.created_at)}
                  {l.status === 'done' ? ' · Concluída' : ''}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
