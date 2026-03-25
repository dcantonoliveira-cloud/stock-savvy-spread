import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRightLeft, Plus, Loader2, Search, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { fmtNum } from '@/lib/format';

type Kitchen = { id: string; name: string };
type StockItem = { id: string; name: string; unit: string; current_stock: number };
type Location = { id: string; item_id: string; kitchen_id: string; current_stock: number };
type Transfer = {
  id: string; item_id: string; from_kitchen_id: string; to_kitchen_id: string;
  quantity: number; transferred_by: string; notes: string | null; created_at: string;
};

export default function TransfersPage() {
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKitchen, setFilterKitchen] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tfFrom, setTfFrom] = useState('');
  const [tfTo, setTfTo] = useState('');
  const [tfItem, setTfItem] = useState('');
  const [tfQty, setTfQty] = useState('');
  const [tfBy, setTfBy] = useState('');
  const [tfNotes, setTfNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [k, i, l, t] = await Promise.all([
      supabase.from('kitchens').select('id, name').order('name'),
      supabase.from('stock_items').select('id, name, unit, current_stock').order('name'),
      supabase.from('stock_item_locations').select('*'),
      supabase.from('stock_transfers' as any).select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (k.data) setKitchens(k.data as Kitchen[]);
    if (i.data) setItems(i.data as StockItem[]);
    if (l.data) setLocations(l.data as Location[]);
    if (t.data) setTransfers(t.data as Transfer[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getLocStock = (itemId: string, kitchenId: string) =>
    locations.find(l => l.item_id === itemId && l.kitchen_id === kitchenId)?.current_stock ?? 0;

  const kitchenName = (id: string) => kitchens.find(k => k.id === id)?.name || '—';
  const itemName = (id: string) => items.find(i => i.id === id)?.name || '—';
  const itemUnit = (id: string) => items.find(i => i.id === id)?.unit || '';

  const handleTransfer = async () => {
    if (!tfFrom || !tfTo || !tfItem || !tfQty || !tfBy.trim()) {
      toast.error('Preencha todos os campos obrigatórios'); return;
    }
    if (tfFrom === tfTo) { toast.error('Origem e destino devem ser diferentes'); return; }
    const qty = parseFloat(tfQty);
    if (!qty || qty <= 0) { toast.error('Quantidade inválida'); return; }
    const available = getLocStock(tfItem, tfFrom);
    if (qty > available) {
      toast.error(`Estoque insuficiente na origem (disponível: ${available})`); return;
    }
    setSaving(true);
    const { error } = await supabase.from('stock_transfers' as any).insert({
      item_id: tfItem, from_kitchen_id: tfFrom, to_kitchen_id: tfTo,
      quantity: qty, transferred_by: tfBy.trim(), notes: tfNotes.trim() || null,
    });
    if (error) { toast.error('Erro ao registrar transferência'); setSaving(false); return; }

    // update locations
    const fromLoc = locations.find(l => l.item_id === tfItem && l.kitchen_id === tfFrom);
    if (fromLoc) await supabase.from('stock_item_locations').update({ current_stock: fromLoc.current_stock - qty } as any).eq('id', fromLoc.id);
    const toLoc = locations.find(l => l.item_id === tfItem && l.kitchen_id === tfTo);
    if (toLoc) await supabase.from('stock_item_locations').update({ current_stock: toLoc.current_stock + qty } as any).eq('id', toLoc.id);
    else await supabase.from('stock_item_locations').insert({ item_id: tfItem, kitchen_id: tfTo, current_stock: qty } as any);

    toast.success('Transferência realizada!');
    setSaving(false);
    setDialogOpen(false);
    setTfFrom(''); setTfTo(''); setTfItem(''); setTfQty(''); setTfBy(''); setTfNotes('');
    load();
  };

  const filtered = transfers.filter(t => {
    const matchSearch = !search || itemName(t.item_id).toLowerCase().includes(search.toLowerCase()) || t.transferred_by.toLowerCase().includes(search.toLowerCase());
    const matchKitchen = filterKitchen === 'all' || t.from_kitchen_id === filterKitchen || t.to_kitchen_id === filterKitchen;
    return matchSearch && matchKitchen;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Transferências</h1>
          <p className="text-muted-foreground mt-1">{transfers.length} transferência{transfers.length !== 1 ? 's' : ''} registrada{transfers.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Nova Transferência
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por item ou responsável..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterKitchen} onValueChange={setFilterKitchen}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filtrar por centro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os centros</SelectItem>
            {kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
              <th className="text-left px-5 py-3">Data</th>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-right px-4 py-3">Qtde</th>
              <th className="text-left px-4 py-3">De</th>
              <th className="text-left px-4 py-3">Para</th>
              <th className="text-left px-4 py-3">Responsável</th>
              <th className="text-left px-4 py-3">Obs.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 opacity-20" />
                {transfers.length === 0 ? 'Nenhuma transferência registrada ainda' : 'Nenhum resultado para o filtro'}
              </td></tr>
            ) : filtered.map(t => (
              <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(t.created_at).toLocaleDateString('pt-BR')}
                  <span className="text-xs block text-muted-foreground/60">
                    {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{itemName(t.item_id)}</td>
                <td className="px-4 py-3 text-right">
                  <Badge variant="outline" className="font-mono text-primary border-primary/30 bg-primary/5">
                    {fmtNum(t.quantity)} {itemUnit(t.item_id)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{kitchenName(t.from_kitchen_id)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-primary" />
                    <span className="font-medium">{kitchenName(t.to_kitchen_id)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t.transferred_by}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{t.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setTfFrom(''); setTfTo(''); setTfItem(''); setTfQty(''); setTfBy(''); setTfNotes(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Transferência</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">De (Origem) *</label>
              <Select value={tfFrom} onValueChange={v => { setTfFrom(v); setTfItem(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o centro de custo" /></SelectTrigger>
                <SelectContent>{kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Para (Destino) *</label>
              <Select value={tfTo} onValueChange={setTfTo}>
                <SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                <SelectContent>{kitchens.filter(k => k.id !== tfFrom).map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Item *</label>
              <Select value={tfItem} onValueChange={setTfItem}>
                <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                <SelectContent>
                  {items
                    .filter(i => !tfFrom || getLocStock(i.id, tfFrom) > 0)
                    .map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                        {tfFrom ? <span className="text-muted-foreground"> · {getLocStock(i.id, tfFrom)} {i.unit}</span> : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {tfItem && tfFrom && (
                <p className="text-xs text-muted-foreground mt-1">
                  Disponível em {kitchenName(tfFrom)}: <strong>{getLocStock(tfItem, tfFrom)} {itemUnit(tfItem)}</strong>
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Quantidade *</label>
              <Input type="text" inputMode="decimal" value={tfQty} onChange={e => setTfQty(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Responsável *</label>
              <Input value={tfBy} onChange={e => setTfBy(e.target.value)} placeholder="Nome de quem transferiu" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Observação</label>
              <Input value={tfNotes} onChange={e => setTfNotes(e.target.value)} placeholder="Ex: Urgente para evento" />
            </div>
            <Button className="w-full" onClick={handleTransfer} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
              Confirmar Transferência
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
