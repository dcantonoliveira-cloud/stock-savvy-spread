import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import {
  Plus, Trash2, Eye, Pencil, X, Upload, Loader2, CheckCircle2,
  AlertCircle, Copy, FileImage, ArrowRight, Package, ChevronsUpDown,
  Check, PackagePlus, AlertTriangle, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MANTIMENTOS_ID = '3fc5dd78-8578-4c45-9c01-6ba8a2123e7a';

type StockItem = { id: string; name: string; unit: string; unit_cost: number; current_stock: number };
type SheetItem = { id?: string; item_id: string; item_name: string; quantity: number; unit: string; unit_cost: number; section: 'receita' | 'decoracao' };
type Sheet = { id: string; name: string; servings: number; yield_quantity: number; yield_unit: string; description: string | null; category: string | null; prep_time: number; instructions: string | null; items: SheetItem[] };
type ExtractedDish = { raw_name: string; quantity: number; unit: string; section_label: string; matched_sheet_id: string | null; matched_sheet_name: string | null; match_score: number; status: 'matched' | 'unmatched' };
type MenuDish = { id: string; sheet_id: string; sheet_name: string; planned_quantity: number; planned_unit: string; sheet: Sheet | null; expanded: boolean };
type EventMenu = { id: string; name: string; location: string | null; guest_count: number; staff_count: number; event_date: string | null; status: string; notes: string | null; created_at: string; dishes: MenuDish[] };

function strSim(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúùûüç\s]/g, '').trim();
  const s2 = b.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúùûüç\s]/g, '').trim();
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;
  const len = Math.max(s1.length, s2.length);
  const dp: number[][] = Array.from({ length: s1.length + 1 }, (_, i) => Array.from({ length: s2.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= s1.length; i++) for (let j = 1; j <= s2.length; j++) dp[i][j] = s1[i-1] === s2[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[s1.length][s2.length] / len;
}

function bestMatch(name: string, sheets: Sheet[]): { sheet: Sheet | null; score: number } {
  let best: Sheet | null = null, bestScore = 0;
  for (const s of sheets) { const score = strSim(name, s.name); if (score > bestScore) { bestScore = score; best = s; } }
  return { sheet: bestScore >= 0.42 ? best : null, score: bestScore };
}

function ItemCombobox({ stockItems, value, onSelect, onCreateNew }: { stockItems: StockItem[]; value: string; onSelect: (id: string) => void; onCreateNew: () => void }) {
  const [open, setOpen] = useState(false);
  const selected = stockItems.find(s => s.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-8 text-xs justify-between w-full font-normal">
          <span className="truncate">{selected ? selected.name : 'Selecionar item...'}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar insumo..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>{stockItems.map(si => (<CommandItem key={si.id} value={si.name} onSelect={() => { onSelect(si.id); setOpen(false); }}><Check className={cn("mr-2 h-3 w-3", value === si.id ? "opacity-100" : "opacity-0")} /><span className="truncate">{si.name}</span><span className="ml-auto text-[10px] text-muted-foreground">{si.unit}</span></CommandItem>))}</CommandGroup>
            <CommandSeparator />
            <CommandGroup><CommandItem onSelect={() => { setOpen(false); onCreateNew(); }} className="text-primary"><PackagePlus className="mr-2 h-3 w-3" />Criar novo insumo...</CommandItem></CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function QuickCreateItemDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (item: StockItem) => void }) {
  const [name, setName] = useState(''); const [unit, setUnit] = useState('kg'); const [unitCost, setUnitCost] = useState('0'); const [category, setCategory] = useState('Outros'); const [categories, setCategories] = useState<string[]>([]); const [saving, setSaving] = useState(false);
  const UNITS = ['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct', 'lata', 'garrafa'];
  useEffect(() => { if (open) supabase.from('categories').select('name').order('name').then(({ data }) => { if (data) setCategories(data.map((c: any) => c.name)); }); }, [open]);
  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('stock_items').insert({ name: name.trim(), unit, unit_cost: parseFloat(unitCost) || 0, category, current_stock: 0, min_stock: 0 } as any).select('id, name, unit, unit_cost, current_stock').single();
    if (error || !data) { toast.error('Erro ao criar insumo'); setSaving(false); return; }
    toast.success(`Insumo "${name}" criado!`); onCreated(data as unknown as StockItem); setName(''); setUnit('kg'); setUnitCost('0'); setSaving(false); onClose();
  };
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Criar Novo Insumo</DialogTitle><DialogDescription>Cadastre rapidamente um novo item de estoque</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-sm text-muted-foreground mb-1 block">Nome *</label><Input value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-muted-foreground mb-1 block">Unidade</label><Select value={unit} onValueChange={setUnit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-sm text-muted-foreground mb-1 block">Custo (R$)</label><Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} /></div>
          </div>
          <div><label className="text-sm text-muted-foreground mb-1 block">Categoria</label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Criar Insumo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SheetViewEditDialog({ open, onClose, sheet, stockItems, onSaved }: { open: boolean; onClose: () => void; sheet: Sheet | null; stockItems: StockItem[]; onSaved: (s: Sheet) => void }) {
  const [editing, setEditing] = useState(false); const [name, setName] = useState(''); const [yieldQty, setYieldQty] = useState('1'); const [yieldUnit, setYieldUnit] = useState('kg'); const [formItems, setFormItems] = useState<SheetItem[]>([]); const [saving, setSaving] = useState(false); const [quickCreateOpen, setQuickCreateOpen] = useState(false); const [localStock, setLocalStock] = useState<StockItem[]>([]);
  useEffect(() => { if (sheet) { setName(sheet.name); setYieldQty(sheet.yield_quantity?.toString() || '1'); setYieldUnit(sheet.yield_unit || 'kg'); setFormItems(sheet.items.map(i => ({ ...i }))); setEditing(false); } }, [sheet]);
  useEffect(() => { setLocalStock(stockItems); }, [stockItems]);
  const addItem = (section: 'receita' | 'decoracao') => setFormItems(prev => [...prev, { item_id: '', item_name: '', quantity: 0, unit: '', unit_cost: 0, section }]);
  const updateItem = (idx: number, field: string, value: any) => setFormItems(prev => prev.map((it, i) => { if (i !== idx) return it; if (field === 'item_id') { const si = localStock.find(s => s.id === value); return { ...it, item_id: value, item_name: si?.name || '', unit: si?.unit || '', unit_cost: si?.unit_cost || 0 }; } return { ...it, [field]: field === 'quantity' ? parseFloat(value) || 0 : value }; }));
  const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));
  const handleSave = async () => {
    if (!sheet) return; setSaving(true);
    await supabase.from('technical_sheets').update({ name: name.trim(), yield_quantity: parseFloat(yieldQty) || 1, yield_unit: yieldUnit } as any).eq('id', sheet.id);
    await supabase.from('technical_sheet_items').delete().eq('sheet_id', sheet.id);
    const valid = formItems.filter(i => i.item_id);
    if (valid.length > 0) await supabase.from('technical_sheet_items').insert(valid.map(i => ({ sheet_id: sheet.id, item_id: i.item_id, quantity: i.quantity, unit_cost: i.unit_cost, section: i.section || 'receita' })) as any);
    toast.success('Ficha atualizada!'); onSaved({ ...sheet, name: name.trim(), yield_quantity: parseFloat(yieldQty) || 1, yield_unit: yieldUnit, items: valid }); setSaving(false); setEditing(false);
  };
  if (!sheet) return null;
  const recipeItems = formItems.filter(i => i.section !== 'decoracao'); const decoItems = formItems.filter(i => i.section === 'decoracao');
  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); setEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">{editing ? <Input value={name} onChange={e => setName(e.target.value)} className="text-base font-bold h-9" /> : <DialogTitle>{sheet.name}</DialogTitle>}</div>
              <div className="flex gap-2 flex-shrink-0">
                {!editing ? <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5 mr-1" />Editar</Button>
                  : <><Button size="sm" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}Salvar</Button><Button variant="ghost" size="sm" onClick={() => { setEditing(false); setFormItems(sheet.items.map(i => ({ ...i }))); }}>Cancelar</Button></>}
              </div>
            </div>
            <DialogDescription>Rende {sheet.yield_quantity} {sheet.yield_unit} · {formItems.length} ingredientes · Custo: R$ {formItems.reduce((s, i) => s + i.quantity * i.unit_cost, 0).toFixed(2)}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div>
              <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Receita Principal</p>{editing && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addItem('receita')}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>}</div>
              <table className="w-full text-sm">
                {recipeItems.length > 0 && <thead><tr className="text-xs text-muted-foreground border-b border-border"><th className="text-left py-1">Insumo</th><th className="text-right py-1 w-24">Qtd</th><th className="text-center py-1 w-12">Un.</th><th className="text-right py-1 w-24">Custo</th>{editing && <th className="w-8"></th>}</tr></thead>}
                <tbody className="divide-y divide-border/40">
                  {recipeItems.map((item) => { const idx = formItems.indexOf(item); return (<tr key={idx}><td className="py-1.5">{editing ? <ItemCombobox stockItems={localStock} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => setQuickCreateOpen(true)} /> : <span>{item.item_name}</span>}</td><td className="py-1.5 text-right">{editing ? <Input type="number" step="any" className="h-7 w-20 text-xs text-right ml-auto" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} /> : <span className="font-medium">{item.quantity}</span>}</td><td className="py-1.5 text-center text-muted-foreground text-xs">{item.unit}</td><td className="py-1.5 text-right text-muted-foreground text-xs">R$ {(item.quantity * item.unit_cost).toFixed(2)}</td>{editing && <td className="py-1.5"><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button></td>}</tr>); })}
                </tbody>
              </table>
              {recipeItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum ingrediente</p>}
            </div>
            <div className="border-t border-dashed border-amber-200 pt-4">
              <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">🎨 Decoração</p>{editing && <Button variant="outline" size="sm" className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => addItem('decoracao')}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>}</div>
              <table className="w-full text-sm">
                {decoItems.length > 0 && <thead><tr className="text-xs text-muted-foreground border-b border-amber-100"><th className="text-left py-1">Item</th><th className="text-right py-1 w-24">Qtd</th><th className="text-center py-1 w-12">Un.</th><th className="text-right py-1 w-24">Custo</th>{editing && <th className="w-8"></th>}</tr></thead>}
                <tbody className="divide-y divide-amber-50">
                  {decoItems.map((item) => { const idx = formItems.indexOf(item); return (<tr key={idx} style={{ background: 'hsl(38 80% 99%)' }}><td className="py-1.5">{editing ? <ItemCombobox stockItems={localStock} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => setQuickCreateOpen(true)} /> : <span>{item.item_name}</span>}</td><td className="py-1.5 text-right">{editing ? <Input type="number" step="any" className="h-7 w-20 text-xs text-right ml-auto" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} /> : <span className="font-medium">{item.quantity}</span>}</td><td className="py-1.5 text-center text-muted-foreground text-xs">{item.unit}</td><td className="py-1.5 text-right text-muted-foreground text-xs">R$ {(item.quantity * item.unit_cost).toFixed(2)}</td>{editing && <td className="py-1.5"><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button></td>}</tr>); })}
                </tbody>
              </table>
              {decoItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum item de decoração</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <QuickCreateItemDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} onCreated={item => setLocalStock(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))} />
    </>
  );
}

