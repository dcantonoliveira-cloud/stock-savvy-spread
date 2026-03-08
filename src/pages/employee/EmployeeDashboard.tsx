import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowUpCircle, ArrowDownCircle, Check, ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES } from '@/types/inventory';

type StockItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  image_url: string | null;
};

const CATEGORY_EMOJIS: Record<string, string> = {
  'Carnes': '🥩', 'Bebidas': '🥤', 'Frios': '🧀', 'Hortifruti': '🥬',
  'Secos': '🌾', 'Descartáveis': '🥤', 'Limpeza': '🧹', 'Outros': '📦',
};

export default function EmployeeDashboard() {
  const { user, permissions, profile } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [mode, setMode] = useState<'entry' | 'output' | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [eventName, setEventName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const loadItems = async () => {
    const { data } = await supabase.from('stock_items').select('id, name, category, unit, current_stock, image_url' as any).order('name');
    if (data) setItems(data as unknown as StockItem[]);
  };

  useEffect(() => { loadItems(); }, []);

  const categories = CATEGORIES.filter(cat => items.some(i => i.category === cat));
  const categoryItems = selectedCategory ? items.filter(i => i.category === selectedCategory) : [];
  const searchResults = search ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : [];

  const handleAction = (item: StockItem, action: 'entry' | 'output') => {
    setSelectedItem(item);
    setMode(action);
    setQuantity('');
    setNotes('');
    setEventName('');
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
    } else {
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
    }

    setSubmitting(false);
    setMode(null);
    setSelectedItem(null);
    loadItems();
  };

  const ItemCard = ({ item }: { item: StockItem }) => (
    <div
      className="flex flex-col items-center rounded-2xl bg-card border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => {
        if (permissions.can_output && permissions.can_entry) {
          // Show both options
          setSelectedItem(item);
        } else if (permissions.can_output) {
          handleAction(item, 'output');
        } else if (permissions.can_entry) {
          handleAction(item, 'entry');
        }
      }}
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

  // Choose action dialog (when both entry and output are allowed)
  const showChooseAction = selectedItem && mode === null;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="text-center py-3">
        <h2 className="text-lg font-display font-bold text-foreground">
          Olá, {profile?.display_name?.split(' ')[0]} 👋
        </h2>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10 h-11 text-sm rounded-xl"
          placeholder="Buscar item..."
          value={search}
          onChange={e => { setSearch(e.target.value); if (e.target.value) setSelectedCategory(null); }}
        />
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
                  className="flex flex-col items-center justify-center rounded-2xl bg-card border border-border p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
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

      {/* Choose action dialog */}
      <Dialog open={!!showChooseAction} onOpenChange={open => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">{selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            {permissions.can_entry && (
              <Button
                size="lg"
                className="h-16 text-lg rounded-xl bg-success text-success-foreground hover:bg-success/90"
                onClick={() => setMode('entry')}
              >
                <ArrowUpCircle className="w-6 h-6 mr-3" /> Entrada
              </Button>
            )}
            {permissions.can_output && (
              <Button
                size="lg"
                className="h-16 text-lg rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => setMode('output')}
              >
                <ArrowDownCircle className="w-6 h-6 mr-3" /> Saída
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quantity dialog */}
      <Dialog open={mode !== null} onOpenChange={open => { if (!open) { setMode(null); setSelectedItem(null); } }}>
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
                <label className="text-sm text-muted-foreground mb-1 block">
                  Quantidade ({selectedItem.unit}) *
                </label>
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
                  <Input
                    className="h-11 rounded-xl"
                    value={eventName}
                    onChange={e => setEventName(e.target.value)}
                    placeholder="Ex: Casamento Silva"
                  />
                </div>
              )}

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Obs (opcional)</label>
                <Input
                  className="h-11 rounded-xl"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Observações"
                />
              </div>

              <Button
                className="w-full h-14 text-lg rounded-xl"
                onClick={handleSubmit}
                disabled={submitting || !quantity}
              >
                <Check className="w-5 h-5 mr-2" />
                {submitting ? 'Registrando...' : 'Confirmar'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
