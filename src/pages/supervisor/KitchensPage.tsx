import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ArrowRightLeft, Building2, Package } from 'lucide-react';
import { toast } from 'sonner';

type Kitchen = { id: string; name: string; created_at: string };
type StockItem = { id: string; name: string; unit: string; category: string; current_stock: number };
type Location = { id: string; item_id: string; kitchen_id: string; current_stock: number };
type Transfer = {
  id: string; item_id: string; from_kitchen_id: string; to_kitchen_id: string;
  quantity: number; transferred_by: string; notes: string | null; date: string; created_at: string;
};

export default function KitchensPage() {
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  const [kitchenDialog, setKitchenDialog] = useState(false);
  const [editingKitchen, setEditingKitchen] = useState<Kitchen | null>(null);
  const [kitchenName, setKitchenName] = useState('');

  const [transferDialog, setTransferDialog] = useState(false);
  const [tfFromKitchen, setTfFromKitchen] = useState('');
  const [tfToKitchen, setTfToKitchen] = useState('');
  const [tfItem, setTfItem] = useState('');
  const [tfQuantity, setTfQuantity] = useState('');
  const [tfBy, setTfBy] = useState('');
  const [tfNotes, setTfNotes] = useState('');

  const load = async () => {
    const [k, i, l, t] = await Promise.all([
      supabase.from('kitchens').select('*').order('name'),
      supabase.from('stock_items').select('id, name, unit, category, current_stock').order('name'),
      supabase.from('stock_item_locations').select('*'),
      supabase.from('stock_transfers').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (k.data) setKitchens(k.data as Kitchen[]);
    if (i.data) setItems(i.data);
    if (l.data) setLocations(l.data as Location[]);
    if (t.data) setTransfers(t.data as Transfer[]);
  };

  useEffect(() => { load(); }, []);

  const getLocationStock = (itemId: string, kitchenId: string) => {
    return locations.find(l => l.item_id === itemId && l.kitchen_id === kitchenId)?.current_stock ?? 0;
  };

  const handleSaveKitchen = async () => {
    const name = kitchenName.trim();
    if (!name) { toast.error('Nome é obrigatório'); return; }

    if (editingKitchen) {
      const { error } = await supabase.from('kitchens').update({ name } as any).eq('id', editingKitchen.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Cozinha atualizada!');
    } else {
      const { error } = await supabase.from('kitchens').insert({ name } as any);
      if (error) { toast.error('Erro ao criar'); return; }
      toast.success('Cozinha criada!');
    }
    setKitchenDialog(false);
    setEditingKitchen(null);
    setKitchenName('');
    load();
  };

  const handleDeleteKitchen = async (id: string) => {
    const kitchenLocations = locations.filter(l => l.kitchen_id === id && l.current_stock > 0);
    if (kitchenLocations.length > 0) {
      toast.error('Transfira todo o estoque antes de remover esta cozinha');
      return;
    }
    const { error } = await supabase.from('kitchens').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    toast.success('Cozinha removida!');
    load();
  };

  const handleTransfer = async () => {
    if (!tfFromKitchen || !tfToKitchen || !tfItem || !tfQuantity || !tfBy.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (tfFromKitchen === tfToKitchen) {
      toast.error('Origem e destino devem ser diferentes');
      return;
    }
    const qty = parseFloat(tfQuantity);
    if (!qty || qty <= 0) { toast.error('Quantidade inválida'); return; }

    const currentFromStock = getLocationStock(tfItem, tfFromKitchen);
    if (qty > currentFromStock) {
      toast.error(`Estoque insuficiente na origem (disponível: ${currentFromStock})`);
      return;
    }

    // Record the transfer
    const { error: tfError } = await supabase.from('stock_transfers').insert({
      item_id: tfItem,
      from_kitchen_id: tfFromKitchen,
      to_kitchen_id: tfToKitchen,
      quantity: qty,
      transferred_by: tfBy.trim(),
      notes: tfNotes.trim() || null,
    } as any);
    if (tfError) { toast.error('Erro ao registrar transferência'); return; }

    // Update origin: subtract
    const fromLoc = locations.find(l => l.item_id === tfItem && l.kitchen_id === tfFromKitchen);
    if (fromLoc) {
      await supabase.from('stock_item_locations')
        .update({ current_stock: fromLoc.current_stock - qty } as any)
        .eq('id', fromLoc.id);
    }

    // Update destination: add or create
    const toLoc = locations.find(l => l.item_id === tfItem && l.kitchen_id === tfToKitchen);
    if (toLoc) {
      await supabase.from('stock_item_locations')
        .update({ current_stock: toLoc.current_stock + qty } as any)
        .eq('id', toLoc.id);
    } else {
      await supabase.from('stock_item_locations').insert({
        item_id: tfItem,
        kitchen_id: tfToKitchen,
        current_stock: qty,
      } as any);
    }

    toast.success('Transferência realizada com sucesso!');
    setTransferDialog(false);
    setTfFromKitchen('');
    setTfToKitchen('');
    setTfItem('');
    setTfQuantity('');
    setTfBy('');
    setTfNotes('');
    load();
  };

  const kitchenName_fn = (id: string) => kitchens.find(k => k.id === id)?.name || '—';
  const itemName_fn = (id: string) => items.find(i => i.id === id)?.name || '—';
  const itemUnit_fn = (id: string) => items.find(i => i.id === id)?.unit || '';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Cozinhas</h1>
          <p className="text-muted-foreground mt-1">{kitchens.length} unidades cadastradas</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={transferDialog} onOpenChange={o => { setTransferDialog(o); }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowRightLeft className="w-4 h-4 mr-2" />Transferir
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Transferência entre Cozinhas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">De (Origem) *</label>
                  <Select value={tfFromKitchen} onValueChange={setTfFromKitchen}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {kitchens.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Para (Destino) *</label>
                  <Select value={tfToKitchen} onValueChange={setTfToKitchen}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {kitchens.filter(k => k.id !== tfFromKitchen).map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Item *</label>
                  <Select value={tfItem} onValueChange={setTfItem}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {items.map(i => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} {tfFromKitchen ? `(${getLocationStock(i.id, tfFromKitchen)} ${i.unit})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Quantidade *</label>
                  <Input type="number" value={tfQuantity} onChange={e => setTfQuantity(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Responsável *</label>
                  <Input value={tfBy} onChange={e => setTfBy(e.target.value)} placeholder="Nome de quem transferiu" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Observação</label>
                  <Input value={tfNotes} onChange={e => setTfNotes(e.target.value)} placeholder="Ex: Urgente para evento" />
                </div>
                <Button className="w-full" onClick={handleTransfer}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />Confirmar Transferência
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={kitchenDialog} onOpenChange={o => { setKitchenDialog(o); if (!o) { setEditingKitchen(null); setKitchenName(''); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nova Cozinha</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{editingKitchen ? 'Editar Cozinha' : 'Nova Cozinha'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  value={kitchenName}
                  onChange={e => setKitchenName(e.target.value)}
                  placeholder="Nome da cozinha"
                  autoFocus
                />
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={handleSaveKitchen}>
                    {editingKitchen ? 'Salvar' : 'Criar'}
                  </Button>
                  <Button variant="outline" onClick={() => { setKitchenDialog(false); setEditingKitchen(null); }}>Cancelar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kitchens grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {kitchens.map(kitchen => {
          const kitchenLocs = locations.filter(l => l.kitchen_id === kitchen.id);
          const totalItems = kitchenLocs.filter(l => l.current_stock > 0).length;
          const totalUnits = kitchenLocs.reduce((s, l) => s + l.current_stock, 0);
          return (
            <Card key={kitchen.id} className="glass-card border-0 animate-fade-in">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{kitchen.name}</h3>
                      <p className="text-xs text-muted-foreground">{totalItems} itens em estoque</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingKitchen(kitchen); setKitchenName(kitchen.name); setKitchenDialog(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteKitchen(kitchen.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="bg-accent rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total em Estoque</p>
                  <p className="text-lg font-bold text-foreground">{totalUnits.toLocaleString('pt-BR')}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {kitchens.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Building2 className="w-16 h-16 mx-auto mb-3 opacity-30" />
            <p>Nenhuma cozinha cadastrada. Crie a primeira!</p>
          </div>
        )}
      </div>

      {/* Recent transfers */}
      {transfers.length > 0 && (
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">Últimas Transferências</h2>
          <div className="space-y-2">
            {transfers.map(t => (
              <div key={t.id} className="glass-card rounded-xl p-4 flex items-center gap-4 animate-fade-in">
                <ArrowRightLeft className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {itemName_fn(t.item_id)} — <span className="text-primary">{t.quantity} {itemUnit_fn(t.item_id)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {kitchenName_fn(t.from_kitchen_id)} → {kitchenName_fn(t.to_kitchen_id)} · Por: {t.transferred_by}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {new Date(t.created_at).toLocaleDateString('pt-BR')}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