function CreateSheetDialog({ open, onClose, initialName, stockItems, onCreated }: { open: boolean; onClose: () => void; initialName: string; stockItems: StockItem[]; onCreated: (sheet: Sheet) => void }) {
  const [name, setName] = useState(initialName); const [yieldQty, setYieldQty] = useState('1'); const [yieldUnit, setYieldUnit] = useState('un'); const [formItems, setFormItems] = useState<SheetItem[]>([]); const [saving, setSaving] = useState(false); const [quickCreateOpen, setQuickCreateOpen] = useState(false); const [localStock, setLocalStock] = useState<StockItem[]>(stockItems);
  useEffect(() => { setName(initialName); }, [initialName]); useEffect(() => { setLocalStock(stockItems); }, [stockItems]);
  const addItem = (section: 'receita' | 'decoracao') => setFormItems(prev => [...prev, { item_id: '', item_name: '', quantity: 0, unit: '', unit_cost: 0, section }]);
  const updateItem = (idx: number, field: string, value: any) => setFormItems(prev => prev.map((it, i) => { if (i !== idx) return it; if (field === 'item_id') { const si = localStock.find(s => s.id === value); return { ...it, item_id: value, item_name: si?.name || '', unit: si?.unit || '', unit_cost: si?.unit_cost || 0 }; } return { ...it, [field]: field === 'quantity' ? parseFloat(value) || 0 : value }; }));
  const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));
  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; } setSaving(true);
    const { data: sheet, error } = await supabase.from('technical_sheets').insert({ name: name.trim(), yield_quantity: parseFloat(yieldQty) || 1, yield_unit: yieldUnit, servings: 1 } as any).select().single();
    if (error || !sheet) { toast.error('Erro ao criar ficha'); setSaving(false); return; }
    const valid = formItems.filter(i => i.item_id);
    if (valid.length > 0) await supabase.from('technical_sheet_items').insert(valid.map(i => ({ sheet_id: (sheet as any).id, item_id: i.item_id, quantity: i.quantity, unit_cost: i.unit_cost, section: i.section || 'receita' })) as any);
    toast.success('Ficha técnica criada!'); onCreated({ ...(sheet as any), items: valid }); setFormItems([]); setSaving(false); onClose();
  };
  const recipeItems = formItems.filter(i => i.section !== 'decoracao'); const decoItems = formItems.filter(i => i.section === 'decoracao');
  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Nova Ficha Técnica</DialogTitle><DialogDescription>Crie uma nova ficha para associar a este prato</DialogDescription></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3"><label className="text-sm text-muted-foreground mb-1 block">Nome *</label><Input value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
              <div className="col-span-2"><label className="text-sm text-muted-foreground mb-1 block">Rendimento</label><Input type="number" value={yieldQty} onChange={e => setYieldQty(e.target.value)} /></div>
              <div><label className="text-sm text-muted-foreground mb-1 block">Unidade</label><Select value={yieldUnit} onValueChange={setYieldUnit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['kg', 'g', 'L', 'ml', 'un', 'porções'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Receita Principal</p><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addItem('receita')}><Plus className="w-3 h-3 mr-1" />Adicionar</Button></div>
              {recipeItems.map((item) => { const idx = formItems.indexOf(item); return (<div key={idx} className="grid grid-cols-[1fr_80px_60px_28px] gap-1 items-center mb-1"><ItemCombobox stockItems={localStock} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => setQuickCreateOpen(true)} /><Input type="number" step="any" className="h-8 text-xs" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} /><span className="text-xs text-muted-foreground text-center">{item.unit}</span><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button></div>); })}
            </div>
            <div className="border-t border-dashed border-amber-200 pt-3">
              <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">🎨 Decoração</p><Button variant="outline" size="sm" className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => addItem('decoracao')}><Plus className="w-3 h-3 mr-1" />Adicionar</Button></div>
              {decoItems.map((item) => { const idx = formItems.indexOf(item); return (<div key={idx} className="grid grid-cols-[1fr_80px_60px_28px] gap-1 items-center mb-1" style={{ background: 'hsl(38 80% 99%)' }}><ItemCombobox stockItems={localStock} value={item.item_id} onSelect={v => updateItem(idx, 'item_id', v)} onCreateNew={() => setQuickCreateOpen(true)} /><Input type="number" step="any" className="h-8 text-xs" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} /><span className="text-xs text-muted-foreground text-center">{item.unit}</span><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button></div>); })}
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Criar Ficha Técnica</Button>
          </div>
        </DialogContent>
      </Dialog>
      <QuickCreateItemDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} onCreated={item => setLocalStock(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))} />
    </>
  );
}

