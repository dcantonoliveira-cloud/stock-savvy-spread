import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ClipboardCheck, Plus, AlertTriangle, Loader2, ChevronRight, Users,
  CheckCircle2, Clock, TrendingDown, PackageCheck,
} from 'lucide-react';
import { toast } from 'sonner';

type Employee = { user_id: string; display_name: string };
type CategoryInfo = { name: string; count: number };
type InventoryCount = {
  id: string; status: string; notes: string | null;
  created_at: string; completed_at: string | null;
  total_items: number; counted_items: number;
};

export default function InventoryPage() {
  const [history, setHistory] = useState<InventoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);

  // New count dialog
  const [newCountOpen, setNewCountOpen] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // category → user_id
  const [creating, setCreating] = useState(false);

  // Detail dialog
  const [detailCountId, setDetailCountId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [applying, setApplying] = useState(false);
  const detailCount = history.find(h => h.id === detailCountId);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [histRes, empRes, catRes] = await Promise.all([
      supabase.from('inventory_counts' as any).select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('user_id, display_name').order('display_name'),
      supabase.from('stock_items').select('category').order('category'),
    ]);

    if (empRes.data) setEmployees(empRes.data as Employee[]);

    // Build unique categories with item count
    if (catRes.data) {
      const map: Record<string, number> = {};
      (catRes.data as any[]).forEach(r => {
        const c = r.category || 'Outros';
        map[c] = (map[c] || 0) + 1;
      });
      setCategories(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count })));
    }

    if (histRes.data) {
      // Enrich with progress
      const counts = histRes.data as any[];
      const enriched = await Promise.all(counts.map(async c => {
        const { count: total } = await supabase.from('inventory_count_items' as any).select('*', { count: 'exact', head: true }).eq('count_id', c.id);
        const { count: counted } = await supabase.from('inventory_count_items' as any).select('*', { count: 'exact', head: true }).eq('count_id', c.id).not('counted_stock', 'is', null);
        return { ...c, total_items: total || 0, counted_items: counted || 0 };
      }));
      setHistory(enriched as InventoryCount[]);
    }

    setLoading(false);
  };

  const handleCreate = async () => {
    if (categories.length === 0) { toast.error('Nenhuma categoria encontrada'); return; }
    setCreating(true);
    try {
      // Create count
      const { data: countData, error: countErr } = await supabase
        .from('inventory_counts' as any)
        .insert({ status: 'in_progress' })
        .select('id').single();
      if (countErr || !countData) throw countErr;
      const cId = (countData as any).id;

      // Fetch all items
      const { data: allItems } = await supabase.from('stock_items').select('id, category, current_stock');
      if (!allItems) throw new Error('no items');

      // Insert count items with assigned_user_id per category
      const countItemsData = (allItems as any[]).map(item => ({
        count_id: cId,
        item_id: item.id,
        system_stock: item.current_stock ?? 0,
        assigned_user_id: assignments[item.category || 'Outros'] || null,
      }));

      const { error: insertErr } = await supabase.from('inventory_count_items' as any).insert(countItemsData);
      if (insertErr) {
        // Cleanup orphan count
        await supabase.from('inventory_counts' as any).delete().eq('id', cId);
        if (insertErr.message?.includes('assigned_user_id')) {
          toast.error('Execute a migração SQL antes de usar esta funcionalidade. Ver console para instruções.');
          console.warn('SQL needed:\nALTER TABLE inventory_count_items ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id);');
        } else {
          toast.error('Erro ao criar contagem: ' + insertErr.message);
        }
        setCreating(false);
        return;
      }

      toast.success('Contagem criada! Os funcionários já podem contar no app deles.');
      setNewCountOpen(false);
      setAssignments({});
      load();
    } catch (e: any) {
      toast.error('Erro ao criar contagem');
      console.error(e);
    }
    setCreating(false);
  };

  const openDetail = async (countId: string) => {
    setDetailCountId(countId);
    setLoadingDetail(true);
    const { data } = await supabase
      .from('inventory_count_items' as any)
      .select('*, stock_items:item_id(name, unit, category)' as any)
      .eq('count_id', countId)
      .not('counted_stock', 'is', null)
      .order('counted_stock', { ascending: false });
    setDetailItems((data as any[]) || []);
    setLoadingDetail(false);
  };

  const handleApplyToStock = async () => {
    if (!detailCountId) return;
    setApplying(true);
    try {
      // Fetch ALL counted items for this count
      const { data } = await supabase
        .from('inventory_count_items' as any)
        .select('item_id, counted_stock')
        .eq('count_id', detailCountId)
        .not('counted_stock', 'is', null);

      if (!data || (data as any[]).length === 0) {
        toast.error('Nenhum item foi contado ainda');
        setApplying(false);
        return;
      }

      // Sum counted_stock per item_id (multiple people may have counted the same item)
      const grouped: Record<string, number> = {};
      for (const row of data as any[]) {
        grouped[row.item_id] = (grouped[row.item_id] || 0) + (row.counted_stock ?? 0);
      }

      // Update stock_items.current_stock for each item
      for (const [itemId, total] of Object.entries(grouped)) {
        await supabase
          .from('stock_items')
          .update({ current_stock: total } as any)
          .eq('id', itemId);
      }

      // Mark count as completed
      await supabase
        .from('inventory_counts' as any)
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', detailCountId);

      toast.success(`Estoque atualizado para ${Object.keys(grouped).length} insumos!`);
      setDetailCountId(null);
      setDetailItems([]);
      load();
    } catch (e: any) {
      toast.error('Erro ao aplicar ao estoque');
      console.error(e);
    }
    setApplying(false);
  };

  const discrepancies = detailItems.filter(d => d.counted_stock !== null && d.counted_stock !== d.system_stock);
  const matching = detailItems.filter(d => d.counted_stock !== null && d.counted_stock === d.system_stock);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Inventários</h1>
          <p className="text-muted-foreground mt-1 text-sm">Contagem física do estoque por funcionário</p>
        </div>
        <Button onClick={() => setNewCountOpen(true)} className="gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />Nova Contagem
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground">DATA</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">ITENS</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">PROGRESSO</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">STATUS</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[30, 15, 30, 15, 5].map((w, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-muted-foreground">
                  <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma contagem realizada ainda.</p>
                </td>
              </tr>
            ) : history.map(h => {
              const pct = h.total_items > 0 ? Math.round((h.counted_items / h.total_items) * 100) : 0;
              const isComplete = h.status === 'completed';
              return (
                <tr key={h.id}
                  className="hover:bg-amber-50/30 transition-colors cursor-pointer"
                  onClick={() => openDetail(h.id)}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">
                          {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-muted-foreground">
                    {h.counted_items}/{h.total_items}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-border/60 rounded-full overflow-hidden max-w-[120px]">
                        <div
                          className={`h-full rounded-full transition-all ${isComplete ? 'bg-success' : 'bg-primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {isComplete ? (
                      <Badge className="bg-success/10 text-success border-success/20 gap-1 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />Concluída
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                        <Clock className="w-3 h-3" />Em andamento
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground/40">
                    <ChevronRight className="w-4 h-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New Count Dialog */}
      <Dialog open={newCountOpen} onOpenChange={o => { if (!o) { setNewCountOpen(false); setAssignments({}); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />Nova Contagem de Inventário
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Atribua cada categoria a um funcionário. Eles verão a tarefa no app deles.</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">CATEGORIA</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground w-16">ITENS</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">RESPONSÁVEL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {categories.map(cat => (
                  <tr key={cat.name}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{cat.name}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground text-xs">{cat.count}</td>
                    <td className="px-3 py-2">
                      <Select
                        value={assignments[cat.name] || 'unassigned'}
                        onValueChange={v => setAssignments(prev => ({ ...prev, [cat.name]: v === 'unassigned' ? '' : v }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Sem responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Sem responsável</SelectItem>
                          {employees.map(e => (
                            <SelectItem key={e.user_id} value={e.user_id}>{e.display_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border pt-4 flex gap-2">
            <Button className="flex-1 gap-2" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Criar Contagem
            </Button>
            <Button variant="outline" onClick={() => { setNewCountOpen(false); setAssignments({}); }}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail / Comparison Dialog */}
      <Dialog open={detailCountId !== null} onOpenChange={o => { if (!o) { setDetailCountId(null); setDetailItems([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Resultado da Contagem</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
          ) : detailItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Nenhum item contado ainda.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="font-semibold text-destructive">{discrepancies.length}</span>
                  <span className="text-muted-foreground">divergência{discrepancies.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="font-semibold text-success">{matching.length}</span>
                  <span className="text-muted-foreground">OK</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs sticky top-0 bg-white" style={{ background: 'hsl(40 30% 97%)' }}>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">INSUMO</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">CATEGORIA</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">SISTEMA</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">CONTADO</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">DIFERENÇA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {detailItems.map(d => {
                      const diff = (d.counted_stock ?? 0) - d.system_stock;
                      const ok = diff === 0;
                      return (
                        <tr key={d.id} className={!ok ? 'bg-red-50/40' : ''}>
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {d.stock_items?.name || '—'}
                            <span className="text-muted-foreground text-xs ml-1">({d.stock_items?.unit})</span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">{d.stock_items?.category}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{d.system_stock}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">{d.counted_stock}</td>
                          <td className="px-4 py-2.5 text-right">
                            {ok ? (
                              <span className="text-success text-xs">✓ ok</span>
                            ) : (
                              <span className={`font-semibold text-xs flex items-center gap-1 justify-end ${diff > 0 ? 'text-success' : 'text-destructive'}`}>
                                <TrendingDown className={`w-3 h-3 ${diff > 0 ? 'rotate-180' : ''}`} />
                                {diff > 0 ? '+' : ''}{diff}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {detailCount?.status !== 'completed' && (
                <div className="border-t border-border pt-4 mt-2">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-3 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-semibold">Atenção: esta ação é irreversível</p>
                      <p className="mt-0.5">O estoque será substituído pela quantidade contada. Se mais de uma pessoa contou o mesmo item, os valores são somados (ex: cozinha 1 + cozinha 2).</p>
                    </div>
                  </div>
                  <Button
                    className="w-full h-11 gap-2"
                    onClick={handleApplyToStock}
                    disabled={applying}
                  >
                    {applying
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <PackageCheck className="w-4 h-4" />
                    }
                    Aplicar ao Estoque
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
