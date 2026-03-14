import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Trash2, Eye, Calendar, MapPin, Users, Pencil, ShoppingCart, X,
  Upload, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  Copy, FileImage, ArrowRight, Package, TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

type StockItem = { id: string; name: string; unit: string; unit_cost: number; current_stock: number };

type SheetItem = {
  item_id: string; item_name: string;
  quantity: number; unit: string; unit_cost: number;
  section: 'receita' | 'decoracao';
};

type Sheet = {
  id: string; name: string; servings: number;
  yield_quantity: number; yield_unit: string; items: SheetItem[];
};

type ExtractedDish = {
  raw_name: string;
  quantity: number;
  unit: string;
  section_label: string; // ex: "Mesa Degustação"
  matched_sheet_id: string | null;
  matched_sheet_name: string | null;
  match_score: number; // 0-1
  status: 'matched' | 'unmatched' | 'pending';
};

type MenuDish = {
  id: string; sheet_id: string; sheet_name: string;
  planned_quantity: number; planned_unit: string;
  sheet: Sheet | null; expanded: boolean;
};

type EventMenu = {
  id: string; name: string; location: string | null;
  guest_count: number; staff_count: number;
  event_date: string | null; status: string; notes: string | null;
  created_at: string; dishes: MenuDish[];
};

type ShoppingItem = {
  id: string; name: string; unit: string;
  needed: number; inStock: number; toBuy: number; unitCost: number;
};

// ─── Similarity ──────────────────────────────────────────────────────────────

function strSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúùûüç\s]/g, '').trim();
  const s2 = b.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúùûüç\s]/g, '').trim();
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  const len = Math.max(s1.length, s2.length);
  const dp: number[][] = Array.from({ length: s1.length + 1 }, (_, i) =>
    Array.from({ length: s2.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= s1.length; i++)
    for (let j = 1; j <= s2.length; j++)
      dp[i][j] = s1[i-1] === s2[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[s1.length][s2.length] / len;
}

function findBestMatch(name: string, sheets: Sheet[]): { sheet: Sheet | null; score: number } {
  let best: Sheet | null = null;
  let bestScore = 0;
  for (const s of sheets) {
    const score = strSimilarity(name, s.name);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return { sheet: bestScore >= 0.45 ? best : null, score: bestScore };
}

// ─── Duplicate Sheet Dialog ───────────────────────────────────────────────────

function DuplicateSheetDialog({
  open, onClose, sourceSheet, onCreated
}: {
  open: boolean; onClose: () => void;
  sourceSheet: Sheet | null; onCreated: (sheet: Sheet) => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sourceSheet) setName(`${sourceSheet.name} (cópia)`);
  }, [sourceSheet]);

  const handleDuplicate = async () => {
    if (!sourceSheet || !name.trim()) return;
    setSaving(true);
    const { data: newSheet, error } = await supabase.from('technical_sheets').insert({
      name: name.trim(),
      servings: sourceSheet.servings,
      yield_quantity: sourceSheet.yield_quantity,
      yield_unit: sourceSheet.yield_unit,
    } as any).select().single();
    if (error || !newSheet) { toast.error('Erro ao duplicar ficha'); setSaving(false); return; }

    if (sourceSheet.items.length > 0) {
      await supabase.from('technical_sheet_items').insert(
        sourceSheet.items.map(i => ({
          sheet_id: (newSheet as any).id,
          item_id: i.item_id,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
          section: i.section || 'receita',
        })) as any
      );
    }
    toast.success('Ficha duplicada!');
    onCreated({ ...(newSheet as any), items: sourceSheet.items });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Copy className="w-4 h-4" />Duplicar Ficha Técnica</DialogTitle>
          <DialogDescription>Cria uma cópia de "{sourceSheet?.name}" com todos os ingredientes</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Nome da nova ficha *</label>
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={handleDuplicate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              Duplicar
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EventMenusPage() {
  const [menus, setMenus] = useState<EventMenu[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingMenu, setViewingMenu] = useState<EventMenu | null>(null);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [editingMenu, setEditingMenu] = useState<EventMenu | null>(null);

  // Steps: 1=info, 2=upload+match, 3=shopping
  const [step, setStep] = useState(1);

  // Step 1 form
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formGuests, setFormGuests] = useState('100');
  const [formStaff, setFormStaff] = useState('0');
  const [formDate, setFormDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Step 2
  const [extracting, setExtracting] = useState(false);
  const [extractedDishes, setExtractedDishes] = useState<ExtractedDish[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null); // base64
  const [uploadedType, setUploadedType] = useState<string>('image/jpeg');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Duplicate dialog
  const [duplicateSource, setDuplicateSource] = useState<Sheet | null>(null);
  const [duplicateForIdx, setDuplicateForIdx] = useState<number | null>(null);

  // Saving
  const [saving, setSaving] = useState(false);

  // Shopping list for viewing
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);

  const load = async () => {
    const [menusRes, sheetsRes, itemsRes] = await Promise.all([
      supabase.from('event_menus').select('*').order('event_date', { ascending: false }),
      supabase.from('technical_sheets').select('*').order('name'),
      supabase.from('stock_items').select('id, name, unit, unit_cost, current_stock').order('name'),
    ]);
    if (itemsRes.data) setStockItems(itemsRes.data as unknown as StockItem[]);

    if (sheetsRes.data) {
      const loaded = await Promise.all(
        (sheetsRes.data as any[]).map(async s => {
          const { data: si } = await supabase
            .from('technical_sheet_items')
            .select('item_id, quantity, unit_cost, section')
            .eq('sheet_id', s.id);
          const items: SheetItem[] = (si || []).map((i: any) => {
            const item = (itemsRes.data as any[])?.find((x: any) => x.id === i.item_id);
            return {
              item_id: i.item_id, item_name: item?.name || '?',
              quantity: i.quantity, unit: item?.unit || '',
              unit_cost: i.unit_cost || item?.unit_cost || 0,
              section: i.section || 'receita',
            };
          });
          return { ...s, items } as Sheet;
        })
      );
      setSheets(loaded);
    }

    if (menusRes.data) {
      const sheetsData = sheetsRes.data as any[] || [];
      const loaded = await Promise.all(
        (menusRes.data as any[]).map(async m => {
          const { data: dishes } = await supabase
            .from('event_menu_dishes').select('*').eq('menu_id', m.id).order('sort_order');
          const menuDishes: MenuDish[] = (dishes || []).map((d: any) => {
            const sheet = sheetsData.find(s => s.id === d.sheet_id);
            return {
              id: d.id, sheet_id: d.sheet_id,
              sheet_name: sheet?.name || '?',
              planned_quantity: d.planned_quantity,
              planned_unit: d.planned_unit || 'un',
              sheet: null, expanded: false,
            };
          });
          return { ...m, dishes: menuDishes } as EventMenu;
        })
      );
      setMenus(loaded);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormName(''); setFormLocation(''); setFormGuests('100');
    setFormStaff('0'); setFormDate(''); setFormNotes('');
    setExtractedDishes([]); setUploadedImage(null); setStep(1); setEditingMenu(null);
  };

  // ── Upload & Extract ────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      setUploadedImage(base64);
      setUploadedType(file.type);
      await extractDishes(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const extractDishes = async (base64: string, mediaType: string) => {
    setExtracting(true);
    setExtractedDishes([]);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              {
                type: mediaType === 'application/pdf' ? 'document' : 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: `Analise este cardápio de buffet e extraia TODOS os pratos com suas quantidades.
                
Retorne APENAS um JSON válido, sem markdown, sem explicação, no formato:
{
  "dishes": [
    {
      "raw_name": "nome exato do prato como aparece no cardápio",
      "quantity": número (use 0 se não especificado),
      "unit": "und|kg|g|l|ml|porcao" (use a unidade que aparecer),
      "section_label": "nome da seção/bloco do cardápio (ex: Mesa Degustação, Coquetel Volante)"
    }
  ]
}

Inclua TODOS os pratos, de TODAS as seções. Não inclua itens decorativos, apenas pratos/alimentos.`,
              },
            ],
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.find((c: any) => c.type === 'text')?.text || '';

      let parsed: { dishes: any[] };
      try {
        const clean = text.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        toast.error('Erro ao processar o cardápio. Tente novamente.');
        setExtracting(false);
        return;
      }

      // Cross-reference with sheets
      const matched: ExtractedDish[] = parsed.dishes.map((d: any) => {
        const { sheet, score } = findBestMatch(d.raw_name, sheets);
        return {
          raw_name: d.raw_name,
          quantity: d.quantity || 0,
          unit: d.unit || 'un',
          section_label: d.section_label || '',
          matched_sheet_id: sheet?.id || null,
          matched_sheet_name: sheet?.name || null,
          match_score: score,
          status: sheet ? 'matched' : 'unmatched',
        } as ExtractedDish;
      });

      setExtractedDishes(matched);
      const matchedCount = matched.filter(d => d.status === 'matched').length;
      toast.success(`${matched.length} pratos extraídos · ${matchedCount} associados automaticamente`);
    } catch (err) {
      toast.error('Erro ao processar arquivo');
      console.error(err);
    } finally {
      setExtracting(false);
    }
  };

  const updateDishMatch = (idx: number, sheetId: string | null) => {
    const sheet = sheets.find(s => s.id === sheetId);
    setExtractedDishes(prev => prev.map((d, i) => i !== idx ? d : {
      ...d,
      matched_sheet_id: sheetId,
      matched_sheet_name: sheet?.name || null,
      status: sheetId ? 'matched' : 'unmatched',
    }));
  };

  const updateDishQty = (idx: number, qty: number) => {
    setExtractedDishes(prev => prev.map((d, i) => i !== idx ? d : { ...d, quantity: qty }));
  };

  const updateDishUnit = (idx: number, unit: string) => {
    setExtractedDishes(prev => prev.map((d, i) => i !== idx ? d : { ...d, unit }));
  };

  const removeDish = (idx: number) => {
    setExtractedDishes(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSaveMenu = async () => {
    if (!formName.trim()) { toast.error('Nome do evento é obrigatório'); return; }
    const matched = extractedDishes.filter(d => d.matched_sheet_id);
    if (matched.length === 0) { toast.error('Associe pelo menos um prato a uma ficha técnica'); return; }

    setSaving(true);
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
      await supabase.from('event_menus').update(menuData as any).eq('id', editingMenu.id);
      menuId = editingMenu.id;
      await supabase.from('event_menu_dishes').delete().eq('menu_id', menuId);
    } else {
      const { data, error } = await supabase.from('event_menus').insert(menuData as any).select().single();
      if (error || !data) { toast.error('Erro ao criar cardápio'); setSaving(false); return; }
      menuId = (data as any).id;
    }

    const inserts = matched.map((d, idx) => ({
      menu_id: menuId,
      sheet_id: d.matched_sheet_id,
      planned_quantity: d.quantity,
      planned_unit: d.unit,
      sort_order: idx,
    }));
    await supabase.from('event_menu_dishes').insert(inserts as any);

    toast.success(editingMenu ? 'Cardápio atualizado!' : 'Cardápio criado!');
    setSaving(false);
    resetForm();
    setDialogOpen(false);
    load();
  };

  // ── View & Shopping List ────────────────────────────────────────────────────

  const openView = async (menu: EventMenu) => {
    const enriched = await Promise.all(
      menu.dishes.map(async d => {
        const sheet = sheets.find(s => s.id === d.sheet_id);
        if (!sheet) return { ...d, sheet: null };
        const { data: si } = await supabase
          .from('technical_sheet_items')
          .select('item_id, quantity, unit_cost, section')
          .eq('sheet_id', sheet.id);
        const items: SheetItem[] = (si || []).map((i: any) => {
          const item = stockItems.find(x => x.id === i.item_id);
          return {
            item_id: i.item_id, item_name: item?.name || '?',
            quantity: i.quantity, unit: item?.unit || '',
            unit_cost: i.unit_cost || item?.unit_cost || 0,
            section: i.section || 'receita',
          };
        });
        return { ...d, sheet: { ...sheet, items }, expanded: false };
      })
    );
    const menuWithSheets = { ...menu, dishes: enriched };
    setViewingMenu(menuWithSheets);
    buildShoppingList(menuWithSheets);
  };

  const buildShoppingList = (menu: EventMenu) => {
    const map: Record<string, ShoppingItem> = {};
    menu.dishes.forEach(dish => {
      if (!dish.sheet) return;
      const scale = dish.planned_quantity / (dish.sheet.yield_quantity || 1);
      dish.sheet.items.forEach(si => {
        const needed = si.quantity * scale;
        if (!map[si.item_id]) {
          const stock = stockItems.find(s => s.id === si.item_id);
          map[si.item_id] = {
            id: si.item_id, name: si.item_name, unit: si.unit,
            needed: 0, inStock: stock?.current_stock || 0,
            toBuy: 0, unitCost: si.unit_cost,
          };
        }
        map[si.item_id].needed += needed;
      });
    });
    const list = Object.values(map).map(i => ({
      ...i, toBuy: Math.max(0, i.needed - i.inStock),
    })).sort((a, b) => a.name.localeCompare(b.name));
    setShoppingList(list);
  };

  const toggleDishExpand = (dishId: string) => {
    if (!viewingMenu) return;
    setViewingMenu({
      ...viewingMenu,
      dishes: viewingMenu.dishes.map(d => d.id === dishId ? { ...d, expanded: !d.expanded } : d),
    });
  };

  const openEdit = (menu: EventMenu) => {
    setEditingMenu(menu);
    setFormName(menu.name);
    setFormLocation(menu.location || '');
    setFormGuests(menu.guest_count.toString());
    setFormStaff(menu.staff_count.toString());
    setFormDate(menu.event_date || '');
    setFormNotes(menu.notes || '');
    setStep(1);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este cardápio?')) return;
    await supabase.from('event_menu_dishes').delete().eq('menu_id', id);
    await supabase.from('event_menus').delete().eq('id', id);
    toast.success('Cardápio removido!');
    load();
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const matchedCount = extractedDishes.filter(d => d.status === 'matched').length;
  const unmatchedCount = extractedDishes.filter(d => d.status === 'unmatched').length;
  const totalToBuy = shoppingList.reduce((s, i) => s + i.toBuy * i.unitCost, 0);
  const totalNeeded = shoppingList.reduce((s, i) => s + i.needed * i.unitCost, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Cardápios de Eventos</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monte cardápios a partir do arquivo do evento</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Criar Cardápio
        </Button>
      </div>

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingMenu ? 'Editar Cardápio' : 'Novo Cardápio de Evento'}</DialogTitle>
            <DialogDescription>
              {step === 1 && 'Preencha as informações do evento'}
              {step === 2 && 'Envie o cardápio e confirme os pratos'}
            </DialogDescription>
          </DialogHeader>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-2">
            {[
              { n: 1, label: 'Informações' },
              { n: 2, label: 'Cardápio' },
            ].map(({ n, label }) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-1.5 text-xs font-medium ${step >= n ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step >= n ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{n}</div>
                  {label}
                </div>
                {n < 2 && <div className={`flex-1 h-px ${step > n ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 pr-1">

            {/* ── Step 1: Info ── */}
            {step === 1 && (
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Nome do Evento *</label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Casamento Silva & Santos" autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Local</label>
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
                }}>
                  Próximo: Carregar Cardápio <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* ── Step 2: Upload + Match ── */}
            {step === 2 && (
              <div className="space-y-4 py-2">

                {/* Upload area */}
                {!extracting && extractedDishes.length === 0 && (
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/3 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileImage className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium text-foreground mb-1">Envie o cardápio do evento</p>
                    <p className="text-sm text-muted-foreground">Imagem (JPG, PNG) ou PDF — o sistema extrai os pratos automaticamente</p>
                    <Button variant="outline" size="sm" className="mt-4">
                      <Upload className="w-4 h-4 mr-2" />Selecionar arquivo
                    </Button>
                    <input
                      ref={fileInputRef} type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                )}

                {/* Extracting */}
                {extracting && (
                  <div className="py-10 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                    <p className="font-medium text-foreground">Extraindo pratos do cardápio...</p>
                    <p className="text-sm text-muted-foreground mt-1">A IA está lendo o arquivo e cruzando com suas fichas técnicas</p>
                  </div>
                )}

                {/* Results */}
                {!extracting && extractedDishes.length > 0 && (
                  <>
                    {/* Summary bar */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                      <div className="flex items-center gap-1.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span className="font-semibold text-success">{matchedCount}</span>
                        <span className="text-muted-foreground">associados</span>
                      </div>
                      <div className="w-px h-4 bg-border" />
                      <div className="flex items-center gap-1.5 text-sm">
                        <AlertCircle className="w-4 h-4 text-warning" />
                        <span className="font-semibold text-warning">{unmatchedCount}</span>
                        <span className="text-muted-foreground">não encontrados</span>
                      </div>
                      <div className="ml-auto">
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="w-3.5 h-3.5 mr-1" />Reenviar
                        </Button>
                        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
                      </div>
                    </div>

                    {/* Dish list */}
                    <div className="space-y-2">
                      {extractedDishes.map((dish, idx) => (
                        <div key={idx} className={`rounded-xl border p-3 ${dish.status === 'matched' ? 'border-success/30 bg-success/3' : 'border-warning/40 bg-warning/5'}`}>
                          <div className="flex items-start gap-3">
                            {/* Status icon */}
                            <div className="mt-0.5 flex-shrink-0">
                              {dish.status === 'matched'
                                ? <CheckCircle2 className="w-4 h-4 text-success" />
                                : <AlertCircle className="w-4 h-4 text-warning" />
                              }
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Raw name + section */}
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">{dish.raw_name}</span>
                                {dish.section_label && (
                                  <Badge variant="outline" className="text-[10px]">{dish.section_label}</Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Quantity */}
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={dish.quantity || ''}
                                    onChange={e => updateDishQty(idx, parseFloat(e.target.value) || 0)}
                                    className="h-7 w-20 text-xs text-right"
                                    placeholder="Qtd"
                                  />
                                  <Input
                                    value={dish.unit}
                                    onChange={e => updateDishUnit(idx, e.target.value)}
                                    className="h-7 w-16 text-xs"
                                    placeholder="un"
                                  />
                                </div>

                                {/* Sheet match selector */}
                                <Select
                                  value={dish.matched_sheet_id || '__none__'}
                                  onValueChange={v => updateDishMatch(idx, v === '__none__' ? null : v)}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1 min-w-[180px]">
                                    <SelectValue placeholder="Selecionar ficha técnica..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Sem ficha técnica —</SelectItem>
                                    {sheets.map(s => (
                                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {/* Duplicate button */}
                                {dish.matched_sheet_id && (
                                  <Button
                                    variant="ghost" size="sm"
                                    className="h-7 px-2 text-xs text-muted-foreground"
                                    title="Duplicar esta ficha para criar uma variação"
                                    onClick={() => {
                                      const s = sheets.find(x => x.id === dish.matched_sheet_id);
                                      setDuplicateSource(s || null);
                                      setDuplicateForIdx(idx);
                                    }}
                                  >
                                    <Copy className="w-3 h-3 mr-1" />Duplicar
                                  </Button>
                                )}
                              </div>

                              {/* Match score */}
                              {dish.matched_sheet_name && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Associado a: <span className="text-foreground font-medium">{dish.matched_sheet_name}</span>
                                  {dish.match_score > 0 && (
                                    <span className="ml-1 opacity-60">({Math.round(dish.match_score * 100)}% similar)</span>
                                  )}
                                </p>
                              )}
                            </div>

                            {/* Remove */}
                            <button onClick={() => removeDish(idx)} className="text-muted-foreground hover:text-destructive flex-shrink-0 mt-0.5">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                      <Button className="flex-1" onClick={handleSaveMenu} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {editingMenu ? 'Salvar Alterações' : `Criar Cardápio (${matchedCount} pratos)`}
                      </Button>
                    </div>
                  </>
                )}

                {/* Back button when no dishes yet */}
                {!extracting && extractedDishes.length === 0 && (
                  <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Duplicate Dialog ── */}
      <DuplicateSheetDialog
        open={duplicateSource !== null}
        onClose={() => { setDuplicateSource(null); setDuplicateForIdx(null); }}
        sourceSheet={duplicateSource}
        onCreated={(newSheet) => {
          setSheets(prev => [...prev, newSheet]);
          if (duplicateForIdx !== null) {
            updateDishMatch(duplicateForIdx, newSheet.id);
          }
        }}
      />

      {/* ── Viewing menu ── */}
      {viewingMenu && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4 gap-4">
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">{viewingMenu.name}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                {viewingMenu.event_date && (
                  <Badge variant="outline">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(viewingMenu.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </Badge>
                )}
                {viewingMenu.location && (
                  <Badge variant="outline"><MapPin className="w-3 h-3 mr-1" />{viewingMenu.location}</Badge>
                )}
                <Badge variant="outline"><Users className="w-3 h-3 mr-1" />{viewingMenu.guest_count} convidados</Badge>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowShoppingList(!showShoppingList)}>
                <ShoppingCart className="w-4 h-4 mr-1" />{showShoppingList ? 'Ocultar compras' : 'Lista de compras'}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setViewingMenu(null); setShowShoppingList(false); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* ── Shopping List ── */}
          {showShoppingList && (
            <div className="mb-6 rounded-xl border border-border overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground text-sm">Lista de Compras</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Custo total estimado: <span className="font-semibold text-foreground">R$ {totalNeeded.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </span>
                  {totalToBuy > 0 && (
                    <span className="text-muted-foreground">
                      A comprar: <span className="font-semibold text-destructive">R$ {totalToBuy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs">
                      <th className="text-left px-4 py-2 font-semibold text-muted-foreground">INSUMO</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">NECESSÁRIO</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">EM ESTOQUE</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">A COMPRAR</th>
                      <th className="text-right px-4 py-2 font-semibold text-muted-foreground">CUSTO EST.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {shoppingList.map(item => (
                      <tr key={item.id} className={item.toBuy > 0 ? 'bg-red-50/30' : ''}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {item.toBuy > 0
                              ? <TrendingDown className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                              : <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                            }
                            <span className={item.toBuy > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {item.needed.toFixed(2)} {item.unit}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {item.inStock} {item.unit}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {item.toBuy > 0
                            ? <span className="text-destructive">{item.toBuy.toFixed(2)} {item.unit}</span>
                            : <span className="text-success text-xs">✓ ok</span>
                          }
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {item.toBuy > 0
                            ? `R$ ${(item.toBuy * item.unitCost).toFixed(2)}`
                            : '—'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Dishes ── */}
          <div className="space-y-2">
            {viewingMenu.dishes.map(dish => {
              const recipeItems = dish.sheet?.items.filter(i => i.section === 'receita') || [];
              const decoItems = dish.sheet?.items.filter(i => i.section === 'decoracao') || [];
              const scale = dish.planned_quantity / (dish.sheet?.yield_quantity || 1);

              return (
                <div key={dish.id} className="border border-border rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => toggleDishExpand(dish.id)}
                  >
                    <div className="flex items-center gap-3">
                      {dish.expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <p className="font-medium text-foreground text-sm">{dish.sheet_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {dish.planned_quantity} {dish.planned_unit}
                          {dish.sheet && ` · ${dish.sheet.items.length} ingredientes`}
                        </p>
                      </div>
                    </div>
                    {dish.sheet && (
                      <div className="flex gap-2">
                        {recipeItems.length > 0 && <Badge variant="outline" className="text-[10px]">{recipeItems.length} receita</Badge>}
                        {decoItems.length > 0 && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">🎨 {decoItems.length} decoração</Badge>}
                      </div>
                    )}
                  </div>

                  {dish.expanded && dish.sheet && (
                    <div className="border-t border-border">
                      {/* Receita */}
                      {recipeItems.length > 0 && (
                        <div className="p-4">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Receita Principal</p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-muted-foreground">
                                <th className="text-left py-1">Insumo</th>
                                <th className="text-right py-1">Na receita</th>
                                <th className="text-right py-1">Para {dish.planned_quantity} {dish.planned_unit}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                              {recipeItems.map(si => (
                                <tr key={si.item_id}>
                                  <td className="py-1.5 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td>
                                  <td className="py-1.5 text-right text-muted-foreground">{si.quantity}</td>
                                  <td className="py-1.5 text-right font-medium text-foreground">{(si.quantity * scale).toFixed(3)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Decoração */}
                      {decoItems.length > 0 && (
                        <div className="p-4 border-t border-dashed border-amber-200" style={{ background: 'hsl(38 80% 98%)' }}>
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">🎨 Decoração</p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-muted-foreground">
                                <th className="text-left py-1">Item</th>
                                <th className="text-right py-1">Na receita</th>
                                <th className="text-right py-1">Para {dish.planned_quantity} {dish.planned_unit}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100">
                              {decoItems.map(si => (
                                <tr key={si.item_id}>
                                  <td className="py-1.5 text-foreground">{si.item_name} <span className="text-muted-foreground text-xs">({si.unit})</span></td>
                                  <td className="py-1.5 text-right text-muted-foreground">{si.quantity}</td>
                                  <td className="py-1.5 text-right font-medium text-foreground">{(si.quantity * scale).toFixed(3)}</td>
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
        </div>
      )}

      {/* ── Menu List ── */}
      <div className="space-y-3">
        {menus.map(menu => (
          <div key={menu.id} className="bg-white rounded-xl border border-border p-4 flex items-center justify-between shadow-xs">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-medium text-foreground">{menu.name}</p>
                <Badge variant={menu.status === 'draft' ? 'secondary' : 'default'} className="text-[10px]">
                  {menu.status === 'draft' ? 'Rascunho' : menu.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {menu.event_date
                  ? new Date(menu.event_date + 'T12:00:00').toLocaleDateString('pt-BR')
                  : 'Sem data'}
                {menu.location ? ` · ${menu.location}` : ''}
                {` · ${menu.guest_count} convidados`}
                {` · ${menu.dishes.length} pratos`}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" title="Visualizar" onClick={() => openView(menu)}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(menu)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(menu.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {menus.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum cardápio criado ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
