import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Loader2, Printer, Copy, ShoppingCart, Package,
  Save, TrendingDown, CheckCircle2, Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { convertToItemUnit } from '@/lib/units';
import { getSavedShoppingLists, SavedShoppingList } from '@/components/ConsolidatedShoppingListDialog';
import { fmtNum, fmtCur } from '@/lib/format';

const MANTIMENTOS_ID = '3fc5dd78-8578-4c45-9c01-6ba8a2123e7a';

type TagBreakdownEntry = { tagId: string | null; tagName: string | null; tagColor: string | null; needed: number; toBuy: number };
type ShoppingItem = {
  id: string; name: string; unit: string; category: string;
  needed: number; inStock: number; toBuy: number; unitCost: number;
  supplier?: string;
  tagBreakdown?: TagBreakdownEntry[];
};
type TagRow = { id: string; name: string; color: string };
type EventSummary = { id: string; name: string; event_date: string | null; guest_count: number };

export default function ShoppingListDetailPage() {
  const { listId } = useParams<{ listId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Resolve menuIds: either from saved list (listId) or from ?ids= query param
  const [menuIds, setMenuIds] = useState<string[]>([]);
  const [savedList, setSavedList] = useState<SavedShoppingList | null>(null);
  const [loading, setLoading] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [allTags, setAllTags] = useState<TagRow[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [shopGroupMode, setShopGroupMode] = useState<'category' | 'supplier' | 'tag'>('category');
  const [shopFilter, setShopFilter] = useState<'all' | 'ok' | 'buy'>('all');
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number | string>>({});
  const [copyingSupplier, setCopyingSupplier] = useState<string | null>(null);
  const supplierRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (listId) {
      const saved = getSavedShoppingLists().find(l => l.id === listId);
      if (!saved) { navigate('/shopping-lists'); return; }
      setSavedList(saved);
      setMenuIds(saved.menuIds);
    } else {
      const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];
      if (ids.length === 0) { navigate('/shopping-lists'); return; }
      setMenuIds(ids);
    }
  }, [listId, searchParams]);

  useEffect(() => {
    if (menuIds.length > 0) load();
  }, [menuIds]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: menusData } = await supabase
        .from('event_menus').select('id, name, event_date, guest_count').in('id', menuIds);
      setEvents((menusData || []) as EventSummary[]);

      const { data: dishesData } = await supabase
        .from('event_menu_dishes').select('id, menu_id, sheet_id, planned_quantity, planned_unit').in('menu_id', menuIds);

      const sheetIds = [...new Set((dishesData || []).map((d: any) => d.sheet_id).filter(Boolean))];

      const [sheetsRes, sheetItemsRes, tagsRes] = await Promise.all([
        supabase.from('technical_sheets').select('id, name, yield_quantity').in('id', sheetIds),
        supabase.from('technical_sheet_items').select('id, sheet_id, item_id, quantity, section, tag_id').in('sheet_id', sheetIds),
        supabase.from('tags').select('id, name, color').order('name'),
      ]);
      const sheetsData = sheetsRes.data || [];
      const sheetItemsData = sheetItemsRes.data || [];
      const tagsData = (tagsRes.data || []) as TagRow[];
      setAllTags(tagsData);
      const tagsMap: Record<string, TagRow> = {};
      tagsData.forEach(t => { tagsMap[t.id] = t; });

      const referencedItemIds = [...new Set(sheetItemsData.map((si: any) => si.item_id).filter(Boolean))];
      const { data: stockData } = await supabase
        .from('stock_items').select('id, name, unit, unit_cost, current_stock, category').in('id', referencedItemIds);
      const stock = (stockData || []) as any[];

      const sheetsMap: Record<string, any> = {};
      (sheetsData || []).forEach((s: any) => { sheetsMap[s.id] = { ...s, items: [] }; });
      (sheetItemsData || []).forEach((si: any) => {
        if (sheetsMap[si.sheet_id]) sheetsMap[si.sheet_id].items.push(si);
      });

      const menusMap: Record<string, any> = {};
      (menusData || []).forEach((m: any) => { menusMap[m.id] = m; });

      const map: Record<string, ShoppingItem> = {};
      // tagMap keyed by `${item_id}::${tag_id||''}` → needed qty per tag
      const tagMap: Record<string, { tagId: string | null; tagName: string | null; tagColor: string | null; needed: number }> = {};
      (dishesData || []).forEach((dish: any) => {
        const menu = menusMap[dish.menu_id];
        if (!menu) return;
        const sheet = sheetsMap[dish.sheet_id];
        if (!sheet) return;
        const isMantimentos = dish.sheet_id === MANTIMENTOS_ID;
        const recipeItems = (sheet.items || []).filter((i: any) => !i.section || i.section === 'receita');
        if (recipeItems.length === 0) return;
        const scale = isMantimentos
          ? menu.guest_count / (sheet.yield_quantity || 1)
          : dish.planned_quantity / (sheet.yield_quantity || 1);
        recipeItems.forEach((si: any) => {
          const s = stock.find((x: any) => x.id === si.item_id);
          const itemUnit = s?.unit || 'un';
          const qtyInItemUnit = convertToItemUnit(si.quantity, itemUnit, itemUnit);
          const needed = qtyInItemUnit * scale;
          if (!map[si.item_id]) {
            map[si.item_id] = { id: si.item_id, name: s?.name || si.item_id, unit: itemUnit, category: s?.category || 'Outros', needed: 0, inStock: s?.current_stock || 0, toBuy: 0, unitCost: s?.unit_cost || 0 };
          }
          map[si.item_id].needed += needed;
          // Tag breakdown
          const tagId = si.tag_id || null;
          const tag = tagId ? tagsMap[tagId] : null;
          const tagKey = `${si.item_id}::${tagId || ''}`;
          if (!tagMap[tagKey]) {
            tagMap[tagKey] = { tagId, tagName: tag?.name || null, tagColor: tag?.color || null, needed: 0 };
          }
          tagMap[tagKey].needed += needed;
        });
      });

      const rawList = Object.values(map)
        .map(i => {
          const toBuy = Math.max(0, i.needed - i.inStock);
          // Attach tag breakdown with toBuy proportional to needed
          const breakdown: TagBreakdownEntry[] = Object.entries(tagMap)
            .filter(([k]) => k.startsWith(i.id + '::'))
            .map(([, v]) => ({
              tagId: v.tagId,
              tagName: v.tagName,
              tagColor: v.tagColor,
              needed: v.needed,
              toBuy: i.needed > 0 ? (v.needed / i.needed) * toBuy : 0,
            }));
          return { ...i, toBuy, tagBreakdown: breakdown };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      if (rawList.length > 0) {
        const itemIds = rawList.map(i => i.id);
        const { data: suppData } = await supabase.from('item_suppliers').select('item_id, supplier_name, is_preferred').in('item_id', itemIds).eq('is_preferred', true);
        const suppMap: Record<string, string> = {};
        (suppData || []).forEach((s: any) => { suppMap[s.item_id] = s.supplier_name; });
        setShoppingList(rawList.map(i => ({ ...i, supplier: suppMap[i.id] })));
      } else {
        setShoppingList(rawList);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar lista');
    }
    setLoading(false);
  };

  const getEffectiveQty = (item: ShoppingItem) => {
    const ov = qtyOverrides[item.id];
    if (ov !== undefined && ov !== '') return parseFloat(String(ov)) || 0;
    return item.toBuy;
  };

  const itemsToBuy = shoppingList.filter(i => i.toBuy > 0).length;
  const itemsOk = shoppingList.filter(i => i.toBuy === 0).length;
  const totalToBuy = shoppingList.reduce((s, i) => s + getEffectiveQty(i) * i.unitCost, 0);

  const filteredList = shoppingList.filter(i => {
    if (shopFilter === 'ok') return i.toBuy === 0;
    if (shopFilter === 'buy') return i.toBuy > 0;
    return true;
  }).filter(i => {
    if (!tagFilter) return true;
    return (i.tagBreakdown || []).some(t => t.tagId === tagFilter);
  });

  const suppliersInList = [...new Set(shoppingList.filter(i => i.toBuy > 0 && i.supplier).map(i => i.supplier!))].sort();
  const itemsNoSupplier = shoppingList.filter(i => i.toBuy > 0 && !i.supplier);

  const printBase = (title: string, bodyHtml: string) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}h2{margin:0 0 4px}p{margin:0 0 12px;color:#666;font-size:11px}
      table{width:100%;border-collapse:collapse}th{background:#f5f5f5;text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase}
      td{padding:5px 8px;border-bottom:1px solid #eee}.right{text-align:right}.total-row td{font-weight:bold;border-top:2px solid #333}
      @media print{body{margin:10px}}</style></head><body>${bodyHtml}</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const handlePrintAll = () => {
    const toBuy = shoppingList.filter(i => i.toBuy > 0);
    if (toBuy.length === 0) return;
    const rows = toBuy.map(i => `<tr><td>${i.name}</td><td>${i.category}</td><td class="right">${fmtNum(i.toBuy)} ${i.unit}</td><td class="right">R$ ${fmtCur(i.unitCost)}</td><td class="right">R$ ${fmtCur(i.toBuy * i.unitCost)}</td></tr>`).join('');
    const total = toBuy.reduce((s, i) => s + i.toBuy * i.unitCost, 0);
    const eventNames = events.map(e => e.name).join(', ');
    printBase('Lista de Compras', `<h2>Lista de Compras</h2><p>${eventNames}</p>
      <table><thead><tr><th>Item</th><th>Categoria</th><th class="right">Qtd</th><th class="right">Preço</th><th class="right">Total</th></tr></thead>
      <tbody>${rows}<tr class="total-row"><td colspan="4" style="text-align:right">Total estimado:</td><td class="right">R$ ${fmtCur(total)}</td></tr></tbody></table>`);
  };

  const handlePrintBySupplier = (supplierName: string) => {
    const items = shoppingList.filter(i => i.supplier === supplierName && i.toBuy > 0);
    if (items.length === 0) return;
    const rows = items.map(i => `<tr><td>${i.name}</td><td class="right">${fmtNum(getEffectiveQty(i))} ${i.unit}</td><td class="right">R$ ${fmtCur(i.unitCost)}</td><td class="right">R$ ${fmtCur(getEffectiveQty(i) * i.unitCost)}</td></tr>`).join('');
    const total = items.reduce((s, i) => s + getEffectiveQty(i) * i.unitCost, 0);
    printBase(`Pedido — ${supplierName}`, `<h2>Pedido — ${supplierName}</h2><p>${events.map(e => e.name).join(', ')}</p>
      <table><thead><tr><th>Item</th><th class="right">Qtd</th><th class="right">Preço</th><th class="right">Total</th></tr></thead>
      <tbody>${rows}<tr class="total-row"><td colspan="3" style="text-align:right">Total:</td><td class="right">R$ ${fmtCur(total)}</td></tr></tbody></table>`);
  };

  const copySupplierOrderAsImage = async (supplierName: string) => {
    const el = supplierRefs.current[supplierName];
    if (!el) return;
    setCopyingSupplier(supplierName);
    const blobPromise: Promise<Blob> = html2canvas(el, { backgroundColor: '#ffffff', scale: 2 })
      .then(canvas => new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
      }));
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
      toast.success('Imagem copiada!');
    } catch {
      try {
        const blob = await blobPromise;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `pedido-${supplierName}.png`; a.click();
        URL.revokeObjectURL(url); toast.success('Imagem baixada!');
      } catch { toast.error('Erro ao gerar imagem'); }
    }
    setCopyingSupplier(null);
  };

  const handleSave = () => {
    const existing = getSavedShoppingLists();
    const already = existing.find(l => JSON.stringify([...l.menuIds].sort()) === JSON.stringify([...menuIds].sort()));
    if (already) { toast.info('Esta lista já está salva.'); return; }
    const newList: SavedShoppingList = {
      id: crypto.randomUUID(), name: events.map(e => e.name).join(' + '),
      menuIds: [...menuIds], eventNames: events.map(e => e.name), createdAt: new Date().toISOString(),
    };
    // Mark events as consolidated
    try {
      const consolidatedIds = JSON.parse(localStorage.getItem('consolidatedEventIds') || '[]');
      const merged = [...new Set([...consolidatedIds, ...menuIds])];
      localStorage.setItem('consolidatedEventIds', JSON.stringify(merged));
    } catch {}
    localStorage.setItem('savedShoppingLists', JSON.stringify([...existing, newList]));
    toast.success('Lista salva!');
    navigate('/shopping-lists');
  };

  const isAlreadySaved = !!savedList || getSavedShoppingLists().some(
    l => JSON.stringify([...l.menuIds].sort()) === JSON.stringify([...menuIds].sort())
  );

  const title = savedList?.name || (events.length > 0 ? events.map(e => e.name).join(' + ') : 'Lista de Compras');

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/shopping-lists')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Listas de Compras
          </button>
          <h1 className="text-3xl font-display font-bold gold-text flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-primary" />
            {loading ? 'Carregando...' : title}
          </h1>
          {events.length > 1 && (
            <p className="text-muted-foreground mt-1 text-sm">
              {events.map(e => e.name).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-8">
          {!loading && shoppingList.length > 0 && menuIds.length > 1 && !isAlreadySaved && (
            <Button variant="outline" onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />Salvar Lista
            </Button>
          )}
          {!loading && shoppingList.length > 0 && (
            <Button variant="outline" onClick={handlePrintAll} className="gap-2">
              <Printer className="w-4 h-4" />Imprimir Lista
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando lista de compras...</p>
        </div>
      ) : shoppingList.length === 0 ? (
        <div className="py-24 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground">Nenhum item encontrado para estes eventos.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {/* Stats + controls bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3" style={{ background: 'hsl(40 30% 97%)' }}>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span className="font-semibold text-destructive">{itemsToBuy}</span>
                <span className="text-muted-foreground">a comprar</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="font-semibold text-success">{itemsOk}</span>
                <span className="text-muted-foreground">em estoque</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 bg-border/40 rounded-lg p-0.5">
                {([['category', 'Por Categoria'], ['supplier', 'Por Fornecedor'], ['tag', 'Por Tag']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setShopGroupMode(v as any)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${shopGroupMode === v ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
                ))}
              </div>
              {shopGroupMode === 'category' && (
                <div className="flex gap-1 bg-border/40 rounded-lg p-0.5">
                  {([['all', 'Todos'], ['ok', '✓ Ok'], ['buy', '⬇ Comprar']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setShopFilter(v)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${shopFilter === v ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
                  ))}
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Custo compra</p>
                <p className="font-bold text-sm">R$ {fmtCur(totalToBuy)}</p>
              </div>
            </div>
          </div>

          {/* Tag filter pills (shown for category mode when tags exist) */}
          {shopGroupMode === 'category' && allTags.length > 0 && (
            <div className="flex gap-2 px-5 py-2.5 border-b border-border flex-wrap" style={{ background: 'hsl(40 30% 98%)' }}>
              <button
                onClick={() => setTagFilter(null)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${tagFilter === null ? 'bg-foreground text-background border-foreground' : 'bg-white border-border text-muted-foreground hover:text-foreground'}`}
              >
                Todas
              </button>
              {allTags.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTagFilter(tagFilter === t.id ? null : t.id)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${tagFilter === t.id ? 'text-white' : 'bg-white text-muted-foreground hover:text-foreground border-border'}`}
                  style={tagFilter === t.id ? { background: t.color, borderColor: t.color } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: tagFilter === t.id ? '#fff' : t.color }} />
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {/* Category view */}
          {shopGroupMode === 'category' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">INSUMO</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">NECESSÁRIO</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">EM ESTOQUE</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">A COMPRAR</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">CUSTO EST.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredList.map(item => (
                  <tr key={item.id} className={item.toBuy > 0 ? 'bg-red-50/30' : ''}>
                    <td className="px-5 py-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {item.toBuy > 0
                            ? <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                            : <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                        </div>
                        <div className="min-w-0">
                          <span className={item.toBuy > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>{item.name}</span>
                          {item.supplier && <span className="text-[10px] text-muted-foreground/60 italic ml-1">({item.supplier})</span>}
                          {(item.tagBreakdown || []).length > 1 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(item.tagBreakdown || []).map((t, ti) => (
                                <span key={ti} className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: (t.tagColor || '#6366f1') + '20', color: t.tagColor || '#6366f1' }}>
                                  {t.tagName || 'Sem tag'} {fmtNum(t.needed)}{item.unit}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(item.needed)} {item.unit}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(item.inStock)} {item.unit}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {item.toBuy > 0
                        ? <span className="text-destructive">{fmtNum(item.toBuy)} {item.unit}</span>
                        : <span className="text-success text-xs">✓ ok</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {item.toBuy > 0 ? `R$ ${fmtCur(item.toBuy * item.unitCost)}` : '—'}
                    </td>
                  </tr>
                ))}
                {filteredList.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhum item neste filtro</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                  <td colSpan={4} className="px-5 py-3 text-right font-semibold text-foreground">Total estimado para comprar:</td>
                  <td className="px-5 py-3 text-right font-bold text-lg gold-text">R$ {fmtCur(totalToBuy)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* Tag view */}
          {shopGroupMode === 'tag' && (() => {
            // Build tag sections: for each tag, collect all items that have usage under that tag
            const tagSections: Record<string, { tag: TagRow | null; rows: { item: ShoppingItem; needed: number; toBuy: number }[] }> = {};
            shoppingList.filter(i => i.toBuy > 0).forEach(item => {
              (item.tagBreakdown || []).filter(t => t.needed > 0).forEach(t => {
                const key = t.tagId || '__none__';
                if (!tagSections[key]) tagSections[key] = { tag: t.tagId ? allTags.find(x => x.id === t.tagId) || null : null, rows: [] };
                tagSections[key].rows.push({ item, needed: t.needed, toBuy: t.toBuy });
              });
            });
            const sortedKeys = Object.keys(tagSections).sort((a, b) => {
              if (a === '__none__') return 1;
              if (b === '__none__') return -1;
              return (tagSections[a].tag?.name || '').localeCompare(tagSections[b].tag?.name || '');
            });
            return (
              <div className="divide-y divide-border/50">
                {sortedKeys.length === 0 && <p className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhum item a comprar.</p>}
                {sortedKeys.map(key => {
                  const section = tagSections[key];
                  const tag = section.tag;
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-3 px-5 py-3 bg-muted/20">
                        {tag ? (
                          <span className="flex items-center gap-1.5 font-semibold text-sm" style={{ color: tag.color }}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: tag.color }} />
                            {tag.name}
                          </span>
                        ) : (
                          <span className="font-semibold text-muted-foreground text-sm">Sem tag</span>
                        )}
                        <span className="text-xs text-muted-foreground">({section.rows.length} item{section.rows.length !== 1 ? 's' : ''})</span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border/40">
                          {section.rows.sort((a, b) => a.item.name.localeCompare(b.item.name)).map(({ item, needed, toBuy }) => (
                            <tr key={item.id}>
                              <td className="px-5 py-2.5 font-medium text-foreground">{item.name}</td>
                              <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.unit}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtNum(needed)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-destructive">{fmtNum(toBuy)}</td>
                              <td className="px-5 py-2.5 text-right text-muted-foreground text-xs">R$ {fmtCur(toBuy * item.unitCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Supplier view */}
          {shopGroupMode === 'supplier' && (
            <div className="divide-y divide-border/50">
              {suppliersInList.length === 0 && itemsNoSupplier.length === 0 && (
                <p className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhum item a comprar.</p>
              )}
              {suppliersInList.map(supplier => {
                const items = shoppingList.filter(i => i.supplier === supplier && i.toBuy > 0);
                const supplierTotal = items.reduce((s, i) => s + getEffectiveQty(i) * i.unitCost, 0);
                return (
                  <div key={supplier}>
                    <div className="flex items-center justify-between px-5 py-3 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="font-semibold text-foreground text-sm">{supplier}</span>
                        <span className="text-xs text-muted-foreground">({items.length} item{items.length !== 1 ? 's' : ''})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-primary">R$ {fmtCur(supplierTotal)}</span>
                        <Button variant="outline" size="sm" onClick={() => copySupplierOrderAsImage(supplier)}
                          disabled={copyingSupplier === supplier} className="gap-1.5 h-7 text-xs">
                          {copyingSupplier === supplier ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                          Copiar Imagem
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrintBySupplier(supplier)} className="gap-1.5 h-7 text-xs">
                          <Printer className="w-3 h-3" />Imprimir Pedido
                        </Button>
                      </div>
                    </div>
                    <div ref={el => { supplierRefs.current[supplier] = el; }} className="bg-white">
                      <div className="bg-primary/5 px-4 py-2 border-b border-border">
                        <p className="font-bold text-sm text-foreground">{supplier}</p>
                        <p className="text-xs text-muted-foreground">{events.map(e => e.name).join(' + ')}</p>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/40 text-xs text-muted-foreground" style={{ background: 'hsl(40 30% 98%)' }}>
                            <th className="text-right px-5 py-2 font-semibold w-28">A COMPRAR</th>
                            <th className="text-left px-3 py-2 font-semibold w-14">UN</th>
                            <th className="text-left px-3 py-2 font-semibold">PRODUTO</th>
                            <th className="text-right px-5 py-2 font-semibold">CUSTO UNIT.</th>
                            <th className="text-right px-5 py-2 font-semibold">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {items.map(item => {
                            const effQty = getEffectiveQty(item);
                            return (
                              <tr key={item.id}>
                                <td className="px-2 py-1.5 text-right w-28">
                                  <input type="number" step="any" min="0"
                                    className="w-24 text-right font-semibold text-destructive bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none rounded px-2 py-1 text-sm transition-colors"
                                    value={qtyOverrides[item.id] !== undefined ? qtyOverrides[item.id] : item.toBuy}
                                    onChange={e => setQtyOverrides(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    onBlur={e => {
                                      const v = parseFloat(e.target.value);
                                      if (isNaN(v) || v < 0) setQtyOverrides(prev => ({ ...prev, [item.id]: item.toBuy }));
                                      else setQtyOverrides(prev => ({ ...prev, [item.id]: v }));
                                    }}
                                  />
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.unit}</td>
                                <td className="px-3 py-2.5 font-medium text-foreground">{item.name}</td>
                                <td className="px-5 py-2.5 text-right text-muted-foreground">R$ {fmtCur(item.unitCost)}</td>
                                <td className="px-5 py-2.5 text-right font-medium">R$ {fmtCur(effQty * item.unitCost)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {itemsNoSupplier.length > 0 && (
                <div>
                  <div className="px-5 py-3 bg-muted/20">
                    <span className="font-semibold text-muted-foreground text-sm">Sem fornecedor definido ({itemsNoSupplier.length})</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-border/40">
                      {itemsNoSupplier.map(item => (
                        <tr key={item.id}>
                          <td className="px-5 py-2.5 font-medium text-foreground">{item.name}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{item.category}</td>
                          <td className="px-5 py-2.5 text-right text-destructive font-semibold">{fmtNum(item.toBuy)} {item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
