import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FolderOpen, Plus, Pencil, Trash2, Loader2, Search, ArrowLeft, Package } from 'lucide-react';
import { toast } from 'sonner';

type Category = { id: string; name: string; sort_order: number; item_count?: number };

type MaterialItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  total_qty: number;
  available_qty: number;
  damaged_qty: number;
  unit: string;
  image_url: string | null;
};

export default function MateriaisCategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Dialog state
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [catsRes, itemsRes] = await Promise.all([
      supabase.from('material_categories' as any).select('*').order('name'),
      supabase.from('material_items' as any).select('id, name, category, description, total_qty, available_qty, damaged_qty, unit, image_url').order('name'),
    ]);

    const cats = (catsRes.data as Category[] | null) ?? [];
    const allItems = (itemsRes.data as MaterialItem[] | null) ?? [];

    // Enrich with item count
    const enriched = cats.map(c => ({
      ...c,
      item_count: allItems.filter(i => i.category === c.name).length,
    }));

    setCategories(enriched);
    setItems(allItems);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setName(''); setDialog(true); };
  const openEdit = (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(cat);
    setName(cat.name);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('material_categories' as any).update({ name: name.trim() }).eq('id', editing.id);
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
      toast.success('Categoria atualizada!');
    } else {
      const { error } = await supabase.from('material_categories' as any).insert({ name: name.trim(), sort_order: categories.length });
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
      toast.success('Categoria criada!');
    }
    setSaving(false);
    setDialog(false);
    load();
  };

  const handleDelete = async (id: string, catName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remover a categoria "${catName}"? Os itens associados não serão excluídos.`)) return;
    const { error } = await supabase.from('material_categories' as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    toast.success('Categoria removida');
    if (selectedCategory?.id === id) setSelectedCategory(null);
    load();
  };

  const filtered = categories.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  // ── Category detail view ──────────────────────────────────────────────────
  if (selectedCategory) {
    const catItems = items.filter(i => i.category === selectedCategory.name);
    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-display font-bold gold-text leading-tight">{selectedCategory.name}</h1>
            <p className="text-muted-foreground text-sm">
              {catItems.length} {catItems.length === 1 ? 'item' : 'itens'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={e => openEdit(selectedCategory, e)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar
          </Button>
        </div>

        {/* Items */}
        {catItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhum item nesta categoria</p>
            <p className="text-sm mt-1">Adicione itens em Inventário e associe a esta categoria</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Total</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Disponível</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Avariado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {catItems.map(item => (
                  <tr key={item.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{item.name}</p>
                          {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {item.total_qty} <span className="text-xs">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={item.available_qty === 0 ? 'text-destructive font-semibold' : 'text-foreground'}>
                        {item.available_qty} <span className="text-xs text-muted-foreground font-normal">{item.unit}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={item.damaged_qty > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                        {item.damaged_qty} <span className="text-xs">{item.unit}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit dialog reused */}
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome *</Label>
                <Input
                  className="mt-1"
                  placeholder="Ex: Louças, Taças e Copos..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="gold-button">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Category list view ────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold gold-text">Categorias de Materiais</h1>
            <p className="text-muted-foreground mt-0.5">
              {categories.length} categoria{categories.length !== 1 ? 's' : ''} cadastrada{categories.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gold-button">
          <Plus className="w-4 h-4 mr-2" />Nova Categoria
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Pesquisar categoria..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium">{search ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}</p>
          {!search && <p className="text-sm mt-1">Crie categorias como "Louças", "Taças e Copos", "Rechauds"...</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <ul className="divide-y divide-border/50">
            {filtered.map(cat => (
              <li
                key={cat.id}
                onClick={() => setSelectedCategory(cat)}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-amber-50/30 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-4 h-4 text-primary" />
                </div>
                <span className="flex-1 font-medium text-foreground">{cat.name}</span>
                <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full mr-1">
                  {cat.item_count ?? 0} {cat.item_count === 1 ? 'item' : 'itens'}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={e => openEdit(cat, e)}
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={e => handleDelete(cat.id, cat.name, e)}
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome *</Label>
              <Input
                className="mt-1"
                placeholder="Ex: Louças, Taças e Copos, Rechauds..."
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gold-button">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
