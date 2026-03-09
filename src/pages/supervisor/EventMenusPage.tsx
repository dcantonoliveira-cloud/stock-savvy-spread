import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, Calendar, MapPin, Users, ChevronDown, ChevronUp, Pencil, ShoppingCart, X } from 'lucide-react';
import { toast } from 'sonner';

type StockItem = { id: string; name: string; unit: string; unit_cost: number; current_stock: number };
type SheetItem = { item_id: string; item_name: string; quantity: number; unit: string; unit_cost: number };
type Sheet = { id: string; name: string; servings: number; yield_quantity: number; yield_unit: string; items: SheetItem[] };
type MenuDish = {
  id: string;
  sheet_id: string;
  sheet_name: string;
  planned_quantity: number;
  planned_unit: string;
  sheet: Sheet | null;
  expanded: boolean;
  overrides: Record<string, number>; // item_id -> override quantity
};
type EventMenu = {
  id: string;
  name: string;
  location: string | null;
  guest_count: number;
  staff_count: number;
  event_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  dishes: MenuDish[];
};

export default function EventMenusPage() {
  const [menus, setMenus] = useState<EventMenu[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingMenu, setViewingMenu] = useState<EventMenu | null>(null);
  const [editingMenu, setEditingMenu] = useState<EventMenu | null>(null);

  // Step management: 1=info, 2=select dishes, 3=quantities
  const [step, setStep] = useState(1);

  // Form
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formGuests, setFormGuests] = useState('100');
  const [formStaff, setFormStaff] = useState('0');
  const [formDate, setFormDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [dishQuantities, setDishQuantities] = useState<Record<string, { qty: number; unit: string }>>({});

  const load = async () => {
    const [menusRes, sheetsRes, itemsRes] = await Promise.all([
      supabase.from('event_menus').select('*').order('event_date', { ascending: false }),
      supabase.from('technical_sheets').select('*').order('name'),
      supabase.from('stock_items').select('id, name, unit, unit_cost, current_stock').order('name'),
    ]);

    if (itemsRes.data) setStockItems(itemsRes.data as unknown as StockItem[]);

    // Load sheets with items
    if (sheetsRes.data) {
      const loadedSheets = await Promise.all(
        (sheetsRes.data as any[]).map(async s => {
          const { data: si } = await supabase.from('technical_sheet_items').select('item_id, quantity, unit_cost').eq('sheet_id', s.id);
          const items: SheetItem[] = (si || []).map((i: any) => {
            const item = itemsRes.data?.find((x: any) => x.id === i.item_id) as any;
            return {
              item_id: i.item_id, item_name: item?.name || '?',
              quantity: i.quantity, unit: item?.unit || '', unit_cost: i.unit_cost || item?.unit_cost || 0,
            };
          });
          return { ...s, items } as Sheet;
        })
      );
      setSheets(loadedSheets);
    }

    // Load menus with dishes
    if (menusRes.data) {
      const loadedMenus = await Promise.all(
        (menusRes.data as any[]).map(async m => {
          const { data: dishes } = await supabase.from('event_menu_dishes').select('*').eq('menu_id', m.id).order('sort_order');
          const menuDishes: MenuDish[] = (dishes || []).map((d: any) => {
            const sheet = sheetsRes.data ? (sheetsRes.data as any[]).find(s => s.id === d.sheet_id) : null;
            return {
              id: d.id, sheet_id: d.sheet_id,
              sheet_name: sheet?.name || '?',
              planned_quantity: d.planned_quantity,
              planned_unit: d.planned_unit || 'kg',
              sheet: null, expanded: false, overrides: {},
            };
          });
          return { ...m, dishes: menuDishes } as EventMenu;
        })
      );
      setMenus(loadedMenus);
    }
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormName(''); setFormLocation(''); setFormGuests('100');
    setFormStaff('0'); setFormDate(''); setFormNotes('');
    setSelectedSheets(new Set()); setDishQuantities({}); setStep(1);
    setEditingMenu(null);
  };

  const toggleSheet = (id: string) => {
    const next = new Set(selectedSheets);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSheets(next);
  };

  const handleSaveMenu = async () => {
    if (!formName.trim()) { toast.error('Nome do evento é obrigatório'); return; }
    if (selectedSheets.size === 0) { toast.error('Selecione pelo menos um prato'); return; }

    const menuData = {
      name: formName.trim(),
      location: formLocation.trim() || null,
      guest_count: parseInt(formGuests) || 100,
      staff_count: parseInt(formStaff) || 0,
      event_date: formDate || null,
      notes: formNotes.trim() || null,
      status: 'draft',
    };

    let menuId: string;
    if (editingMenu) {
      const { error } = await supabase.from('event_menus').update(menuData as any).eq('id', editingMenu.id);
      if (error) { toast.error('Erro ao atualizar cardápio'); return; }
      menuId = editingMenu.id;
      await supabase.from('event_menu_dishes').delete().eq('menu_id', menuId);
    } else {
      const { data, error } = await supabase.from('event_menus').insert(menuData as any).select().single();
      if (error || !data) { toast.error('Erro ao criar cardápio'); return; }
      menuId = (data as any).id;
    }

    // Insert dishes
    const dishInserts = Array.from(selectedSheets).map((sheetId, idx) => ({
      menu_id: menuId,
      sheet_id: sheetId,
      planned_quantity: dishQuantities[sheetId]?.qty || 0,
      planned_unit: dishQuantities[sheetId]?.unit || 'kg',
      sort_order: idx,
    }));
    await supabase.from('event_menu_dishes').insert(dishInserts as any);

    toast.success(editingMenu ? 'Cardápio atualizado!' : 'Cardápio criado!');
    resetForm();
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('event_menus').delete().eq('id', id);
    toast.success('Cardápio removido!');
    load();
  };

  const openView = async (menu: EventMenu) => {
    // Enrich dishes with full sheet data
    const enriched = await Promise.all(
      menu.dishes.map(async d => {
        const sheet = sheets.find(s => s.id === d.sheet_id);
        if (!sheet) return d;
        // Load sheet items
        const { data: si } = await supabase.from('technical_sheet_items').select('item_id, quantity, unit_cost').eq('sheet_id', sheet.id);
        const items: SheetItem[] = (si || []).map((i: any) => {
          const item = stockItems.find(x => x.id === i.item_id);
          return {
            item_id: i.item_id, item_name: item?.name || '?',
            quantity: i.quantity, unit: item?.unit || '', unit_cost: i.unit_cost || item?.unit_cost || 0,
          };
        });
        return { ...d, sheet: { ...sheet, items }, expanded: false, overrides: {} };
      })
    );
    setViewingMenu({ ...menu, dishes: enriched });
  };

  const toggleDishExpand = (dishId: string) => {
    if (!viewingMenu) return;
    setViewingMenu({
      ...viewingMenu,
      dishes: viewingMenu.dishes.map(d => d.id === dishId ? { ...d, expanded: !d.expanded } : d),
    });
  };

  const updateOverride = (dishId: string, itemId: string, value: number) => {
    if (!viewingMenu) return;
    setViewingMenu({
      ...viewingMenu,
      dishes: viewingMenu.dishes.map(d => {
        if (d.id !== dishId) return d;
        return { ...d, overrides: { ...d.overrides, [itemId]: value } };
      }),
    });
  };

  // Calculate scaled quantity based on planned quantity and recipe yield
  const getScaledQty = (recipeQty: number, sheet: Sheet, plannedQty: number) => {
    const yieldQty = sheet.yield_quantity || 1;
    const scale = plannedQty / yieldQty;
    return parseFloat((recipeQty * scale).toFixed(4));
  };

  // Generate shopping list
  const generateShoppingList = () => {
    if (!viewingMenu) return;
    const itemsMap: Record<string, { name: string; unit: string; needed: number; inStock: number; unitCost: number }> = {};

    viewingMenu.dishes.forEach(dish => {
      if (!dish.sheet) return;
      dish.sheet.items.forEach(si => {
        const scaled = getScaledQty(si.quantity, dish.sheet!, dish.planned_quantity);
        const finalQty = dish.overrides[si.item_id] ?? scaled;
        if (!itemsMap[si.item_id]) {
          const stockItem = stockItems.find(s => s.id === si.item_id);
          itemsMap[si.item_id] = {
            name: si.item_name, unit: si.unit,
            needed: 0, inStock: stockItem?.current_stock || 0,
            unitCost: si.unit_cost,
          };
        }
        itemsMap[si.item_id].needed += finalQty;
      });
    });

    return Object.entries(itemsMap).map(([id, v]) => ({
      id, ...v, toBuy: Math.max(0, v.needed - v.inStock),
    })).sort((a, b) => a.name.localeCompare(b.name));
  };

  const [showShoppingList, setShowShoppingList] = useState(false);

  const openEdit = (menu: EventMenu) => {
    setEditingMenu(menu);
    setFormName(menu.name);
    setFormLocation(menu.location || '');
    setFormGuests(menu.guest_count.toString());
    setFormStaff(menu.staff_count.toString());
    setFormDate(menu.event_date || '');
    setFormNotes(menu.notes || '');
    setSelectedSheets(new Set(menu.dishes.map(d => d.sheet_id)));
    const qtys: Record<string, { qty: number; unit: string }> = {};
    menu.dishes.forEach(d => { qtys[d.sheet_id] = { qty: d.planned_quantity, unit: d.planned_unit }; });
    setDishQuantities(qtys);
    setStep(1);
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Cardápios de Eventos</h1>
          <p className="text-muted-foreground mt-1">Monte cardápios completos com lista de compras automática</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Criar Cardápio de Evento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingMenu ? 'Editar Cardápio' : 'Novo Cardápio de Evento'}</DialogTitle>
              <DialogDescription>
                {step === 1 && 'Informações do evento'}
                {step === 2 && 'Selecione os pratos do cardápio'}
                {step === 3 && 'Defina as quantidades de cada prato'}
              </DialogDescription>
            </DialogHeader>

            {/* Step indicators */}
            <div className="flex gap-2 mb-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Nome do Evento *</label>
                    <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Casamento Silva & Santos" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Local do Evento</label>
                      <Input value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="Ex: Salão Principal" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Data do Evento</label>
                      <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Convidados</label>
                      <Input type="number" value={formGuests} onChange={e => setFormGuests(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Profissionais</label>
                      <Input type="number" value={formStaff} onChange={e => setFormStaff(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Observações</label>
                    <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Restrições alimentares, etc." />
                  </div>
                  <Button className="w-full" onClick={() => {
                    if (!formName.trim()) { toast.error('Nome do evento é obrigatório'); return; }
                    setStep(2);
                  }}>Próximo: Selecionar Pratos</Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Clique para selecionar os pratos que farão parte do cardápio:</p>
                  {sheets.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhuma receita cadastrada. Cadastre fichas técnicas primeiro.</p>
                  )}
                  {sheets.map(sheet => (
                    <div
                      key={sheet.id}
                      onClick={() => toggleSheet(sheet.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedSheets.has(sheet.id) ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border bg-card hover:border-primary/30'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{sheet.name}</p>
                          <p className="text-xs text-muted-foreground">{sheet.items.length} insumos · Rende {sheet.yield_quantity} {sheet.yield_unit}</p>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedSheets.has(sheet.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                          {selectedSheets.has(sheet.id) && <span className="text-xs">✓</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                    <Button className="flex-1" onClick={() => {
                      if (selectedSheets.size === 0) { toast.error('Selecione pelo menos um prato'); return; }
                      setStep(3);
                    }}>Próximo: Quantidades ({selectedSheets.size} pratos)</Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Defina quanto de cada prato será necessário para o evento:</p>
                  {Array.from(selectedSheets).map(sheetId => {
                    const sheet = sheets.find(s => s.id === sheetId);
                    if (!sheet) return null;
                    const dq = dishQuantities[sheetId] || { qty: 0, unit: sheet.yield_unit || 'kg' };
                    return (
                      <div key={sheetId} className="p-4 rounded-xl bg-card border border-border">
                        <p className="font-medium text-foreground mb-1">{sheet.name}</p>
                        <p className="text-xs text-muted-foreground mb-3">Receita rende: {sheet.yield_quantity} {sheet.yield_unit}</p>
                        <div className="flex gap-3 items-center">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Quantidade necessária</label>
                            <Input type="number" value={dq.qty || ''} onChange={e => setDishQuantities({
                              ...dishQuantities, [sheetId]: { ...dq, qty: parseFloat(e.target.value) || 0 }
                            })} placeholder="0" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Unidade</label>
                            <Input value={dq.unit} onChange={e => setDishQuantities({
                              ...dishQuantities, [sheetId]: { ...dq, unit: e.target.value }
                            })} className="w-20" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
                    <Button className="flex-1" onClick={handleSaveMenu}>
                      {editingMenu ? 'Salvar Alterações' : 'Criar Cardápio'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Viewing menu detail */}
      {viewingMenu && (
        <div className="glass-card rounded-xl p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-foreground text-xl">{viewingMenu.name}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {viewingMenu.event_date && <Badge variant="outline"><Calendar className="w-3 h-3 mr-1" />{new Date(viewingMenu.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}</Badge>}
                {viewingMenu.location && <Badge variant="outline"><MapPin className="w-3 h-3 mr-1" />{viewingMenu.location}</Badge>}
                <Badge variant="outline"><Users className="w-3 h-3 mr-1" />{viewingMenu.guest_count} convidados</Badge>
                {viewingMenu.staff_count > 0 && <Badge variant="outline">{viewingMenu.staff_count} profissionais</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowShoppingList(!showShoppingList)}>
                <ShoppingCart className="w-4 h-4 mr-1" />{showShoppingList ? 'Ocultar' : 'Lista de Compras'}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setViewingMenu(null); setShowShoppingList(false); }}><X className="w-4 h-4" /></Button>
            </div>
          </div>

          {/* Shopping list */}
          {showShoppingList && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" /> Lista de Compras
              </h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-1 text-muted-foreground">Item</th>
                    <th className="py-1 text-center text-muted-foreground">Necessário</th>
                    <th className="py-1 text-center text-muted-foreground">Em Estoque</th>
                    <th className="py-1 text-center font-semibold text-foreground">Comprar</th>
                    <th className="py-1 text-right text-muted-foreground">Custo Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {generateShoppingList()?.map(item => (
                    <tr key={item.id} className={`border-b border-border/30 ${item.toBuy > 0 ? '' : 'opacity-50'}`}>
                      <td className="py-1.5 text-foreground">{item.name}</td>
                      <td className="py-1.5 text-center text-muted-foreground">{item.needed.toFixed(2)} {item.unit}</td>
                      <td className="py-1.5 text-center text-muted-foreground">{item.inStock} {item.unit}</td>
                      <td className="py-1.5 text-center font-semibold text-foreground">
                        {item.toBuy > 0 ? `${item.toBuy.toFixed(2)} ${item.unit}` : '✓'}
                      </td>
                      <td className="py-1.5 text-right text-muted-foreground">
                        {item.toBuy > 0 ? `R$ ${(item.toBuy * item.unitCost).toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan={4} className="py-2 text-right">Total estimado:</td>
                    <td className="py-2 text-right text-primary">
                      R$ {(generateShoppingList()?.reduce((s, i) => s + i.toBuy * i.unitCost, 0) || 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Dishes table with expandable ingredients */}
          <div className="space-y-2">
            {viewingMenu.dishes.map(dish => {
              const sheet = dish.sheet;
              return (
                <div key={dish.id} className="border border-border rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => toggleDishExpand(dish.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        {dish.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <div>
                        <p className="font-medium text-foreground">{dish.sheet_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {dish.planned_quantity} {dish.planned_unit}
                          {sheet && ` · ${sheet.items.length} insumos`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Expanded ingredient breakdown */}
                  {dish.expanded && sheet && (
                    <div className="border-t border-border bg-accent/30 p-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground text-xs">
                            <th className="py-1">Insumo</th>
                            <th className="py-1 text-center">Receita ({sheet.yield_quantity} {sheet.yield_unit})</th>
                            <th className="py-1 text-center">Calculado ({dish.planned_quantity} {dish.planned_unit})</th>
                            <th className="py-1 text-center">Qtd Final (editável)</th>
                            <th className="py-1 text-right">Custo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.items.map(si => {
                            const scaled = getScaledQty(si.quantity, sheet, dish.planned_quantity);
                            const finalQty = dish.overrides[si.item_id] ?? scaled;
                            return (
                              <tr key={si.item_id} className="border-t border-border/30">
                                <td className="py-1.5 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td>
                                <td className="py-1.5 text-center text-muted-foreground">{si.quantity}</td>
                                <td className="py-1.5 text-center text-muted-foreground">{scaled.toFixed(3)}</td>
                                <td className="py-1.5 text-center">
                                  <Input
                                    type="number"
                                    className="h-7 w-24 mx-auto text-xs text-center"
                                    value={finalQty}
                                    onChange={e => updateOverride(dish.id, si.item_id, parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                                <td className="py-1.5 text-right text-muted-foreground">R$ {(finalQty * si.unit_cost).toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Menu list */}
      <div className="space-y-3">
        {menus.map(menu => (
          <div key={menu.id} className="glass-card rounded-xl p-4 flex items-center justify-between animate-fade-in">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{menu.name}</p>
                <Badge variant={menu.status === 'draft' ? 'secondary' : 'default'} className="text-[10px]">
                  {menu.status === 'draft' ? 'Rascunho' : menu.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {menu.event_date ? new Date(menu.event_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                {menu.location ? ` · ${menu.location}` : ''}
                {` · ${menu.guest_count} convidados`}
                {` · ${menu.dishes.length} pratos`}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" title="Visualizar" onClick={() => openView(menu)}><Eye className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(menu)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(menu.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {menus.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum cardápio de evento criado. Clique em "Criar Cardápio de Evento" para começar.
          </div>
        )}
      </div>
    </div>
  );
}
