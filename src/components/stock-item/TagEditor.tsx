import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TagEditor({ itemId }: { itemId: string }) {
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [linked, setLinked] = useState<{ id: string; tag_id: string }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('tags').select('id, name, color').order('name'),
      (supabase.from('stock_item_tags') as any).select('id, tag_id').eq('item_id', itemId),
    ]).then(([tagsRes, linkedRes]) => {
      setAllTags((tagsRes.data || []) as any[]);
      setLinked((linkedRes.data || []) as any[]);
      setLoading(false);
    });
  }, [itemId]);

  const add = async (tagId: string) => {
    if (linked.some(l => l.tag_id === tagId)) return;
    const { data, error } = await (supabase.from('stock_item_tags') as any)
      .insert({ item_id: itemId, tag_id: tagId }).select('id, tag_id').single();
    if (error) { toast.error('Erro ao adicionar tag'); return; }
    setLinked(prev => [...prev, data]);
  };

  const remove = async (linkId: string) => {
    const { error } = await (supabase.from('stock_item_tags') as any).delete().eq('id', linkId);
    if (error) { toast.error('Erro ao remover tag'); return; }
    setLinked(prev => prev.filter(l => l.id !== linkId));
  };

  return (
    <div className="relative">
      <label className="text-sm text-muted-foreground mb-1 block">Tags</label>
      <div className="flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-md min-h-[42px]">
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
          <>
            {linked.map(l => {
              const tag = allTags.find(t => t.id === l.tag_id);
              if (!tag) return null;
              return (
                <span key={l.id} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                  style={{ background: tag.color + '20', color: tag.color }}>
                  {tag.name}
                  <button type="button" onClick={() => remove(l.id)} className="hover:opacity-60">×</button>
                </span>
              );
            })}
            <button type="button" onClick={() => setShowPicker(v => !v)} className="text-xs text-muted-foreground hover:text-primary border border-dashed border-border rounded px-2 py-1">+ adicionar</button>
            {linked.length === 0 && <span className="text-muted-foreground/60 italic text-xs">Nenhuma tag</span>}
          </>
        )}
      </div>
      {showPicker && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg p-2 w-56 max-h-64 overflow-y-auto">
          {allTags.filter(t => !linked.some(l => l.tag_id === t.id)).map(t => (
            <button key={t.id} type="button" onClick={() => add(t.id)} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />{t.name}
            </button>
          ))}
          {allTags.filter(t => !linked.some(l => l.tag_id === t.id)).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhuma tag disponível</p>
          )}
          <button type="button" onClick={() => setShowPicker(false)} className="w-full text-center px-2 py-1 text-xs text-muted-foreground hover:text-foreground mt-1 border-t border-border pt-1.5">Fechar</button>
        </div>
      )}
    </div>
  );
}
