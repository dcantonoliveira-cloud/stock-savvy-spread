import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Check, ArrowLeft, Search, ScanBarcode } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES } from '@/types/inventory';
import BarcodeScanner from '@/components/BarcodeScanner';

type StockItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  image_url: string | null;
  barcode: string | null;
};

type Kitchen = { id: string; name: string };
type Location = { id: string; item_id: string; kitchen_id: string; current_stock: number };

const CATEGORY_EMOJIS: Record<string, string> = {
  'Carnes': '🥩', 'Bebidas': '🥤', 'Frios': '🧀', 'Hortifruti': '🥬',
  'Secos': '🌾', 'Descartáveis': '🥤', 'Limpeza': '🧹', 'Outros': '📦',
};

export default function EmployeeDashboard() {
  const { user, permissions, profile } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [mode, setMode] = useState<'entry' | 'output' | 'transfer' | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [eventName, setEventName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [barcodeTimeout, setBarcodeTimeout] = useState<NodeJS.Timeout | null>(null);

  // Transfer state
  const [tfFromKitchen, setTfFromKitchen] = useState('');
  const [tfToKitchen, setTfToKitchen] = useState('');

  const loadData = async () => {
    const [itemsRes, kitchensRes, locsRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, category, unit, current_stock, image_url, barcode' as any).order('name'),
      supabase.from('kitchens').select('id, name').order('name'),
      supabase.from('stock_item_locations').select('id, item_id, kitchen_id, current_stock'),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as unknown as StockItem[]);
    if (kitchensRes.data) setKitchens(kitchensRes.data as Kitchen[]);
    if (locsRes.data) setLocations(locsRes.data as Location[]);
  };

  useEffect(() => { loadData(); }, []);

  // Physical barcode reader support (keyboard input)
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

  const categories = CATEGORIES.filter(cat => items.some(i => i.category === cat));
  const categoryItems = selectedCategory ? items.filter(i => i.category === selectedCategory) : [];
  const searchResults = search ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : [];

  const handleAction = (item: StockItem, action: 'entry' | 'output' | 'transfer') => {
    setSelectedItem(item);
    setMode(action);
    setQuantity('');
    setNotes('');
    setEventName('');
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
      const { error } = await supabase.from('stock_entries').insert({
        item_id: selectedItem.id,
        quantity: parseFloat(quantity),
        notes: notes.trim() || null,
        registered_by: user.id,
      });
      if (error) toast.error('Erro ao registrar entrada');
      else toast.success(`✅ Entrada de ${quantity} ${selectedItem.unit} de ${selectedItem.name}`);
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
      if (!tfFromKitchen || !tfToKitchen) {
        toast.error('Selecione origem e destino');
        setSubmitting(false);
        return;
      }
      if (tfFromKitchen === tfToKitchen) {
        toast.error('Origem e destino devem ser diferentes');
        setSubmitting(false);
        return;
      }
      const qty = parseFloat(quantity);
      const fromStock = getLocationStock(selectedItem.id, tfFromKitchen);
      if (qty > fromStock) {
        toast.error(`Estoque insuficiente na origem (disponível: ${fromStock})`);
        setSubmitting(false);
        return;
      }

      // Record transfer
      const { error: tfError } = await supabase.from('stock_transfers').insert({
        item_id: selectedItem.id,
        from_kitchen_id: tfFromKitchen,
        to_kitchen_id: tfToKitchen,
        quantity: qty,
        transferred_by: profile?.display_name || user.email || '',
        notes: notes.trim() || null,
      } as any);
      if (tfError) { toast.error('Erro ao registrar transferência'); setSubmitting(false); return; }

      // Update origin
      const fromLoc = locations.find(l => l.item_id === selectedItem.id && l.kitchen_id === tfFromKitchen);
      if (fromLoc) {
        await supabase.from('stock_item_locations')
          .update({ current_stock: fromLoc.current_stock - qty } as any)
          .eq('id', fromLoc.id);
      }

      // Update destination
      const toLoc = locations.find(l => l.item_id === selectedItem.id && l.kitchen_id === tfToKitchen);
      if (toLoc) {
        await supabase.from('stock_item_locations')
          .update({ current_stock: toLoc.current_stock + qty } as any)
          .eq('id', toLoc.id);
      } else {
        await supabase.from('stock_item_locations').insert({
          item_id: selectedItem.id,
          kitchen_id: tfToKitchen,
          current_stock: qty,
        } as any);
      }

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
  // Always show transfer if there are kitchens (Estoque Geral counts as one)
  const hasKitchens = kitchens.length >= 2;

  return (
    <div className="pb-8">
      <div className="text-center py-3">
        <h2 className="text-lg font-display font-bold text-foreground">
          Olá, {profile?.display_name?.split(' ')[0]} 👋
        </h2>
      </div>

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

      {/* Search results */}
      {search && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">{searchResults.length} resultado(s)</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {searchResults.map(item => <ItemCard key={item.id} item={item} />)}
          </div>
          {searchResults.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum item encontrado.</p>
          )}
        </div>
      )}

      {/* Category grid */}
      {!search && !selectedCategory && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">Selecione uma categoria</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {categories.map(cat => {
              const count = items.filter(i => i.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="flex flex-col items-center justify-center rounded-2xl bg-card border border-border p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-95"
                >
                  <span className="text-4xl mb-2">{CATEGORY_EMOJIS[cat] || '📦'}</span>
                  <p className="font-medium text-foreground text-sm">{cat}</p>
                  <p className="text-xs text-muted-foreground">{count} {count === 1 ? 'item' : 'itens'}</p>
                </button>
              );
            })}
          </div>
          {categories.length === 0 && (
            <p className="text-center text-muted-foreground py-12">Nenhum item cadastrado.</p>
          )}
        </div>
      )}

      {/* Items in category */}
      {!search && selectedCategory && (
        <div>
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-2 text-sm text-primary mb-4 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar às categorias
          </button>
          <p className="text-sm text-muted-foreground mb-3">
            {CATEGORY_EMOJIS[selectedCategory]} {selectedCategory} · {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'itens'}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {categoryItems.map(item => <ItemCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Camera barcode scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />

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
              <Button
                size="lg"
                className="h-14 text-base rounded-xl bg-success text-success-foreground hover:bg-success/90 w-full justify-center"
                onClick={() => setMode('entry')}
              >
                <ArrowUpCircle className="w-5 h-5 mr-3 flex-shrink-0" /> Entrada
              </Button>
            )}
            {permissions.can_output && (
              <Button
                size="lg"
                className="h-14 text-base rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full justify-center"
                onClick={() => setMode('output')}
              >
                <ArrowDownCircle className="w-5 h-5 mr-3 flex-shrink-0" /> Saída
              </Button>
            )}
            {hasKitchens && (
              <Button
                size="lg"
                variant="outline"
                className="h-14 text-base rounded-xl border-primary/30 text-primary hover:bg-primary/10 w-full justify-center"
                onClick={() => setMode('transfer')}
              >
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
              {mode === 'entry' ? (
                <><ArrowUpCircle className="w-5 h-5 text-success" /> Entrada</>
              ) : (
                <><ArrowDownCircle className="w-5 h-5 text-destructive" /> Saída</>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-accent rounded-lg p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-card flex items-center justify-center">
                  {selectedItem.image_url ? (
                    <img src={selectedItem.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{CATEGORY_EMOJIS[selectedItem.category] || '📦'}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedItem.name}</p>
                  <p className="text-xs text-muted-foreground">Estoque: {selectedItem.current_stock} {selectedItem.unit}</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Quantidade ({selectedItem.unit}) *</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  className="h-14 text-2xl text-center font-bold rounded-xl"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>

              {mode === 'output' && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Evento (opcional)</label>
                  <Input className="h-11 rounded-xl" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Ex: Casamento Silva" />
                </div>
              )}

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Obs (opcional)</label>
                <Input className="h-11 rounded-xl" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações" />
              </div>

              <Button className="w-full h-14 text-lg rounded-xl" onClick={handleSubmit} disabled={submitting || !quantity}>
                <Check className="w-5 h-5 mr-2" />
                {submitting ? 'Registrando...' : 'Confirmar'}
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
              <ArrowRightLeft className="w-5 h-5 text-primary" /> Transferir
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-accent rounded-lg p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-card flex items-center justify-center">
                  {selectedItem.image_url ? (
                    <img src={selectedItem.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{CATEGORY_EMOJIS[selectedItem.category] || '📦'}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedItem.name}</p>
                  <p className="text-xs text-muted-foreground">Estoque geral: {selectedItem.current_stock} {selectedItem.unit}</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">De (Origem) *</label>
                <Select value={tfFromKitchen} onValueChange={setTfFromKitchen}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Selecione a cozinha de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {kitchens.map(k => {
                      const stock = getLocationStock(selectedItem.id, k.id);
                      return (
                        <SelectItem key={k.id} value={k.id}>
                          {k.name} ({stock} {selectedItem.unit})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Para (Destino) *</label>
                <Select value={tfToKitchen} onValueChange={setTfToKitchen}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Selecione a cozinha de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {kitchens.filter(k => k.id !== tfFromKitchen).map(k => (
                      <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Quantidade ({selectedItem.unit}) *</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  className="h-14 text-2xl text-center font-bold rounded-xl"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
                {tfFromKitchen && (
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Disponível na origem: {getLocationStock(selectedItem.id, tfFromKitchen)} {selectedItem.unit}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Obs (opcional)</label>
                <Input className="h-11 rounded-xl" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Urgente para evento" />
              </div>

              <Button
                className="w-full h-14 text-lg rounded-xl"
                onClick={handleSubmit}
                disabled={submitting || !quantity || !tfFromKitchen || !tfToKitchen}
              >
                <ArrowRightLeft className="w-5 h-5 mr-2" />
                {submitting ? 'Transferindo...' : 'Confirmar Transferência'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
