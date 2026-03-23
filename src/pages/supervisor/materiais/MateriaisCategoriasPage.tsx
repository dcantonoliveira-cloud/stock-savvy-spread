import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FolderOpen, Plus, Pencil, Trash2, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

type Category = { id: string; name: string; sort_order: number };

export default function MateriaisCategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('material_categories' as any)
      .select('*')
      .order('sort_order')
      .order('name');
    if (data) setCategories(data as Category[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setName(''); setDialog(true); };
  const openEdit = (cat: Category) => { setEditing(cat); setName(cat.name); setDialog(true); };

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

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`Remover a categoria "${catName}"?`)) return;
    const { error } = await supabase.from('material_categories' as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    toast.success('Categoria removida');
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold gold-text">Categorias de Materiais</h1>
            <p className="text-muted-foreground mt-0.5">{categories.length} categoria{categories.length !== 1 ? 's' : ''} cadastrada{categories.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gold-button">
          <Plus className="w-4 h-4 mr-2" />Nova Categoria
        </Button>
      </div>

      {/* List */}
      {categories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhuma categoria cadastrada</p>
          <p className="text-sm mt-1">Crie categorias como "Louças", "Taças e Copos", "Rechauds"...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <ul className="divide-y divide-border/50">
            {categories.map((cat, idx) => (
              <li key={cat.id} className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50/30 transition-colors">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                <span className="w-6 text-xs text-muted-foreground text-center">{idx + 1}</span>
                <span className="flex-1 font-medium text-foreground">{cat.name}</span>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(cat)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleDelete(cat.id, cat.name)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dialog */}
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
