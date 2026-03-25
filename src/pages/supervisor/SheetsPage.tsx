import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Plus, Trash2, Eye, X, Copy, Pencil, Clock, Users, ChefHat, ChevronsUpDown, Check, PackagePlus, Download, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getCompatibleUnits, calcRecipeUnitCost, effectiveUnitCost } from '@/lib/units';
import { fmtNum, fmtCur } from '@/lib/format';

type StockItem = { id: string; name: string; unit: string; unit_cost: number; purchase_qty: number | null };
type SheetItem = {
  id?: string;
  item_id: string;
  item_name: string;
  quantity: number | string;
  gross_quantity: number | string;
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

// Categories loaded dynamically from DB

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

const YIELD_UNITS = ['kg', 'g', 'L', 'ml', 'un', 'unid', 'pct', 'cx', 'bd', 'fatias'];

export default function SupervisorSheetsPage() {
  const navigate = useNavigate();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingSheet, setViewingSheet] = useState<Sheet | null>(null);
  const [editingSheet, setEditingSheet] = useState<Sheet | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [sheetCategories, setSheetCategories] = useState<string[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const [loading, setLoading] = useState(true);

  // Import highlight state — IDs de fichas criadas/atualizadas na última importação
  const [updatedSheetIds, setUpdatedSheetIds] = useState<Set<string>>(new Set());

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [servings, setServings] = useState('1');
  const [yieldQty, setYieldQty] = useState('1');
  const [yieldUnit, setYieldUnit] = useState('kg');
  const [prepTime, setPrepTime] = useState('0');
  const [instructions, setInstructions] = useState('');
  const [formItems, setFormItems] = useState<SheetItem[]>([]);

  // File import ref
  const importFileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [itemsRes, sheetsRes, catsRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, unit, unit_cost, purchase_qty').order('name'),
      supabase.from('technical_sheets').select('*').order('name'),
      supabase.from('sheet_categories').select('name, sort_order').order('sort_order'),
    ]);
    if (catsRes.data) setSheetCategories((catsRes.data as any[]).map(c => c.name));
    if (itemsRes.data) setStockItems(itemsRes.data as unknown as StockItem[]);
    if (sheetsRes.data) {
      const sheetsWithItems = await Promise.all(
        (sheetsRes.data as any[]).map(async s => {
          const { data: si } = await supabase.from('technical_sheet_items').select('*').eq('sheet_id', s.id);
          const sheetItems: SheetItem[] = (si || []).map((i: any) => {
            const item = itemsRes.data?.find((x: any) => x.id === i.item_id);
            const itemUnit = (item as any)?.unit || '';
            const recipeUnit = i.unit || itemUnit;
            const baseUnitCost = effectiveUnitCost((item as any)?.unit_cost || 0, (item as any)?.purchase_qty);
            return {
              id: i.id,
              item_id: i.item_id,
              item_name: (item as any)?.name || '?',
              quantity: i.quantity,
              gross_quantity: i.gross_quantity || i.quantity,
              correction_factor: i.correction_factor || 1,
              unit: recipeUnit,
              unit_cost: calcRecipeUnitCost(baseUnitCost, itemUnit, recipeUnit),
            };
          });
          return { ...s, items: sheetItems } as Sheet;
        })
      );
      setSheets(sheetsWithItems);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Focus inline input when editing starts
  useEffect(() => {
    if (editingCell && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [editingCell]);

  const resetForm = () => {
    setName(''); setDescription(''); setCategory(sheetCategories[0] || '');
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
      const effCost = si ? effectiveUnitCost(si.unit_cost || 0, si.purchase_qty) : 0;
      updated[idx] = {
        ...updated[idx], item_id: value,
        item_name: si?.name || '', unit: si?.unit || '',
        unit_cost: effCost,
      };
    } else if (field === 'unit') {
      const si = stockItems.find(s => s.id === updated[idx].item_id);
      const effCost = si ? effectiveUnitCost(si.unit_cost || 0, si.purchase_qty) : 0;
      const itemUnit = si?.unit || value;
      const newCost = calcRecipeUnitCost(effCost, itemUnit, value);
      updated[idx] = { ...updated[idx], unit: value, unit_cost: newCost };
    } else if (field === 'quantity') {
      updated[idx] = { ...updated[idx], quantity: value, gross_quantity: value };
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
          sheet_id: editingSheet.id, item_id: i.item_id,
          quantity: parseFloat(String(i.quantity).replace(',', '.')) || 0,
          gross_quantity: parseFloat(String(i.gross_quantity).replace(',', '.')) || 0,
          correction_factor: i.correction_factor,
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
          sheet_id: (sheet as any).id, item_id: i.item_id,
          quantity: parseFloat(String(i.quantity).replace(',', '.')) || 0,
          gross_quantity: parseFloat(String(i.gross_quantity).replace(',', '.')) || 0,
          correction_factor: i.correction_factor,
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

  // ─── Inline editing handlers ───
  const startEdit = (sheet: Sheet, field: string) => {
    let value = '';
    if (field === 'name') value = sheet.name;
    else if (field === 'prep_time') value = sheet.prep_time?.toString() || '0';
    else if (field === 'yield_quantity') value = sheet.yield_quantity?.toString() || '1';
    else if (field === 'yield_unit') value = sheet.yield_unit || 'kg';
    else if (field === 'servings') value = sheet.servings?.toString() || '1';
    setEditingCell({ id: sheet.id, field });
    setEditingValue(value);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const commitEdit = async (sheet: Sheet) => {
    if (!editingCell) return;
    const { field } = editingCell;

    let updateData: Record<string, any> = {};
    if (field === 'name') {
      const trimmed = editingValue.trim();
      if (!trimmed) { cancelEdit(); return; }
      updateData = { name: trimmed };
    } else if (field === 'prep_time') {
      updateData = { prep_time: parseInt(editingValue) || 0 };
    } else if (field === 'yield_quantity') {
      updateData = { yield_quantity: parseFloat(editingValue) || 1 };
    } else if (field === 'yield_unit') {
      updateData = { yield_unit: editingValue };
    } else if (field === 'servings') {
      updateData = { servings: parseInt(editingValue) || 1 };
    }

    const { error } = await supabase.from('technical_sheets').update(updateData).eq('id', sheet.id);
    if (error) {
      toast.error('Erro ao salvar alteração');
      cancelEdit();
      return;
    }

    // Update local state
    setSheets(prev => prev.map(s => {
      if (s.id !== sheet.id) return s;
      return { ...s, ...updateData };
    }));

    toast.success('Alteração salva!');
    cancelEdit();
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent, sheet: Sheet) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(sheet);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // ─── Excel Export ───
  const handleExport = async () => {
    try {
      const [sheetsRes, itemsRes] = await Promise.all([
        supabase.from('technical_sheets').select('*').order('name'),
        supabase.from('technical_sheet_items').select('*, stock_items(name, unit, unit_cost)'),
      ]);

      if (sheetsRes.error || itemsRes.error) {
        toast.error('Erro ao exportar dados');
        return;
      }

      const allSheets = sheetsRes.data as any[];
      const allItems = itemsRes.data as any[];

      const headers = [
        'FICHA', 'CATEGORIA', 'TEMPO_PREPARO_MIN',
        'RENDIMENTO_QTD', 'RENDIMENTO_UNIT',
        'INSUMO', 'QUANTIDADE', 'UNIDADE', 'CUSTO_UNIT',
      ];

      const rows: any[][] = [];

      for (const sheet of allSheets) {
        const sheetItems = allItems.filter(i => i.sheet_id === sheet.id);
        if (sheetItems.length === 0) {
          rows.push([
            sheet.name,
            sheet.category || '',
            sheet.prep_time || 0,
            sheet.yield_quantity || 1,
            sheet.yield_unit || '',
            '', '', '', '',
          ]);
        } else {
          for (const item of sheetItems) {
            const stockItem = item.stock_items as any;
            rows.push([
              sheet.name,
              sheet.category || '',
              sheet.prep_time || 0,
              sheet.yield_quantity || 1,
              sheet.yield_unit || '',
              stockItem?.name || '',
              item.quantity || 0,
              stockItem?.unit || '',
              item.unit_cost || stockItem?.unit_cost || 0,
            ]);
          }
        }
      }

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fichas Técnicas');
      XLSX.writeFile(wb, 'fichas_tecnicas.xlsx');
      toast.success('Excel exportado com sucesso!');
    } catch (err) {
      toast.error('Erro ao gerar arquivo Excel');
    }
  };

  // ─── Excel Import ───
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importFileRef.current) importFileRef.current.value = '';

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (raw.length < 2) { toast.error('Arquivo vazio ou inválido'); return; }

      const headerRow = raw[0].map((h: any) => String(h ?? '').trim().toUpperCase());
      const col = (name: string) => headerRow.indexOf(name);

      const fichaIdx    = col('FICHA');
      const catIdx      = col('CATEGORIA');
      const prepIdx     = col('TEMPO_PREPARO_MIN');
      const rendQtdIdx  = col('RENDIMENTO_QTD');
      const rendUnitIdx = col('RENDIMENTO_UNIT');
      const insumoIdx   = col('INSUMO');
      const qtdIdx      = col('QUANTIDADE');
      const unidadeIdx  = col('UNIDADE');
      const custoIdx    = col('CUSTO_UNIT');

      if (fichaIdx === -1 || insumoIdx === -1) {
        toast.error('Colunas FICHA e INSUMO são obrigatórias');
        return;
      }

      // Agrupa linhas por nome de ficha
      type ImportRow = { insumo: string; quantidade: number; unidade: string; custo_unit: number };
      type ImportSheet = { categoria: string; preparo: number | null; rendQtd: number | null; rendUnit: string; items: ImportRow[] };
      const grouped: Record<string, ImportSheet> = {};

      const toNum = (v: any): number | null => {
        if (v == null || v === '') return null;
        const n = parseFloat(String(v).replace(',', '.'));
        return isNaN(n) ? null : n;
      };

      for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        const fichaName = String(row[fichaIdx] ?? '').trim();
        if (!fichaName) continue;

        if (!grouped[fichaName]) {
          grouped[fichaName] = {
            categoria: catIdx !== -1 ? String(row[catIdx] ?? '').trim() : '',
            preparo:   prepIdx !== -1 ? toNum(row[prepIdx]) : null,
            rendQtd:   rendQtdIdx !== -1 ? toNum(row[rendQtdIdx]) : null,
            rendUnit:  rendUnitIdx !== -1 ? String(row[rendUnitIdx] ?? '').trim() : '',
            items: [],
          };
        } else {
          // Linhas seguintes da mesma ficha: complementa campos de nível ficha se ainda não preenchidos
          if (!grouped[fichaName].categoria && catIdx !== -1) grouped[fichaName].categoria = String(row[catIdx] ?? '').trim();
          if (grouped[fichaName].rendQtd == null && rendQtdIdx !== -1) grouped[fichaName].rendQtd = toNum(row[rendQtdIdx]);
          if (!grouped[fichaName].rendUnit && rendUnitIdx !== -1) grouped[fichaName].rendUnit = String(row[rendUnitIdx] ?? '').trim();
        }

        const insumoName = String(row[insumoIdx] ?? '').trim();
        if (insumoName) {
          grouped[fichaName].items.push({
            insumo:     insumoName,
            quantidade: toNum(row[qtdIdx ?? -1]) ?? 0,
            unidade:    unidadeIdx !== -1 ? String(row[unidadeIdx] ?? '').trim() : '',
            custo_unit: toNum(row[custoIdx ?? -1]) ?? 0,
          });
        }
      }

      const sheetNames = Object.keys(grouped);
      if (sheetNames.length === 0) { toast.error('Nenhum dado encontrado no arquivo'); return; }

      const { data: dbSheets }     = await supabase.from('technical_sheets').select('id, name');
      const { data: dbStockItems } = await supabase.from('stock_items').select('id, name, unit');

      // Matching case-insensitive
      const findSheet = (n: string) => dbSheets?.find((s: any) => s.name.trim().toLowerCase() === n.toLowerCase());
      const findStock = (n: string) => dbStockItems?.find((s: any) => s.name.trim().toLowerCase() === n.toLowerCase());

      const sheetsToCreate = sheetNames.filter(n => !findSheet(n));
      const sheetsToUpdate = sheetNames.filter(n =>  findSheet(n));
      const allInsumos = [...new Set(sheetNames.flatMap(n => grouped[n].items.map(i => i.insumo)))];
      const insumosNovos = allInsumos.filter(n => !findStock(n));

      const totalItens = sheetNames.reduce((sum, n) => sum + grouped[n].items.length, 0);
      const msgParts: string[] = [];
      if (sheetsToUpdate.length) msgParts.push(`${sheetsToUpdate.length} ficha(s) serão atualizadas`);
      if (sheetsToCreate.length) msgParts.push(`${sheetsToCreate.length} ficha(s) novas serão criadas`);
      if (insumosNovos.length)   msgParts.push(`${insumosNovos.length} insumo(s) novo(s) serão criados`);
      msgParts.push(`${totalItens} linha(s) de ingredientes processadas`);

      const confirmed = window.confirm(msgParts.join('\n') + '\n\nConfirmar?');
      if (!confirmed) return;

      let updatedSheets = 0, createdSheets = 0, createdInsumos = 0;
      const highlightIds = new Set<string>();

      // Mapa mutável name.toLowerCase() → id (inclui os que vamos criar)
      const stockMap: Record<string, string> = {};
      (dbStockItems || []).forEach((si: any) => { stockMap[si.name.trim().toLowerCase()] = si.id; });
      // Também mapa de unit atual para comparar
      const stockUnitMap: Record<string, string> = {};
      (dbStockItems || []).forEach((si: any) => { stockUnitMap[si.id] = si.unit; });

      // 1. Cria insumos novos
      for (const nome of insumosNovos) {
        let unit = 'un';
        for (const n of sheetNames) {
          const row = grouped[n].items.find(i => i.insumo.toLowerCase() === nome.toLowerCase());
          if (row?.unidade) { unit = row.unidade; break; }
        }
        const { data: newItem } = await supabase.from('stock_items').insert({
          name: nome, unit, unit_cost: 0, current_stock: 0, min_stock: 0, category: 'Outros',
        } as any).select('id').single();
        if (newItem) {
          stockMap[nome.toLowerCase()] = (newItem as any).id;
          stockUnitMap[(newItem as any).id] = unit;
          createdInsumos++;
        }
      }

      // 2. Processa cada ficha
      for (const sheetName of sheetNames) {
        const imp = grouped[sheetName];
        let sheetId: string;

        const existing = findSheet(sheetName) as any;

        if (existing) {
          sheetId = existing.id;
          // Atualiza todos os campos presentes na planilha (sem condicionais que omitem valores)
          const sheetUpdate: Record<string, any> = {};
          if (imp.categoria)        sheetUpdate.category       = imp.categoria;
          if (imp.preparo != null)  sheetUpdate.prep_time      = imp.preparo;
          if (imp.rendQtd != null)  sheetUpdate.yield_quantity = imp.rendQtd;
          if (imp.rendUnit)         sheetUpdate.yield_unit     = imp.rendUnit;
          if (Object.keys(sheetUpdate).length > 0)
            await supabase.from('technical_sheets').update(sheetUpdate).eq('id', sheetId);
          updatedSheets++;
        } else {
          const { data: newSheet } = await supabase.from('technical_sheets').insert({
            name:           sheetName,
            category:       imp.categoria  || 'Prato Principal',
            prep_time:      imp.preparo    ?? 0,
            yield_quantity: imp.rendQtd    ?? 1,
            yield_unit:     imp.rendUnit   || 'un',
            servings:       1,
            instructions:   '',
          } as any).select('id').single();
          if (!newSheet) continue;
          sheetId = (newSheet as any).id;
          createdSheets++;
        }

        highlightIds.add(sheetId);

        // 3. Busca itens existentes da ficha
        const { data: sheetItems } = await supabase
          .from('technical_sheet_items').select('id, item_id').eq('sheet_id', sheetId);

        // 4. Processa ingredientes
        for (const row of imp.items) {
          const key = row.insumo.trim().toLowerCase();
          const itemId = stockMap[key];
          if (!itemId) continue;

          // Atualiza unidade do insumo se mudou na planilha
          if (row.unidade && row.unidade !== stockUnitMap[itemId]) {
            await supabase.from('stock_items').update({ unit: row.unidade }).eq('id', itemId);
            stockUnitMap[itemId] = row.unidade;
          }

          const existing = sheetItems?.find((si: any) => si.item_id === itemId) as any;
          if (existing) {
            await supabase.from('technical_sheet_items').update({
              quantity:  row.quantidade,
              gross_quantity: row.quantidade,
              unit_cost: row.custo_unit,
            }).eq('id', existing.id);
          } else {
            await supabase.from('technical_sheet_items').insert({
              sheet_id: sheetId, item_id: itemId,
              quantity: row.quantidade, gross_quantity: row.quantidade,
              correction_factor: 1, unit_cost: row.custo_unit, section: 'receita',
            } as any);
          }
        }
      }

      const resumo = [`${updatedSheets} fichas atualizadas`];
      if (createdSheets)  resumo.push(`${createdSheets} fichas criadas`);
      if (createdInsumos) resumo.push(`${createdInsumos} insumos criados`);
      toast.success(resumo.join(' · ') + '!');

      // Destaca as fichas atualizadas em verde por 8 segundos
      setUpdatedSheetIds(highlightIds);
      setTimeout(() => setUpdatedSheetIds(new Set()), 8000);

      load();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar arquivo Excel');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

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
                  <div className="flex gap-2">
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sheetCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!addingCat ? (
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => setAddingCat(true)} title="Nova categoria">
                        <Plus className="w-4 h-4" />
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Input className="w-36" placeholder="Nova categoria" value={newCatName} onChange={e => setNewCatName(e.target.value)} autoFocus />
                        <Button size="icon" className="shrink-0" onClick={async () => {
                          const n = newCatName.trim();
                          if (!n) return;
                          if (sheetCategories.includes(n)) { toast.error('Categoria já existe'); return; }
                          await supabase.from('sheet_categories').insert({ name: n, sort_order: sheetCategories.length + 1 } as any);
                          setSheetCategories(prev => [...prev, n]);
                          setCategory(n);
                          setNewCatName('');
                          setAddingCat(false);
                          toast.success(`Categoria "${n}" criada!`);
                        }}><Check className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { setAddingCat(false); setNewCatName(''); }}><X className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Rendimento</label>
                  <Input type="number" value={yieldQty} onChange={e => setYieldQty(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Unidade</label>
                  <Select value={yieldUnit} onValueChange={setYieldUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {YIELD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Insumos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">Insumos da Receita</label>
                  <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
                </div>

                {formItems.length > 0 && (
                  <div className="grid grid-cols-[1fr_80px_70px_90px_32px] gap-1 text-[10px] text-muted-foreground mb-1 px-1">
                    <span>Item</span><span>Quantidade</span><span>Un.</span>
                    <span className="text-right">Custo Total</span><span></span>
                  </div>
                )}

                {formItems.map((item, idx) => {
                  const compatUnits = item.item_id
                    ? getCompatibleUnits(stockItems.find(s => s.id === item.item_id)?.unit || item.unit)
                    : [item.unit].filter(Boolean);
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_80px_70px_90px_32px] gap-1 items-center mb-1">
                      <ItemCombobox
                        stockItems={stockItems}
                        value={item.item_id}
                        onSelect={v => updateItem(idx, 'item_id', v)}
                        onCreateNew={() => setQuickCreateOpen(true)}
                      />
                      <Input type="text" inputMode="decimal" className="h-8 text-xs" placeholder="Ex: 0.5" value={String(item.quantity)} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                      {compatUnits.length > 1 ? (
                        <select
                          className="h-8 text-xs border border-input rounded-md px-1 bg-background cursor-pointer"
                          value={item.unit}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
                        >
                          {compatUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground text-center">{item.unit}</span>
                      )}
                      <span className="text-xs font-medium text-foreground text-right">{fmtCur((parseFloat(String(item.quantity).replace(',', '.')) || 0) * item.unit_cost)}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)}><X className="w-3 h-3" /></Button>
                    </div>
                  );
                })}

                {formItems.length > 0 && (
                  <div className="flex justify-end mt-2 pr-10">
                    <span className="text-sm font-semibold text-primary">
                      Total: {fmtCur(formItems.reduce((s, i) => s + (parseFloat(String(i.quantity).replace(',', '.')) || 0) * i.unit_cost, 0))}
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

      {/* Filters + Excel buttons */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Input placeholder="Buscar receita..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {sheetCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport} className="gap-2 shrink-0">
          <Download className="w-4 h-4" />
          Exportar Excel
        </Button>
        <label className="inline-flex items-center gap-2 cursor-pointer shrink-0 px-3 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
          <Upload className="w-4 h-4" />
          Importar Excel
        </label>
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
            <Badge variant="outline">Rende: {viewingSheet.yield_quantity} {viewingSheet.yield_unit}</Badge>
            <Badge className="bg-primary/20 text-primary">Custo: {fmtCur(getSheetTotalCost(viewingSheet))}</Badge>
          </div>

          {/* Ingredients table */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 text-muted-foreground font-medium">Insumo</th>
                  <th className="py-2 text-muted-foreground font-medium text-center">Quantidade</th>
                  <th className="py-2 text-muted-foreground font-medium text-center">Unidade</th>
                  <th className="py-2 text-muted-foreground font-medium text-right">Custo Unit.</th>
                  <th className="py-2 text-muted-foreground font-medium text-right">Custo Total</th>
                </tr>
              </thead>
              <tbody>
                {viewingSheet.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{item.item_name}</td>
                    <td className="py-2 text-center text-foreground font-medium">{fmtNum(item.quantity)}</td>
                    <td className="py-2 text-center text-muted-foreground">{item.unit}</td>
                    <td className="py-2 text-right text-muted-foreground">{fmtCur(item.unit_cost)}</td>
                    <td className="py-2 text-right text-foreground font-medium">{fmtCur(item.quantity * item.unit_cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={4} className="py-2 text-right font-semibold text-foreground">Total:</td>
                  <td className="py-2 text-right font-bold text-primary">{fmtCur(getSheetTotalCost(viewingSheet))}</td>
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
      <div className="rounded-xl border border-border overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
              <th className="text-left px-5 py-2.5 w-8">#</th>
              <th className="text-left px-3 py-2.5">RECEITA</th>
              <th className="text-left px-3 py-2.5">CATEGORIA</th>
              <th className="text-center px-3 py-2.5">INSUMOS</th>
              <th className="text-center px-3 py-2.5">PREPARO</th>
              <th className="text-center px-3 py-2.5">RENDIMENTO</th>
              <th className="text-right px-3 py-2.5">CUSTO TOTAL</th>
              <th className="text-center px-3 py-2.5 w-28">AÇÕES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredSheets.map((sheet, idx) => (
              <tr key={sheet.id} className={cn("transition-colors group", updatedSheetIds.has(sheet.id) ? "bg-green-50 hover:bg-green-100" : "hover:bg-amber-50")}>
                <td className="px-5 py-2.5 text-muted-foreground text-xs">{idx + 1}</td>

                {/* RECEITA — inline editable */}
                <td className="px-3 py-2.5">
                  {editingCell?.id === sheet.id && editingCell.field === 'name' ? (
                    <input
                      ref={inlineInputRef}
                      className="font-medium text-foreground border-b border-primary bg-transparent outline-none w-full"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onBlur={() => commitEdit(sheet)}
                      onKeyDown={e => handleInlineKeyDown(e, sheet)}
                    />
                  ) : (
                    <div
                      className="cursor-pointer group/cell flex items-center gap-1"
                      onClick={() => startEdit(sheet, 'name')}
                      title="Clique para editar"
                    >
                      <span className="font-medium text-foreground border-b border-dashed border-transparent group-hover/cell:border-muted-foreground transition-colors">
                        {sheet.name}
                      </span>
                      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0" />
                    </div>
                  )}
                  {sheet.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[260px]">{sheet.description}</p>}
                </td>

                <td className="px-3 py-2.5">
                  {sheet.category
                    ? <Badge variant="secondary" className="text-[10px]">{sheet.category}</Badge>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>

                <td className="px-3 py-2.5 text-center text-sm font-medium text-foreground">{sheet.items.length}</td>

                {/* PREPARO — inline editable */}
                <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                  {editingCell?.id === sheet.id && editingCell.field === 'prep_time' ? (
                    <input
                      ref={inlineInputRef}
                      type="number"
                      className="w-16 text-center border-b border-primary bg-transparent outline-none text-xs"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onBlur={() => commitEdit(sheet)}
                      onKeyDown={e => handleInlineKeyDown(e, sheet)}
                    />
                  ) : (
                    <div
                      className="cursor-pointer group/cell inline-flex items-center gap-1"
                      onClick={() => startEdit(sheet, 'prep_time')}
                      title="Clique para editar"
                    >
                      <span className="border-b border-dashed border-transparent group-hover/cell:border-muted-foreground transition-colors">
                        {sheet.prep_time > 0 ? `${sheet.prep_time} min` : '—'}
                      </span>
                      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0" />
                    </div>
                  )}
                </td>

                {/* RENDIMENTO — inline editable (qty, unit) */}
                <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                  <div className="inline-flex items-center gap-1">
                    {/* yield_quantity */}
                    {editingCell?.id === sheet.id && editingCell.field === 'yield_quantity' ? (
                      <input
                        ref={inlineInputRef}
                        type="number"
                        className="w-14 text-center border-b border-primary bg-transparent outline-none text-xs"
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => commitEdit(sheet)}
                        onKeyDown={e => handleInlineKeyDown(e, sheet)}
                      />
                    ) : (
                      <span
                        className="cursor-pointer border-b border-dashed border-transparent hover:border-muted-foreground transition-colors"
                        onClick={() => startEdit(sheet, 'yield_quantity')}
                        title="Editar quantidade"
                      >
                        {sheet.yield_quantity}
                      </span>
                    )}

                    {/* yield_unit */}
                    {editingCell?.id === sheet.id && editingCell.field === 'yield_unit' ? (
                      <select
                        className="border-b border-primary bg-transparent outline-none text-xs"
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => commitEdit(sheet)}
                        onKeyDown={e => handleInlineKeyDown(e, sheet)}
                        autoFocus
                      >
                        {YIELD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : (
                      <span
                        className="cursor-pointer border-b border-dashed border-transparent hover:border-muted-foreground transition-colors"
                        onClick={() => startEdit(sheet, 'yield_unit')}
                        title="Editar unidade"
                      >
                        {sheet.yield_unit}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-3 py-2.5 text-right font-semibold text-amber-700">
                  {fmtCur(getSheetTotalCost(sheet))}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-0.5">
                    <Button variant="ghost" size="icon" className="w-7 h-7" title="Abrir ficha" onClick={() => navigate(`/sheets/${sheet.id}`)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7" title="Editar" onClick={() => openEditDialog(sheet)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7" title="Duplicar" onClick={() => openDuplicateDialog(sheet)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7" title="Remover" onClick={() => handleDelete(sheet.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredSheets.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground text-sm">
                  {sheets.length === 0 ? 'Nenhuma ficha técnica cadastrada.' : 'Nenhuma receita encontrada.'}
                </td>
              </tr>
            )}
          </tbody>
          {filteredSheets.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td colSpan={6} className="px-5 py-2 text-xs font-semibold text-muted-foreground text-right">
                  {filteredSheets.length} receitas
                </td>
                <td className="px-3 py-2 text-right font-bold text-amber-700 text-sm">
                  {fmtCur(filteredSheets.reduce((s, sh) => s + getSheetTotalCost(sh), 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
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
