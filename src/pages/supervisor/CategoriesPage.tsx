import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Package, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES as DEFAULT_CATEGORIES } from '@/types/inventory';
import * as XLSX from 'xlsx';

type Item = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
};

type CategorySummary = {
  name: string;
  itemCount: number;
  totalStock: number;
  totalValue: number;
};

export default function CategoriesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const load = async () => {
    const { data } = await supabase.from('stock_items').select('id, name, category, unit, current_stock, min_stock, unit_cost').order('name');
    if (data) {
      setItems(data);
      // Get unique categories from items + defaults
      const usedCats = [...new Set(data.map(i => i.category))];
      const allCats = [...new Set([...DEFAULT_CATEGORIES, ...usedCats])];
      setCategories(allCats);
    }
  };

  useEffect(() => { load(); }, []);

  const summaries: CategorySummary[] = categories.map(cat => {
    const catItems = items.filter(i => i.category === cat);
    return {
      name: cat,
      itemCount: catItems.length,
      totalStock: catItems.reduce((s, i) => s + i.current_stock, 0),
      totalValue: catItems.reduce((s, i) => s + i.current_stock * i.unit_cost, 0),
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  const totalValue = summaries.reduce((s, c) => s + c.totalValue, 0);

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) { toast.error('Nome é obrigatório'); return; }
    if (categories.includes(name)) { toast.error('Categoria já existe'); return; }
    setCategories(prev => [...prev, name]);
    toast.success(`Categoria "${name}" criada!`);
    setNewCategoryName('');
    setDialogOpen(false);
  };

  const handleRenameCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || !editingCategory) return;
    if (categories.includes(name)) { toast.error('Categoria já existe'); return; }

    // Update all items with this category
    const { error } = await supabase.from('stock_items').update({ category: name } as any).eq('category', editingCategory);
    if (error) { toast.error('Erro ao renomear'); return; }

    toast.success(`Categoria renomeada para "${name}"`);
    setNewCategoryName('');
    setEditingCategory(null);
    setDialogOpen(false);
    load();
  };

  const handleDeleteCategory = async (cat: string) => {
    const catItems = items.filter(i => i.category === cat);
    if (catItems.length > 0) {
      toast.error(`Não é possível excluir: ${catItems.length} itens nessa categoria`);
      return;
    }
    setCategories(prev => prev.filter(c => c !== cat));
    toast.success(`Categoria "${cat}" removida`);
  };

  const exportExcel = () => {
    const rows = items.map(i => ({
      'Nome': i.name,
      'Categoria': i.category,
      'Unidade': i.unit,
      'Estoque Atual': i.current_stock,
      'Estoque Mínimo': i.min_stock,
      'Custo Unitário': i.unit_cost,
      'Valor em Estoque': Math.round(i.current_stock * i.unit_cost * 100) / 100,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `estoque_rondello_${date}.xlsx`);
    toast.success('Planilha de estoque exportada!');
  };

  const CATEGORY_EMOJIS: Record<string, string> = {
    'Carnes': '🥩', 'Bebidas': '🥤', 'Frios': '🧀', 'Hortifruti': '🥬',
    'Secos': '🌾', 'Descartáveis': '🥤', 'Limpeza': '🧹', 'Outros': '📦',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Categorias</h1>
          <p className="text-muted-foreground mt-1">
            {categories.length} categorias · Valor total: <span className="text-primary font-semibold">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <DollarSign className="w-4 h-4 mr-2" />Exportar Estoque
          </Button>
          <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setEditingCategory(null); setNewCategoryName(''); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nova Categoria</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Renomear Categoria' : 'Nova Categoria'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  autoFocus
                />
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={editingCategory ? handleRenameCategory : handleAddCategory}>
                    {editingCategory ? 'Renomear' : 'Criar'}
                  </Button>
                  <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingCategory(null); }}>Cancelar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map(cat => (
          <Card key={cat.name} className="glass-card border-0 animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{CATEGORY_EMOJIS[cat.name] || '📦'}</span>
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{cat.name}</h3>
                    <p className="text-xs text-muted-foreground">{cat.itemCount} {cat.itemCount === 1 ? 'item' : 'itens'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCategory(cat.name); setNewCategoryName(cat.name); setDialogOpen(true); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteCategory(cat.name)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-accent rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Em Estoque</p>
                  <p className="text-lg font-bold text-foreground">{cat.totalStock.toLocaleString('pt-BR')}</p>
                </div>
                <div className="bg-accent rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Valor</p>
                  <p className="text-lg font-bold text-primary">R$ {cat.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
