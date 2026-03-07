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
type Output = { id: string; item_id: string; quantity: number; employee_name: string; event_name: string | null; notes: string | null; date: string; created_at: string };

export default function SupervisorOutputsPage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');

  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [eventName, setEventName] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    const [itemsRes, outputsRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, unit, current_stock').order('name'),
      supabase.from('stock_outputs').select('*').order('created_at', { ascending: false }),
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (outputsRes.data) setOutputs(outputsRes.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = filterDate ? outputs.filter(o => o.date === filterDate) : outputs;

  const resetForm = () => { setItemId(''); setQuantity(''); setEmployeeName(''); setEventName(''); setNotes(''); };

  const handleSave = async () => {
    if (!itemId) { toast.error('Selecione um item'); return; }
    if (!quantity || parseFloat(quantity) <= 0) { toast.error('Quantidade inválida'); return; }
    if (!employeeName.trim()) { toast.error('Nome do funcionário é obrigatório'); return; }
    if (!user) return;

    const { error } = await supabase.from('stock_outputs').insert({
      item_id: itemId,
      quantity: parseFloat(quantity),
      employee_name: employeeName.trim(),
      event_name: eventName.trim() || null,
      notes: notes.trim() || null,
      registered_by: user.id,
    });

    if (error) { toast.error('Erro ao registrar'); return; }
    toast.success('Saída registrada!');
    resetForm();
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('stock_outputs').delete().eq('id', id);
    toast.success('Saída removida!');
    load();
  };

  const selectedItem = items.find(i => i.id === itemId);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Saídas</h1>
          <p className="text-muted-foreground mt-1">Registre as saídas de estoque</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Saída</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Saída</DialogTitle></DialogHeader>
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
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Quantidade {selectedItem ? `(${selectedItem.unit})` : ''}</label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
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
              <Button onClick={handleSave} className="w-full">Registrar Saída</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-48" />
        {filterDate && <Button variant="ghost" size="sm" onClick={() => setFilterDate('')}>Limpar</Button>}
      </div>

      <div className="space-y-3">
        {filtered.map(output => {
          const item = items.find(i => i.id === output.item_id);
          return (
            <div key={output.id} className="glass-card rounded-xl p-4 flex items-center justify-between animate-fade-in">
              <div>
                <p className="font-medium text-foreground">{item?.name || '?'}</p>
                <p className="text-xs text-muted-foreground">
                  {output.employee_name} · {new Date(output.date).toLocaleDateString('pt-BR')}
                  {output.event_name && ` · ${output.event_name}`}
                </p>
                {output.notes && <p className="text-xs text-muted-foreground mt-1">{output.notes}</p>}
              </div>
              <div className="flex items-center gap-4">
                <p className="text-lg font-semibold text-destructive">-{output.quantity}</p>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(output.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">Nenhuma saída registrada.</div>
        )}
      </div>
    </div>
  );
}
