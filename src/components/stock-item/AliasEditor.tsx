import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AliasEditor({ itemId }: { itemId: string }) {
  const [aliases, setAliases] = useState<{ id: string; alias: string }[]>([]);
  const [newAlias, setNewAlias] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase.from('stock_item_aliases') as any).select('id, alias').eq('item_id', itemId).order('alias')
      .then(({ data }: any) => { setAliases(data || []); setLoading(false); });
  }, [itemId]);

  const add = async () => {
    const alias = newAlias.trim();
    if (!alias) return;
    if (aliases.some(a => a.alias.toLowerCase() === alias.toLowerCase())) { setNewAlias(''); return; }
    const { data, error } = await (supabase.from('stock_item_aliases') as any)
      .insert({ item_id: itemId, alias }).select('id, alias').single();
    if (error) { toast.error('Erro ao adicionar apelido'); return; }
    setAliases(prev => [...prev, data]);
    setNewAlias('');
  };

  const remove = async (id: string) => {
    const { error } = await (supabase.from('stock_item_aliases') as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao remover apelido'); return; }
    setAliases(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div>
      <label className="text-sm text-muted-foreground mb-1 block">
        Apelidos (nomes usados em notas fiscais)
        <span className="ml-1 text-xs text-muted-foreground/70">— facilita o cruzamento automático na entrada de NF</span>
      </label>
      <div className="flex flex-wrap items-center gap-1.5 p-2 border border-border rounded-md min-h-[42px]">
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
          <>
            {aliases.map(a => (
              <span key={a.id} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-sky-50 text-sky-700">
                {a.alias}
                <button type="button" onClick={() => remove(a.id)} className="hover:text-red-600">×</button>
              </span>
            ))}
            {aliases.length === 0 && <span className="text-muted-foreground/60 italic text-xs">Nenhum apelido cadastrado</span>}
          </>
        )}
      </div>
      <div className="flex gap-2 mt-1.5">
        <Input
          value={newAlias}
          onChange={e => setNewAlias(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Ex: QDO MUSSARELA BUFALA 1KG"
          className="h-8 text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} className="h-8 text-xs">Adicionar</Button>
      </div>
    </div>
  );
}
