import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, TrendingUp, TrendingDown, Package, Store, ChevronLeft, ChevronRight,
  ClipboardList, DollarSign, History, Utensils, Pencil, Trash2, Plus, Loader2, Star, StarOff, SlidersHorizontal, Barcode, Boxes, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { fmtNum, fmtCur, fmtDate } from '@/lib/format';
import ResponsibleEditor from '@/components/stock-item/ResponsibleEditor';
import AliasEditor from '@/components/stock-item/AliasEditor';
import TagEditor from '@/components/stock-item/TagEditor';

type StockItem = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
  subcategory_id: string | null; barcode: string | null; purchase_qty: number | null; image_url: string | null;
};

type Entry = {
  id: string; created_at: string; quantity: number; unit_cost: number;
  supplier: string | null; invoice_number: string | null; notes: string | null;
};

type Output = {
  id: string; created_at: string; quantity: number;
  employee_name: string | null; event_name: string | null; notes: string | null;
};

type Supplier = {
  id: string; supplier_name: string; unit_price: number; is_preferred: boolean; notes: string | null;
};

type SheetUsage = {
  sheet_id: string; sheet_name: string; quantity: number; unit: string; section: string;
};

const PAGE_SIZE = 50;

export default function StockItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const [item, setItem] = useState<StockItem | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sheetUsages, setSheetUsages] = useState<SheetUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'movimentos' | 'precos' | 'fornecedores' | 'pratos' | 'config'>('movimentos');
  const [subcategoryName, setSubcategoryName] = useState<string | null>(null);
  const [allProfiles, setAllProfiles] = useState<{ user_id: string; display_name: string }[]>([]);
  const [allGroups, setAllGroups] = useState<{ id: string; name: string }[]>([]);

  // Pagination
  const [movPage, setMovPage] = useState(0);

  // Stock correction dialog
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionQty, setCorrectionQty] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [correctionSaving, setCorrectionSaving] = useState(false);

  // Price edit dialog
  const [priceEditOpen, setPriceEditOpen] = useState(false);
  const [priceEditValue, setPriceEditValue] = useState('');
  const [priceEditSaving, setPriceEditSaving] = useState(false);

  // Supplier dialog state
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supPrice, setSupPrice] = useState('');
  const [supPreferred, setSupPreferred] = useState(false);
  const [supNotes, setSupNotes] = useState('');
  const [supSaving, setSupSaving] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    setLoading(true);
    const [itemRes, entriesRes, outputsRes, suppliersRes, sheetItemsRes, profsRes, grpsRes, rolesRes, priceHistRes] = await Promise.all([
      supabase.from('stock_items').select('*').eq('id', id!).single(),
      supabase.from('stock_entries').select('*').eq('item_id', id!).order('created_at', { ascending: false }).limit(200),
      supabase.from('stock_outputs').select('*').eq('item_id', id!).order('created_at', { ascending: false }).limit(200),
      supabase.from('item_suppliers').select('*').eq('item_id', id!).order('is_preferred', { ascending: false }),
      supabase.from('technical_sheet_items').select('sheet_id, quantity, unit_cost, section, technical_sheets(name)').eq('item_id', id!),
      supabase.from('profiles').select('user_id, display_name').order('display_name'),
      (supabase.from('inventory_groups') as any).select('id, name').order('name'),
      supabase.from('user_roles').select('user_id, role').eq('role', 'employee'),
      (supabase.from('stock_price_history') as any).select('new_price, created_at').eq('item_id', id!).order('created_at', { ascending: false }).limit(1),
    ]);

    if (!itemRes.data) { navigate('/items'); return; }
    const itemData = itemRes.data as unknown as StockItem;
    const entriesData = (entriesRes.data || []) as unknown as Entry[];
    const suppliersData = (suppliersRes.data || []) as unknown as Supplier[];

    // Self-cura: entrada de compra mais recente com preço deve mandar no "Preço Atual" e no fornecedor cadastrado,
    // a menos que uma edição manual de preço (stock_price_history) seja mais recente que ela.
    const latestPricedEntry = entriesData.find(e => e.unit_cost && e.unit_cost > 0);
    const latestManualEdit = ((priceHistRes.data || []) as any[])[0];
    if (latestPricedEntry) {
      const entryIsNewer = !latestManualEdit || new Date(latestPricedEntry.created_at).getTime() >= new Date(latestManualEdit.created_at).getTime();
      if (entryIsNewer && Math.abs((itemData.unit_cost || 0) - latestPricedEntry.unit_cost) > 0.001) {
        await supabase.from('stock_items').update({ unit_cost: latestPricedEntry.unit_cost } as any).eq('id', id!);
        itemData.unit_cost = latestPricedEntry.unit_cost;
      }
      const supplierName = latestPricedEntry.supplier?.trim();
      if (supplierName) {
        const existingSupplier = suppliersData.find(s => s.supplier_name.toLowerCase() === supplierName.toLowerCase());
        if (!existingSupplier) {
          const { data: newSup } = await supabase.from('item_suppliers').insert({
            item_id: id, supplier_name: supplierName, unit_price: latestPricedEntry.unit_cost,
            is_preferred: suppliersData.length === 0,
          } as any).select('*').single();
          if (newSup) suppliersData.push(newSup as unknown as Supplier);
        } else if (entryIsNewer && Math.abs(existingSupplier.unit_price - latestPricedEntry.unit_cost) > 0.001) {
          await supabase.from('item_suppliers').update({ unit_price: latestPricedEntry.unit_cost } as any).eq('id', existingSupplier.id);
          existingSupplier.unit_price = latestPricedEntry.unit_cost;
        }
      }
    }

    setItem({ ...itemData });
    setEntries(entriesData);
    setOutputs((outputsRes.data || []) as unknown as Output[]);
    setSuppliers(suppliersData);

    const employeeIds = new Set(((rolesRes.data || []) as { user_id: string }[]).map(r => r.user_id));
    setAllProfiles(((profsRes.data || []) as { user_id: string; display_name: string }[]).filter(p => employeeIds.has(p.user_id)));
    setAllGroups((grpsRes.data || []) as { id: string; name: string }[]);

    if (itemData.subcategory_id) {
      const { data: subcat } = await supabase.from('subcategories').select('name').eq('id', itemData.subcategory_id).single();
      setSubcategoryName((subcat as any)?.name ?? null);
    } else {
      setSubcategoryName(null);
    }

    const usages: SheetUsage[] = (sheetItemsRes.data || []).map((row: any) => ({
      sheet_id: row.sheet_id,
      sheet_name: row.technical_sheets?.name || '?',
      quantity: row.quantity,
      unit: itemRes.data?.unit || '',
      section: row.section || 'receita',
    }));
    setSheetUsages(usages);
    setLoading(false);
  };

  const handleSetPreferred = async (supplierId: string) => {
    await supabase.from('item_suppliers').update({ is_preferred: false } as any).eq('item_id', id!);
    await supabase.from('item_suppliers').update({ is_preferred: true } as any).eq('id', supplierId);
    setSuppliers(prev => prev.map(s => ({ ...s, is_preferred: s.id === supplierId })));
    toast.success('Fornecedor preferido atualizado!');
  };

  const handleSaveSupplier = async () => {
    if (!supName.trim()) { toast.error('Nome é obrigatório'); return; }
    setSupSaving(true);
    if (editingSupplier) {
      await supabase.from('item_suppliers').update({
        supplier_name: supName.trim(),
        unit_price: parseFloat(supPrice) || 0,
        is_preferred: supPreferred,
        notes: supNotes.trim() || null,
      } as any).eq('id', editingSupplier.id);
      toast.success('Fornecedor atualizado!');
    } else {
      await supabase.from('item_suppliers').insert({
        item_id: id,
        supplier_name: supName.trim(),
        unit_price: parseFloat(supPrice) || 0,
        is_preferred: supPreferred,
        notes: supNotes.trim() || null,
      } as any);
      toast.success('Fornecedor adicionado!');
    }
    setSupSaving(false);
    setSupplierDialogOpen(false);
    load();
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!confirm('Remover este fornecedor?')) return;
    await supabase.from('item_suppliers').delete().eq('id', supplierId);
    toast.success('Fornecedor removido');
    load();
  };

  const handleUpdateSupplierPrice = async (supplierId: string, newPrice: number) => {
    const prev = suppliers.find(s => s.id === supplierId);
    if (!prev || prev.unit_price === newPrice) return;
    await supabase.from('item_suppliers').update({ unit_price: newPrice } as any).eq('id', supplierId);
    setSuppliers(p => p.map(s => s.id === supplierId ? { ...s, unit_price: newPrice } : s));
    toast.success('Preço atualizado!');
  };

  const handleCorrection = async () => {
    if (!item) return;
    const newQty = parseFloat(correctionQty.replace(',', '.'));
    if (isNaN(newQty) || newQty < 0) { toast.error('Quantidade inválida'); return; }
    setCorrectionSaving(true);
    const diff = newQty - item.current_stock;
    if (diff === 0) { setCorrectionSaving(false); setCorrectionOpen(false); return; }
    const notes = correctionNotes.trim() ? `Correção de estoque — ${correctionNotes.trim()}` : 'Correção de estoque';
    let movError = null;
    if (diff > 0) {
      const { error } = await supabase.from('stock_entries').insert({
        item_id: item.id,
        quantity: diff,
        unit_cost: item.unit_cost,
        notes,
        supplier: null,
        invoice_number: null,
        registered_by: user?.id,
      } as any);
      movError = error;
    } else {
      const { error } = await supabase.from('stock_outputs').insert({
        item_id: item.id,
        quantity: Math.abs(diff),
        notes,
        employee_name: 'Correção de estoque',
        event_name: null,
        registered_by: user?.id,
      } as any);
      movError = error;
    }
    if (movError) {
      toast.error('Erro ao corrigir estoque: ' + movError.message);
      setCorrectionSaving(false);
      return;
    }
    // Não seta stock_items.current_stock diretamente aqui: o trigger do banco (on_stock_entry/on_stock_output)
    // já ajusta o valor sozinho a partir da quantidade inserida acima. Setar os dois duplicaria o ajuste.

    // Sync stock_item_locations: apply the diff to the default kitchen location
    const { data: defaultKitchen } = await supabase.from('kitchens').select('id').eq('is_default', true).single();
    if (defaultKitchen) {
      const { data: loc } = await supabase.from('stock_item_locations')
        .select('id, current_stock').eq('item_id', item.id).eq('kitchen_id', (defaultKitchen as any).id).maybeSingle();
      if (loc) {
        const newLocStock = Math.max(0, (loc as any).current_stock + diff);
        await supabase.from('stock_item_locations').update({ current_stock: newLocStock } as any).eq('id', (loc as any).id);
      }
    }

    toast.success(`Estoque corrigido para ${newQty} ${item.unit}`);
    setCorrectionOpen(false);
    setCorrectionQty('');
    setCorrectionNotes('');
    setCorrectionSaving(false);
    load();
  };

  const handlePriceEdit = async () => {
    if (!item) return;
    const newPrice = parseFloat(priceEditValue.replace(',', '.'));
    if (isNaN(newPrice) || newPrice < 0) { toast.error('Preço inválido'); return; }
    setPriceEditSaving(true);
    const who = profile?.display_name ?? 'Supervisor';
    // Atualiza direto em stock_items — dispara automaticamente o histórico de preço (trigger no banco)
    const { error } = await supabase.from('stock_items').update({ unit_cost: newPrice } as any).eq('id', item.id);
    if (!error) {
      // Registra também como entrada de preço (qtd 0) pra aparecer no Histórico de Preços
      const { error: movError } = await supabase.from('stock_entries').insert({
        item_id: item.id, quantity: 0, unit_cost: newPrice,
        notes: `Atualização de preço por ${who} (anterior: R$ ${item.unit_cost ?? 0})`,
        registered_by: user?.id,
      } as any);
      if (movError) toast.error('Preço salvo, mas o histórico não pôde ser registrado: ' + movError.message);
    }
    setPriceEditSaving(false);
    if (error) { toast.error('Erro ao salvar preço'); return; }
    toast.success(`Preço atualizado para ${fmtCur(newPrice)}`);
    setPriceEditOpen(false);
    load();
  };

  if (loading || !item) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  const isLow = item.current_stock > 0 && item.current_stock < item.min_stock && item.min_stock > 0;
  const totalEntries = entries.reduce((s, e) => s + e.quantity, 0);
  const totalOutputs = outputs.reduce((s, o) => s + o.quantity, 0);
  const pricedEntries = entries.filter(e => e.unit_cost > 0);
  const avgCost = pricedEntries.length > 0
    ? pricedEntries.reduce((s, e) => s + e.unit_cost * e.quantity, 0) / pricedEntries.reduce((s, e) => s + e.quantity, 0)
    : item.unit_cost;

  // All movements merged
  const isCorrectionNote = (notes: string | null) =>
    !!notes && (notes.startsWith('Ajuste manual') || notes.startsWith('Correção de estoque'));
  const allMovementsRaw = [
    ...entries.filter(e => e.quantity !== 0).map(e => ({ id: e.id, type: 'entrada' as const, date: e.created_at, qty: e.quantity, cost: e.unit_cost || null, who: e.supplier, ref: e.invoice_number, notes: e.notes, isCorrection: isCorrectionNote(e.notes) })),
    ...outputs.map(o => ({ id: o.id, type: 'saida' as const, date: o.created_at, qty: o.quantity, cost: null, who: o.employee_name, ref: o.event_name, notes: o.notes, isCorrection: isCorrectionNote(o.notes) })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Running balance: newest movement lands on the item's current stock, walking backwards from there
  let runningBalance = item.current_stock;
  const allMovements = allMovementsRaw.map(m => {
    const balanceAfter = runningBalance;
    runningBalance -= m.type === 'entrada' ? m.qty : -m.qty;
    return { ...m, balanceAfter };
  });

  const totalMovPages = Math.ceil(allMovements.length / PAGE_SIZE);
  const pagedMovements = allMovements.slice(movPage * PAGE_SIZE, (movPage + 1) * PAGE_SIZE);

  // Price history — only entries with actual purchase price
  const priceHistory = [...pricedEntries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Lowest price supplier
  const lowestPrice = suppliers.length > 1
    ? Math.min(...suppliers.map(s => s.unit_price))
    : null;


  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{item.name}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant="outline" className="text-xs">{item.category || 'Sem categoria'}</Badge>
            {subcategoryName && <Badge variant="outline" className="text-xs">{subcategoryName}</Badge>}
            <span className="text-xs text-muted-foreground">{item.unit}</span>
            {item.min_stock > 0 && <span className="text-xs text-muted-foreground">· mín. {fmtNum(item.min_stock)} {item.unit}</span>}
            {item.purchase_qty && item.purchase_qty > 1 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Boxes className="w-3 h-3" />{fmtNum(item.purchase_qty)} {item.unit}/embalagem</span>
            )}
            {item.barcode && (
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Barcode className="w-3 h-3" />{item.barcode}</span>
            )}
            {isLow && <Badge variant="destructive" className="text-xs">Estoque baixo</Badge>}
          </div>
        </div>
        {item.image_url && (
          <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover border border-border" />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Estoque Atual — clicável para corrigir */}
        <div
          className="bg-white rounded-xl border border-border shadow-sm p-4 cursor-pointer group hover:border-primary/40 hover:shadow-md transition-all"
          onClick={() => { setCorrectionQty(String(item.current_stock)); setCorrectionOpen(true); }}
          title="Clique para ajustar o estoque"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Package className={`w-4 h-4 ${isLow ? 'text-destructive' : 'text-success'}`} />
              <span className="text-xs text-muted-foreground">Estoque Atual</span>
            </div>
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
          <p className={`text-xl font-bold ${isLow ? 'text-destructive' : 'text-success'}`}>{fmtNum(item.current_stock)} {item.unit}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5 group-hover:text-primary/60 transition-colors">clique para ajustar</p>
        </div>
        {(() => {
          const stockValue = item.current_stock * (item.unit_cost > 0 ? item.unit_cost : avgCost);
          const preferredSupplier = suppliers.find(s => s.is_preferred) ?? suppliers[0];
          const otherSuppliers = suppliers.filter(s => s !== preferredSupplier);
          const currentPrice = preferredSupplier?.unit_price ?? item.unit_cost;
          const secondPrice = otherSuppliers.length > 0
            ? Math.min(...otherSuppliers.map(s => s.unit_price).filter(p => p > 0))
            : null;
          const priceDiff = secondPrice != null && currentPrice > 0
            ? ((currentPrice - secondPrice) / secondPrice) * 100
            : null;

          // Sparkline data from priceHistory
          const sparkPrices = priceHistory.map(e => e.unit_cost).filter(p => p > 0);

          return (
            <React.Fragment>
              {/* Card: Preço Atual — clicável para editar */}
              <div
                className="bg-white rounded-xl border border-border shadow-sm p-4 cursor-pointer group hover:border-primary/40 hover:shadow-md transition-all"
                onClick={() => { setPriceEditValue(String(item.unit_cost || '')); setPriceEditOpen(true); }}
                title="Clique para editar o preço"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-600" />
                    <span className="text-xs text-muted-foreground">Preço Atual</span>
                  </div>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xl font-bold text-amber-600">
                  {currentPrice > 0 ? fmtCur(currentPrice) : '—'}
                </p>
                {priceDiff != null && (
                  <p className={`text-[11px] mt-1 ${priceDiff > 0 ? 'text-destructive' : 'text-success'}`}>
                    {priceDiff > 0 ? `+${priceDiff.toFixed(1)}% vs ${otherSuppliers[0]?.supplier_name ?? '2º fornecedor'}` : `${priceDiff.toFixed(1)}% vs ${otherSuppliers[0]?.supplier_name ?? '2º fornecedor'}`}
                  </p>
                )}
                {!priceDiff && preferredSupplier && (
                  <p className="text-[11px] mt-1 text-muted-foreground/60">{preferredSupplier.supplier_name}</p>
                )}
                {!priceDiff && !preferredSupplier && (
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5 group-hover:text-primary/60 transition-colors">clique para editar</p>
                )}
              </div>

              {/* Card: Valor em Estoque */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Valor em Estoque</span>
                </div>
                <p className="text-xl font-bold text-primary">{stockValue > 0 ? fmtCur(stockValue) : '—'}</p>
              </div>

              {/* Card: Evolução do Preço (sparkline) */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-xs text-muted-foreground">Evolução do Preço</span>
                </div>
                {sparkPrices.length >= 2 ? (() => {
                  const min = Math.min(...sparkPrices);
                  const max = Math.max(...sparkPrices);
                  const range = max - min || 1;
                  const W = 120, H = 36, pad = 3;
                  const pts = sparkPrices.map((p, i) => {
                    const x = pad + (i / (sparkPrices.length - 1)) * (W - pad * 2);
                    const y = H - pad - ((p - min) / range) * (H - pad * 2);
                    return `${x},${y}`;
                  }).join(' ');
                  const last = sparkPrices[sparkPrices.length - 1];
                  const trend = last >= sparkPrices[0];
                  return (
                    <div className="flex items-end gap-3">
                      <svg width={W} height={H} className="overflow-visible">
                        <polyline points={pts} fill="none" stroke={trend ? '#16a34a' : '#dc2626'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                        {sparkPrices.map((p, i) => {
                          const x = pad + (i / (sparkPrices.length - 1)) * (W - pad * 2);
                          const y = H - pad - ((p - min) / range) * (H - pad * 2);
                          return i === sparkPrices.length - 1
                            ? <circle key={i} cx={x} cy={y} r="3" fill={trend ? '#16a34a' : '#dc2626'} />
                            : null;
                        })}
                      </svg>
                      <div>
                        <p className={`text-lg font-bold leading-none ${trend ? 'text-success' : 'text-destructive'}`}>{fmtCur(last)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{sparkPrices.length} registros</p>
                      </div>
                    </div>
                  );
                })() : (
                  <p className="text-xl font-bold text-success">
                    {sparkPrices.length === 1 ? fmtCur(sparkPrices[0]) : '—'}
                  </p>
                )}
              </div>
            </React.Fragment>
          );
        })()}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-border p-1 w-fit">
        {([
          ['movimentos', `Movimentações (${allMovements.length})`, History],
          ['precos', `Histórico de Preços (${pricedEntries.length})`, DollarSign],
          ['fornecedores', `Fornecedores (${suppliers.length})`, Store],
          ['pratos', `Pratos que usam (${sheetUsages.length})`, Utensils],
          ['config', 'Configurações', Settings],
        ] as const).map(([tab, label, Icon]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${activeTab === tab ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon className="w-3 h-3" />{label}
          </button>
        ))}
      </div>

      {/* Tab: Movimentações */}
      {activeTab === 'movimentos' && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <p className="font-semibold text-sm">Todas as movimentações</p>
            {totalMovPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Página {movPage + 1} de {totalMovPages}</span>
                <Button variant="outline" size="icon" className="w-7 h-7" disabled={movPage === 0} onClick={() => setMovPage(p => p - 1)}><ChevronLeft className="w-3 h-3" /></Button>
                <Button variant="outline" size="icon" className="w-7 h-7" disabled={movPage >= totalMovPages - 1} onClick={() => setMovPage(p => p + 1)}><ChevronRight className="w-3 h-3" /></Button>
              </div>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                <th className="text-left px-5 py-2">DATA</th>
                <th className="text-center px-3 py-2">TIPO</th>
                <th className="text-right px-3 py-2">QUANTIDADE</th>
                <th className="text-right px-3 py-2">QTD. ATUAL</th>
                <th className="text-right px-3 py-2">CUSTO UNIT.</th>
                <th className="text-left px-3 py-2">REFERÊNCIA</th>
                <th className="text-left px-3 py-2">OBSERVAÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {pagedMovements.map(m => (
                <tr key={m.id} className="hover:bg-amber-50/40 transition-colors">
                  <td className="px-5 py-2.5 text-muted-foreground text-xs">{fmtDate(m.date)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {m.isCorrection
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold"><SlidersHorizontal className="w-2.5 h-2.5" />Correção</span>
                      : m.type === 'entrada'
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-semibold"><TrendingUp className="w-2.5 h-2.5" />Entrada</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-semibold"><TrendingDown className="w-2.5 h-2.5" />Saída</span>}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${m.type === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                    {m.type === 'entrada' ? '+' : '-'}{fmtNum(m.qty)} {item.unit}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground text-xs">
                    {fmtNum(m.balanceAfter)} {item.unit}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground text-xs">
                    {m.cost != null ? fmtCur(m.cost) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.who || m.ref || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.notes || '—'}</td>
                </tr>
              ))}
              {pagedMovements.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground text-sm">Nenhuma movimentação registrada</td></tr>
              )}
            </tbody>
          </table>
          {totalMovPages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Mostrando {movPage * PAGE_SIZE + 1}–{Math.min((movPage + 1) * PAGE_SIZE, allMovements.length)} de {allMovements.length}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={movPage === 0} onClick={() => setMovPage(p => p - 1)}>← Anterior</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={movPage >= totalMovPages - 1} onClick={() => setMovPage(p => p + 1)}>Próxima →</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Histórico de Preços */}
      {activeTab === 'precos' && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="font-semibold text-sm">Histórico de preços pagos</p>
            <p className="text-xs text-muted-foreground mt-0.5">Baseado nas entradas de estoque</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                <th className="text-left px-5 py-2">DATA</th>
                <th className="text-right px-3 py-2">QTDE ENTRADA</th>
                <th className="text-right px-3 py-2">PREÇO UNIT.</th>
                <th className="text-right px-3 py-2">TOTAL PAGO</th>
                <th className="text-left px-3 py-2">FORNECEDOR</th>
                <th className="text-left px-3 py-2">NF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {priceHistory.map(e => (
                <tr key={e.id} className="hover:bg-amber-50/40 transition-colors">
                  <td className="px-5 py-2.5 text-muted-foreground text-xs">{fmtDate(e.created_at)}</td>
                  <td className="px-3 py-2.5 text-right">{fmtNum(e.quantity)} {item.unit}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-amber-700">{fmtCur(e.unit_cost)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{fmtCur(e.quantity * e.unit_cost)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{e.supplier || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{e.invoice_number || '—'}</td>
                </tr>
              ))}
              {priceHistory.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground text-sm">Nenhuma entrada registrada</td></tr>
              )}
            </tbody>
            {priceHistory.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td colSpan={2} className="px-5 py-2.5 text-xs font-semibold text-muted-foreground">Custo médio ponderado</td>
                  <td className="px-3 py-2.5 text-right font-bold text-amber-700">{fmtCur(avgCost)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Tab: Fornecedores */}
      {activeTab === 'fornecedores' && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Fornecedores cadastrados</p>
              <p className="text-xs text-muted-foreground mt-0.5">Menor preço será usado como referência na lista de compras</p>
            </div>
            <Button size="sm" onClick={() => {
              setEditingSupplier(null);
              setSupName('');
              setSupPrice('');
              setSupPreferred(false);
              setSupNotes('');
              setSupplierDialogOpen(true);
            }}>
              <Plus className="w-3.5 h-3.5 mr-1" />Adicionar
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                <th className="text-left px-5 py-2">FORNECEDOR</th>
                <th className="text-right px-3 py-2">PREÇO CADASTRADO</th>
                <th className="text-left px-3 py-2">OBSERVAÇÕES</th>
                <th className="text-center px-3 py-2">PREFERIDO</th>
                <th className="text-right px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-amber-50/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{s.supplier_name}</td>
                  <td className="px-3 py-3 text-right font-semibold text-amber-700">
                    <div className="flex items-center justify-end gap-1.5">
                      {lowestPrice !== null && s.unit_price === lowestPrice && (
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-1.5 py-0.5 text-[10px] font-semibold">
                          menor preço
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={s.unit_price}
                          key={s.id + '-' + s.unit_price}
                          className="w-24 text-right text-sm font-semibold text-amber-700 bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-border focus:border-primary focus:bg-white focus:outline-none transition-all"
                          onBlur={e => handleUpdateSupplierPrice(s.id, parseFloat(e.target.value) || 0)}
                          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                          title="Clique para editar o preço"
                        />
                        <span className="text-xs text-muted-foreground">/{item.unit}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{s.notes || '—'}</td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => handleSetPreferred(s.id)}
                      title={s.is_preferred ? 'Preferido' : 'Clique para definir como preferido'}
                      className="cursor-pointer hover:scale-110 transition-transform"
                    >
                      {s.is_preferred
                        ? <Star className="w-4 h-4 text-amber-500 fill-amber-400 mx-auto" />
                        : <StarOff className="w-4 h-4 text-muted-foreground/40 hover:text-amber-400 mx-auto transition-colors" />
                      }
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
                        setEditingSupplier(s);
                        setSupName(s.supplier_name);
                        setSupPrice(String(s.unit_price));
                        setSupPreferred(s.is_preferred);
                        setSupNotes(s.notes || '');
                        setSupplierDialogOpen(true);
                      }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive/60 hover:text-destructive" onClick={() => handleDeleteSupplier(s.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground text-sm">Nenhum fornecedor cadastrado para este item</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Pratos que usam */}
      {activeTab === 'pratos' && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="font-semibold text-sm">Fichas técnicas que utilizam este insumo</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                <th className="text-left px-5 py-2">FICHA TÉCNICA</th>
                <th className="text-right px-3 py-2">QUANTIDADE NA RECEITA</th>
                <th className="text-center px-3 py-2">TIPO</th>
                <th className="text-right px-3 py-2 hidden md:table-cell">AÇÃO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sheetUsages.map((u, i) => (
                <tr key={i} className="hover:bg-amber-50/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{u.sheet_name}</td>
                  <td className="px-3 py-3 text-right">{fmtNum(u.quantity)} {u.unit}</td>
                  <td className="px-3 py-3 text-center">
                    {u.section === 'decoracao'
                      ? <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">Decoração</Badge>
                      : <Badge variant="outline" className="text-[10px]">Receita</Badge>}
                  </td>
                  <td className="px-3 py-3 text-right hidden md:table-cell">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/sheets/${u.sheet_id}`)}>
                      <ClipboardList className="w-3 h-3 mr-1" />Ver ficha
                    </Button>
                  </td>
                </tr>
              ))}
              {sheetUsages.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground text-sm">Este insumo não está em nenhuma ficha técnica</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Configurações */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-5">
          <ResponsibleEditor itemId={item.id} allProfiles={allProfiles} allGroups={allGroups} />
          <AliasEditor itemId={item.id} />
          <TagEditor itemId={item.id} />
        </div>
      )}

      {/* Stock Correction Dialog */}
      <Dialog open={correctionOpen} onOpenChange={o => { if (!o) setCorrectionOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Corrigir Estoque — {item.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Atual: <strong>{item.current_stock} {item.unit}</strong>. A diferença será registrada como movimentação de correção.
            </p>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nova quantidade ({item.unit})</label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={correctionQty}
                onChange={e => setCorrectionQty(e.target.value)}
                autoFocus
              />
              {correctionQty !== '' && !isNaN(parseFloat(correctionQty)) && (
                <p className={`text-xs mt-1 ${parseFloat(correctionQty) > item.current_stock ? 'text-green-600' : parseFloat(correctionQty) < item.current_stock ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {parseFloat(correctionQty) > item.current_stock
                    ? `Entrada de ${fmt(parseFloat(correctionQty) - item.current_stock)} ${item.unit}`
                    : parseFloat(correctionQty) < item.current_stock
                      ? `Saída de ${fmt(item.current_stock - parseFloat(correctionQty))} ${item.unit}`
                      : 'Sem alteração'}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Motivo (opcional)</label>
              <Input
                value={correctionNotes}
                onChange={e => setCorrectionNotes(e.target.value)}
                placeholder="Ex: Contagem física, perda, etc."
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCorrectionOpen(false)}>Cancelar</Button>
              <Button className="flex-1 gold-button" onClick={handleCorrection} disabled={correctionSaving}>
                {correctionSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Price Edit Dialog */}
      <Dialog open={priceEditOpen} onOpenChange={o => { if (!o) setPriceEditOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Editar Preço — {item.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Atual: <strong>{item.unit_cost > 0 ? fmtCur(item.unit_cost) : '—'}</strong>. Isso atualiza o preço do insumo e fica registrado no histórico de preços automaticamente.
            </p>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Novo preço da embalagem (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={priceEditValue}
                onChange={e => setPriceEditValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePriceEdit()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPriceEditOpen(false)}>Cancelar</Button>
              <Button className="flex-1 gold-button" onClick={handlePriceEdit} disabled={priceEditSaving}>
                {priceEditSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Add/Edit Dialog */}
      <Dialog open={supplierDialogOpen} onOpenChange={o => { if (!o) setSupplierDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Editar Fornecedor' : 'Adicionar Fornecedor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nome *</label>
              <Input value={supName} onChange={e => setSupName(e.target.value)} placeholder="Ex: Atacadão" autoFocus />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Preço unitário (R$)</label>
              <Input type="number" step="0.01" value={supPrice} onChange={e => setSupPrice(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Observações</label>
              <Input value={supNotes} onChange={e => setSupNotes(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sup-preferred" checked={supPreferred} onChange={e => setSupPreferred(e.target.checked)} className="w-4 h-4" />
              <label htmlFor="sup-preferred" className="text-sm text-foreground cursor-pointer">Fornecedor preferido</label>
            </div>
            <Button className="w-full" onClick={handleSaveSupplier} disabled={supSaving}>
              {supSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingSupplier ? 'Salvar alterações' : 'Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
