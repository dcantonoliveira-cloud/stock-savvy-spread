import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ResponsibleEditor({ itemId, allProfiles, allGroups }: {
  itemId: string;
  allProfiles: { user_id: string; display_name: string }[];
  allGroups: { id: string; name: string }[];
}) {
  const [resp, setResp] = useState<{ id: string; user_id: string | null; group_id: string | null }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase.from('stock_item_responsibles') as any).select('id, user_id, group_id').eq('item_id', itemId)
      .then(({ data }: any) => { setResp(data || []); setLoading(false); });
  }, [itemId]);

  const add = async (value: string) => {
    const user_id = value.startsWith('user:') ? value.slice(5) : null;
    const group_id = value.startsWith('group:') ? value.slice(6) : null;
    if (resp.some(r => r.user_id === user_id && r.group_id === group_id)) return;
    const { data, error } = await (supabase.from('stock_item_responsibles') as any)
      .insert({ item_id: itemId, user_id, group_id }).select('id, user_id, group_id').single();
    if (error) { toast.error('Erro ao adicionar responsável'); return; }
    setResp(prev => [...prev, data]);
  };

  const remove = async (id: string) => {
    const { error } = await (supabase.from('stock_item_responsibles') as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao remover responsável'); return; }
    setResp(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="relative">
      <label className="text-sm text-muted-foreground mb-1 block">Responsáveis pelo inventário</label>
      <div className="flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-md min-h-[42px]">
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
          <>
            {resp.map(r => {
              const label = r.user_id
                ? allProfiles.find(p => p.user_id === r.user_id)?.display_name
                : allGroups.find(g => g.id === r.group_id)?.name;
              return (
                <span key={r.id} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                  {r.group_id && '👥 '}{label || '—'}
                  <button type="button" onClick={() => remove(r.id)} className="hover:text-red-600">×</button>
                </span>
              );
            })}
            <button type="button" onClick={() => setShowPicker(v => !v)} className="text-xs text-muted-foreground hover:text-primary border border-dashed border-border rounded px-2 py-1">+ adicionar</button>
            {resp.length === 0 && <span className="text-muted-foreground/60 italic text-xs">Nenhum responsável definido</span>}
          </>
        )}
      </div>
      {showPicker && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg p-2 w-64 max-h-64 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase text-muted-foreground/60 px-1 mb-1">Grupos</p>
          {allGroups.map(g => <button key={g.id} type="button" onClick={() => add(`group:${g.id}`)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted">👥 {g.name}</button>)}
          <p className="text-[10px] font-bold uppercase text-muted-foreground/60 px-1 mb-1 mt-2">Pessoas</p>
          {allProfiles.map(p => <button key={p.user_id} type="button" onClick={() => add(`user:${p.user_id}`)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted">{p.display_name}</button>)}
          <button type="button" onClick={() => setShowPicker(false)} className="w-full text-center px-2 py-1 text-xs text-muted-foreground hover:text-foreground mt-1 border-t border-border pt-1.5">Fechar</button>
        </div>
      )}
    </div>
  );
}
