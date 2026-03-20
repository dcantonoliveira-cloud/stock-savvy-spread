import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ClipboardList, Send, Plus, Search, Loader2, CheckCircle2, AlertTriangle, X, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES } from '@/types/inventory';

type StockItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
};

type InventoryCountItem = {
  id: string;
  count_id: string;
  item_id: string;
  system_stock: number;
  counted_stock: number | null;
  stock_items: { name: string; unit: string; category: string } | null;
  inventory_counts: { id: string; created_at: string } | null;
};

function findSimilarItems(name: string, items: StockItem[]): StockItem[] {
  const q = name.toLowerCase().trim();
  if (q.length < 3) return [];
  const qWords = q.split(/\s+/).filter(w => w.length > 2);
  return items.filter(item => {
    const n = item.name.toLowerCase();
    if (n.includes(q) || q.includes(n)) return true;
    const nWords = n.split(/\s+/);
    return qWords.some(w => nWords.some(nw => nw.includes(w) || w.includes(nw)));
  }).slice(0, 5);
}

// ── Unassigned items dialog ──────────────────────────────────────────────────

function UnassignedDialog({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [items, setItems] = useState<InventoryCountItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadUnassigned(); }, []);

  const loadUnassigned = async () => {
    setLoading(true);
    const { data: activeCounts } = await (supabase as any)
      .from('inventory_counts').select('id').eq('status', 'in_progress');
    if (!activeCounts?.length) { setLoading(false); return; }
    const ids = activeCounts.map((c: any) => c.id);
    const { data } = await (supabase as any)
      .from('inventory_count_items')
      .select('id, count_id, item_id, system_stock, counted_stock, stock_items(name, unit, category), inventory_counts(id, created_at)')
      .in('count_id', ids)
      .is('assigned_user_id', null)
      .is('counted_stock', null);
    const rows = (data || []) as InventoryCountItem[];
    setItems(rows);
    const init: Record<string, string> = {};
    for (const i of rows) init[i.id] = '';
    setQuantities(init);
    setLoading(false);
  };

  const handleSave = async () => {
    const filled = items.filter(i => quantities[i.id] !== '');
    if (!filled.length) { toast.error('Preencha pelo menos um item'); return; }
    setSaving(true);
    for (const item of filled) {
      const val = parseFloat(quantities[item.id]);
      if (isNaN(val) || val < 0) continue;
      await (supabase as any)
        .from('inventory_count_items')
        .update({ counted_stock: val, assigned_user_id: userId })
        .eq('id', item.id);
    }
    toast.success(`✅ ${filled.length} item(s) contabilizados`);
    setSaving(false);
    onDone();
    onClose();
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-500" />
            Itens sem responsável
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estes itens não têm responsável — qualquer um pode contar.
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Nenhum item livre no momento.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.stock_items?.name}</p>
                    <p className="text-xs text-muted-foreground">{item.stock_items?.category} · {item.stock_items?.unit}</p>
                  </div>
                  <Input
                    type="number" inputMode="decimal"
                    className="w-24 h-10 text-center text-base font-bold rounded-xl"
                    placeholder="Qtd"
                    value={quantities[item.id] ?? ''}
                    onChange={e => setQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border">
          <Button
            className="w-full h-12"
            onClick={handleSave}
            disabled={saving || !items.some(i => quantities[i.id] !== '')}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar contagem
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Free count dialog ────────────────────────────────────────────────────────

function FreeCountDialog({
  userId, activeCountId, allItems, onClose, onDone,
}: {
  userId: string;
  activeCountId: string;
  allItems: StockItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [freeSearch, setFreeSearch] = useState('');
  const [freeItem, setFreeItem] = useState<StockItem | null>(null);
  const [freeQty, setFreeQty] = useState('');
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('un');
  const [newCategory, setNewCategory] = useState('Outros');
  const [similarItems, setSimilarItems] = useState<StockItem[]>([]);
  const [checkingAI, setCheckingAI] = useState(false);
  const [confirmedNew, setConfirmedNew] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!creatingNew || newName.length < 3) { setSimilarItems([]); setConfirmedNew(false); return; }
    setCheckingAI(true);
    const t = setTimeout(() => {
      setSimilarItems(findSimilarItems(newName, allItems));
      setConfirmedNew(false);
      setCheckingAI(false);
    }, 500);
    return () => clearTimeout(t);
  }, [newName, creatingNew]);

  const freeSearchResults = freeSearch.length >= 2
    ? allItems.filter(i => i.name.toLowerCase().includes(freeSearch.toLowerCase())).slice(0, 12)
    : [];

  const handleSaveFreeCount = async () => {
    if (!freeItem || !freeQty) { toast.error('Selecione um item e informe a quantidade'); return; }
    setSaving(true);
    const { data: existing } = await (supabase as any)
      .from('inventory_count_items')
      .select('id').eq('count_id', activeCountId).eq('item_id', freeItem.id).maybeSingle();
    if (existing) {
      await (supabase as any)
        .from('inventory_count_items')
        .update({ counted_stock: parseFloat(freeQty), assigned_user_id: userId })
        .eq('id', existing.id);
    } else {
      await (supabase as any)
        .from('inventory_count_items')
        .insert({ count_id: activeCountId, item_id: freeItem.id, system_stock: freeItem.current_stock, counted_stock: parseFloat(freeQty), assigned_user_id: userId });
    }
    toast.success(`✅ ${freeItem.name}: ${freeQty} ${freeItem.unit}`);
    setSaving(false);
    onDone();
    onClose();
  };

  const handleCreateNewItem = async () => {
    if (!newName.trim() || !newUnit.trim()) { toast.error('Preencha nome e unidade'); return; }
    if (similarItems.length > 0 && !confirmedNew) { toast.error('Confirme que nenhum item similar é o que você procura'); return; }
    setSaving(true);
    const { data: newItem, error } = await (supabase as any)
      .from('stock_items')
      .insert({ name: newName.trim(), unit: newUnit.trim(), category: newCategory, current_stock: 0 })
      .select().single();
    if (error || !newItem) { toast.error('Erro ao criar insumo'); setSaving(false); return; }
    toast.success(`Insumo "${newName}" criado!`);
    setFreeItem(newItem as StockItem);
    setFreeSearch(newName);
    setCreatingNew(false);
    setNewName('');
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            {creatingNew ? 'Novo insumo' : 'Contar item avulso'}
          </DialogTitle>
        </DialogHeader>

        {!creatingNew ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-10 rounded-xl"
                placeholder="Buscar insumo..."
                value={freeSearch}
                onChange={e => { setFreeSearch(e.target.value); setFreeItem(null); setFreeQty(''); }}
                autoFocus
              />
            </div>

            {freeSearch.length >= 2 && !freeItem && (
              <div className="border border-border rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {freeSearchResults.length > 0 ? freeSearchResults.map(item => (
                  <button
                    key={item.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent border-b border-border/40 last:border-0"
                    onClick={() => { setFreeItem(item); setFreeSearch(item.name); }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category} · {item.unit}</p>
                    </div>
                  </button>
                )) : (
                  <div className="px-3 py-4 text-center">
                    <p className="text-sm text-muted-foreground mb-3">Nenhum resultado para "{freeSearch}"</p>
                    <Button
                      variant="outline" size="sm" className="gap-1.5 text-xs"
                      onClick={() => { setCreatingNew(true); setNewName(freeSearch); setSimilarItems([]); setConfirmedNew(false); }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Criar novo insumo
                    </Button>
                  </div>
                )}
              </div>
            )}

            {freeItem && (
              <div className="space-y-3">
                <div className="bg-accent rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{freeItem.name}</p>
                    <p className="text-xs text-muted-foreground">{freeItem.category} · {freeItem.unit}</p>
                  </div>
                  <button onClick={() => { setFreeItem(null); setFreeSearch(''); }} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Quantidade contada ({freeItem.unit}) *</label>
                  <Input
                    type="number" inputMode="decimal"
                    className="h-14 text-2xl text-center font-bold rounded-xl"
                    placeholder="0" value={freeQty}
                    onChange={e => setFreeQty(e.target.value)} autoFocus
                  />
                </div>
                <Button className="w-full h-12" onClick={handleSaveFreeCount} disabled={saving || !freeQty}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Registrar contagem
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* ── Create new item ── */
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nome do insumo *</label>
              <Input
                className="h-10 rounded-xl" value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Queijo Mussarela" autoFocus
              />
            </div>

            {checkingAI && newName.length >= 3 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Verificando itens similares...
              </div>
            )}

            {!checkingAI && similarItems.length > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Itens parecidos encontrados:</p>
                    <p className="text-xs text-amber-700 mt-0.5">Verifique se já existe antes de criar.</p>
                  </div>
                </div>
                <div className="space-y-1 mb-3">
                  {similarItems.map(item => (
                    <button
                      key={item.id}
                      className="w-full flex items-center gap-2 text-xs text-left px-2 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                      onClick={() => { setFreeItem(item); setCreatingNew(false); setFreeSearch(item.name); setFreeQty(''); }}
                    >
                      <Check className="w-3 h-3 text-amber-600 flex-shrink-0" />
                      <span className="font-medium text-amber-900 flex-1 truncate">{item.name}</span>
                      <span className="text-amber-600 flex-shrink-0">{item.unit}</span>
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-amber-800 cursor-pointer select-none">
                  <input
                    type="checkbox" className="rounded accent-amber-600"
                    checked={confirmedNew} onChange={e => setConfirmedNew(e.target.checked)}
                  />
                  Confirmei — nenhum desses é o que procuro
                </label>
              </div>
            )}

            {!checkingAI && (similarItems.length === 0 || confirmedNew) && newName.length >= 3 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Unidade *</label>
                  <Select value={newUnit} onValueChange={setNewUnit}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['kg', 'g', 'L', 'ml', 'un', 'cx', 'pç', 'fardo'].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Categoria</label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {!checkingAI && (similarItems.length === 0 || confirmedNew) && newName.length >= 3 && (
              <Button
                className="w-full h-12" onClick={handleCreateNewItem}
                disabled={saving || !newName.trim() || !newUnit.trim()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Criar insumo
              </Button>
            )}

            <button
              className="text-xs text-muted-foreground hover:text-foreground text-center w-full py-1"
              onClick={() => setCreatingNew(false)}
            >
              ← Voltar
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeeInventoryPage() {
  const { user } = useAuth();

  // Assigned items (pending + counted)
  const [pendingItems, setPendingItems] = useState<InventoryCountItem[]>([]);
  const [countedItems, setCountedItems] = useState<InventoryCountItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Extra features
  const [allStockItems, setAllStockItems] = useState<StockItem[]>([]);
  const [activeCountId, setActiveCountId] = useState<string | null>(null);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [showFreeCount, setShowFreeCount] = useState(false);

  useEffect(() => {
    if (user) {
      load();
      loadExtras();
    }
  }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get active counts
      const { data: activeCounts } = await (supabase as any)
        .from('inventory_counts').select('id').eq('status', 'in_progress');
      const activeIds = new Set((activeCounts || []).map((c: any) => c.id));

      if (activeIds.size === 0) {
        setPendingItems([]);
        setCountedItems([]);
        setLoading(false);
        return;
      }

      // Load ALL items assigned to this user in active counts
      const { data } = await (supabase as any)
        .from('inventory_count_items')
        .select('id, count_id, item_id, system_stock, counted_stock, stock_items(name, unit, category), inventory_counts(id, created_at)')
        .eq('assigned_user_id', user.id)
        .in('count_id', [...activeIds]);

      const all = ((data || []) as InventoryCountItem[]).filter(i => activeIds.has(i.count_id));
      const pending = all.filter(i => i.counted_stock === null);
      const counted = all.filter(i => i.counted_stock !== null);

      setPendingItems(pending);
      setCountedItems(counted);

      const initQty: Record<string, string> = {};
      for (const i of pending) initQty[i.id] = '';
      setQuantities(initQty);
    } catch {
      setPendingItems([]);
      setCountedItems([]);
    }
    setLoading(false);
  };

  const loadExtras = async () => {
    // Load all stock items for free count / new item
    const { data: stockData } = await supabase
      .from('stock_items')
      .select('id, name, category, unit, current_stock' as any)
      .order('name');
    if (stockData) setAllStockItems(stockData as unknown as StockItem[]);

    // Find active count id + unassigned count
    const { data: activeCounts } = await (supabase as any)
      .from('inventory_counts').select('id').eq('status', 'in_progress');
    if (!activeCounts?.length) return;
    const ids = activeCounts.map((c: any) => c.id);
    setActiveCountId(ids[0]);
    const { count } = await (supabase as any)
      .from('inventory_count_items')
      .select('id', { count: 'exact', head: true })
      .in('count_id', ids)
      .is('assigned_user_id', null)
      .is('counted_stock', null);
    setUnassignedCount(count || 0);
  };

  const handleSave = async () => {
    const filled = pendingItems.filter(i => quantities[i.id] !== '' && quantities[i.id] !== undefined);
    if (filled.length === 0) { toast.error('Preencha pelo menos um item'); return; }
    setSaving(true);
    try {
      for (const item of filled) {
        const val = parseFloat(quantities[item.id]);
        if (isNaN(val) || val < 0) continue;
        await (supabase as any)
          .from('inventory_count_items')
          .update({ counted_stock: val })
          .eq('id', item.id);
      }
      toast.success(`✅ ${filled.length} item(s) registrado(s)`);
      load();
      loadExtras();
    } catch {
      toast.error('Erro ao salvar contagem');
    }
    setSaving(false);
  };

  // Group pending items by count session
  const pendingGroups: Record<string, InventoryCountItem[]> = {};
  for (const item of pendingItems) {
    if (!pendingGroups[item.count_id]) pendingGroups[item.count_id] = [];
    pendingGroups[item.count_id].push(item);
  }

  const hasActiveCount = activeCountId !== null;
  const total = pendingItems.length + countedItems.length;

  return (
    <div className="pb-8">
      <div className="mb-5">
        <h2 className="text-xl font-display font-bold text-foreground">Inventário</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Contagem de itens atribuídos a você</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !hasActiveCount && total === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma contagem ativa</p>
          <p className="text-sm mt-1">O supervisor ainda não iniciou um inventário.</p>
        </div>
      ) : (
        <>
          {/* Progress summary */}
          {total > 0 && (
            <div className="bg-white rounded-2xl border border-border p-4 mb-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Progresso da contagem</p>
                <div className="h-2 bg-border/60 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${total > 0 ? Math.round((countedItems.length / total) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-foreground">{countedItems.length}<span className="text-sm text-muted-foreground font-normal">/{total}</span></p>
                <p className="text-xs text-muted-foreground">contados</p>
              </div>
            </div>
          )}

          {/* Pending items grouped by session */}
          {Object.entries(pendingGroups).map(([countId, groupItems]) => {
            const countDate = groupItems[0]?.inventory_counts?.created_at
              ? new Date(groupItems[0].inventory_counts.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
              : countId.slice(0, 8);

            return (
              <div key={countId} className="rounded-2xl border border-primary/30 bg-white shadow-sm overflow-hidden mb-4">
                <div className="bg-primary/5 border-b border-primary/15 px-4 py-2.5 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Contagem de {countDate}</p>
                  <Badge className="ml-auto text-[10px] bg-primary/10 text-primary border-primary/20">
                    {groupItems.length} pendente{groupItems.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="divide-y divide-border/50">
                  {groupItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.stock_items?.name}</p>
                        <p className="text-xs text-muted-foreground">{item.stock_items?.category} · {item.stock_items?.unit}</p>
                      </div>
                      <Input
                        type="number" inputMode="decimal"
                        className="w-24 h-10 text-center text-base font-bold rounded-xl"
                        placeholder="Qtd"
                        value={quantities[item.id] ?? ''}
                        onChange={e => setQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 border-t border-border bg-white">
                  <Button
                    className="w-full h-12 text-base"
                    onClick={handleSave}
                    disabled={saving || !groupItems.some(i => quantities[i.id] !== '' && quantities[i.id] !== undefined)}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Salvar contagem parcial
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Already counted items */}
          {countedItems.length > 0 && (
            <div className="rounded-2xl border border-border bg-white overflow-hidden mb-4">
              <div className="bg-success/5 border-b border-success/15 px-4 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <p className="text-sm font-semibold text-foreground">Já contados</p>
                <Badge className="ml-auto text-[10px] bg-success/10 text-success border-success/20">
                  {countedItems.length}
                </Badge>
              </div>
              <div className="divide-y divide-border/50">
                {countedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.stock_items?.name}</p>
                      <p className="text-xs text-muted-foreground">{item.stock_items?.category} · {item.stock_items?.unit}</p>
                    </div>
                    <span className="text-sm font-bold text-success">
                      {item.counted_stock?.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {item.stock_items?.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating action buttons — bottom right */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-2 items-end">
        {unassignedCount > 0 && (
          <button
            onClick={() => setShowUnassigned(true)}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-2xl shadow-lg text-sm font-semibold active:scale-95 transition-all"
          >
            <ClipboardList className="w-4 h-4" />
            {unassignedCount} item{unassignedCount !== 1 ? 's' : ''} livre{unassignedCount !== 1 ? 's' : ''}
          </button>
        )}
        {activeCountId && (
          <button
            onClick={() => setShowFreeCount(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl shadow-lg text-sm font-semibold active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Contar avulso
          </button>
        )}
      </div>

      {/* Dialogs */}
      {showUnassigned && user && (
        <UnassignedDialog
          userId={user.id}
          onClose={() => setShowUnassigned(false)}
          onDone={() => { load(); loadExtras(); }}
        />
      )}
      {showFreeCount && user && activeCountId && (
        <FreeCountDialog
          userId={user.id}
          activeCountId={activeCountId}
          allItems={allStockItems}
          onClose={() => setShowFreeCount(false)}
          onDone={() => { load(); loadExtras(); }}
        />
      )}
    </div>
  );
}
