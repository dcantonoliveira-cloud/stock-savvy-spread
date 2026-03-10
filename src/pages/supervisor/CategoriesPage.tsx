import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, Trash2, DollarSign, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
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

const CATEGORY_EMOJIS: Record<string, string> = {
  'Carnes': '🥩', 'Bebidas': '🥤', 'Frios': '🧀', 'Hortifruti': '🥬',
  'Secos': '🌾', 'Descartáveis': '🥤', 'Limpeza': '🧹', 'Outros': '📦',
};

export default function CategoriesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const load = async () => {
    const [itemsRes, catsRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, category, unit, current_stock, min_stock, unit_cost').order('name'),
      supabase.from('categories').select('name').order('name'),
    ]);
    
    const dbCats = (catsRes.data || []).map((c: any) => c.name);
    const usedCats = itemsRes.data ? [...new Set((itemsRes.data as any[]).map(i => i.category))] : [];
    const allCats = [...new Set([...dbCats, ...usedCats])];
    
    if (itemsRes.data) setItems(itemsRes.data);
    setCategories(allCats);
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

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) { toast.error('Nome é obrigatório'); return; }
    if (categories.includes(name)) { toast.error('Categoria já existe'); return; }
    
    // Persist to categories table
    const { error } = await supabase.from('categories').insert({ name } as any);
    if (error) { toast.error('Erro ao criar categoria'); return; }
    
    toast.success(`Categoria "${name}" criada!`);
    setNewCategoryName('');
    setDialogOpen(false);
    load();
  };

  const handleRenameCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || !editingCategory) return;
    if (categories.includes(name)) { toast.error('Categoria já existe'); return; }
    
    // Update items and category record
    await supabase.from('stock_items').update({ category: name } as any).eq('category', editingCategory);
    await supabase.from('categories').update({ name } as any).eq('name', editingCategory);
    
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
    await supabase.from('categories').delete().eq('name', cat);
    toast.success(`Categoria "${cat}" removida`);
    load();
  };

  const exportExcel = () => {
    const rows = items.map(i => ({
      'Nome': i.name, 'Categoria': i.category, 'Unidade': i.unit,
      'Estoque Atual': i.current_stock, 'Estoque Mínimo': i.min_stock,
      'Custo Unitário': i.unit_cost,
      'Valor em Estoque': Math.round(i.current_stock * i.unit_cost * 100) / 100,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    XLSX.writeFile(wb, `estoque_rondello_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Planilha de estoque exportada!');
  };

  const navigateToCategory = (catName: string) => {
    navigate(`/items?category=${encodeURIComponent(catName)}`);
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
                <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nome da categoria" autoFocus />
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
          <Card
            key={cat.name}
            className="glass-card border-0 animate-fade-in cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all group"
            onClick={() => navigateToCategory(cat.name)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{CATEGORY_EMOJIS[cat.name] || '📦'}</span>
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{cat.name}</h3>
                    <p className="text-xs text-muted-foreground">{cat.itemCount} {cat.itemCount === 1 ? 'item' : 'itens'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCategory(cat.name); setNewCategoryName(cat.name); setDialogOpen(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteCategory(cat.name)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
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
