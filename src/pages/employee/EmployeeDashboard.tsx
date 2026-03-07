import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowUpCircle, ArrowDownCircle, Search, Check } from 'lucide-react';
import { toast } from 'sonner';

type StockItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
};

export default function EmployeeDashboard() {
  const { user, permissions, profile } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [mode, setMode] = useState<'entry' | 'output' | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [eventName, setEventName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadItems = async () => {
    const { data } = await supabase.from('stock_items').select('id, name, category, unit, current_stock').order('name');
    if (data) setItems(data);
  };

  useEffect(() => { loadItems(); }, []);

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

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

  return (
    <div className="space-y-4 pb-8">
      <div className="text-center py-4">
        <h2 className="text-xl font-display font-bold text-foreground">
          Olá, {profile?.display_name?.split(' ')[0]} 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Selecione um item para lançar</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          className="pl-11 h-12 text-base rounded-xl"
          placeholder="Buscar item..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.id} className="glass-card rounded-xl p-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category} · {item.current_stock} {item.unit}</p>
              </div>
              <div className="flex gap-2 ml-3">
                {permissions.can_entry && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-12 rounded-xl border-success/30 text-success hover:bg-success/10"
                    onClick={() => handleAction(item, 'entry')}
                  >
                    <ArrowUpCircle className="w-5 h-5" />
                  </Button>
                )}
                {permissions.can_output && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => handleAction(item, 'output')}
                  >
                    <ArrowDownCircle className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {items.length === 0 ? 'Nenhum item cadastrado.' : 'Nenhum item encontrado.'}
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={mode !== null} onOpenChange={open => { if (!open) setMode(null); }}>
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
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="font-medium text-foreground">{selectedItem.name}</p>
                <p className="text-xs text-muted-foreground">Estoque: {selectedItem.current_stock} {selectedItem.unit}</p>
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