// ─── Extraction Progress ──────────────────────────────────────────────────────

function ExtractionProgress({ elapsed }: { elapsed: number }) {
  const estimated = 25;
  const progress = Math.min((elapsed / estimated) * 100, 95);
  const remaining = Math.max(0, estimated - elapsed);

  return (
    <div className="py-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
      <div>
        <p className="font-medium text-foreground">Analisando o cardápio...</p>
        <p className="text-sm text-muted-foreground mt-1">A IA está lendo e cruzando com suas fichas técnicas</p>
      </div>
      <div className="max-w-xs mx-auto space-y-2">
        <div className="w-full bg-border rounded-full h-2 overflow-hidden">
          <div className="h-2 rounded-full bg-primary transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}%</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{remaining}s restantes</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EventMenusPage() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<EventMenu[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<EventMenu | null>(null);
  const [step, setStep] = useState(1);
  const [formName, setFormName] = useState(''); const [formLocation, setFormLocation] = useState(''); const [formGuests, setFormGuests] = useState('100'); const [formStaff, setFormStaff] = useState('0'); const [formDate, setFormDate] = useState(''); const [formNotes, setFormNotes] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [extractedDishes, setExtractedDishes] = useState<ExtractedDish[]>([]);
  const [showUnmatchedWarning, setShowUnmatchedWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [viewingSheet, setViewingSheet] = useState<Sheet | null>(null);
  const [creatingForIdx, setCreatingForIdx] = useState<number | null>(null);
  const [creatingInitialName, setCreatingInitialName] = useState('');
  const [duplicatingSheet, setDuplicatingSheet] = useState<Sheet | null>(null);
  const [duplicatingForIdx, setDuplicatingForIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [menusRes, sheetsRes, itemsRes] = await Promise.all([
      supabase.from('event_menus').select('*').order('event_date', { ascending: false }),
      supabase.from('technical_sheets').select('*').order('name'),
      supabase.from('stock_items').select('id, name, unit, unit_cost, current_stock').order('name'),
    ]);
    if (itemsRes.data) setStockItems(itemsRes.data as unknown as StockItem[]);
    if (sheetsRes.data) {
      const loaded = await Promise.all((sheetsRes.data as any[]).map(async s => {
        const { data: si } = await supabase.from('technical_sheet_items').select('id, item_id, quantity, unit_cost, section').eq('sheet_id', s.id);
        const items: SheetItem[] = (si || []).map((i: any) => { const item = (itemsRes.data as any[])?.find((x: any) => x.id === i.item_id); return { id: i.id, item_id: i.item_id, item_name: item?.name || '?', quantity: i.quantity, unit: item?.unit || '', unit_cost: i.unit_cost || item?.unit_cost || 0, section: i.section || 'receita' }; });
        return { ...s, items } as Sheet;
      }));
      setSheets(loaded);
    }
    if (menusRes.data) {
      const sheetsData = sheetsRes.data as any[] || [];
      const loaded = await Promise.all((menusRes.data as any[]).map(async m => {
        const { data: dishes } = await supabase.from('event_menu_dishes').select('*').eq('menu_id', m.id).order('sort_order');
        const menuDishes: MenuDish[] = (dishes || []).map((d: any) => { const sheet = sheetsData.find(s => s.id === d.sheet_id); return { id: d.id, sheet_id: d.sheet_id, sheet_name: sheet?.name || '?', planned_quantity: d.planned_quantity, planned_unit: d.planned_unit || 'un', sheet: null, expanded: false }; });
        return { ...m, dishes: menuDishes } as EventMenu;
      }));
      setMenus(loaded);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setFormName(''); setFormLocation(''); setFormGuests('100'); setFormStaff('0'); setFormDate(''); setFormNotes(''); setExtractedDishes([]); setStep(1); setEditingMenu(null); setShowUnmatchedWarning(false); };

  const startTimer = () => { setElapsedSeconds(0); timerRef.current = setInterval(() => setElapsedSeconds(p => p + 1), 1000); };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => { const base64 = (ev.target?.result as string).split(',')[1]; await extractDishes(base64, file.type); };
    reader.readAsDataURL(file);
  };

  const extractDishes = async (base64: string, mediaType: string) => {
    setExtracting(true); setExtractedDishes([]); startTimer();
    try {
      const response = await fetch('https://vfrtvnzptaazhzfirflm.supabase.co/functions/v1/extract-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcnR2bnpwdGFhemh6ZmlyZmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjg2MjksImV4cCI6MjA4OTAwNDYyOX0.6yyDclMjzfkSUK2c_zUEjtAkhOUWrEotwRbGcQo6tb0` },
        body: JSON.stringify({ base64, mediaType }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || String(data.error));
      const text = data.content?.find((c: any) => c.type === 'text')?.text || '';
      let parsed: { dishes: any[] };
      try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { toast.error('Erro ao processar o cardápio.'); return; }
      const matched: ExtractedDish[] = parsed.dishes.map((d: any) => {
        const rawName = d.raw_name?.trim() || '';
        const { sheet, score } = bestMatch(rawName, sheets);
        return { raw_name: rawName, quantity: d.quantity || 0, unit: d.unit || 'un', section_label: d.section_label || '', matched_sheet_id: sheet?.id || null, matched_sheet_name: sheet?.name || null, match_score: score, status: sheet ? 'matched' : 'unmatched' };
      });
      setExtractedDishes(matched);
      const mc = matched.filter(d => d.status === 'matched').length;
      toast.success(`${matched.length} pratos extraídos · ${mc} associados automaticamente`);
    } catch (err: any) { toast.error('Erro: ' + (err?.message || '')); console.error(err); }
    finally { setExtracting(false); stopTimer(); }
  };

  const updateMatch = (idx: number, sheetId: string | null) => { const sheet = sheets.find(s => s.id === sheetId); setExtractedDishes(prev => prev.map((d, i) => i !== idx ? d : { ...d, matched_sheet_id: sheetId, matched_sheet_name: sheet?.name || null, status: sheetId ? 'matched' : 'unmatched' })); };

  const handleSaveMenu = async () => {
    if (!formName.trim()) { toast.error('Nome do evento é obrigatório'); return; }
    const matched = extractedDishes.filter(d => d.matched_sheet_id);
    const unmatched = extractedDishes.filter(d => !d.matched_sheet_id);

    // Warn about unmatched items
    if (unmatched.length > 0 && !showUnmatchedWarning) {
      setShowUnmatchedWarning(true);
      return;
    }

    if (matched.length === 0) { toast.error('Associe pelo menos um prato a uma ficha técnica'); return; }
    setSaving(true);
    const guestCount = parseInt(formGuests) || 100;
    const menuData = { name: formName.trim(), location: formLocation.trim() || null, guest_count: guestCount, staff_count: parseInt(formStaff) || 0, event_date: formDate || null, notes: formNotes.trim() || null, status: 'draft' };
    let menuId: string;
    if (editingMenu) {
      await supabase.from('event_menus').update(menuData as any).eq('id', editingMenu.id); menuId = editingMenu.id;
      await supabase.from('event_menu_dishes').delete().eq('menu_id', menuId);
    } else {
      const { data, error } = await supabase.from('event_menus').insert(menuData as any).select().single();
      if (error || !data) { toast.error('Erro ao criar cardápio'); setSaving(false); return; } menuId = (data as any).id;
    }

    // Insert dishes
    const dishInserts = matched.map((d, idx) => ({ menu_id: menuId, sheet_id: d.matched_sheet_id, planned_quantity: d.quantity, planned_unit: d.unit, sort_order: idx }));

    // Add MANTIMENTOS automatically (quantity = guest count)
    dishInserts.push({ menu_id: menuId, sheet_id: MANTIMENTOS_ID, planned_quantity: guestCount, planned_unit: 'un', sort_order: dishInserts.length });

    await supabase.from('event_menu_dishes').insert(dishInserts as any);
    toast.success(editingMenu ? 'Cardápio atualizado!' : 'Cardápio criado!'); setSaving(false); resetForm(); setDialogOpen(false); load();
  };

  const handleDelete = async (id: string) => { if (!confirm('Remover este cardápio?')) return; await supabase.from('event_menu_dishes').delete().eq('menu_id', id); await supabase.from('event_menus').delete().eq('id', id); toast.success('Cardápio removido!'); load(); };
  const openEdit = (menu: EventMenu) => { setEditingMenu(menu); setFormName(menu.name); setFormLocation(menu.location || ''); setFormGuests(menu.guest_count.toString()); setFormStaff(menu.staff_count.toString()); setFormDate(menu.event_date || ''); setFormNotes(menu.notes || ''); setStep(1); setDialogOpen(true); };

  const matchedCount = extractedDishes.filter(d => d.status === 'matched').length;
  const unmatchedCount = extractedDishes.filter(d => d.status === 'unmatched').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Cardápios de Eventos</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monte cardápios a partir do arquivo do evento</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Criar Cardápio</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { resetForm(); stopTimer(); } }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingMenu ? 'Editar Cardápio' : 'Novo Cardápio de Evento'}</DialogTitle>
            <DialogDescription>{step === 1 ? 'Preencha as informações do evento' : 'Envie o cardápio e confirme os pratos'}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {[{ n: 1, label: 'Informações' }, { n: 2, label: 'Cardápio' }].map(({ n, label }) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-1.5 text-xs font-medium ${step >= n ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step >= n ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{n}</div>{label}
                </div>
                {n < 2 && <div className={`flex-1 h-px ${step > n ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 pr-1">
            {step === 1 && (
              <div className="space-y-4 py-2">
                <div><label className="text-sm text-muted-foreground mb-1 block">Nome do Evento *</label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Casamento Silva & Santos" autoFocus /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm text-muted-foreground mb-1 block">Local</label><Input value={formLocation} onChange={e => setFormLocation(e.target.value)} /></div>
                  <div><label className="text-sm text-muted-foreground mb-1 block">Data</label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm text-muted-foreground mb-1 block">Convidados</label><Input type="number" value={formGuests} onChange={e => setFormGuests(e.target.value)} /></div>
                  <div><label className="text-sm text-muted-foreground mb-1 block">Profissionais</label><Input type="number" value={formStaff} onChange={e => setFormStaff(e.target.value)} /></div>
                </div>
                <div><label className="text-sm text-muted-foreground mb-1 block">Observações</label><Input value={formNotes} onChange={e => setFormNotes(e.target.value)} /></div>
                <Button className="w-full" onClick={() => { if (!formName.trim()) { toast.error('Nome do evento é obrigatório'); return; } setStep(2); }}>Próximo: Carregar Cardápio <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 py-2">
                {!extracting && extractedDishes.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/40 transition-all" onClick={() => fileInputRef.current?.click()}>
                    <FileImage className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium text-foreground mb-1">Envie o cardápio do evento</p>
                    <p className="text-sm text-muted-foreground">Imagem (JPG, PNG) ou PDF</p>
                    <Button variant="outline" size="sm" className="mt-4"><Upload className="w-4 h-4 mr-2" />Selecionar arquivo</Button>
                    <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
                  </div>
                )}

                {extracting && <ExtractionProgress elapsed={elapsedSeconds} />}

                {!extracting && extractedDishes.length > 0 && (
                  <>
                    {/* Unmatched warning */}
                    {showUnmatchedWarning && unmatchedCount > 0 && (
                      <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/40 bg-warning/5">
                        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-foreground text-sm">Atenção: {unmatchedCount} prato{unmatchedCount > 1 ? 's' : ''} sem ficha técnica</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Eles não entrarão na lista de compras. Deseja continuar assim mesmo?</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setShowUnmatchedWarning(false)}>Voltar</Button>
                          <Button size="sm" onClick={() => { setShowUnmatchedWarning(false); handleSaveMenu(); }}>Continuar</Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                      <div className="flex items-center gap-1.5 text-sm"><CheckCircle2 className="w-4 h-4 text-success" /><span className="font-semibold text-success">{matchedCount}</span><span className="text-muted-foreground">associados</span></div>
                      <div className="w-px h-4 bg-border" />
                      <div className="flex items-center gap-1.5 text-sm"><AlertCircle className="w-4 h-4 text-warning" /><span className="font-semibold text-warning">{unmatchedCount}</span><span className="text-muted-foreground">não encontrados</span></div>
                      <div className="ml-auto"><Button variant="outline" size="sm" onClick={() => { setExtractedDishes([]); fileInputRef.current?.click(); }}><Upload className="w-3.5 h-3.5 mr-1" />Reenviar</Button><input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} /></div>
                    </div>

                    <div className="space-y-2">
                      {extractedDishes.map((dish, idx) => (
                        <div key={idx} className={`rounded-xl border p-3 ${dish.status === 'matched' ? 'border-success/30 bg-success/3' : 'border-warning/40 bg-warning/5'}`}>
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0">{dish.status === 'matched' ? <CheckCircle2 className="w-4 h-4 text-success" /> : <AlertCircle className="w-4 h-4 text-warning" />}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">{dish.raw_name}</span>
                                {dish.section_label && <Badge variant="outline" className="text-[10px]">{dish.section_label}</Badge>}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Input type="number" value={dish.quantity || ''} placeholder="Qtd" onChange={e => setExtractedDishes(prev => prev.map((d, i) => i !== idx ? d : { ...d, quantity: parseFloat(e.target.value) || 0 }))} className="h-7 w-20 text-xs text-right" />
                                <Input value={dish.unit} placeholder="un" onChange={e => setExtractedDishes(prev => prev.map((d, i) => i !== idx ? d : { ...d, unit: e.target.value }))} className="h-7 w-16 text-xs" />
                                <Select value={dish.matched_sheet_id || '__none__'} onValueChange={v => updateMatch(idx, v === '__none__' ? null : v)}>
                                  <SelectTrigger className="h-7 text-xs flex-1 min-w-[180px]"><SelectValue placeholder="Selecionar ficha técnica..." /></SelectTrigger>
                                  <SelectContent><SelectItem value="__none__">— Sem ficha técnica —</SelectItem>{sheets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <div className="flex gap-1">
                                  {dish.matched_sheet_id && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { const s = sheets.find(x => x.id === dish.matched_sheet_id); setViewingSheet(s || null); }}><Eye className="w-3 h-3 mr-1" />Ver ficha</Button>}
                                  {dish.matched_sheet_id && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { const s = sheets.find(x => x.id === dish.matched_sheet_id); setDuplicatingSheet(s || null); setDuplicatingForIdx(idx); }}><Copy className="w-3 h-3 mr-1" />Duplicar</Button>}
                                  {dish.status === 'unmatched' && <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-primary/40 text-primary" onClick={() => { setCreatingInitialName(dish.raw_name); setCreatingForIdx(idx); }}><Plus className="w-3 h-3 mr-1" />Criar ficha</Button>}
                                </div>
                              </div>
                              {dish.matched_sheet_name && <p className="text-[11px] text-muted-foreground mt-1">→ <span className="text-foreground font-medium">{dish.matched_sheet_name}</span>{dish.match_score > 0 && <span className="ml-1 opacity-50">({Math.round(dish.match_score * 100)}% similar)</span>}</p>}
                            </div>
                            <button onClick={() => setExtractedDishes(prev => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive flex-shrink-0 mt-0.5"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* MANTIMENTOS notice */}
                    <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5 text-sm">
                      <Package className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">A ficha <span className="font-semibold text-foreground">MANTIMENTOS</span> será adicionada automaticamente com {formGuests} unidades (nº de convidados)</span>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                      <Button className="flex-1" onClick={handleSaveMenu} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{editingMenu ? 'Salvar Alterações' : `Criar Cardápio (${matchedCount} pratos)`}</Button>
                    </div>
                  </>
                )}
                {!extracting && extractedDishes.length === 0 && <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SheetViewEditDialog open={viewingSheet !== null} onClose={() => setViewingSheet(null)} sheet={viewingSheet} stockItems={stockItems} onSaved={(updated) => { setSheets(prev => prev.map(s => s.id === updated.id ? updated : s)); setViewingSheet(null); }} />
      <CreateSheetDialog open={creatingForIdx !== null} onClose={() => { setCreatingForIdx(null); setCreatingInitialName(''); }} initialName={creatingInitialName} stockItems={stockItems} onCreated={(newSheet) => { setSheets(prev => [...prev, newSheet].sort((a, b) => a.name.localeCompare(b.name))); if (creatingForIdx !== null) updateMatch(creatingForIdx, newSheet.id); setCreatingForIdx(null); }} />
      {duplicatingSheet && <CreateSheetDialog open={true} onClose={() => { setDuplicatingSheet(null); setDuplicatingForIdx(null); }} initialName={`${duplicatingSheet.name} (variação)`} stockItems={stockItems} onCreated={(newSheet) => { setSheets(prev => [...prev, newSheet].sort((a, b) => a.name.localeCompare(b.name))); if (duplicatingForIdx !== null) updateMatch(duplicatingForIdx, newSheet.id); setDuplicatingSheet(null); setDuplicatingForIdx(null); }} />}

      <div className="space-y-3">
        {menus.map(menu => (
          <div key={menu.id} className="bg-white rounded-xl border border-border p-4 flex items-center justify-between shadow-xs">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-medium text-foreground">{menu.name}</p>
                <Badge variant={menu.status === 'draft' ? 'secondary' : 'default'} className="text-[10px]">{menu.status === 'draft' ? 'Rascunho' : menu.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {menu.event_date ? new Date(menu.event_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                {menu.location ? ` · ${menu.location}` : ''}{` · ${menu.guest_count} convidados · ${menu.dishes.length} pratos`}
                <span className="ml-2 opacity-60">· Gerado {new Date(menu.created_at).toLocaleDateString('pt-BR')} às {new Date(menu.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => navigate(`/event-menus/${menu.id}`)}><Eye className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(menu)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(menu.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {menus.length === 0 && <div className="text-center py-16 text-muted-foreground"><Package className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Nenhum cardápio criado ainda.</p></div>}
      </div>
    </div>
  );
}
