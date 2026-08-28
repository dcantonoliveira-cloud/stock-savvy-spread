import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  ClipboardCheck, Plus, AlertTriangle, Loader2, ChevronRight, Users,
  CheckCircle2, Clock, TrendingDown, PackageCheck, UserPlus, Trash2, Settings,
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
};

export default function InventoryPage() {
  const [history, setHistory] = useState<InventoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<InventoryGroup[]>([]);

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

  // Detail dialog
  const [detailCountId, setDetailCountId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [applying, setApplying] = useState(false);
  const detailCount = history.find(h => h.id === detailCountId);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [histRes, empRes, groupsRes] = await Promise.all([
      supabase.from('inventory_counts' as any).select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('user_id, display_name').order('display_name'),
      (supabase as any).from('inventory_groups').select('id, name, inventory_group_members(user_id, profiles(user_id, display_name))').order('name'),
    ]);

    if (empRes.data) setEmployees(empRes.data as Employee[]);

    if (groupsRes.data) {
      const g: InventoryGroup[] = (groupsRes.data as any[]).map((row: any) => ({
        id: row.id,
        name: row.name,
        member_count: row.inventory_group_members?.length ?? 0,
        members: (row.inventory_group_members || []).map((m: any) => ({
          user_id: m.profiles?.user_id ?? m.user_id,
          display_name: m.profiles?.display_name ?? 'Desconhecido',
        })),
      }));
      setGroups(g);
    }

    if (histRes.data) {
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

  const openNewCount = async () => {
    // Build assignee rows from stock_items counter fields
    const { data: items } = await (supabase as any)
      .from('stock_items')
      .select('id, counter_user_id, counter_group_id, profiles:counter_user_id(user_id, display_name), inventory_groups:counter_group_id(id, name)');

    const userMap: Record<string, { label: string; count: number }> = {};
    const grpMap: Record<string, { label: string; count: number }> = {};
    let unassigned = 0;

    for (const item of (items || []) as any[]) {
      if (item.counter_user_id) {
        const uid = item.counter_user_id;
        if (!userMap[uid]) userMap[uid] = { label: item.profiles?.display_name ?? uid, count: 0 };
        userMap[uid].count++;
      } else if (item.counter_group_id) {
        const gid = item.counter_group_id;
        if (!grpMap[gid]) grpMap[gid] = { label: item.inventory_groups?.name ?? gid, count: 0 };
        grpMap[gid].count++;
      } else {
        unassigned++;
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

      const { data: allItems } = await (supabase as any)
        .from('stock_items')
        .select('id, current_stock, counter_user_id, counter_group_id');
      if (!allItems) throw new Error('no items');

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

      const countItemsData = (allItems as any[]).map(item => {
        let assigned_user_id = item.counter_user_id ?? null;
        let assigned_group_id = item.counter_group_id ?? null;

        // Apply overrides
        if (item.counter_user_id && userOverride[item.counter_user_id] !== undefined) {
          assigned_user_id = userOverride[item.counter_user_id];
        }
        if (item.counter_group_id && grpOverride[item.counter_group_id] !== undefined) {
          assigned_group_id = grpOverride[item.counter_group_id];
        }

        return {
          count_id: cId,
          item_id: item.id,
          system_stock: item.current_stock ?? 0,
          assigned_user_id,
          assigned_group_id,
        };
      });

      const { error: insertErr } = await supabase.from('inventory_count_items' as any).insert(countItemsData);
      if (insertErr) {
        await supabase.from('inventory_counts' as any).delete().eq('id', cId);
        toast.error('Erro ao criar contagem: ' + insertErr.message);
        setCreating(false);
        return;
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

      const grouped: Record<string, number> = {};
      for (const row of data as any[]) {
        grouped[row.item_id] = (grouped[row.item_id] || 0) + (row.counted_stock ?? 0);
      }

      for (const [itemId, total] of Object.entries(grouped)) {
        await supabase.from('stock_items').update({ current_stock: total } as any).eq('id', itemId);
      }

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
      <Dialog open={detailCountId !== null} onOpenChange={o => { if (!o) { setDetailCountId(null); setDetailItems([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Resultado da Contagem</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
          ) : detailItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Nenhum item contado ainda.</div>
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
                      <p className="mt-0.5">O estoque será substituído pela quantidade contada. Se mais de uma pessoa contou o mesmo item, os valores são somados.</p>
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
