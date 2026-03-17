import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';

type Item = { id: string; name: string; unit: string; current_stock: number };
type Output = { id: string; item_id: string; quantity: number; employee_name: string; event_name: string | null; notes: string | null; date: string; created_at: string };

const exportCsv = (rows: string[][], filename: string) => {
  const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default function SupervisorOutputsPage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

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

  const filtered = outputs.filter(o => {
    const item = items.find(i => i.id === o.item_id);
    const matchDate = filterDate ? o.date === filterDate : true;
    const q = search.toLowerCase();
    const matchSearch = q
      ? (item?.name || '').toLowerCase().includes(q) ||
        o.employee_name.toLowerCase().includes(q) ||
        (o.event_name || '').toLowerCase().includes(q)
      : true;
    return matchDate && matchSearch;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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

  const handleExportCsv = () => {
    const header = ['Data', 'Item', 'Quantidade', 'Unidade', 'Funcionário', 'Evento', 'Observações'];
    const rows = filtered.map(o => {
      const item = items.find(i => i.id === o.item_id);
      return [
        new Date(o.date).toLocaleDateString('pt-BR'),
        item?.name || '',
        String(o.quantity),
        item?.unit || '',
        o.employee_name,
        o.event_name || '',
        o.notes || '',
      ];
    });
    exportCsv([header, ...rows], `saidas-${filterDate || 'todos'}.csv`);
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
                <label className="text-sm text-muted-foreground mb-1 block">Quantidade</label>
                <div className="relative">
                  <Input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" className={selectedItem ? 'pr-16' : ''} />
                  {selectedItem && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {selectedItem.unit}
                    </span>
                  )}
                </div>
                {selectedItem && <p className="text-xs text-muted-foreground mt-1">Estoque atual: {selectedItem.current_stock} {selectedItem.unit}</p>}
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

      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-48" />
        <Input
          type="text"
          placeholder="Buscar por item, funcionário ou evento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
        {filterDate && <Button variant="ghost" size="sm" onClick={() => setFilterDate('')}>Limpar</Button>}
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-2" />Exportar CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma saída registrada.</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Un.</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(output => {
                const item = items.find(i => i.id === output.item_id);
                return (
                  <TableRow key={output.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(output.date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium">{item?.name || '?'}</TableCell>
                    <TableCell className="text-right text-destructive font-semibold">-{output.quantity}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-medium">{item?.unit || ''}</TableCell>
                    <TableCell>{output.employee_name}</TableCell>
                    <TableCell className="text-muted-foreground">{output.event_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{output.notes || '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(output.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
              <span>Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} saídas</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Anterior</Button>
                <span>Página {page + 1} de {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima →</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
