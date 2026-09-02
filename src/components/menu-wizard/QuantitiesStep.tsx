import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import SheetFormModal from '@/components/SheetFormModal';
import { convertToItemUnit } from '@/lib/units';

type DishRow = { id: string; sheet_id: string; sheet_name: string; planned_quantity: number; planned_unit: string; yield_quantity: number };
type Sheet = { id: string; name: string; category: string | null; yield_unit: string };
type RecipeIngredient = {
  item_id: string; item_name: string; recipe_quantity: number; unit: string;
  overrideId: string | null; override_quantity: number | null;
};

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default function QuantitiesStep({ menuId, onContinue, onBack }: { menuId: string; onContinue: () => void; onBack: () => void }) {
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [allSheets, setAllSheets] = useState<Sheet[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ingredientsByDish, setIngredientsByDish] = useState<Record<string, RecipeIngredient[]>>({});
  const [loadingIngredients, setLoadingIngredients] = useState<string | null>(null);
  const ingredientDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from('event_menu_dishes') as any)
      .select('id, sheet_id, planned_quantity, planned_unit, technical_sheets:sheet_id(name, yield_quantity)')
      .eq('menu_id', menuId)
      .order('created_at');
    if (data) {
      setDishes((data as any[]).map(d => ({
        id: d.id, sheet_id: d.sheet_id,
        sheet_name: d.technical_sheets?.name || '?',
        planned_quantity: d.planned_quantity ?? 0,
        planned_unit: d.planned_unit || 'un',
        yield_quantity: d.technical_sheets?.yield_quantity || 1,
      })).sort((a, b) => a.sheet_name.localeCompare(b.sheet_name, 'pt-BR')));
    }
    setLoading(false);
  };

  const toggleExpand = async (dish: DishRow) => {
    if (expandedId === dish.id) { setExpandedId(null); return; }
    setExpandedId(dish.id);
    if (ingredientsByDish[dish.id]) return; // já carregado
    setLoadingIngredients(dish.id);
    const [itemsRes, overridesRes] = await Promise.all([
      (supabase.from('technical_sheet_items') as any)
        .select('item_id, quantity, unit, stock_items:item_id(name, unit)')
        .eq('sheet_id', dish.sheet_id),
      (supabase.from('event_menu_dish_items') as any)
        .select('id, item_id, override_quantity')
        .eq('menu_dish_id', dish.id),
    ]);
    const overrideMap: Record<string, { id: string; override_quantity: number | null }> = {};
    for (const o of (overridesRes.data || []) as any[]) {
      overrideMap[o.item_id] = { id: o.id, override_quantity: o.override_quantity };
    }
    const ingredients: RecipeIngredient[] = ((itemsRes.data || []) as any[]).map(i => ({
      item_id: i.item_id,
      item_name: i.stock_items?.name || '?',
      recipe_quantity: Number(i.quantity) || 0,
      unit: i.unit || i.stock_items?.unit || '',
      overrideId: overrideMap[i.item_id]?.id ?? null,
      override_quantity: overrideMap[i.item_id]?.override_quantity ?? null,
    })).sort((a, b) => a.item_name.localeCompare(b.item_name, 'pt-BR'));
    setIngredientsByDish(prev => ({ ...prev, [dish.id]: ingredients }));
    setLoadingIngredients(null);
  };

  const updateIngredientOverride = (dish: DishRow, ing: RecipeIngredient, value: string) => {
    const val = parseFloat(value.replace(',', '.'));
    const overrideValue = isNaN(val) ? null : val;
    setIngredientsByDish(prev => ({
      ...prev,
      [dish.id]: prev[dish.id].map(i => i.item_id === ing.item_id ? { ...i, override_quantity: overrideValue } : i),
    }));
    const key = `${dish.id}:${ing.item_id}`;
    clearTimeout(ingredientDebounceRef.current[key]);
    ingredientDebounceRef.current[key] = setTimeout(async () => {
      const calculated = ing.recipe_quantity * (dish.planned_quantity / (dish.yield_quantity || 1));
      if (ing.overrideId) {
        await (supabase.from('event_menu_dish_items') as any)
          .update({ override_quantity: overrideValue, calculated_quantity: calculated })
          .eq('id', ing.overrideId);
      } else {
        const { data } = await (supabase.from('event_menu_dish_items') as any)
          .insert({ menu_dish_id: dish.id, item_id: ing.item_id, calculated_quantity: calculated, override_quantity: overrideValue, unit: ing.unit })
          .select('id').single();
        if (data) {
          setIngredientsByDish(prev => ({
            ...prev,
            [dish.id]: prev[dish.id].map(i => i.item_id === ing.item_id ? { ...i, overrideId: data.id } : i),
          }));
        }
      }
    }, 400);
  };

  useEffect(() => { load(); }, [menuId]);

  useEffect(() => {
    if (!addOpen) return;
    supabase.from('technical_sheets').select('id, name, category, yield_unit').order('name')
      .then(({ data }) => { if (data) setAllSheets(data as Sheet[]); });
  }, [addOpen]);

  const updateQuantity = (id: string, value: string) => {
    const qty = parseFloat(value.replace(',', '.')) || 0;
    setDishes(prev => prev.map(d => d.id === id ? { ...d, planned_quantity: qty } : d));
    clearTimeout(debounceRef.current[id]);
    debounceRef.current[id] = setTimeout(async () => {
      await supabase.from('event_menu_dishes').update({ planned_quantity: qty } as any).eq('id', id);
    }, 400);
  };

  const removeDish = async (id: string) => {
    await supabase.from('event_menu_dishes').delete().eq('id', id);
    setDishes(prev => prev.filter(d => d.id !== id));
  };

  const addExisting = async (sheet: Sheet) => {
    if (dishes.some(d => d.sheet_id === sheet.id)) { toast.error('Esse prato já está na lista'); return; }
    const { data, error } = await (supabase.from('event_menu_dishes') as any)
      .insert({ menu_id: menuId, sheet_id: sheet.id, planned_quantity: 0, planned_unit: sheet.yield_unit || 'un' })
      .select('id').single();
    if (error) { toast.error('Erro ao adicionar prato'); return; }
    setDishes(prev => [...prev, { id: data.id, sheet_id: sheet.id, sheet_name: sheet.name, planned_quantity: 0, planned_unit: sheet.yield_unit || 'un' }]
      .sort((a, b) => a.sheet_name.localeCompare(b.sheet_name, 'pt-BR')));
    setAddSearch('');
  };

  const onNewSheetCreated = async (sheet: { id: string; name: string; category: string | null }) => {
    const { data: full } = await supabase.from('technical_sheets').select('yield_unit').eq('id', sheet.id).single();
    const yieldUnit = (full as any)?.yield_unit || 'un';
    const { data, error } = await (supabase.from('event_menu_dishes') as any)
      .insert({ menu_id: menuId, sheet_id: sheet.id, planned_quantity: 0, planned_unit: yieldUnit })
      .select('id').single();
    if (error) { toast.error('Erro ao adicionar prato'); return; }
    setDishes(prev => [...prev, { id: data.id, sheet_id: sheet.id, sheet_name: sheet.name, planned_quantity: 0, planned_unit: yieldUnit }]
      .sort((a, b) => a.sheet_name.localeCompare(b.sheet_name, 'pt-BR')));
  };

  const filteredAddOptions = allSheets
    .filter(s => !dishes.some(d => d.sheet_id === s.id))
    .filter(s => !addSearch.trim() || normalize(s.name).includes(normalize(addSearch)));

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Defina quantas unidades de cada prato serão produzidas — os insumos da receita serão multiplicados por essa quantidade na lista de compras.
      </p>

      <div className="rounded-xl border border-border overflow-hidden bg-white">
        <div className="divide-y divide-border/50">
          {dishes.map(d => {
            const isExpanded = expandedId === d.id;
            const ingredients = ingredientsByDish[d.id];
            const factor = d.planned_quantity / (d.yield_quantity || 1);
            return (
              <div key={d.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleExpand(d)} className="text-muted-foreground hover:text-foreground flex-shrink-0" title="Ver receita">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <span className="flex-1 text-sm font-medium text-foreground cursor-pointer" onClick={() => toggleExpand(d)}>{d.sheet_name}</span>
                  <Input
                    type="text" inputMode="decimal"
                    value={String(d.planned_quantity)}
                    onChange={e => updateQuantity(d.id, e.target.value)}
                    className="w-24 text-right"
                  />
                  <span className="text-xs text-muted-foreground w-14">{d.planned_unit}</span>
                  <button onClick={() => removeDish(d.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="bg-muted/20 border-t border-border px-4 py-3 pl-11">
                    {loadingIngredients === d.id ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />Carregando receita...
                      </div>
                    ) : ingredients && ingredients.length > 0 ? (
                      <div className="space-y-1.5">
                        {ingredients.map(ing => {
                          const calculated = ing.recipe_quantity * factor;
                          const displayValue = ing.override_quantity ?? calculated;
                          const isOverridden = ing.override_quantity != null;
                          return (
                            <div key={ing.item_id} className="flex items-center gap-3 text-sm">
                              <span className="flex-1 text-foreground">{ing.item_name}</span>
                              {isOverridden && <span className="text-[10px] text-amber-600 font-medium">editado</span>}
                              <Input
                                type="text" inputMode="decimal"
                                value={String(Number(displayValue.toFixed(4)))}
                                onChange={e => updateIngredientOverride(d, ing, e.target.value)}
                                className="w-24 text-right h-8 text-xs"
                              />
                              <span className="text-xs text-muted-foreground w-14">{ing.unit}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">Essa ficha não tem insumos cadastrados.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {dishes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum prato selecionado.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <div className="relative flex-1">
          <button
            onClick={() => setAddOpen(v => !v)}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Search className="w-3.5 h-3.5" /> Adicionar prato existente
          </button>
          {addOpen && (
            <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg w-80 max-h-72 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-border">
                <Input autoFocus value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Buscar ficha técnica..." className="h-8 text-sm" />
              </div>
              <div className="overflow-y-auto">
                {filteredAddOptions.slice(0, 50).map(s => (
                  <button key={s.id} onClick={() => addExisting(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between">
                    <span>{s.name}</span>
                    {s.category && <span className="text-[10px] text-muted-foreground">{s.category}</span>}
                  </button>
                ))}
                {filteredAddOptions.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma ficha encontrada</p>}
              </div>
              <button onClick={() => setAddOpen(false)} className="text-xs text-muted-foreground hover:text-foreground border-t border-border py-1.5">Fechar</button>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />Criar ficha nova
        </Button>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button size="lg" disabled={dishes.length === 0} onClick={onContinue}>Continuar</Button>
      </div>

      <SheetFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode="create"
        onSaved={onNewSheetCreated}
      />
    </div>
  );
}
