import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Item = { id: string; name: string; unit: string; current_stock: number };
type Entry = { id: string; item_id: string; quantity: number; unit_cost: number | null; supplier: string | null; invoice_number: string | null; notes: string | null; date: string; created_at: string };

export default function EntriesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');

  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    const [itemsRes, entriesRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, unit, current_stock').order('name'),
      supabase.from('stock_entries').select('*').order('created_at', { ascending: false }),
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (entriesRes.data) setEntries(entriesRes.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = filterDate ? entries.filter(e => e.date === filterDate) : entries;

  const resetForm = () => { setItemId(''); setQuantity(''); setUnitCost(''); setSupplier(''); setInvoiceNumber(''); setNotes(''); };

  const handleSave = async () => {
    if (!itemId) { toast.error('Selecione um item'); return; }
    if (!quantity || parseFloat(quantity) <= 0) { toast.error('Quantidade inválida'); return; }
    if (!user) return;

    const { error } = await supabase.from('stock_entries').insert({
      item_id: itemId,
      quantity: parseFloat(quantity),
      unit_cost: unitCost ? parseFloat(unitCost) : null,
      supplier: supplier.trim() || null,
      invoice_number: invoiceNumber.trim() || null,
      notes: notes.trim() || null,
      registered_by: user.id,
    });

    if (error) { toast.error('Erro ao registrar'); return; }
    toast.success('Entrada registrada!');
    resetForm();
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('stock_entries').delete().eq('id', id);
    toast.success('Entrada removida!');
    load();
  };

  const selectedItem = items.find(i => i.id === itemId);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Entradas</h1>
          <p className="text-muted-foreground mt-1">Registre o recebimento de mercadorias</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Entrada</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Entrada</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Item</label>
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                  <SelectContent>
                    {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Quantidade {selectedItem ? `(${selectedItem.unit})` : ''}</label>
                  <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Custo Unit. (R$)</label>
                  <Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Fornecedor (opcional)</label>
                <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nome do fornecedor" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nota Fiscal (opcional)</label>
                <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Nº da NF" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Observações (opcional)</label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações" />
              </div>
              <Button onClick={handleSave} className="w-full">Registrar Entrada</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-48" />
        {filterDate && <Button variant="ghost" size="sm" onClick={() => setFilterDate('')}>Limpar</Button>}
      </div>

      <div className="space-y-3">
        {filtered.map(entry => {
          const item = items.find(i => i.id === entry.item_id);
          return (
            <div key={entry.id} className="glass-card rounded-xl p-4 flex items-center justify-between animate-fade-in">
              <div>
                <p className="font-medium text-foreground">{item?.name || '?'}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.date).toLocaleDateString('pt-BR')}
                  {entry.supplier && ` · ${entry.supplier}`}
                  {entry.invoice_number && ` · NF: ${entry.invoice_number}`}
                </p>
                {entry.notes && <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-lg font-semibold text-success">+{entry.quantity}</p>
                  {entry.unit_cost && <p className="text-xs text-muted-foreground">R$ {entry.unit_cost}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">Nenhuma entrada registrada.</div>
        )}
      </div>
    </div>
  );
}
