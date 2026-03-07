import { useEffect, useState } from 'react';
import { getItems, getOutputs, saveOutput, deleteOutput } from '@/lib/storage';
import { StockItem, StockOutput } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function OutputForm({ items, onSave, onCancel }: { items: StockItem[]; onSave: (o: StockOutput) => void; onCancel: () => void }) {
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [eventName, setEventName] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const selectedItem = items.find(i => i.id === itemId);

  const handleSubmit = () => {
    if (!itemId) { toast.error('Selecione um item'); return; }
    if (!quantity || parseFloat(quantity) <= 0) { toast.error('Quantidade inválida'); return; }
    if (!employeeName.trim()) { toast.error('Nome do funcionário é obrigatório'); return; }
    onSave({
      id: crypto.randomUUID(),
      itemId,
      itemName: selectedItem?.name || '',
      quantity: parseFloat(quantity),
      employeeName: employeeName.trim(),
      eventName: eventName.trim() || undefined,
      notes: notes.trim() || undefined,
      date,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Item</label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
          <SelectContent>
            {items.map(i => (
              <SelectItem key={i.id} value={i.id}>
                {i.name} ({i.currentStock} {i.unit})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Quantidade {selectedItem ? `(${selectedItem.unit})` : ''}</label>
          <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Data</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Funcionário</label>
        <Input value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Nome do funcionário" />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Evento (opcional)</label>
        <Input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Ex: Casamento Silva" />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Observações (opcional)</label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSubmit} className="flex-1">Registrar Saída</Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function OutputsPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [outputs, setOutputs] = useState<StockOutput[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');

  const reload = () => {
    setItems(getItems());
    setOutputs(getOutputs());
  };
  useEffect(reload, []);

  const filtered = filterDate ? outputs.filter(o => o.date === filterDate) : outputs;
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleSave = (output: StockOutput) => {
    saveOutput(output);
    reload();
    setDialogOpen(false);
    toast.success('Saída registrada!');
  };

  const handleDelete = (id: string) => {
    deleteOutput(id);
    reload();
    toast.success('Saída removida!');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Saídas</h1>
          <p className="text-muted-foreground mt-1">Registre as saídas de estoque</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Saída</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Saída</DialogTitle>
            </DialogHeader>
            <OutputForm items={items} onSave={handleSave} onCancel={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-48" />
        {filterDate && (
          <Button variant="ghost" size="sm" className="ml-2 text-xs" onClick={() => setFilterDate('')}>Limpar filtro</Button>
        )}
      </div>

      <div className="space-y-3">
        {sorted.map(output => (
          <div key={output.id} className="glass-card rounded-xl p-4 flex items-center justify-between animate-fade-in">
            <div>
              <p className="font-medium text-foreground">{output.itemName}</p>
              <p className="text-xs text-muted-foreground">
                {output.employeeName} · {new Date(output.date).toLocaleDateString('pt-BR')}
                {output.eventName && ` · ${output.eventName}`}
              </p>
              {output.notes && <p className="text-xs text-muted-foreground mt-1">{output.notes}</p>}
            </div>
            <div className="flex items-center gap-4">
              <p className="text-lg font-semibold text-primary">-{output.quantity}</p>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(output.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma saída registrada.
          </div>
        )}
      </div>
    </div>
  );
}
