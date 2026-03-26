import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtNum } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, DollarSign, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

type Item = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
};

type CategoryRecord = {
  id: string; name: string; emoji: string | null;
};

type Subcategory = {
  id: string; name: string; category_id: string;
};

type CategorySummary = {
  id: string;
  name: string;
  emoji: string | null;
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
  const [categoryRecords, setCategoryRecords] = useState<CategoryRecord[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Subcategory dialog state
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subDialogCategoryId, setSubDialogCategoryId] = useState<string | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [subSaving, setSubSaving] = useState(false);

  const load = async () => {
    const [itemsRes, catsRes, subsRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, category, unit, current_stock, min_stock, unit_cost').order('name'),
      supabase.from('categories').select('id, name, emoji').order('name'),
      supabase.from('subcategories').select('id, name, category_id').order('name'),
    ]);

    const dbCats = (catsRes.data || []) as CategoryRecord[];
    const usedCatNames = itemsRes.data ? [...new Set((itemsRes.data as any[]).map(i => i.category))] : [];

    // Add used cats that might not be in categories table yet
    const existingNames = new Set(dbCats.map(c => c.name));
    const extraCats: CategoryRecord[] = usedCatNames
      .filter(n => !existingNames.has(n))
      .map(n => ({ id: n, name: n, emoji: null }));

    if (itemsRes.data) setItems(itemsRes.data);
    setCategoryRecords([...dbCats, ...extraCats]);
    setSubcategories((subsRes.data || []) as Subcategory[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const summaries: CategorySummary[] = categoryRecords.map(cat => {
    const catItems = items.filter(i => i.category === cat.name);
    return {
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji,
      itemCount: catItems.length,
      totalStock: catItems.reduce((s, i) => s + i.current_stock, 0),
      totalValue: catItems.reduce((s, i) => s + i.current_stock * i.unit_cost, 0),
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  const totalValue = summaries.reduce((s, c) => s + c.totalValue, 0);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) { toast.error('Nome é obrigatório'); return; }
    if (categoryRecords.some(c => c.name === name)) { toast.error('Categoria já existe'); return; }
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
    if (categoryRecords.some(c => c.name === name && c.name !== editingCategory)) { toast.error('Categoria já existe'); return; }
    await supabase.from('stock_items').update({ category: name } as any).eq('category', editingCategory);
    await supabase.from('categories').update({ name } as any).eq('name', editingCategory);
    toast.success(`Categoria renomeada para "${name}"`);
    setNewCategoryName('');
    setEditingCategory(null);
    setDialogOpen(false);
    load();
  };

  const handleDeleteCategory = async (cat: CategorySummary) => {
    const catItems = items.filter(i => i.category === cat.name);
    if (catItems.length > 0) {
      toast.error(`Não é possível excluir: ${catItems.length} itens nessa categoria`);
      return;
    }
    await supabase.from('categories').delete().eq('name', cat.name);
    toast.success(`Categoria "${cat.name}" removida`);
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
    navigate(`/categories/${encodeURIComponent(catName)}`);
  };

  const toggleExpand = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories(prev => {
      const n = new Set(prev);
      n.has(catId) ? n.delete(catId) : n.add(catId);
      return n;
    });
  };

  // Subcategory CRUD
  const openAddSubcategory = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubDialogCategoryId(categoryId);
    setEditingSubcategory(null);
    setNewSubcategoryName('');
    setSubDialogOpen(true);
  };

  const openEditSubcategory = (sub: Subcategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubDialogCategoryId(sub.category_id);
    setEditingSubcategory(sub);
    setNewSubcategoryName(sub.name);
    setSubDialogOpen(true);
  };

  const handleSaveSubcategory = async () => {
    const name = newSubcategoryName.trim();
    if (!name || !subDialogCategoryId) { toast.error('Nome é obrigatório'); return; }
    setSubSaving(true);
    if (editingSubcategory) {
      const { error } = await supabase.from('subcategories').update({ name } as any).eq('id', editingSubcategory.id);
      if (error) { toast.error('Erro ao salvar: ' + error.message); setSubSaving(false); return; }
      toast.success('Subcategoria atualizada!');
    } else {
      const { error } = await supabase.from('subcategories').insert({ name, category_id: subDialogCategoryId } as any);
      if (error) { toast.error('Erro ao criar: ' + error.message); setSubSaving(false); return; }
      toast.success(`Subcategoria "${name}" criada!`);
    }
    setSubSaving(false);
    setSubDialogOpen(false);
    load();
  };

  const handleDeleteSubcategory = async (sub: Subcategory, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remover subcategoria "${sub.name}"?`)) return;
    const { error } = await supabase.from('subcategories').delete().eq('id', sub.id);
    if (error) { toast.error('Erro ao remover: ' + error.message); return; }
    toast.success('Subcategoria removida!');
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Categorias</h1>
          <p className="text-muted-foreground mt-1">
            {summaries.length} categorias · Valor total: <span className="text-primary font-semibold">R$ {fmtNum(totalValue)}</span>
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
                <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nome da categoria" autoFocus onKeyDown={e => e.key === 'Enter' && (editingCategory ? handleRenameCategory() : handleAddCategory())} />
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

      <div className="rounded-xl border border-border overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
              <th className="text-left px-5 py-2.5 w-8">#</th>
              <th className="text-left px-3 py-2.5 w-6"></th>
              <th className="text-left px-3 py-2.5">CATEGORIA</th>
              <th className="text-center px-3 py-2.5">ITENS</th>
              <th className="text-right px-3 py-2.5">EM ESTOQUE</th>
              <th className="text-right px-3 py-2.5">VALOR TOTAL</th>
              <th className="text-right px-3 py-2.5">% DO TOTAL</th>
              <th className="text-center px-3 py-2.5 w-24">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((cat, idx) => {
              const catSubs = subcategories.filter(s => {
                const catRec = categoryRecords.find(c => c.name === cat.name);
                return catRec && s.category_id === catRec.id;
              });
              const isExpanded = expandedCategories.has(cat.id);
              return (
                <>
                  <tr
                    key={cat.name}
                    className={`hover:bg-amber-50 transition-colors cursor-pointer border-b border-border/50 ${isExpanded ? 'bg-amber-50/50' : ''}`}
                    onClick={() => navigateToCategory(cat.name)}
                  >
                    <td className="px-5 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                    <td className="px-2 py-3" onClick={e => toggleExpand(cat.id, e)}>
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />
                        }
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cat.emoji || CATEGORY_EMOJIS[cat.name] || '📦'}</span>
                        <span className="font-medium text-foreground">{cat.name}</span>
                        {catSubs.length > 0 && (
                          <Badge variant="outline" className="text-[10px] font-normal ml-1">
                            {catSubs.length} subcateg.
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-sm font-medium text-foreground">{cat.itemCount}</td>
                    <td className="px-3 py-3 text-right text-sm text-foreground">{fmtNum(cat.totalStock)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-amber-700">
                      R$ {fmtNum(cat.totalValue)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                      {totalValue > 0 ? `${((cat.totalValue / totalValue) * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-0.5">
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditingCategory(cat.name); setNewCategoryName(cat.name); setDialogOpen(true); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleDeleteCategory(cat)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Subcategories expanded row */}
                  {isExpanded && (
                    <tr key={`${cat.name}-subs`} className="bg-amber-50/30 border-b border-border/30">
                      <td colSpan={8} className="px-8 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subcategorias</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={e => {
                              const catRec = categoryRecords.find(c => c.name === cat.name);
                              if (catRec) openAddSubcategory(catRec.id, e);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />Subcategoria
                          </Button>
                        </div>
                        {catSubs.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Nenhuma subcategoria cadastrada.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {catSubs.map(sub => {
                              const subItemCount = items.filter(i => (i as any).subcategory_id === sub.id).length;
                              return (
                                <div
                                  key={sub.id}
                                  className="flex items-center gap-1.5 bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs"
                                >
                                  <span className="font-medium text-foreground">{sub.name}</span>
                                  <span className="text-muted-foreground">({subItemCount})</span>
                                  <button
                                    onClick={e => openEditSubcategory(sub, e)}
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={e => handleDeleteSubcategory(sub, e)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {summaries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground text-sm">
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            )}
          </tbody>
          {summaries.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td colSpan={5} className="px-5 py-2.5 text-xs font-semibold text-muted-foreground text-right">
                  Total em estoque:
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-amber-700">
                  R$ {fmtNum(totalValue)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Subcategory Dialog */}
      <Dialog open={subDialogOpen} onOpenChange={o => { if (!o) setSubDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? 'Editar Subcategoria' : 'Nova Subcategoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newSubcategoryName}
              onChange={e => setNewSubcategoryName(e.target.value)}
              placeholder="Nome da subcategoria"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveSubcategory()}
            />
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleSaveSubcategory} disabled={subSaving}>
                {subSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingSubcategory ? 'Salvar' : 'Criar'}
              </Button>
              <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
