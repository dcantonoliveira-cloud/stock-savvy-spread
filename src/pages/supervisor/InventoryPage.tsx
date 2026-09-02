import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  ClipboardCheck, Plus, AlertTriangle, Loader2, ChevronRight, Users,
  CheckCircle2, Clock, TrendingDown, PackageCheck, UserPlus, Trash2, Settings, Eye,
} from 'lucide-react';
import { toast } from 'sonner';

type Employee = { user_id: string; display_name: string };
type InventoryGroup = { id: string; name: string; member_count: number; members: Employee[] };
type AssigneeRow = {
  label: string;
  type: 'user' | 'group' | 'unassigned';
  id: string | null;
  item_count: number;
};
type InventoryCount = {
  id: string; status: string; notes: string | null;
  created_at: string; completed_at: string | null;
  total_items: number; counted_items: number;
  inventory_value: number;
};

export default function InventoryPage() {
  const { profile } = useAuth();
  const [history, setHistory] = useState<InventoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [detailSearch, setDetailSearch] = useState('');

  // New count dialog
  const [newCountOpen, setNewCountOpen] = useState(false);
  const [assigneeRows, setAssigneeRows] = useState<AssigneeRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({}); // rowKey → 'user:uuid' | 'group:uuid' | 'none'
  const [creating, setCreating] = useState(false);

  // Group management dialog
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [addingMember, setAddingMember] = useState<string | null>(null); // group id
  const [selectedMember, setSelectedMember] = useState('');

  // Employee preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLabel, setPreviewLabel] = useState('');
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Detail dialog
  const [detailCountId, setDetailCountId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [applying, setApplying] = useState(false);
  const [zeroUncounted, setZeroUncounted] = useState(false);
  const [editingDetailItem, setEditingDetailItem] = useState<string | null>(null);
  const [editingDetailValue, setEditingDetailValue] = useState('');
  const detailCount = history.find(h => h.id === detailCountId);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [histRes, empRes, groupsRes, membersRes] = await Promise.all([
      supabase.from('inventory_counts' as any).select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('user_id, display_name').order('display_name'),
      (supabase as any).from('inventory_groups').select('id, name').order('name'),
      (supabase as any).from('inventory_group_members').select('group_id, user_id'),
    ]);

    const empList: Employee[] = empRes.data ?? [];
    if (empRes.data) setEmployees(empList);

    if (groupsRes.data) {
      const empMap = Object.fromEntries(empList.map((e: Employee) => [e.user_id, e.display_name]));
      const membersByGroup: Record<string, Employee[]> = {};
      for (const m of (membersRes.data ?? []) as any[]) {
        if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
        membersByGroup[m.group_id].push({ user_id: m.user_id, display_name: empMap[m.user_id] ?? 'Desconhecido' });
      }
      const g: InventoryGroup[] = (groupsRes.data as any[]).map((row: any) => ({
        id: row.id,
        name: row.name,
        member_count: membersByGroup[row.id]?.length ?? 0,
        members: membersByGroup[row.id] ?? [],
      }));
      setGroups(g);
    }

    if (histRes.data) {
      const counts = histRes.data as any[];
      const enriched = await Promise.all(counts.map(async c => {
        const [{ count: total }, { count: counted }] = await Promise.all([
          (supabase.from('inventory_count_items' as any) as any).select('*', { count: 'exact', head: true }).eq('count_id', c.id),
          (supabase.from('inventory_count_items' as any) as any).select('*', { count: 'exact', head: true }).eq('count_id', c.id).not('counted_stock', 'is', null),
        ]);
        // Concluído: usa o valor congelado no momento da conclusão (imune a mudanças futuras de preço).
        // Em andamento: calcula ao vivo com os preços atuais.
        let inventory_value = c.final_value;
        if (c.status !== 'completed' || inventory_value === null || inventory_value === undefined) {
          const { data: valueRows } = await (supabase as any).from('inventory_count_items')
            .select('counted_stock, stock_items:item_id(unit_cost, purchase_qty)')
            .eq('count_id', c.id).not('counted_stock', 'is', null);
          inventory_value = ((valueRows || []) as any[]).reduce((s: number, r: any) => {
            const uc = r.stock_items?.unit_cost ?? 0;
            const pq = Math.max(1, r.stock_items?.purchase_qty ?? 1);
            return s + Number(r.counted_stock) * (uc / pq);
          }, 0);
        }
        return { ...c, total_items: total || 0, counted_items: counted || 0, inventory_value };
      }));
      setHistory(enriched as InventoryCount[]);
    }

    setLoading(false);
  };

  const openNewCount = async () => {
    const [{ data: items }, { data: respData }, { data: empData }, { data: grpData }] = await Promise.all([
      (supabase as any).from('stock_items').select('id'),
      (supabase as any).from('stock_item_responsibles').select('item_id, user_id, group_id'),
      supabase.from('profiles').select('user_id, display_name'),
      (supabase as any).from('inventory_groups').select('id, name'),
    ]);

    const empMap = Object.fromEntries(((empData ?? []) as Employee[]).map(e => [e.user_id, e.display_name]));
    const grpLabelMap = Object.fromEntries(((grpData ?? []) as any[]).map(g => [g.id, g.name]));

    const respByItem: Record<string, { user_id: string | null; group_id: string | null }[]> = {};
    for (const r of (respData || []) as any[]) {
      if (!respByItem[r.item_id]) respByItem[r.item_id] = [];
      respByItem[r.item_id].push({ user_id: r.user_id, group_id: r.group_id });
    }

    const userMap: Record<string, { label: string; count: number }> = {};
    const grpMap: Record<string, { label: string; count: number }> = {};
    let unassigned = 0;

    for (const item of (items || []) as any[]) {
      const resp = respByItem[item.id] || [];
      if (resp.length === 0) { unassigned++; continue; }
      for (const r of resp) {
        if (r.user_id) {
          if (!userMap[r.user_id]) userMap[r.user_id] = { label: empMap[r.user_id] ?? r.user_id, count: 0 };
          userMap[r.user_id].count++;
        } else if (r.group_id) {
          if (!grpMap[r.group_id]) grpMap[r.group_id] = { label: grpLabelMap[r.group_id] ?? r.group_id, count: 0 };
          grpMap[r.group_id].count++;
        }
      }
    }

    const rows: AssigneeRow[] = [
      ...Object.entries(userMap).map(([id, v]) => ({ label: v.label, type: 'user' as const, id, item_count: v.count })),
      ...Object.entries(grpMap).map(([id, v]) => ({ label: v.label, type: 'group' as const, id, item_count: v.count })),
      ...(unassigned > 0 ? [{ label: 'Sem responsável', type: 'unassigned' as const, id: null, item_count: unassigned }] : []),
    ];

    setAssigneeRows(rows);
    setOverrides({});
    setNewCountOpen(true);
  };

  const rowKey = (r: AssigneeRow) => `${r.type}:${r.id ?? 'none'}`;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data: countData, error: countErr } = await supabase
        .from('inventory_counts' as any)
        .insert({ status: 'in_progress' })
        .select('id').single();
      if (countErr || !countData) throw countErr;
      const cId = (countData as any).id;

      const [{ data: allItems }, { data: allResp }] = await Promise.all([
        (supabase as any).from('stock_items').select('id, current_stock'),
        (supabase as any).from('stock_item_responsibles').select('item_id, user_id, group_id'),
      ]);
      if (!allItems) throw new Error('no items');

      const respByItem: Record<string, { user_id: string | null; group_id: string | null }[]> = {};
      for (const r of (allResp || []) as any[]) {
        if (!respByItem[r.item_id]) respByItem[r.item_id] = [];
        respByItem[r.item_id].push({ user_id: r.user_id, group_id: r.group_id });
      }

      // Build override maps
      const userOverride: Record<string, string | null> = {};
      const grpOverride: Record<string, string | null> = {};
      for (const row of assigneeRows) {
        const ov = overrides[rowKey(row)];
        if (!ov || ov === '__default__') continue;
        const [type, id] = ov.split(':');
        if (row.type === 'user' && row.id) {
          userOverride[row.id] = type === 'user' ? id : null;
        } else if (row.type === 'group' && row.id) {
          grpOverride[row.id] = type === 'group' ? id : null;
        }
      }

      // Resolve responsáveis finais (com overrides aplicados) por item
      const finalRespByIdx: { user_id: string | null; group_id: string | null }[][] = [];
      const countItemsData = (allItems as any[]).map(item => {
        let resp = respByItem[item.id] || [];
        resp = resp
          .map(r => {
            if (r.user_id && userOverride[r.user_id] !== undefined) {
              const ov = userOverride[r.user_id];
              return ov ? { user_id: ov, group_id: null } : null;
            }
            if (r.group_id && grpOverride[r.group_id] !== undefined) {
              const ov = grpOverride[r.group_id];
              return ov ? { user_id: null, group_id: ov } : null;
            }
            return r;
          })
          .filter((r): r is { user_id: string | null; group_id: string | null } => r !== null);
        finalRespByIdx.push(resp);

        return {
          count_id: cId,
          item_id: item.id,
          system_stock: item.current_stock ?? 0,
          // Mantém 1º responsável nas colunas legadas (compat) — os demais vão na tabela de assignees
          assigned_user_id: resp[0]?.user_id ?? null,
          assigned_group_id: resp[0]?.group_id ?? null,
        };
      });

      const { data: insertedItems, error: insertErr } = await supabase.from('inventory_count_items' as any).insert(countItemsData).select('id');
      if (insertErr || !insertedItems) {
        await supabase.from('inventory_counts' as any).delete().eq('id', cId);
        toast.error('Erro ao criar contagem: ' + insertErr?.message);
        setCreating(false);
        return;
      }

      // Fan-out: grava TODOS os responsáveis (inclusive extras além do 1º) na tabela de assignees
      const assigneeRowsToInsert: { count_item_id: string; user_id: string | null; group_id: string | null }[] = [];
      (insertedItems as any[]).forEach((row, idx) => {
        for (const r of finalRespByIdx[idx]) {
          assigneeRowsToInsert.push({ count_item_id: row.id, user_id: r.user_id, group_id: r.group_id });
        }
      });
      if (assigneeRowsToInsert.length > 0) {
        await supabase.from('inventory_count_item_assignees' as any).insert(assigneeRowsToInsert);
      }

      toast.success('Contagem criada! Os funcionários já podem contar no app deles.');
      setNewCountOpen(false);
      setOverrides({});
      load();
    } catch (e: any) {
      toast.error('Erro ao criar contagem');
      console.error(e);
    }
    setCreating(false);
  };

  const handleDeleteCount = async (id: string) => {
    if (!confirm('Excluir este inventário? Esta ação não pode ser desfeita.')) return;
    await supabase.from('inventory_count_items' as any).delete().eq('count_id', id);
    await supabase.from('inventory_counts' as any).delete().eq('id', id);
    toast.success('Inventário excluído');
    load();
  };

  const openPreview = async (row: AssigneeRow) => {
    setPreviewLabel(row.label);
    setPreviewItems([]);
    setPreviewOpen(true);
    setLoadingPreview(true);

    const { data: activeCounts } = await (supabase as any)
      .from('inventory_counts').select('id').eq('status', 'in_progress');
    const activeIds = (activeCounts || []).map((c: any) => c.id);
    if (!activeIds.length) { setLoadingPreview(false); return; }

    let q = (supabase as any)
      .from('inventory_count_items')
      .select('id, counted_stock, system_stock, stock_items:item_id(name, unit, category)')
      .in('count_id', activeIds);

    if (row.type === 'user' && row.id) {
      q = q.eq('assigned_user_id', row.id);
    } else if (row.type === 'group' && row.id) {
      q = q.eq('assigned_group_id', row.id);
    } else {
      q = q.is('assigned_user_id', null).is('assigned_group_id', null);
    }

    const { data } = await q.order('counted_stock', { ascending: true, nullsFirst: true });
    setPreviewItems((data || []) as any[]);
    setLoadingPreview(false);
  };

  const openDetail = async (countId: string) => {
    setDetailCountId(countId);
    setLoadingDetail(true);

    const [{ data: items }, { data: entries }, { data: profiles }] = await Promise.all([
      (supabase as any)
        .from('inventory_count_items')
        .select('*, stock_items:item_id(name, unit, category, unit_cost, purchase_qty)')
        .eq('count_id', countId)
        .not('counted_stock', 'is', null)
        .order('counted_stock', { ascending: false }),
      (supabase as any)
        .from('inventory_count_entries')
        .select('count_item_id, user_id, quantity'),
      supabase.from('profiles').select('user_id, display_name'),
    ]);

    const profileMap: Record<string, string> = Object.fromEntries(
      ((profiles || []) as any[]).map((p: any) => [p.user_id, p.display_name])
    );
    // group entries by count_item_id
    const entriesByItem: Record<string, { name: string; qty: number }[]> = {};
    for (const e of (entries || []) as any[]) {
      if (!entriesByItem[e.count_item_id]) entriesByItem[e.count_item_id] = [];
      entriesByItem[e.count_item_id].push({ name: profileMap[e.user_id] ?? 'Desconhecido', qty: Number(e.quantity) });
    }

    const enriched = ((items || []) as any[]).map((item: any) => ({
      ...item,
      counters: entriesByItem[item.id] ?? [],
    }));
    setDetailItems(enriched);
    setLoadingDetail(false);
  };

  const commitDetailEdit = async (itemId: string) => {
    const val = parseFloat(editingDetailValue.replace(',', '.'));
    if (isNaN(val) || val < 0) { setEditingDetailItem(null); return; }
    await (supabase as any)
      .from('inventory_count_items')
      .update({ counted_stock: val, difference: val - (detailItems.find(d => d.id === itemId)?.system_stock ?? 0) })
      .eq('id', itemId);
    setDetailItems(prev => prev.map(d => d.id === itemId ? { ...d, counted_stock: val, difference: val - d.system_stock } : d));
    setEditingDetailItem(null);
  };

  const handleApplyToStock = async () => {
    if (!detailCountId) return;
    setApplying(true);
    try {
      // Fetch all items in this count
      const { data: allRows } = await supabase
        .from('inventory_count_items' as any)
        .select('item_id, counted_stock')
        .eq('count_id', detailCountId);

      if (!allRows || (allRows as any[]).length === 0) {
        toast.error('Nenhum item foi contado ainda');
        setApplying(false);
        return;
      }

      const counted = (allRows as any[]).filter(r => r.counted_stock !== null);
      if (counted.length === 0) {
        toast.error('Nenhum item foi contado ainda');
        setApplying(false);
        return;
      }

      // Build map of counted items (summed)
      const grouped: Record<string, number> = {};
      for (const row of counted) {
        grouped[row.item_id] = (grouped[row.item_id] || 0) + (row.counted_stock ?? 0);
      }

      // Fetch current stock for all affected items to compute diff
      const allItemIds = [...new Set((allRows as any[]).map((r: any) => r.item_id))];
      const { data: currentStocks } = await (supabase as any)
        .from('stock_items').select('id, current_stock').in('id', allItemIds);
      const currentMap: Record<string, number> = Object.fromEntries(
        ((currentStocks || []) as any[]).map((i: any) => [i.id, Number(i.current_stock) || 0])
      );

      const now = new Date().toISOString();
      const who = profile?.display_name ?? 'Supervisor';
      const countLabel = `Inventário ${new Date().toLocaleDateString('pt-BR')}`;

      // Apply counted items + register movement
      for (const [itemId, total] of Object.entries(grouped)) {
        await supabase.from('stock_items').update({ current_stock: total } as any).eq('id', itemId);
        const prev = currentMap[itemId] ?? 0;
        const diff = (total as number) - prev;
        if (diff > 0) {
          await (supabase as any).from('stock_entries').insert({
            item_id: itemId, quantity: diff, unit_cost: 0, created_at: now,
            notes: `${countLabel} — por ${who}`,
          });
        } else if (diff < 0) {
          await (supabase as any).from('stock_outputs').insert({
            item_id: itemId, quantity: Math.abs(diff), created_at: now,
            employee_name: who, notes: countLabel,
          });
        } else {
          // sem diferença — registra entrada com qty 0 para constar no histórico
          await (supabase as any).from('stock_entries').insert({
            item_id: itemId, quantity: 0, unit_cost: 0, created_at: now,
            notes: `${countLabel} — sem divergência`,
          });
        }
      }

      // Zero out uncounted items if option is enabled
      if (zeroUncounted) {
        const uncounted = (allRows as any[]).filter(r => r.counted_stock === null);
        const uncountedIds = [...new Set(uncounted.map((r: any) => r.item_id))];
        for (const itemId of uncountedIds) {
          if (!grouped[itemId]) {
            await supabase.from('stock_items').update({ current_stock: 0 } as any).eq('id', itemId);
            const prev = currentMap[itemId] ?? 0;
            if (prev > 0) {
              await (supabase as any).from('stock_outputs').insert({
                item_id: itemId, quantity: prev, created_at: now,
                employee_name: who, notes: `${countLabel} — zerado (não contado)`,
              });
            }
          }
        }
      }

      // Congela o valor do inventário no momento da conclusão (imune a mudanças futuras de preço)
      const { data: finalValueRows } = await (supabase as any).from('inventory_count_items')
        .select('counted_stock, stock_items:item_id(unit_cost, purchase_qty)')
        .eq('count_id', detailCountId).not('counted_stock', 'is', null);
      const final_value = ((finalValueRows || []) as any[]).reduce((s: number, r: any) => {
        const uc = r.stock_items?.unit_cost ?? 0;
        const pq = Math.max(1, r.stock_items?.purchase_qty ?? 1);
        return s + Number(r.counted_stock) * (uc / pq);
      }, 0);

      await supabase
        .from('inventory_counts' as any)
        .update({ status: 'completed', completed_at: new Date().toISOString(), final_value })
        .eq('id', detailCountId);

      const uncountedCount = (allRows as any[]).filter(r => r.counted_stock === null).length;
      toast.success(
        `Estoque atualizado para ${Object.keys(grouped).length} insumos!` +
        (zeroUncounted && uncountedCount > 0 ? ` ${uncountedCount} itens não contados zerados.` : '')
      );
      setDetailCountId(null);
      setDetailItems([]);
      load();
    } catch (e: any) {
      toast.error('Erro ao aplicar ao estoque');
      console.error(e);
    }
    setApplying(false);
  };

  // ── Group management ──────────────────────────────────────────────────────

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    const { error } = await (supabase as any)
      .from('inventory_groups')
      .insert({ name: newGroupName.trim(), company_id: 'c56c2ccd-2c35-4ebb-b868-e153727e5d89' });
    if (error) {
      toast.error('Erro ao criar grupo: ' + error.message);
    } else {
      toast.success(`Grupo "${newGroupName.trim()}" criado!`);
      setNewGroupName('');
      load();
    }
    setCreatingGroup(false);
  };

  const handleAddMember = async (groupId: string, userId: string) => {
    const { error } = await (supabase as any)
      .from('inventory_group_members')
      .insert({ group_id: groupId, user_id: userId });
    if (error) {
      toast.error('Erro ao adicionar membro');
    } else {
      setSelectedMember('');
      setAddingMember(null);
      load();
    }
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    await (supabase as any)
      .from('inventory_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
    load();
  };

  const handleDeleteGroup = async (groupId: string) => {
    await (supabase as any).from('inventory_groups').delete().eq('id', groupId);
    load();
  };

  const discrepancies = detailItems.filter(d => d.counted_stock !== null && d.counted_stock !== d.system_stock);
  const matching = detailItems.filter(d => d.counted_stock !== null && d.counted_stock === d.system_stock);

  const assigneeOptions = [
    ...employees.map(e => ({ label: e.display_name, value: `user:${e.user_id}` })),
    ...groups.map(g => ({ label: `👥 ${g.name}`, value: `group:${g.id}` })),
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Inventários</h1>
          <p className="text-muted-foreground mt-1 text-sm">Contagem física do estoque por funcionário</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGroupsOpen(true)} className="gap-2">
            <Settings className="w-4 h-4" />Grupos
          </Button>
          <Button onClick={openNewCount} className="gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />Nova Contagem
          </Button>
        </div>
      </div>

      {/* History table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground">DATA</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">ITENS</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">PROGRESSO</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">VALOR</th>
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
                <td colSpan={6} className="px-5 py-16 text-center text-muted-foreground">
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
                  <td className="px-4 py-3.5 text-right">
                    {h.inventory_value > 0 ? (
                      <span className="text-sm font-semibold text-amber-700">
                        {h.inventory_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
                  <td className="px-2 py-3.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteCount(h.id); }}
                      className="p-1.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir inventário"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── New Count Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={newCountOpen} onOpenChange={o => { if (!o) { setNewCountOpen(false); setOverrides({}); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />Nova Contagem de Inventário
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Responsáveis pré-definidos por insumo. Ajuste se necessário.</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">RESPONSÁVEL</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground w-14">ITENS</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">MANTER / TROCAR</th>
                  <th className="w-8 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {assigneeRows.map(row => {
                  const key = rowKey(row);
                  const ov = overrides[key] || '__default__';
                  const isGroup = row.type === 'group';
                  return (
                    <tr key={key}>
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        <span className="flex items-center gap-1.5">
                          {isGroup && <Users className="w-3.5 h-3.5 text-primary" />}
                          {row.label}
                          {row.type === 'unassigned' && <span className="text-xs text-muted-foreground font-normal">(sem dono)</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground text-xs">{row.item_count}</td>
                      <td className="px-3 py-2">
                        {row.type !== 'unassigned' ? (
                          <Select value={ov} onValueChange={v => setOverrides(prev => ({ ...prev, [key]: v }))}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Manter" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__default__">Manter padrão</SelectItem>
                              {assigneeOptions.map(o => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground px-2">livres</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => openPreview(row)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Ver itens"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border pt-4 flex gap-2">
            <Button className="flex-1 gap-2" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Criar Contagem
            </Button>
            <Button variant="outline" onClick={() => { setNewCountOpen(false); setOverrides({}); }}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Employee Preview Dialog ──────────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Itens de {previewLabel}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Contagem ativa — visão do funcionário.</p>
          </DialogHeader>
          {loadingPreview ? (
            <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" /></div>
          ) : previewItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma contagem ativa ou nenhum item atribuído.</div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {previewItems.map((item: any) => {
                const counted = item.counted_stock !== null;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {counted
                      ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                      : <Clock className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.stock_items?.name}</p>
                      <p className="text-xs text-muted-foreground">{item.stock_items?.category} · {item.stock_items?.unit}</p>
                    </div>
                    {counted ? (
                      <span className="text-sm font-bold text-success">{item.counted_stock} {item.stock_items?.unit}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">pendente</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-border pt-3 flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{previewItems.filter((i: any) => i.counted_stock !== null).length}/{previewItems.length} contados</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Groups Management Dialog ─────────────────────────────────────────── */}
      <Dialog open={groupsOpen} onOpenChange={setGroupsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />Grupos de Inventário
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Gerencie departamentos com múltiplos responsáveis.</p>
          </DialogHeader>

          {/* Create new group */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Nome do grupo (ex: Cozinha)"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
              className="flex-1"
            />
            <Button onClick={handleCreateGroup} disabled={creatingGroup || !newGroupName.trim()} className="gap-1.5">
              {creatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {groups.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Nenhum grupo criado ainda.</p>
            ) : groups.map(group => (
              <div key={group.id} className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm flex-1">{group.name}</span>
                  <span className="text-xs text-muted-foreground">{group.member_count} membro{group.member_count !== 1 ? 's' : ''}</span>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-border/50">
                  {group.members.map(m => (
                    <div key={m.user_id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {m.display_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm flex-1 text-foreground">{m.display_name}</span>
                      <button
                        onClick={() => handleRemoveMember(group.id, m.user_id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {addingMember === group.id ? (
                    <div className="flex items-center gap-2 px-4 py-2.5">
                      <Select value={selectedMember} onValueChange={setSelectedMember}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue placeholder="Selecione um funcionário" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees
                            .filter(e => !group.members.some(m => m.user_id === e.user_id))
                            .map(e => (
                              <SelectItem key={e.user_id} value={e.user_id}>{e.display_name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm" className="h-8 text-xs px-3"
                        disabled={!selectedMember}
                        onClick={() => { handleAddMember(group.id, selectedMember); }}
                      >
                        Adicionar
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-8 text-xs px-2"
                        onClick={() => { setAddingMember(null); setSelectedMember(''); }}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingMember(group.id); setSelectedMember(''); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-primary hover:bg-primary/5 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Adicionar membro
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={detailCountId !== null} onOpenChange={o => { if (!o) { setDetailCountId(null); setDetailItems([]); setDetailSearch(''); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Resultado da Contagem</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
          ) : detailItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Nenhum item contado ainda.</div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-3 text-sm flex-wrap">
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
                <div className="flex-1 min-w-[180px]">
                  <input
                    type="text"
                    placeholder="Buscar insumo..."
                    value={detailSearch}
                    onChange={e => setDetailSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs sticky top-0" style={{ background: 'hsl(40 30% 97%)' }}>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">INSUMO</th>
                      <th className="text-left px-2 py-2 font-semibold text-muted-foreground">QUEM CONTOU</th>
                      <th className="text-right px-2 py-2 font-semibold text-muted-foreground">SISTEMA</th>
                      <th className="text-right px-2 py-2 font-semibold text-muted-foreground">CONTADO</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">DIFERENÇA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {detailItems.filter(d => !detailSearch || (d.stock_items?.name ?? '').toLowerCase().includes(detailSearch.toLowerCase())).map(d => {
                      const diff = (d.counted_stock ?? 0) - d.system_stock;
                      const ok = diff === 0;
                      const uc = d.stock_items?.unit_cost ?? 0;
                      const pq = Math.max(1, d.stock_items?.purchase_qty ?? 1);
                      const val = Number(d.counted_stock) * (uc / pq);
                      return (
                        <tr key={d.id} className={!ok ? 'bg-red-50/40' : ''}>
                          <td className="px-3 py-1.5">
                            <p className="font-medium text-foreground text-xs leading-tight">{d.stock_items?.name || '—'} <span className="text-muted-foreground font-normal">({d.stock_items?.unit})</span></p>
                            <p className="text-[10px] text-muted-foreground/70">{d.stock_items?.category}</p>
                          </td>
                          <td className="px-2 py-1.5 text-xs text-foreground">
                            {d.counters && d.counters.length > 0 ? d.counters.map((c: any, i: number) => (
                              <span key={i} className="block leading-tight">
                                {c.name.split(' ')[0]}{d.counters.length > 1 && <span className="text-muted-foreground"> ({Number(c.qty).toFixed(1)})</span>}
                              </span>
                            )) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">{Number(d.system_stock).toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right">
                            {editingDetailItem === d.id ? (
                              <input
                                autoFocus
                                type="number"
                                value={editingDetailValue}
                                onChange={e => setEditingDetailValue(e.target.value)}
                                onBlur={() => commitDetailEdit(d.id)}
                                onKeyDown={e => { if (e.key === 'Enter') commitDetailEdit(d.id); if (e.key === 'Escape') setEditingDetailItem(null); }}
                                className="w-20 text-right text-xs font-semibold border border-primary rounded px-1 py-0.5 focus:outline-none"
                              />
                            ) : (
                              <p
                                className="font-semibold text-xs cursor-pointer hover:text-primary hover:underline"
                                title="Clique para corrigir"
                                onClick={() => { setEditingDetailItem(d.id); setEditingDetailValue(Number(d.counted_stock).toString()); }}
                              >{Number(d.counted_stock).toFixed(2)}</p>
                            )}
                            {val > 0 && <p className="text-[10px] text-muted-foreground/70">{val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {ok ? (
                              <span className="text-success text-xs">✓ ok</span>
                            ) : (
                              <span className={`font-semibold text-xs flex items-center gap-0.5 justify-end ${diff > 0 ? 'text-success' : 'text-destructive'}`}>
                                <TrendingDown className={`w-3 h-3 ${diff > 0 ? 'rotate-180' : ''}`} />
                                {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Total valor inventariado */}
              {detailItems.length > 0 && (() => {
                const total = detailItems.reduce((s, d) => {
                  const uc = d.stock_items?.unit_cost ?? 0;
                  const pq = Math.max(1, d.stock_items?.purchase_qty ?? 1);
                  return s + Number(d.counted_stock) * (uc / pq);
                }, 0);
                return total > 0 ? (
                  <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-muted/20">
                    <span className="text-sm font-semibold text-foreground">Valor total inventariado</span>
                    <span className="text-base font-bold text-amber-700">
                      {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                ) : null;
              })()}
              {detailCount?.status !== 'completed' && (
                <div className="border-t border-border pt-4 mt-2">
                  {/* Toggle: zerar não contados */}
                  <button
                    onClick={() => setZeroUncounted(v => !v)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border mb-3 transition-colors text-sm ${
                      zeroUncounted
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-muted/40 border-border text-muted-foreground'
                    }`}
                  >
                    <span className="font-medium">Zerar itens não contados</span>
                    <div className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${zeroUncounted ? 'bg-red-500' : 'bg-border'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${zeroUncounted ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </button>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-3 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-semibold">Atenção: esta ação é irreversível</p>
                      <p className="mt-0.5">
                        {zeroUncounted
                          ? 'Os itens contados terão o estoque substituído. Os itens não contados serão zerados.'
                          : 'Os itens contados terão o estoque substituído. Os itens não contados serão mantidos como estão.'}
                        {' '}Se mais de uma pessoa contou o mesmo item, os valores são somados.
                      </p>
                    </div>
                  </div>
                  <Button className="w-full h-11 gap-2" onClick={handleApplyToStock} disabled={applying}>
                    {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
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
