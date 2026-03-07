import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Carnes', 'Bebidas', 'Frios', 'Hortifruti', 'Secos', 'Descartáveis', 'Limpeza', 'Outros'];
const UNITS = ['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct', 'lata', 'garrafa'];

type Item = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
};

function ItemForm({ item, onSave, onCancel }: { item?: Item; onSave: (i: Partial<Item> & { name: string; category: string; unit: string }) => void; onCancel: () => void }) {
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || CATEGORIES[0]);
  const [unit, setUnit] = useState(item?.unit || UNITS[0]);
  const [currentStock, setCurrentStock] = useState(item?.current_stock?.toString() || '0');
  const [minStock, setMinStock] = useState(item?.min_stock?.toString() || '0');
  const [unitCost, setUnitCost] = useState(item?.unit_cost?.toString() || '0');

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    onSave({
      ...(item?.id ? { id: item.id } : {}),
      name: name.trim(), category, unit,
      current_stock: parseFloat(currentStock) || 0,
      min_stock: parseFloat(minStock) || 0,
      unit_cost: parseFloat(unitCost) || 0,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Nome do Item</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Filé Mignon" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Categoria</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Unidade</label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Estoque Atual</label>
          <Input type="number" value={currentStock} onChange={e => setCurrentStock(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Estoque Mínimo</label>
          <Input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Custo Unit. (R$)</label>
          <Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSubmit} className="flex-1">Salvar</Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function StockItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | undefined>();
  const [filterCategory, setFilterCategory] = useState('all');

  const load = async () => {
    const { data } = await supabase.from('stock_items').select('*').order('name');
    if (data) setItems(data);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || i.category === filterCategory;
    return matchSearch && matchCat;
  });

  const totalValue = filtered.reduce((s, i) => s + i.current_stock * i.unit_cost, 0);

  const handleSave = async (item: Partial<Item> & { name: string; category: string; unit: string }) => {
    if (item.id) {
      const { error } = await supabase.from('stock_items').update(item).eq('id', item.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Item atualizado!');
    } else {
      const { error } = await supabase.from('stock_items').insert(item);
      if (error) { toast.error('Erro ao cadastrar'); return; }
      toast.success('Item cadastrado!');
    }
    load();
    setDialogOpen(false);
    setEditingItem(undefined);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('stock_items').delete().eq('id', id);
    if (error) toast.error('Erro ao remover');
    else { toast.success('Item removido!'); load(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Estoque</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus itens · Valor total: <span className="text-primary font-semibold">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditingItem(undefined); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
            </DialogHeader>
            <ItemForm item={editingItem} onSave={handleSave} onCancel={() => { setDialogOpen(false); setEditingItem(undefined); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar item..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map(item => (
          <div key={item.id} className="glass-card rounded-xl p-4 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full ${item.current_stock <= item.min_stock ? 'bg-warning' : 'bg-success'}`} />
              <div>
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category} · {item.unit}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-lg font-semibold text-foreground">{item.current_stock} <span className="text-xs text-muted-foreground">{item.unit}</span></p>
                <p className="text-xs text-muted-foreground">R$ {(item.current_stock * item.unit_cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
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
    </div>
  );
}
