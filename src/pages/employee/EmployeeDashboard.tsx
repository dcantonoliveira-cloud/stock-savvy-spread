import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Check, ArrowLeft,
  Search, ScanBarcode, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScanner from '@/components/BarcodeScanner';

type StockItem = {
  id: string;
  name: string;
  category: string;
  subcategory_id: string | null;
  unit: string;
  current_stock: number;
  image_url: string | null;
  barcode: string | null;
};

type Kitchen = { id: string; name: string };
type Location = { id: string; item_id: string; kitchen_id: string; current_stock: number };
type Subcategory = { id: string; name: string; category_id: string };
type CategoryRecord = { id: string; name: string };
type Tag = { id: string; name: string; color: string };

const normalizeText = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Busca tolerante: casa se o nome contém o texto inteiro OU pelo menos uma das palavras digitadas
// (ex: "queijo provolone" encontra "PROVOLONE")
function looseMatch(itemName: string, query: string): boolean {
  const nItem = normalizeText(itemName);
  const nQuery = normalizeText(query);
  if (!nQuery) return true;
  if (nItem.includes(nQuery)) return true;
  const words = nQuery.split(/\s+/).filter(w => w.length >= 3);
  return words.some(w => nItem.includes(w));
}

const CATEGORY_EMOJIS: Record<string, string> = {
  'Carnes': '🥩', 'Bebidas': '🥤', 'Frios': '🧀', 'Hortifruti': '🥬',
  'Secos': '🌾', 'Descartáveis': '🥤', 'Limpeza': '🧹', 'Outros': '📦',
};

