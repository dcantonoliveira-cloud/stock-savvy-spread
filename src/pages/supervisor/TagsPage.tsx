import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Tag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type TagRow = {
  id: string;
  name: string;
  color: string;
  created_at: string;
  usageCount?: number;
};

const PRESET_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#ec4899', '#8b5cf6', '#f97316',
];

export default function TagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagRow | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tagsRes, usageRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('technical_sheet_items').select('tag_id').not('tag_id', 'is', null),
    ]);
    const usageMap: Record<string, number> = {};
    (usageRes.data || []).forEach((r: any) => {
      if (r.tag_id) usageMap[r.tag_id] = (usageMap[r.tag_id] || 0) + 1;
    });
    const rows = (tagsRes.data || []).map((t: any) => ({
      ...t,
      usageCount: usageMap[t.id] || 0,
    })) as TagRow[];
    setTags(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor(PRESET_COLORS[0]);
    setDialogOpen(true);
  };

  const openEdit = (tag: TagRow) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = tagName.trim();
    if (!name) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    if (editingTag) {
      const { error } = await supabase.from('tags').update({ name, color: tagColor } as any).eq('id', editingTag.id);
      if (error) { toast.error('Erro ao salvar: ' + error.message); setSaving(false); return; }
      toast.success('Tag atualizada!');
    } else {
      const { error } = await supabase.from('tags').insert({ name, color: tagColor } as any);
      if (error) { toast.error('Erro ao criar tag: ' + error.message); setSaving(false); return; }
      toast.success(`Tag "${name}" criada!`);
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (tag: TagRow) => {
    if ((tag.usageCount || 0) > 0) {
      toast.error(`Não é possível excluir: tag usada em ${tag.usageCount} ingrediente(s)`);
      return;
    }
    if (!confirm(`Remover a tag "${tag.name}"?`)) return;
    const { error } = await supabase.from('tags').delete().eq('id', tag.id);
    if (error) { toast.error('Erro ao remover: ' + error.message); return; }
    toast.success('Tag removida!');
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
          <h1 className="text-3xl font-display font-bold gold-text">Tags</h1>
          <p className="text-muted-foreground mt-1">
            {tags.length} tags cadastradas · usadas em ingredientes de fichas técnicas
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />Nova Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="py-24 text-center">
          <Tag className="w-12 h-12 mx-auto mb-4 opacity-20 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Nenhuma tag criada ainda.</p>
          <p className="text-muted-foreground text-xs mt-1">Tags servem para classificar ingredientes nas fichas técnicas.</p>
          <Button className="mt-6" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Criar primeira tag</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tags.map(tag => (
            <div key={tag.id} className="bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                  <span className="font-semibold text-foreground">{tag.name}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(tag)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleDelete(tag)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
              <Badge
                style={{ background: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
                variant="outline"
                className="text-xs font-medium"
              >
                {tag.usageCount} uso{tag.usageCount !== 1 ? 's' : ''}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Editar Tag' : 'Nova Tag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nome *</label>
              <Input
                value={tagName}
                onChange={e => setTagName(e.target.value)}
                placeholder="Ex: Fábrica, Evento, Salão..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setTagColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${tagColor === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'}`}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full" style={{ background: tagColor }} />
                  <span className="text-sm font-medium" style={{ color: tagColor }}>{tagName || 'Preview'}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingTag ? 'Salvar' : 'Criar'}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
