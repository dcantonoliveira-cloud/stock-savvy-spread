import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Calendar, MapPin, Users, ShoppingCart,
  ChevronDown, ChevronUp, CheckCircle2, TrendingDown, Loader2
} from 'lucide-react';

type StockItem = { id: string; name: string; unit: string; unit_cost: number; current_stock: number };
type SheetItem = { item_id: string; item_name: string; quantity: number; unit: string; unit_cost: number; section: 'receita' | 'decoracao' };
type Sheet = { id: string; name: string; yield_quantity: number; yield_unit: string; items: SheetItem[] };
type MenuDish = { id: string; sheet_id: string; sheet_name: string; planned_quantity: number; planned_unit: string; sheet: Sheet | null; expanded: boolean };
type EventMenu = { id: string; name: string; location: string | null; guest_count: number; staff_count: number; event_date: string | null; status: string; notes: string | null; dishes: MenuDish[] };
type ShoppingItem = { id: string; name: string; unit: string; needed: number; inStock: number; toBuy: number; unitCost: number };

export default function EventMenuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<EventMenu | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pratos' | 'compras'>('pratos');

  useEffect(() => {
    if (!id) return;
    loadMenu();
  }, [id]);

  const loadMenu = async () => {
    setLoading(true);
    const [menuRes, itemsRes] = await Promise.all([
      supabase.from('event_menus').select('*').eq('id', id!).single(),
      supabase.from('stock_items').select('id, name, unit, unit_cost, current_stock').order('name'),
    ]);

    if (!menuRes.data) { navigate('/event-menus'); return; }
    const stockData = (itemsRes.data || []) as unknown as StockItem[];
    setStockItems(stockData);

    const { data: dishes } = await supabase.from('event_menu_dishes').select('*').eq('menu_id', id!).order('sort_order');

    const enrichedDishes: MenuDish[] = await Promise.all((dishes || []).map(async (d: any) => {
      const { data: sheetData } = await supabase.from('technical_sheets').select('*').eq('id', d.sheet_id).single();
      if (!sheetData) return { id: d.id, sheet_id: d.sheet_id, sheet_name: '?', planned_quantity: d.planned_quantity, planned_unit: d.planned_unit || 'un', sheet: null, expanded: false };
      const { data: si } = await supabase.from('technical_sheet_items').select('item_id, quantity, unit_cost, section').eq('sheet_id', d.sheet_id);
      const items: SheetItem[] = (si || []).map((i: any) => {
        const item = stockData.find(x => x.id === i.item_id);
        return { item_id: i.item_id, item_name: item?.name || '?', quantity: i.quantity, unit: item?.unit || '', unit_cost: i.unit_cost || item?.unit_cost || 0, section: i.section || 'receita' };
      });
      return { id: d.id, sheet_id: d.sheet_id, sheet_name: (sheetData as any).name, planned_quantity: d.planned_quantity, planned_unit: d.planned_unit || 'un', sheet: { ...(sheetData as any), items }, expanded: false };
    }));

    const loadedMenu: EventMenu = { ...(menuRes.data as any), dishes: enrichedDishes };
    setMenu(loadedMenu);
    buildShoppingList(enrichedDishes, stockData);
    setLoading(false);
  };

  const buildShoppingList = (dishes: MenuDish[], stock: StockItem[]) => {
    const map: Record<string, ShoppingItem> = {};
    dishes.forEach(dish => {
      if (!dish.sheet) return;
      const scale = dish.planned_quantity / (dish.sheet.yield_quantity || 1);
      dish.sheet.items.forEach(si => {
        const needed = si.quantity * scale;
        if (!map[si.item_id]) {
          const s = stock.find(x => x.id === si.item_id);
          map[si.item_id] = { id: si.item_id, name: si.item_name, unit: si.unit, needed: 0, inStock: s?.current_stock || 0, toBuy: 0, unitCost: si.unit_cost };
        }
        map[si.item_id].needed += needed;
      });
    });
    setShoppingList(Object.values(map).map(i => ({ ...i, toBuy: Math.max(0, i.needed - i.inStock) })).sort((a, b) => a.name.localeCompare(b.name)));
  };

  const toggleExpand = (dishId: string) => {
    setMenu(prev => prev ? { ...prev, dishes: prev.dishes.map(d => d.id === dishId ? { ...d, expanded: !d.expanded } : d) } : prev);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!menu) return null;

  const totalToBuy = shoppingList.reduce((s, i) => s + i.toBuy * i.unitCost, 0);
  const totalNeeded = shoppingList.reduce((s, i) => s + i.needed * i.unitCost, 0);
  const itemsToBuy = shoppingList.filter(i => i.toBuy > 0).length;
  const itemsOk = shoppingList.filter(i => i.toBuy === 0).length;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back */}
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate('/event-menus')}>
        <ArrowLeft className="w-4 h-4 mr-1" />Voltar aos cardápios
      </Button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-border p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">{menu.name}</h1>
            <div className="flex flex-wrap gap-2">
              {menu.event_date && (
                <Badge variant="outline" className="text-sm px-3 py-1">
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  {new Date(menu.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Badge>
              )}
              {menu.location && <Badge variant="outline" className="text-sm px-3 py-1"><MapPin className="w-3.5 h-3.5 mr-1.5" />{menu.location}</Badge>}
              <Badge variant="outline" className="text-sm px-3 py-1"><Users className="w-3.5 h-3.5 mr-1.5" />{menu.guest_count} convidados</Badge>
              {menu.staff_count > 0 && <Badge variant="outline" className="text-sm px-3 py-1">{menu.staff_count} profissionais</Badge>}
            </div>
            {menu.notes && <p className="text-sm text-muted-foreground mt-2">{menu.notes}</p>}
          </div>
          <Badge variant={menu.status === 'draft' ? 'secondary' : 'default'} className="text-xs">
            {menu.status === 'draft' ? 'Rascunho' : menu.status}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{menu.dishes.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">pratos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{shoppingList.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">insumos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{itemsToBuy}</p>
            <p className="text-xs text-muted-foreground mt-0.5">a comprar</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold gold-text">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-0.5">custo compra</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-border p-1 w-fit">
        <button
          onClick={() => setActiveTab('pratos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pratos' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Fichas Técnicas ({menu.dishes.length})
        </button>
        <button
          onClick={() => setActiveTab('compras')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === 'compras' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Lista de Compras
          {itemsToBuy > 0 && <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${activeTab === 'compras' ? 'bg-white/20' : 'bg-destructive text-white'}`}>{itemsToBuy}</span>}
        </button>
      </div>

      {/* Fichas Técnicas */}
      {activeTab === 'pratos' && (
        <div className="space-y-3">
          {menu.dishes.map(dish => {
            const recipeItems = dish.sheet?.items.filter(i => i.section !== 'decoracao') || [];
            const decoItems = dish.sheet?.items.filter(i => i.section === 'decoracao') || [];
            const scale = dish.planned_quantity / (dish.sheet?.yield_quantity || 1);

            return (
              <div key={dish.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => toggleExpand(dish.id)}>
                  <div className="flex items-center gap-3">
                    {dish.expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    <div>
                      <p className="font-medium text-foreground">{dish.sheet_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dish.planned_quantity} {dish.planned_unit}
                        {dish.sheet && ` · ${dish.sheet.items.length} ingredientes`}
                        {dish.sheet && ` · Rende ${dish.sheet.yield_quantity} ${dish.sheet.yield_unit}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {recipeItems.length > 0 && <Badge variant="outline" className="text-[10px]">{recipeItems.length} receita</Badge>}
                    {decoItems.length > 0 && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">🎨 {decoItems.length} decoração</Badge>}
                  </div>
                </div>

                {dish.expanded && dish.sheet && (
                  <div className="border-t border-border">
                    {/* Receita */}
                    {recipeItems.length > 0 && (
                      <div className="p-5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Receita Principal</p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-xs text-muted-foreground">
                              <th className="text-left pb-2">Insumo</th>
                              <th className="text-right pb-2">Na receita</th>
                              <th className="text-right pb-2">Para {dish.planned_quantity} {dish.planned_unit}</th>
                              <th className="text-right pb-2">Custo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {recipeItems.map(si => (
                              <tr key={si.item_id}>
                                <td className="py-2 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td>
                                <td className="py-2 text-right text-muted-foreground">{si.quantity}</td>
                                <td className="py-2 text-right font-medium text-foreground">{(si.quantity * scale).toFixed(3)}</td>
                                <td className="py-2 text-right text-muted-foreground text-xs">R$ {(si.quantity * scale * si.unit_cost).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-border">
                              <td colSpan={3} className="pt-2 text-right text-xs font-semibold text-muted-foreground">Total receita:</td>
                              <td className="pt-2 text-right text-sm font-bold text-primary">R$ {recipeItems.reduce((s, i) => s + i.quantity * scale * i.unit_cost, 0).toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {/* Decoração */}
                    {decoItems.length > 0 && (
                      <div className="p-5 border-t border-dashed border-amber-200" style={{ background: 'hsl(38 80% 98%)' }}>
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">🎨 Decoração</p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-amber-200 text-xs text-muted-foreground">
                              <th className="text-left pb-2">Item</th>
                              <th className="text-right pb-2">Na receita</th>
                              <th className="text-right pb-2">Para {dish.planned_quantity} {dish.planned_unit}</th>
                              <th className="text-right pb-2">Custo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {decoItems.map(si => (
                              <tr key={si.item_id}>
                                <td className="py-2 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td>
                                <td className="py-2 text-right text-muted-foreground">{si.quantity}</td>
                                <td className="py-2 text-right font-medium text-foreground">{(si.quantity * scale).toFixed(3)}</td>
                                <td className="py-2 text-right text-muted-foreground text-xs">R$ {(si.quantity * scale * si.unit_cost).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lista de Compras */}
      {activeTab === 'compras' && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Summary */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span className="font-semibold text-destructive">{itemsToBuy} itens</span>
                <span className="text-muted-foreground">a comprar</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="font-semibold text-success">{itemsOk} itens</span>
                <span className="text-muted-foreground">em estoque</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Custo total compra</p>
              <p className="font-bold text-foreground">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

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
              {shoppingList.map(item => (
                <tr key={item.id} className={item.toBuy > 0 ? 'bg-red-50/30' : ''}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {item.toBuy > 0
                        ? <TrendingDown className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                        : <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                      }
                      <span className={item.toBuy > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{item.needed.toFixed(2)} {item.unit}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{item.inStock} {item.unit}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {item.toBuy > 0
                      ? <span className="text-destructive">{item.toBuy.toFixed(2)} {item.unit}</span>
                      : <span className="text-success text-xs">✓ ok</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground">
                    {item.toBuy > 0 ? `R$ ${(item.toBuy * item.unitCost).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                <td colSpan={4} className="px-5 py-3 text-right font-semibold text-foreground">Total estimado para comprar:</td>
                <td className="px-5 py-3 text-right font-bold text-lg gold-text">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