export default function EmployeeDashboard() {
  const { user, permissions, profile } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categoryRecords, setCategoryRecords] = useState<CategoryRecord[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [itemTagsMap, setItemTagsMap] = useState<Record<string, string[]>>({});
  const [loadingItems, setLoadingItems] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [mode, setMode] = useState<'entry' | 'output' | 'transfer' | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [eventName, setEventName] = useState('');
  const [entryUnitCost, setEntryUnitCost] = useState('');
  const [entrySupplier, setEntrySupplier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [barcodeTimeout, setBarcodeTimeout] = useState<NodeJS.Timeout | null>(null);

  const [tfFromKitchen, setTfFromKitchen] = useState('');
  const [tfToKitchen, setTfToKitchen] = useState('');

  const loadData = async () => {
    const [itemsRes, kitchensRes, locsRes, subcatsRes, catsRes, tagsRes, itemTagsRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, category, subcategory_id, unit, current_stock, image_url, barcode' as any).order('name').range(0, 9999),
      supabase.from('kitchens').select('id, name').order('name'),
      supabase.from('stock_item_locations').select('id, item_id, kitchen_id, current_stock'),
      supabase.from('subcategories').select('id, name, category_id').order('name'),
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('tags').select('id, name, color').order('name'),
      (supabase.from('stock_item_tags') as any).select('item_id, tag_id'),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as unknown as StockItem[]);
    if (kitchensRes.data) setKitchens(kitchensRes.data as Kitchen[]);
    if (locsRes.data) setLocations(locsRes.data as Location[]);
    if (subcatsRes.data) setSubcategories(subcatsRes.data as Subcategory[]);
    if (catsRes.data) setCategoryRecords(catsRes.data as CategoryRecord[]);
    if (tagsRes.data) setAllTags(tagsRes.data as Tag[]);
    if (itemTagsRes.data) {
      const map: Record<string, string[]> = {};
      for (const l of itemTagsRes.data as { item_id: string; tag_id: string }[]) {
        if (!map[l.item_id]) map[l.item_id] = [];
        map[l.item_id].push(l.tag_id);
      }
      setItemTagsMap(map);
    }
    setLoadingItems(false);
  };

  useEffect(() => { loadData(); }, []);

  // Physical barcode reader support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Enter' && barcodeBuffer.length >= 8) {
        handleBarcodeScan(barcodeBuffer);
        setBarcodeBuffer('');
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        setBarcodeBuffer(prev => prev + e.key);
        if (barcodeTimeout) clearTimeout(barcodeTimeout);
        const timeout = setTimeout(() => setBarcodeBuffer(''), 300);
        setBarcodeTimeout(timeout);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeBuffer, barcodeTimeout]);

  const handleBarcodeScan = (barcode: string) => {
    const found = items.find(i => i.barcode === barcode);
    if (found) {
      setSearch('');
      setSelectedCategory(null);
      setSelectedItem(found);
      toast.success(`📦 ${found.name}`);
    } else {
      toast.error(`Código ${barcode} não encontrado`);
    }
  };

  const usedTags = allTags.filter(t => Object.values(itemTagsMap).some(tagIds => tagIds.includes(t.id)));
  const tagFilteredItems = selectedTag ? items.filter(i => (itemTagsMap[i.id] || []).includes(selectedTag)) : items;
  const categories = Array.from(new Set(tagFilteredItems.map(i => i.category).filter(Boolean))).sort();
  const categoryItemsAll = selectedCategory ? tagFilteredItems.filter(i => i.category === selectedCategory) : [];
  const categoryRecord = selectedCategory ? categoryRecords.find(c => c.name === selectedCategory) : null;
  const subcategoriesForCategory = categoryRecord
    ? subcategories.filter(s => s.category_id === categoryRecord.id && categoryItemsAll.some(i => i.subcategory_id === s.id))
    : [];
  const categoryItems = selectedSubcategory
    ? categoryItemsAll.filter(i => i.subcategory_id === selectedSubcategory)
    : categoryItemsAll;
  const searchResults = search ? tagFilteredItems.filter(i => looseMatch(i.name, search)) : [];

  const handleAction = (item: StockItem, action: 'entry' | 'output' | 'transfer') => {
    setSelectedItem(item);
    setMode(action);
    setQuantity('');
    setNotes('');
    setEventName('');
    setEntryUnitCost('');
    setEntrySupplier('');
    setTfFromKitchen('');
    setTfToKitchen('');
  };

  const getLocationStock = (itemId: string, kitchenId: string) => {
    return locations.find(l => l.item_id === itemId && l.kitchen_id === kitchenId)?.current_stock ?? 0;
  };

  const handleSubmit = async () => {
    if (!selectedItem || !user || !quantity || parseFloat(quantity) <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }
    setSubmitting(true);

    if (mode === 'entry') {
      const parsedCost = entryUnitCost ? parseFloat(entryUnitCost.replace(',', '.')) : null;
      const supplierName = entrySupplier.trim() || null;
      const { error } = await supabase.from('stock_entries').insert({
        item_id: selectedItem.id,
        quantity: parseFloat(quantity),
        unit_cost: parsedCost,
        supplier: supplierName,
        notes: notes.trim() || null,
        registered_by: user.id,
      });
      if (error) { toast.error('Erro ao registrar entrada'); setSubmitting(false); return; }

      // Atualiza o preço do item (dispara histórico de preço via trigger) e vincula o fornecedor
      if (parsedCost && parsedCost > 0) {
        await supabase.from('stock_items').update({ unit_cost: parsedCost } as any).eq('id', selectedItem.id);
      }
      if (supplierName) {
        const { data: existing } = await supabase.from('item_suppliers').select('id')
          .eq('item_id', selectedItem.id).ilike('supplier_name', supplierName).maybeSingle();
        if (existing) {
          if (parsedCost && parsedCost > 0) await supabase.from('item_suppliers').update({ unit_price: parsedCost } as any).eq('id', (existing as any).id);
        } else {
          const { count } = await supabase.from('item_suppliers').select('id', { count: 'exact', head: true }).eq('item_id', selectedItem.id);
          await supabase.from('item_suppliers').insert({
            item_id: selectedItem.id, supplier_name: supplierName,
            unit_price: parsedCost || 0, is_preferred: !count || count === 0,
          } as any);
        }
      }

      toast.success(`✅ Entrada de ${quantity} ${selectedItem.unit} de ${selectedItem.name}`);
    } else if (mode === 'output') {
      const { error } = await supabase.from('stock_outputs').insert({
        item_id: selectedItem.id,
        quantity: parseFloat(quantity),
        employee_name: profile?.display_name || user.email || '',
        event_name: eventName.trim() || null,
        notes: notes.trim() || null,
        registered_by: user.id,
      });
      if (error) toast.error('Erro ao registrar saída');
      else toast.success(`✅ Saída de ${quantity} ${selectedItem.unit} de ${selectedItem.name}`);
    } else if (mode === 'transfer') {
      if (!tfFromKitchen || !tfToKitchen) { toast.error('Selecione origem e destino'); setSubmitting(false); return; }
      if (tfFromKitchen === tfToKitchen) { toast.error('Origem e destino devem ser diferentes'); setSubmitting(false); return; }
      const qty = parseFloat(quantity);
      const fromStock = getLocationStock(selectedItem.id, tfFromKitchen);
      if (qty > fromStock) { toast.error(`Estoque insuficiente na origem (disponível: ${fromStock})`); setSubmitting(false); return; }
      const { error: tfError } = await supabase.from('stock_transfers').insert({
        item_id: selectedItem.id,
        from_kitchen_id: tfFromKitchen,
        to_kitchen_id: tfToKitchen,
        quantity: qty,
        transferred_by: profile?.display_name || user.email || '',
        notes: notes.trim() || null,
      } as any);
      if (tfError) { toast.error('Erro ao registrar transferência'); setSubmitting(false); return; }
      const fromLoc = locations.find(l => l.item_id === selectedItem.id && l.kitchen_id === tfFromKitchen);
      if (fromLoc) await supabase.from('stock_item_locations').update({ current_stock: fromLoc.current_stock - qty } as any).eq('id', fromLoc.id);
      const toLoc = locations.find(l => l.item_id === selectedItem.id && l.kitchen_id === tfToKitchen);
      if (toLoc) await supabase.from('stock_item_locations').update({ current_stock: toLoc.current_stock + qty } as any).eq('id', toLoc.id);
      else await supabase.from('stock_item_locations').insert({ item_id: selectedItem.id, kitchen_id: tfToKitchen, current_stock: qty } as any);
      const fromName = kitchens.find(k => k.id === tfFromKitchen)?.name;
      const toName = kitchens.find(k => k.id === tfToKitchen)?.name;
      toast.success(`✅ ${qty} ${selectedItem.unit} de ${selectedItem.name} transferidos de ${fromName} → ${toName}`);
    }

    setSubmitting(false);
    setMode(null);
    setSelectedItem(null);
    loadData();
  };

  const ItemCard = ({ item }: { item: StockItem }) => (
    <div
      className="flex flex-col items-center rounded-2xl bg-card border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-95"
      onClick={() => setSelectedItem(item)}
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-accent flex items-center justify-center mb-2">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">{CATEGORY_EMOJIS[item.category] || '📦'}</span>
        )}
      </div>
      <p className="text-xs font-medium text-foreground text-center leading-tight line-clamp-2">{item.name}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{item.current_stock} {item.unit}</p>
    </div>
  );

  const showChooseAction = selectedItem && mode === null;
  const hasKitchens = kitchens.length >= 2;

  return (
    <div className="pb-8">
      <div className="text-center py-3">
        <h2 className="text-lg font-display font-bold text-foreground">
          Olá, {profile?.display_name?.split(' ')[0]} 👋
        </h2>
      </div>

      {loadingItems ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div>
          {/* Search + Scanner */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-10 h-11 text-sm rounded-xl"
                placeholder="Buscar item..."
                value={search}
                onChange={e => { setSearch(e.target.value); if (e.target.value) setSelectedCategory(null); }}
              />
            </div>
            <Button
              variant="outline"
              size="lg"
              className="h-11 px-4 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => setScannerOpen(true)}
            >
              <ScanBarcode className="w-5 h-5" />
            </Button>
          </div>

          {/* Filtro de tags — estilo totem */}
          {usedTags.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-3 mb-1 -mx-4 px-4 scrollbar-none">
              <button
                onClick={() => setSelectedTag(null)}
                className={`flex-shrink-0 h-9 px-4 rounded-full text-xs font-bold transition-all active:scale-95 ${
                  selectedTag === null
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-card border-2 border-border text-muted-foreground'
                }`}
              >
                Todas as tags
              </button>
              {usedTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTag(prev => prev === tag.id ? null : tag.id)}
                  className={`flex-shrink-0 h-9 px-4 rounded-full text-xs font-bold transition-all active:scale-95 inline-flex items-center gap-1.5 ${
                    selectedTag === tag.id
                      ? 'text-white shadow-md'
                      : 'bg-card border-2 border-border text-muted-foreground'
                  }`}
                  style={selectedTag === tag.id ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedTag === tag.id ? '#fff' : tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          {/* Search results */}
          {search && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">{searchResults.length} resultado(s)</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {searchResults.map(item => <ItemCard key={item.id} item={item} />)}
              </div>
              {searchResults.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum item encontrado.</p>}
            </div>
          )}

          {/* Category grid */}
          {!search && !selectedCategory && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">Selecione uma categoria</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {categories.map(cat => {
                  const count = tagFilteredItems.filter(i => i.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setSelectedSubcategory(null); }}
                      className="flex flex-col items-center justify-center rounded-2xl bg-card border border-border p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-95"
                    >
                      <span className="text-4xl mb-2">{CATEGORY_EMOJIS[cat] || '📦'}</span>
                      <p className="font-medium text-foreground text-sm">{cat}</p>
                      <p className="text-xs text-muted-foreground">{count} {count === 1 ? 'item' : 'itens'}</p>
                    </button>
                  );
                })}
              </div>
              {categories.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum item cadastrado.</p>}
            </div>
          )}

          {/* Items in category */}
          {!search && selectedCategory && (
            <div>
              <button onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }} className="flex items-center gap-2 text-sm text-primary mb-4 hover:underline">
                <ArrowLeft className="w-4 h-4" /> Voltar às categorias
              </button>
              <p className="text-sm text-muted-foreground mb-3">
                {CATEGORY_EMOJIS[selectedCategory]} {selectedCategory} · {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'itens'}
              </p>

              {/* Filtro de subcategoria — estilo totem: botões grandes, roláveis na horizontal */}
              {subcategoriesForCategory.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-4 px-4 scrollbar-none">
                  <button
                    onClick={() => setSelectedSubcategory(null)}
                    className={`flex-shrink-0 h-11 px-5 rounded-full text-sm font-bold transition-all active:scale-95 ${
                      selectedSubcategory === null
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-card border-2 border-border text-muted-foreground'
                    }`}
                  >
                    Todas
                  </button>
                  {subcategoriesForCategory.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubcategory(sub.id)}
                      className={`flex-shrink-0 h-11 px-5 rounded-full text-sm font-bold transition-all active:scale-95 ${
                        selectedSubcategory === sub.id
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-card border-2 border-border text-muted-foreground'
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {categoryItems.map(item => <ItemCard key={item.id} item={item} />)}
              </div>
              {categoryItems.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum item nessa subcategoria.</p>}
            </div>
          )}

          <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleBarcodeScan} />
        </div>
      )}

      {/* Choose action dialog */}
      <Dialog open={!!showChooseAction} onOpenChange={open => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-[320px] mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">{selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground -mt-2">
            Estoque: {selectedItem?.current_stock} {selectedItem?.unit}
          </p>
          <div className="flex flex-col gap-3 pt-2 w-full">
            {permissions.can_entry && (
              <Button size="lg" className="h-14 text-base rounded-xl bg-success text-success-foreground hover:bg-success/90 w-full justify-center" onClick={() => handleAction(selectedItem!, 'entry')}>
                <ArrowUpCircle className="w-5 h-5 mr-3 flex-shrink-0" /> Entrada
              </Button>
            )}
            {permissions.can_output && (
              <Button size="lg" className="h-14 text-base rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full justify-center" onClick={() => handleAction(selectedItem!, 'output')}>
                <ArrowDownCircle className="w-5 h-5 mr-3 flex-shrink-0" /> Saída
              </Button>
            )}
            {hasKitchens && (
              <Button size="lg" variant="outline" className="h-14 text-base rounded-xl border-primary/30 text-primary hover:bg-primary/10 w-full justify-center" onClick={() => handleAction(selectedItem!, 'transfer')}>
                <ArrowRightLeft className="w-5 h-5 mr-3 flex-shrink-0" /> Transferir
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Entry/Output quantity dialog */}
      <Dialog open={mode === 'entry' || mode === 'output'} onOpenChange={open => { if (!open) { setMode(null); setSelectedItem(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === 'entry'
                ? <><ArrowUpCircle className="w-5 h-5 text-success" /> Entrada</>
                : <><ArrowDownCircle className="w-5 h-5 text-destructive" /> Saída</>
              }
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-accent rounded-lg p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-card flex items-center justify-center">
                  {selectedItem.image_url
                    ? <img src={selectedItem.image_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-2xl">{CATEGORY_EMOJIS[selectedItem.category] || '📦'}</span>
                  }
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedItem.name}</p>
                  <p className="text-xs text-muted-foreground">Estoque: {selectedItem.current_stock} {selectedItem.unit}</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Quantidade ({selectedItem.unit}) *</label>
                <Input type="number" inputMode="decimal" className="h-14 text-2xl text-center font-bold rounded-xl" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" autoFocus />
              </div>
              {mode === 'output' && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Evento (opcional)</label>
                  <Input className="h-11 rounded-xl" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Ex: Casamento Silva" />
                </div>
              )}
              {mode === 'entry' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Preço pago (opcional)</label>
                    <Input type="number" inputMode="decimal" className="h-11 rounded-xl" value={entryUnitCost} onChange={e => setEntryUnitCost(e.target.value)} placeholder="R$ 0,00" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Fornecedor (opcional)</label>
                    <Input className="h-11 rounded-xl" value={entrySupplier} onChange={e => setEntrySupplier(e.target.value)} placeholder="Ex: Atacadão" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Obs (opcional)</label>
                <Input className="h-11 rounded-xl" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações" />
              </div>
              <Button className="w-full h-14 text-lg rounded-xl" onClick={handleSubmit} disabled={submitting || !quantity}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Check className="w-5 h-5 mr-2" />}
                Confirmar {mode === 'entry' ? 'Entrada' : 'Saída'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={mode === 'transfer'} onOpenChange={open => { if (!open) { setMode(null); setSelectedItem(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" /> Transferir entre cozinhas
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-accent rounded-lg p-3">
                <p className="font-medium text-foreground">{selectedItem.name}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">De (origem)</label>
                <Select value={tfFromKitchen} onValueChange={setTfFromKitchen}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione a cozinha de origem" /></SelectTrigger>
                  <SelectContent>
                    {kitchens.map(k => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.name} ({getLocationStock(selectedItem.id, k.id)} {selectedItem.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Para (destino)</label>
                <Select value={tfToKitchen} onValueChange={setTfToKitchen}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione a cozinha de destino" /></SelectTrigger>
                  <SelectContent>
                    {kitchens.filter(k => k.id !== tfFromKitchen).map(k => (
                      <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Quantidade ({selectedItem.unit}) *</label>
                <Input type="number" inputMode="decimal" className="h-14 text-2xl text-center font-bold rounded-xl" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" autoFocus />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Obs (opcional)</label>
                <Input className="h-11 rounded-xl" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações" />
              </div>
              <Button className="w-full h-14 text-lg rounded-xl" onClick={handleSubmit} disabled={submitting || !quantity || !tfFromKitchen || !tfToKitchen}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRightLeft className="w-5 h-5 mr-2" />}
                Confirmar Transferência
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
