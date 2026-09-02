import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, ShoppingCart } from 'lucide-react';
import { convertToItemUnit } from '@/lib/units';
import { fmtNum } from '@/lib/format';

type Row = { itemId: string; name: string; unit: string; needed: number; inStock: number; toBuy: number };

export default function ShoppingListStep({ menuId, onBack }: { menuId: string; onBack: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const build = async () => {
      setLoading(true);
      const { data: dishData } = await (supabase.from('event_menu_dishes') as any)
        .select('id, sheet_id, planned_quantity')
        .eq('menu_id', menuId);
      const dishes = (dishData || []) as { id: string; sheet_id: string; planned_quantity: number }[];

      if (dishes.length === 0) { setRows([]); setLoading(false); return; }

      const sheetIds = [...new Set(dishes.map(d => d.sheet_id))];
      const dishIds = dishes.map(d => d.id);
      const [sheetsRes, itemsRes, overridesRes] = await Promise.all([
        supabase.from('technical_sheets').select('id, yield_quantity').in('id', sheetIds),
        (supabase.from('technical_sheet_items') as any).select('sheet_id, item_id, quantity, unit').in('sheet_id', sheetIds),
        (supabase.from('event_menu_dish_items') as any).select('menu_dish_id, item_id, override_quantity').in('menu_dish_id', dishIds),
      ]);
      const yieldBySheet: Record<string, number> = {};
      for (const s of (sheetsRes.data || []) as any[]) yieldBySheet[s.id] = s.yield_quantity || 1;

      // Sobrescritas manuais feitas no passo 2 (Quantidades) — têm prioridade sobre o cálculo automático
      const overrideByDishItem: Record<string, number> = {};
      for (const o of (overridesRes.data || []) as any[]) {
        if (o.override_quantity != null) overrideByDishItem[`${o.menu_dish_id}:${o.item_id}`] = o.override_quantity;
      }

      const sheetItems = (itemsRes.data || []) as { sheet_id: string; item_id: string; quantity: number; unit: string }[];
      const itemIds = [...new Set(sheetItems.map(i => i.item_id))];
      const { data: stockData } = itemIds.length
        ? await (supabase.from('stock_items') as any).select('id, name, unit, current_stock').in('id', itemIds)
        : { data: [] as any[] };
      const stockById: Record<string, { name: string; unit: string; current_stock: number }> = {};
      for (const s of (stockData || []) as any[]) stockById[s.id] = s;

      // Soma necessário de cada insumo, cruzando todos os pratos que o usam
      const neededByItem: Record<string, number> = {};
      for (const dish of dishes) {
        const yieldQty = yieldBySheet[dish.sheet_id] || 1;
        const factor = (dish.planned_quantity || 0) / yieldQty;
        for (const si of sheetItems.filter(i => i.sheet_id === dish.sheet_id)) {
          const stock = stockById[si.item_id];
          if (!stock) continue;
          const overrideKey = `${dish.id}:${si.item_id}`;
          const recipeQty = overrideKey in overrideByDishItem ? overrideByDishItem[overrideKey] : si.quantity * factor;
          if (recipeQty === 0) continue;
          const neededInItemUnit = convertToItemUnit(recipeQty, si.unit || stock.unit, stock.unit);
          neededByItem[si.item_id] = (neededByItem[si.item_id] || 0) + neededInItemUnit;
        }
      }

      const built: Row[] = Object.entries(neededByItem).map(([itemId, needed]) => {
        const stock = stockById[itemId];
        const inStock = stock?.current_stock || 0;
        return {
          itemId, name: stock?.name || '?', unit: stock?.unit || '',
          needed, inStock, toBuy: Math.max(0, needed - inStock),
        };
      }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      setRows(built);
      setLoading(false);
    };
    build();
  }, [menuId]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="w-5 h-5 text-primary" />
        <p className="text-sm text-muted-foreground">Insumos consolidados de todos os pratos, cruzados com o estoque atual.</p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
              <th className="text-left px-4 py-2.5">INSUMO</th>
              <th className="text-right px-4 py-2.5">NECESSÁRIO</th>
              <th className="text-right px-4 py-2.5">EM ESTOQUE</th>
              <th className="text-right px-4 py-2.5">A COMPRAR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map(r => (
              <tr key={r.itemId} className={r.toBuy > 0 ? 'bg-amber-50/40' : ''}>
                <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{fmtNum(r.needed)} {r.unit}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{fmtNum(r.inStock)} {r.unit}</td>
                <td className={`px-4 py-2 text-right font-semibold ${r.toBuy > 0 ? 'text-amber-700' : 'text-success'}`}>
                  {r.toBuy > 0 ? `${fmtNum(r.toBuy)} ${r.unit}` : 'OK'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Nenhum insumo — defina as quantidades no passo anterior.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-start mt-6">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
      </div>
    </div>
  );
}
