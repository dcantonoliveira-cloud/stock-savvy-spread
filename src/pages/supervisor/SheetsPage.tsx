import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Plus, Trash2, Eye, X, Copy, Pencil, Clock, Users, ChefHat, ChevronsUpDown, Check, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StockItem = { id: string; name: string; unit: string; unit_cost: number };
type SheetItem = {
  id?: string;
  item_id: string;
  item_name: string;
  quantity: number;
  gross_quantity: number;
  correction_factor: number;
  unit: string;
  unit_cost: number;
};
type Sheet = {
  id: string;
  name: string;
  servings: number;
  description: string | null;
  category: string | null;
  prep_time: number;
  yield_quantity: number;
  yield_unit: string;
  instructions: string | null;
  items: SheetItem[];
  created_at: string;
};

const RECIPE_CATEGORIES = ['Prato Principal', 'Entrada', 'Acompanhamento', 'Sobremesa', 'Molho', 'Guarnição', 'Bebida', 'Outros'];

// ─── Searchable Item Combobox ───
function ItemCombobox({ stockItems, value, onSelect, onCreateNew }: {
  stockItems: StockItem[];
  value: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = stockItems.find(s => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 text-xs justify-between w-full font-normal"
        >
          <span className="truncate">{selected ? selected.name : 'Selecionar item...'}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar insumo..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>
              {stockItems.map(si => (
                <CommandItem
                  key={si.id}
                  value={si.name}
                  onSelect={() => {
                    onSelect(si.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-3 w-3", value === si.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{si.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{si.unit}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onCreateNew();
                }}
                className="text-primary"
              >
                <PackagePlus className="mr-2 h-3 w-3" />
                Criar novo insumo...
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Quick Create Item Dialog ───
function QuickCreateItemDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (item: StockItem) => void;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [unitCost, setUnitCost] = useState('0');
  const [category, setCategory] = useState('Outros');
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      supabase.from('categories').select('name').order('name')
        .then(({ data }) => {
          if (data) setCategories(data.map((c: any) => c.name));
        });
    }
  }, [open]);

  const UNITS = ['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct', 'lata', 'garrafa'];

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('stock_items').insert({
      name: name.trim(),
      unit,
      unit_cost: parseFloat(unitCost) || 0,
      category,
      current_stock: 0,
      min_stock: 0,
    } as any).select('id, name, unit, unit_cost').single();

    if (error || !data) {
      toast.error('Erro ao criar insumo');
      setSaving(false);
      return;
    }
    toast.success(`Insumo "${name}" criado!`);
    onCreated(data as unknown as StockItem);
    setName(''); setUnit('kg'); setUnitCost('0'); setCategory('Outros');
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Criar Novo Insumo</DialogTitle>
          <DialogDescription>Cadastre rapidamente um novo item de estoque</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Nome *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Farinha de Trigo" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Unidade</label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Custo (R$)</label>
              <Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Categoria</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Criando...' : 'Criar Insumo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SupervisorSheetsPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingSheet, setViewingSheet] = useState<Sheet | null>(null);
  const [editingSheet, setEditingSheet] = useState<Sheet | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Prato Principal');
  const [servings, setServings] = useState('1');
  const [yieldQty, setYieldQty] = useState('1');
  const [yieldUnit, setYieldUnit] = useState('kg');
  const [prepTime, setPrepTime] = useState('0');
  const [instructions, setInstructions] = useState('');
  const [formItems, setFormItems] = useState<SheetItem[]>([]);

  const load = async () => {
    const [itemsRes, sheetsRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, unit, unit_cost').order('name'),
      supabase.from('technical_sheets').select('*').order('name'),
    ]);
    if (itemsRes.data) setStockItems(itemsRes.data as unknown as StockItem[]);
    if (sheetsRes.data) {
      const sheetsWithItems = await Promise.all(
        (sheetsRes.data as any[]).map(async s => {
          const { data: si } = await supabase.from('technical_sheet_items').select('*').eq('sheet_id', s.id);
          const sheetItems: SheetItem[] = (si || []).map((i: any) => {
            const item = itemsRes.data?.find((x: any) => x.id === i.item_id);
            return {
              id: i.id,
              item_id: i.item_id,
              item_name: (item as any)?.name || '?',
              quantity: i.quantity,
              gross_quantity: i.gross_quantity || i.quantity,
              correction_factor: i.correction_factor || 1,
              unit: (item as any)?.unit || '',
              unit_cost: i.unit_cost || (item as any)?.unit_cost || 0,
            };
          });
          return { ...s, items: sheetItems } as Sheet;
        })
      );
      setSheets(sheetsWithItems);
    }
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(''); setDescription(''); setCategory('Prato Principal');
    setServings('1'); setYieldQty('1'); setYieldUnit('kg');
    setPrepTime('0'); setInstructions(''); setFormItems([]);
    setEditingSheet(null);
  };

  const openEditDialog = (sheet: Sheet) => {
    setEditingSheet(sheet);
    setName(sheet.name);
    setDescription(sheet.description || '');
    setCategory(sheet.category || 'Prato Principal');
    setServings(sheet.servings.toString());
    setYieldQty(sheet.yield_quantity?.toString() || '1');
    setYieldUnit(sheet.yield_unit || 'kg');
    setPrepTime(sheet.prep_time?.toString() || '0');
    setInstructions(sheet.instructions || '');
    setFormItems([...sheet.items]);
    setDialogOpen(true);
  };

  const openDuplicateDialog = (sheet: Sheet) => {
    setEditingSheet(null);
    setName(`${sheet.name} (cópia)`);
    setDescription(sheet.description || '');
    setCategory(sheet.category || 'Prato Principal');
    setServings(sheet.servings.toString());
    setYieldQty(sheet.yield_quantity?.toString() || '1');
    setYieldUnit(sheet.yield_unit || 'kg');
    setPrepTime(sheet.prep_time?.toString() || '0');
    setInstructions(sheet.instructions || '');
    setFormItems(sheet.items.map(i => ({ ...i, id: undefined })));
    setDialogOpen(true);
  };

  const addItem = () => setFormItems([...formItems, {
    item_id: '', item_name: '', quantity: 0, gross_quantity: 0,
    correction_factor: 1, unit: '', unit_cost: 0,
  }]);

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...formItems];
    if (field === 'item_id') {
      const si = stockItems.find(s => s.id === value);
      updated[idx] = {
        ...updated[idx], item_id: value,
        item_name: si?.name || '', unit: si?.unit || '',
        unit_cost: si?.unit_cost || 0,
      };
    } else if (field === 'gross_quantity') {
      const gross = parseFloat(value) || 0;
      const cf = updated[idx].correction_factor || 1;
      updated[idx] = { ...updated[idx], gross_quantity: gross, quantity: parseFloat((gross / cf).toFixed(4)) };
    } else if (field === 'correction_factor') {
      const cf = parseFloat(value) || 1;
      const gross = updated[idx].gross_quantity || 0;
      updated[idx] = { ...updated[idx], correction_factor: cf, quantity: parseFloat((gross / cf).toFixed(4)) };
    } else {
      (updated[idx] as any)[field] = value;
    }
    setFormItems(updated);
  };

  const removeItem = (idx: number) => setFormItems(formItems.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    const validItems = formItems.filter(i => i.item_id);
    if (validItems.length === 0) { toast.error('Adicione pelo menos um insumo'); return; }

    const sheetData = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      servings: parseInt(servings) || 1,
      yield_quantity: parseFloat(yieldQty) || 1,
      yield_unit: yieldUnit,
      prep_time: parseInt(prepTime) || 0,
      instructions: instructions.trim() || null,
    };

    if (editingSheet) {
      const { error } = await supabase.from('technical_sheets').update(sheetData as any).eq('id', editingSheet.id);
      if (error) { toast.error('Erro ao atualizar ficha'); return; }
      await supabase.from('technical_sheet_items').delete().eq('sheet_id', editingSheet.id);
      await supabase.from('technical_sheet_items').insert(
        validItems.map(i => ({
          sheet_id: editingSheet.id, item_id: i.item_id, quantity: i.quantity,
          gross_quantity: i.gross_quantity, correction_factor: i.correction_factor,
          unit_cost: i.unit_cost,
        })) as any
      );
      toast.success('Ficha técnica atualizada!');
    } else {
      const { data: sheet, error } = await supabase.from('technical_sheets')
        .insert(sheetData as any).select().single();
      if (error || !sheet) { toast.error('Erro ao criar ficha'); return; }
      await supabase.from('technical_sheet_items').insert(
        validItems.map(i => ({
          sheet_id: (sheet as any).id, item_id: i.item_id, quantity: i.quantity,
          gross_quantity: i.gross_quantity, correction_factor: i.correction_factor,
          unit_cost: i.unit_cost,
        })) as any
      );
      toast.success('Ficha técnica criada!');
    }

    resetForm();
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('technical_sheets').delete().eq('id', id);
    toast.success('Ficha removida!');
    load();
  };

  const getSheetTotalCost = (sheet: Sheet) => {
    return sheet.items.reduce((sum, i) => sum + (i.quantity * i.unit_cost), 0);
  };

  const filteredSheets = sheets.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || s.category === filterCategory;
    return matchSearch && matchCat;
  });

  const handleQuickItemCreated = (newItem: StockItem) => {
    setStockItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Fichas Técnicas</h1>
          <p className="text-muted-foreground mt-1">Receitas detalhadas com insumos e custos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Receita</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingSheet ? 'Editar Receita' : 'Nova Ficha Técnica'}</DialogTitle>
              <DialogDescription>Defina os insumos e o modo de preparo da receita</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground mb-1 block">Nome da Receita *</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Espeto Baiano" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Categoria</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECIPE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Tempo de Preparo (min)</label>
                  <Input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Descrição (opcional)</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descrição do prato" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Rendimento</label>
                  <Input type="number" value={yieldQty} onChange={e => setYieldQty(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Unidade Rendimento</label>
                  <Select value={yieldUnit} onValueChange={setYieldUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['kg', 'g', 'L', 'ml', 'un', 'porções'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Porções</label>
                  <Input type="number" value={servings} onChange={e => setServings(e.target.value)} />
                </div>
              </div>

              {/* Insumos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">Insumos da Receita</label>
                  <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
                </div>

                {formItems.length > 0 && (
                  <div className="grid grid-cols-[1fr_80px_80px_60px_80px_80px_32px] gap-1 text-[10px] text-muted-foreground mb-1 px-1">
                    <span>Item</span><span>Qtd Bruta</span><span>Fator Cor.</span>
                    <span>Qtd Líq.</span><span>Custo Unit.</span><span>Custo Total</span><span></span>
                  </div>
                )}

                {formItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_80px_60px_80px_80px_32px] gap-1 items-center mb-1">
                    <ItemCombobox
                      stockItems={stockItems}
                      value={item.item_id}
                      onSelect={v => updateItem(idx, 'item_id', v)}
                      onCreateNew={() => setQuickCreateOpen(true)}
                    />
                    <Input type="number" className="h-8 text-xs" placeholder="Bruta" value={item.gross_quantity || ''} onChange={e => updateItem(idx, 'gross_quantity', e.target.value)} />
                    <Input type="number" className="h-8 text-xs" placeholder="FC" value={item.correction_factor || ''} onChange={e => updateItem(idx, 'correction_factor', e.target.value)} />
                    <span className="text-xs text-muted-foreground text-center">{item.quantity.toFixed(3)}</span>
                    <Input type="number" className="h-8 text-xs" value={item.unit_cost || ''} onChange={e => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)} />
                    <span className="text-xs font-medium text-foreground text-center">R$ {(item.quantity * item.unit_cost).toFixed(2)}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)}><X className="w-3 h-3" /></Button>
                  </div>
                ))}

                {formItems.length > 0 && (
                  <div className="flex justify-end mt-2 pr-10">
                    <span className="text-sm font-semibold text-primary">
                      Total: R$ {formItems.reduce((s, i) => s + i.quantity * i.unit_cost, 0).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Modo de Preparo</label>
                <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Descreva o passo a passo do preparo..." rows={4} />
              </div>

              <Button onClick={handleSave} className="w-full">{editingSheet ? 'Salvar Alterações' : 'Criar Ficha Técnica'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Input placeholder="Buscar receita..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {RECIPE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Viewing sheet detail */}
      {viewingSheet && (
        <div className="glass-card rounded-xl p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-foreground text-lg">{viewingSheet.name}</h3>
              {viewingSheet.description && <p className="text-sm text-muted-foreground">{viewingSheet.description}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setViewingSheet(null)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-3 mb-4">
            <Badge variant="secondary"><ChefHat className="w-3 h-3 mr-1" />{viewingSheet.category}</Badge>
            {viewingSheet.prep_time > 0 && <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{viewingSheet.prep_time} min</Badge>}
            <Badge variant="outline"><Users className="w-3 h-3 mr-1" />{viewingSheet.servings} porções</Badge>
            <Badge variant="outline">Rende: {viewingSheet.yield_quantity} {viewingSheet.yield_unit}</Badge>
            <Badge className="bg-primary/20 text-primary">Custo: R$ {getSheetTotalCost(viewingSheet).toFixed(2)}</Badge>
          </div>

          {/* Ingredients table */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 text-muted-foreground font-medium">Insumo</th>
                  <th className="py-2 text-muted-foreground font-medium text-center">Unidade</th>
                  <th className="py-2 text-muted-foreground font-medium text-center">Qtd Bruta</th>
                  <th className="py-2 text-muted-foreground font-medium text-center">Qtd Líquida</th>
                  <th className="py-2 text-muted-foreground font-medium text-center">FC</th>
                  <th className="py-2 text-muted-foreground font-medium text-right">Custo Unit.</th>
                  <th className="py-2 text-muted-foreground font-medium text-right">Custo Total</th>
                </tr>
              </thead>
              <tbody>
                {viewingSheet.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{item.item_name}</td>
                    <td className="py-2 text-center text-muted-foreground">{item.unit}</td>
                    <td className="py-2 text-center text-foreground">{item.gross_quantity}</td>
                    <td className="py-2 text-center text-foreground font-medium">{item.quantity}</td>
                    <td className="py-2 text-center text-muted-foreground">{item.correction_factor}</td>
                    <td className="py-2 text-right text-muted-foreground">R$ {item.unit_cost.toFixed(2)}</td>
                    <td className="py-2 text-right text-foreground font-medium">R$ {(item.quantity * item.unit_cost).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={6} className="py-2 text-right font-semibold text-foreground">Total:</td>
                  <td className="py-2 text-right font-bold text-primary">R$ {getSheetTotalCost(viewingSheet).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Instructions */}
          {viewingSheet.instructions && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Modo de Preparo</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{viewingSheet.instructions}</p>
            </div>
          )}
        </div>
      )}

      {/* Sheet list */}
      <div className="space-y-3">
        {filteredSheets.map(sheet => (
          <div key={sheet.id} className="glass-card rounded-xl p-4 flex items-center justify-between animate-fade-in">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground truncate">{sheet.name}</p>
                {sheet.category && <Badge variant="secondary" className="text-[10px]">{sheet.category}</Badge>}
              </div>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-muted-foreground">{sheet.items.length} insumos</span>
                {sheet.prep_time > 0 && <span className="text-xs text-muted-foreground">{sheet.prep_time} min</span>}
                <span className="text-xs text-muted-foreground">Rende: {sheet.yield_quantity} {sheet.yield_unit}</span>
                <span className="text-xs text-primary font-medium">R$ {getSheetTotalCost(sheet).toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setViewingSheet(sheet)}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditDialog(sheet)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Duplicar" onClick={() => openDuplicateDialog(sheet)}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Remover" onClick={() => handleDelete(sheet.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {filteredSheets.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {sheets.length === 0 ? 'Nenhuma ficha técnica cadastrada.' : 'Nenhuma receita encontrada.'}
          </div>
        )}
      </div>

      {/* Quick create item dialog */}
      <QuickCreateItemDialog
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={handleQuickItemCreated}
      />
    </div>
  );
}
