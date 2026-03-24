import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaterialImageUpload } from '@/components/MaterialImageUpload';
import {
  Plus, Search, Package, Loader2, ChevronRight, ArrowLeft,
  ClipboardList, Calendar, CheckCircle2, RotateCcw, X, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { MaterialLabelPrint, type LabelItem } from '@/components/MaterialLabelPrint';

// ── Types ─────────────────────────────────────────────────────────────────────

type MaterialItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  total_qty: number;
  available_qty: number;
  damaged_qty: number;
  unit: string;
  image_url: string | null;
};

type LoanItem = {
  id: string;               // material_loan_items.id ('' for new items not yet in DB)
  material_item_id: string;
  qty_out: number;
  qty_returned: number;
  item_name: string;
  item_unit: string;
  image_url: string | null;
  isNew?: boolean;
};

type EventLoan = {
  id: string;
  event_name: string;
  date_out: string;
  status: string;
  items: LoanItem[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const UNITS = ['unid', 'peça', 'conjunto', 'par', 'kit', 'jogo', 'metro'];

const CATEGORY_EMOJIS: Record<string, string> = {
  'Louças': '🍽️', 'Cutelaria': '🍴', 'Taças e Copos': '🥂', 'Rechauds': '🔥',
  'Equipamentos': '⚙️', 'Decoração': '🌸', 'Toalhas e Tecidos': '🧶',
  'Mesas e Cadeiras': '🪑', 'Iluminação': '💡', 'Outros': '📦',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planejando', color: 'bg-blue-100 text-blue-700' },
  active:   { label: 'Ativo',      color: 'bg-amber-100 text-amber-700' },
  partial:  { label: 'Parcial',    color: 'bg-purple-100 text-purple-700' },
};

// ── ItemCard ──────────────────────────────────────────────────────────────────

function ItemCard({ item, compact = false, onPrint }: { item: MaterialItem; compact?: boolean; onPrint?: () => void }) {
  const inUse = item.total_qty - item.available_qty;
  const imgSize = compact ? 'w-10 h-10' : 'w-12 h-12';
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className={`${imgSize} rounded-lg object-cover border border-border flex-shrink-0`} />
      ) : (
        <div className={`${imgSize} rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0`}>
          <Package className={`${iconSize} text-muted-foreground/40`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
        {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 text-right">
        {onPrint && (
          <button
            onClick={e => { e.stopPropagation(); onPrint(); }}
            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <Printer className="w-4 h-4" />
          </button>
        )}
        <div>
          <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Total</p>
          <p className="text-sm font-semibold text-foreground">{item.total_qty} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span></p>
        </div>
        {inUse > 0 && (
          <div>
            <p className="text-[10px] text-amber-600 leading-none mb-0.5">Em uso</p>
            <p className="text-sm font-semibold text-amber-600">{inUse} <span className="text-xs font-normal">{item.unit}</span></p>
          </div>
        )}
        <div>
          <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Disponível</p>
          <p className={`text-sm font-semibold ${item.available_qty === 0 ? 'text-destructive' : 'text-foreground'}`}>
            {item.available_qty} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function EmployeeMateriaisPage() {
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [events, setEvents] = useState<EventLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventario' | 'eventos'>('inventario');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventLoan | null>(null);
  const [search, setSearch] = useState('');

  // Separation state (planning events)
  const [sepItems, setSepItems] = useState<LoanItem[]>([]);
  const [sepQtys, setSepQtys] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'separation' | 'devolution' | null>(null);
  const [processing, setProcessing] = useState(false);

  // Devolution state (active/partial events)
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});

  // Label print
  const [labelItem, setLabelItem] = useState<LabelItem | null>(null);

  // Add existing item dialog
  const [addItemDialog, setAddItemDialog] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');

  // Create new item dialog
  const [dialog, setDialog] = useState(false);
  const [creatingForSep, setCreatingForSep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCatDialog, setNewCatDialog] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [form, setForm] = useState({
    name: '', category: '', description: '',
    total_qty: 0, unit: 'unid', image_url: null as string | null,
  });

  // ── Data loading ───────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    const [itemsRes, catsRes, loansRes] = await Promise.all([
      supabase.from('material_items' as any)
        .select('id, name, category, description, total_qty, available_qty, damaged_qty, unit, image_url')
        .order('category').order('name'),
      supabase.from('material_categories' as any).select('name').order('sort_order').order('name'),
      supabase.from('material_loans' as any)
        .select('id, event_name, date_out, status')
        .in('status', ['active', 'planning', 'partial'])
        .order('date_out'),
    ]);

    if (itemsRes.data) setItems(itemsRes.data as MaterialItem[]);
    if (catsRes.data) setDbCategories((catsRes.data as any[]).map(c => c.name));

    const rawLoans = (loansRes.data || []) as any[];
    if (rawLoans.length > 0) {
      const loanIds = rawLoans.map(l => l.id);
      const { data: loanItemsData } = await supabase
        .from('material_loan_items' as any)
        .select('id, loan_id, material_item_id, qty_out, qty_returned, material_items(name, unit, image_url)')
        .in('loan_id', loanIds);

      const loanItemsMap: Record<string, EventLoan['items']> = {};
      for (const li of (loanItemsData || []) as any[]) {
        if (!loanItemsMap[li.loan_id]) loanItemsMap[li.loan_id] = [];
        loanItemsMap[li.loan_id].push({
          id: li.id,
          material_item_id: li.material_item_id,
          qty_out: li.qty_out,
          qty_returned: li.qty_returned ?? 0,
          item_name: li.material_items?.name || '?',
          item_unit: li.material_items?.unit || '',
          image_url: li.material_items?.image_url || null,
        });
      }
      setEvents(rawLoans.map(l => ({ ...l, items: loanItemsMap[l.id] || [] })));
    } else {
      setEvents([]);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Event open / close ─────────────────────────────────────────────────────

  const openEvent = (ev: EventLoan) => {
    setSelectedEvent(ev);
    if (ev.status === 'planning') {
      const qtys: Record<string, number> = {};
      for (const li of ev.items) qtys[li.material_item_id] = li.qty_out;
      setSepQtys(qtys);
      setSepItems([...ev.items]);
      setViewMode('separation');
    } else {
      const qtys: Record<string, number> = {};
      for (const li of ev.items) qtys[li.material_item_id] = 0;
      setReturnQtys(qtys);
      setViewMode('devolution');
    }
  };

  const closeEvent = () => {
    setSelectedEvent(null);
    setViewMode(null);
    setSepItems([]);
    setSepQtys({});
    setReturnQtys({});
  };

  // ── Separation handlers ────────────────────────────────────────────────────

  const handleAddExistingItem = (matItem: MaterialItem) => {
    if (sepItems.some(i => i.material_item_id === matItem.id)) {
      toast.error('Item já está na lista');
      return;
    }
    const newLi: LoanItem = {
      id: '',
      material_item_id: matItem.id,
      qty_out: 1,
      qty_returned: 0,
      item_name: matItem.name,
      item_unit: matItem.unit,
      image_url: matItem.image_url,
      isNew: true,
    };
    setSepItems(prev => [...prev, newLi]);
    setSepQtys(prev => ({ ...prev, [matItem.id]: 1 }));
    setAddItemDialog(false);
    setAddItemSearch('');
  };

  const handleRemoveSepItem = (materialItemId: string) => {
    setSepItems(prev => prev.filter(i => i.material_item_id !== materialItemId));
    setSepQtys(prev => {
      const next = { ...prev };
      delete next[materialItemId];
      return next;
    });
  };

  const handleConfirmSeparation = async () => {
    if (!selectedEvent) return;
    setProcessing(true);
    try {
      const newSepIds = new Set(sepItems.filter(i => !i.isNew).map(i => i.id));

      // Delete items that were removed from the list
      for (const origItem of selectedEvent.items) {
        if (!newSepIds.has(origItem.id)) {
          await supabase.from('material_loan_items' as any).delete().eq('id', origItem.id);
        }
      }

      // Update existing items with new qty_out
      for (const li of sepItems.filter(i => !i.isNew)) {
        const newQty = sepQtys[li.material_item_id] ?? li.qty_out;
        if (newQty !== li.qty_out) {
          await supabase.from('material_loan_items' as any)
            .update({ qty_out: newQty } as any)
            .eq('id', li.id);
        }
      }

      // Insert newly added items
      for (const li of sepItems.filter(i => i.isNew)) {
        const newQty = sepQtys[li.material_item_id] || 1;
        await supabase.from('material_loan_items' as any).insert({
          loan_id: selectedEvent.id,
          material_item_id: li.material_item_id,
          qty_out: newQty,
          qty_returned: 0,
          qty_damaged: 0,
        } as any);
      }

      // Change loan status to active
      await supabase.from('material_loans' as any)
        .update({ status: 'active' } as any)
        .eq('id', selectedEvent.id);

      toast.success('Separação confirmada! Materiais saíram para o evento.');
      closeEvent();
      load();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Tente novamente'));
    }
    setProcessing(false);
  };

  // ── Devolution handlers ────────────────────────────────────────────────────

  const handleRegisterReturn = async () => {
    if (!selectedEvent) return;
    const totalEntered = Object.values(returnQtys).reduce((s, v) => s + v, 0);
    if (totalEntered === 0) {
      toast.error('Informe pelo menos um item devolvido');
      return;
    }
    setProcessing(true);
    try {
      // Fetch fresh item data for accurate qty values
      const { data: freshItems } = await supabase
        .from('material_items' as any)
        .select('id, available_qty, total_qty')
        .in('id', selectedEvent.items.map(i => i.material_item_id));

      const freshMap: Record<string, { available_qty: number; total_qty: number }> = {};
      for (const fi of (freshItems || []) as any[]) freshMap[fi.id] = fi;

      let totalOut = 0;
      let totalReturned = 0;

      for (const li of selectedEvent.items) {
        const addedNow = returnQtys[li.material_item_id] || 0;
        const prevReturned = li.qty_returned || 0;
        const newTotalReturned = prevReturned + addedNow;
        totalOut += li.qty_out;
        totalReturned += newTotalReturned;

        // Update loan item qty_returned
        await supabase.from('material_loan_items' as any)
          .update({ qty_returned: newTotalReturned } as any)
          .eq('id', li.id);

        // Increment available_qty for items that came back
        if (addedNow > 0 && freshMap[li.material_item_id]) {
          const fi = freshMap[li.material_item_id];
          await supabase.from('material_items' as any)
            .update({ available_qty: fi.available_qty + addedNow } as any)
            .eq('id', li.material_item_id);
        }
      }

      const isFullyReturned = totalReturned >= totalOut;
      const newStatus = isFullyReturned ? 'returned' : 'partial';

      // If fully returned: deduct losses from total_qty permanently
      if (isFullyReturned) {
        for (const li of selectedEvent.items) {
          const addedNow = returnQtys[li.material_item_id] || 0;
          const prevReturned = li.qty_returned || 0;
          const newTotalReturned = prevReturned + addedNow;
          const lost = li.qty_out - newTotalReturned;
          if (lost > 0 && freshMap[li.material_item_id]) {
            const fi = freshMap[li.material_item_id];
            await supabase.from('material_items' as any)
              .update({ total_qty: Math.max(0, fi.total_qty - lost) } as any)
              .eq('id', li.material_item_id);
          }
        }
      }

      await supabase.from('material_loans' as any)
        .update({
          status: newStatus,
          date_return: new Date().toISOString().split('T')[0],
        } as any)
        .eq('id', selectedEvent.id);

      toast.success(isFullyReturned
        ? 'Devolução completa! Evento finalizado.'
        : 'Devolução parcial registrada.');
      closeEvent();
      load();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Tente novamente'));
    }
    setProcessing(false);
  };

  // ── Create item handlers ───────────────────────────────────────────────────

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const { error } = await supabase.from('material_categories' as any)
      .insert({ name: newCatName.trim(), sort_order: dbCategories.length });
    if (error) { toast.error('Erro ao criar categoria'); return; }
    toast.success('Categoria criada!');
    setDbCategories(prev => [...prev, newCatName.trim()]);
    setForm(f => ({ ...f, category: newCatName.trim() }));
    setNewCatName('');
    setNewCatDialog(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.category) { toast.error('Categoria é obrigatória'); return; }
    setSaving(true);

    const newId = crypto.randomUUID();
    const { error } = await supabase.from('material_items' as any).insert({
      id: newId,
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      total_qty: Number(form.total_qty) || 0,
      available_qty: Number(form.total_qty) || 0,
      damaged_qty: 0,
      unit: form.unit,
      image_url: form.image_url,
    } as any);

    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
    toast.success('Material cadastrado!');
    setSaving(false);
    setDialog(false);

    // If created from separation view, add the new item to the sep list automatically
    if (creatingForSep) {
      const newLi: LoanItem = {
        id: '',
        material_item_id: newId,
        qty_out: 1,
        qty_returned: 0,
        item_name: form.name.trim(),
        item_unit: form.unit,
        image_url: form.image_url,
        isNew: true,
      };
      setSepItems(prev => [...prev, newLi]);
      setSepQtys(prev => ({ ...prev, [newId]: 1 }));
    }

    setForm({ name: '', category: '', description: '', total_qty: 0, unit: 'unid', image_url: null });
    setCreatingForSep(false);
    load();
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const categories = Array.from(new Set(items.map(i => i.category))).sort();
  const allCategories = Array.from(new Set([...dbCategories, ...categories])).sort();
  const filtered = items.filter(item =>
    (!selectedCategory || item.category === selectedCategory) &&
    (!search || item.name.toLowerCase().includes(search.toLowerCase()))
  );

  const sepItemIds = new Set(sepItems.map(i => i.material_item_id));
  const addItemFiltered = items.filter(i =>
    !sepItemIds.has(i.id) &&
    (!addItemSearch ||
      i.name.toLowerCase().includes(addItemSearch.toLowerCase()) ||
      i.category.toLowerCase().includes(addItemSearch.toLowerCase()))
  );

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  // ── SEPARATION VIEW ────────────────────────────────────────────────────────

  if (selectedEvent && viewMode === 'separation') {
    const totalQty = Object.values(sepQtys).reduce((s, v) => s + v, 0);

    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={closeEvent} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{selectedEvent.event_name}</h2>
            <p className="text-xs text-muted-foreground">
              📅 {new Date(selectedEvent.date_out + 'T12:00:00').toLocaleDateString('pt-BR')}
              {' · '}{sepItems.length} item{sepItems.length !== 1 ? 'ns' : ''}{' · '}{totalQty} unid.
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">Separando</span>
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
          <p className="font-semibold mb-0.5">📋 Separação de materiais</p>
          <p>Ajuste as quantidades, adicione ou remova itens conforme necessário. Ao confirmar, os materiais serão marcados como saídos para o evento.</p>
        </div>

        {/* Items list */}
        {sepItems.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Lista vazia. Adicione materiais abaixo.</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {sepItems.map(li => (
              <div key={li.material_item_id}
                className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
                {li.image_url ? (
                  <img src={li.image_url} alt={li.item_name}
                    className="w-10 h-10 rounded-lg object-cover border border-border flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{li.item_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {li.item_unit}{li.isNew ? ' · adicionado' : ''}
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={sepQtys[li.material_item_id] ?? li.qty_out}
                  onChange={e => setSepQtys(prev => ({
                    ...prev,
                    [li.material_item_id]: Math.max(0, Number(e.target.value) || 0),
                  }))}
                  className="w-20 text-center h-9 text-sm flex-shrink-0"
                />
                <button
                  onClick={() => handleRemoveSepItem(li.material_item_id)}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add / Create buttons */}
        <div className="flex gap-2 mb-5">
          <Button variant="outline" className="flex-1" onClick={() => setAddItemDialog(true)}>
            <Search className="w-4 h-4 mr-1" />Adicionar Item
          </Button>
          <Button variant="outline" onClick={() => { setCreatingForSep(true); setDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" />Criar Novo
          </Button>
        </div>

        <Button
          className="w-full gold-button"
          onClick={handleConfirmSeparation}
          disabled={processing || sepItems.length === 0}
        >
          {processing
            ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
            : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Confirmar Saída de Materiais
        </Button>
      </div>
    );
  }

  // ── DEVOLUTION VIEW ────────────────────────────────────────────────────────

  if (selectedEvent && viewMode === 'devolution') {
    const totalOut = selectedEvent.items.reduce((s, li) => s + li.qty_out, 0);
    const totalAlreadyReturned = selectedEvent.items.reduce((s, li) => s + (li.qty_returned || 0), 0);
    const totalEntered = Object.values(returnQtys).reduce((s, v) => s + v, 0);
    const remaining = totalOut - totalAlreadyReturned;
    const sc = STATUS_CONFIG[selectedEvent.status] || STATUS_CONFIG.active;

    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={closeEvent} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{selectedEvent.event_name}</h2>
            <p className="text-xs text-muted-foreground">
              📅 {new Date(selectedEvent.date_out + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
        </div>

        {/* Summary row */}
        <div className="bg-white rounded-xl border border-border p-4 mb-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold text-foreground">{totalOut}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Saíram</p>
          </div>
          <div>
            <p className="text-xl font-bold text-green-600">{totalAlreadyReturned}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Voltaram</p>
          </div>
          <div>
            <p className={`text-xl font-bold ${remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>{remaining}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pendentes</p>
          </div>
        </div>

        {/* Items */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Informar qtde devolvida agora
        </p>
        <div className="space-y-2 mb-6">
          {selectedEvent.items.map(li => {
            const stillOut = li.qty_out - (li.qty_returned || 0);
            return (
              <div key={li.material_item_id}
                className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
                {li.image_url ? (
                  <img src={li.image_url} alt={li.item_name}
                    className="w-10 h-10 rounded-lg object-cover border border-border flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{li.item_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Saiu: {li.qty_out}
                    {li.qty_returned > 0 && ` · Já voltou: ${li.qty_returned}`}
                    {' · '}Pendente: <span className={stillOut > 0 ? 'text-amber-600 font-semibold' : 'text-green-600'}>{stillOut}</span>
                  </p>
                </div>
                <div className="flex-shrink-0 text-center">
                  <p className="text-[9px] text-muted-foreground mb-1">Voltando</p>
                  <Input
                    type="number"
                    min={0}
                    max={stillOut}
                    value={returnQtys[li.material_item_id] ?? 0}
                    onChange={e => setReturnQtys(prev => ({
                      ...prev,
                      [li.material_item_id]: Math.min(stillOut, Math.max(0, Number(e.target.value) || 0)),
                    }))}
                    className="w-20 text-center h-9 text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Button
          className="w-full gold-button"
          onClick={handleRegisterReturn}
          disabled={processing || totalEntered === 0}
        >
          {processing
            ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
            : <RotateCcw className="w-4 h-4 mr-2" />}
          Registrar Devolução
        </Button>
      </div>
    );
  }

  // ── CATEGORY DETAIL ────────────────────────────────────────────────────────

  if (selectedCategory && !search && activeTab === 'inventario') {
    const catItems = items.filter(i => i.category === selectedCategory);
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setSelectedCategory(null)}
            className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-foreground">
            {CATEGORY_EMOJIS[selectedCategory] || '📦'} {selectedCategory}
          </h2>
          <span className="text-sm text-muted-foreground ml-auto">
            {catItems.length} {catItems.length === 1 ? 'item' : 'itens'}
          </span>
        </div>
        <div className="space-y-2">
          {catItems.map(item => (
            <ItemCard key={item.id} item={item}
              onPrint={() => setLabelItem({ id: item.id, name: item.name, category: item.category, total_qty: item.total_qty, unit: item.unit })}
            />
          ))}
          {catItems.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">Nenhum item nesta categoria</div>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN VIEW ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground">Materiais</h1>
        {activeTab === 'inventario' && (
          <Button size="sm" onClick={() => { setCreatingForSep(false); setDialog(true); }} className="gold-button">
            <Plus className="w-4 h-4 mr-1" />Novo
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1 mb-5">
        <button
          onClick={() => setActiveTab('inventario')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'inventario' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
        >
          Inventário
        </button>
        <button
          onClick={() => setActiveTab('eventos')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeTab === 'eventos' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Eventos
          {events.length > 0 && (
            <span className={`text-[10px] rounded-full min-w-[1rem] h-4 px-1 flex items-center justify-center font-bold ${activeTab === 'eventos' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {events.length}
            </span>
          )}
        </button>
      </div>

      {/* ── INVENTÁRIO ── */}
      {activeTab === 'inventario' && (
        <>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar material..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {search ? (
            <div className="space-y-2">
              {filtered.map(item => (
                <ItemCard key={item.id} item={item} compact
                  onPrint={() => setLabelItem({ id: item.id, name: item.name, category: item.category, total_qty: item.total_qty, unit: item.unit })}
                />
              ))}
              {filtered.length === 0 && (
                <p className="text-center py-10 text-muted-foreground text-sm">Nenhum resultado</p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {categories.map(cat => {
                  const catItems = items.filter(i => i.category === cat);
                  const available = catItems.reduce((s, i) => s + i.available_qty, 0);
                  const total = catItems.reduce((s, i) => s + i.total_qty, 0);
                  return (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className="bg-white rounded-xl border border-border p-4 text-left hover:border-primary/40 hover:bg-amber-50/30 transition-all active:scale-95">
                      <div className="text-2xl mb-2">{CATEGORY_EMOJIS[cat] || '📦'}</div>
                      <p className="font-semibold text-sm text-foreground leading-tight">{cat}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {catItems.length} iten{catItems.length !== 1 ? 's' : ''} · {available}/{total} disponíveis
                      </p>
                    </button>
                  );
                })}
              </div>

              {categories.length > 0 && (
                <div className="space-y-4">
                  {categories.map(cat => {
                    const catItems = items.filter(i => i.category === cat);
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {CATEGORY_EMOJIS[cat] || '📦'} {cat}
                          </p>
                          <button onClick={() => setSelectedCategory(cat)}
                            className="text-xs text-primary flex items-center gap-0.5">
                            Ver todos <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {catItems.slice(0, 4).map(item => <ItemCard key={item.id} item={item} compact />)}
                          {catItems.length > 4 && (
                            <button onClick={() => setSelectedCategory(cat)}
                              className="w-full text-center text-xs text-primary py-2">
                              + {catItems.length - 4} mais
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {categories.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Nenhum material cadastrado</p>
                  <p className="text-sm mt-1">Clique em "Novo" para adicionar</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── EVENTOS ── */}
      {activeTab === 'eventos' && (
        <div>
          {events.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhum evento ativo</p>
              <p className="text-sm mt-1">Os eventos com lista de materiais aparecem aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(ev => {
                const sc = STATUS_CONFIG[ev.status] || STATUS_CONFIG.active;
                const isPlanning = ev.status === 'planning';
                const actionLabel = isPlanning ? 'Separar' : 'Devolver';
                return (
                  <button
                    key={ev.id}
                    onClick={() => openEvent(ev)}
                    className="w-full bg-white rounded-xl border border-border p-4 text-left transition-all active:scale-[0.99] hover:border-primary/40 hover:bg-amber-50/20"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ClipboardList className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{ev.event_name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(ev.date_out + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sc.color}`}>
                            {sc.label}
                          </span>
                          {ev.items.length > 0 && (
                            <span className="text-xs text-primary font-medium">
                              {ev.items.length} material{ev.items.length !== 1 ? 'is' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5 ${isPlanning ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                        {actionLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Label print ── */}
      <MaterialLabelPrint item={labelItem} onClose={() => setLabelItem(null)} />

      {/* ── Add existing item dialog ── */}
      <Dialog open={addItemDialog} onOpenChange={setAddItemDialog}>
        <DialogContent className="max-w-sm max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Adicionar Material</DialogTitle></DialogHeader>
          <div className="relative mb-3 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar material..."
              value={addItemSearch}
              onChange={e => setAddItemSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {addItemFiltered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                {addItemSearch ? 'Nenhum resultado' : 'Todos os itens já estão na lista'}
              </p>
            ) : (
              addItemFiltered.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleAddExistingItem(item)}
                  className="w-full bg-white rounded-xl border border-border p-3 flex items-center gap-3 text-left hover:border-primary/40 hover:bg-amber-50/20 transition-all active:scale-[0.98]"
                >
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name}
                      className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category} · {item.available_qty} disponíveis
                    </p>
                  </div>
                  <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New Material Dialog ── */}
      <Dialog open={dialog} onOpenChange={v => { setDialog(v); if (!v) setCreatingForSep(false); }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {creatingForSep ? 'Novo Material (adicionando ao evento)' : 'Novo Material'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="mb-2 block">Foto</Label>
              <MaterialImageUpload value={form.image_url} onChange={url => setForm(f => ({ ...f, image_url: url }))} />
            </div>
            <div>
              <Label>Nome *</Label>
              <Input className="mt-1" placeholder="Ex: Taça de vinho"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Categoria *</Label>
              <div className="flex gap-2 mt-1">
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="flex-shrink-0"
                  onClick={() => setNewCatDialog(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input className="mt-1" placeholder="Detalhes opcionais..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Qtde Total</Label>
                <Input className="mt-1" type="number" min={0} value={form.total_qty}
                  onChange={e => setForm(f => ({ ...f, total_qty: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDialog(false); setCreatingForSep(false); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gold-button">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {creatingForSep ? 'Criar e Adicionar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New Category Dialog ── */}
      <Dialog open={newCatDialog} onOpenChange={setNewCatDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Ex: Louças, Rechauds..." value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateCategory()} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNewCatDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleCreateCategory} className="gold-button">Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
