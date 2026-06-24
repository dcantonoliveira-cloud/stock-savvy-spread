import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Config {
  title: string;
  table: string;
  typeFilter?: { column: string; value: string };
  namePlaceholder?: string;
}

const inputCls = 'h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

export default function CadastroListPage({ title, table, typeFilter, namePlaceholder = 'Nome...' }: Config) {
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from(table as any).select('id, name').order('name');
    if (typeFilter) q = (q as any).eq(typeFilter.column, typeFilter.value);
    const { data, error } = await q;
    if (error) toast.error('Erro ao carregar: ' + error.message);
    setRows((data ?? []) as { id: string; name: string }[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const add = async () => {
    if (!newName.trim()) return;
    const payload: any = { name: newName.trim() };
    if (typeFilter) payload[typeFilter.column] = typeFilter.value;
    const { error } = await supabase.from(table as any).insert(payload);
    if (error) { toast.error('Erro: ' + error.message); return; }
    setNewName('');
    toast.success('Adicionado!');
    load();
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return;
    const { error } = await supabase.from(table as any).update({ name: editName.trim() }).eq('id', editId);
    if (error) { toast.error('Erro: ' + error.message); return; }
    setEditId(null);
    toast.success('Salvo!');
    load();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}"?`)) return;
    const { error } = await supabase.from(table as any).delete().eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Removido!');
    load();
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>

      {/* Add new */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder={namePlaceholder}
          className={inputCls + ' flex-1'}
        />
        <button
          onClick={add}
          className="h-9 px-4 flex items-center gap-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar..."
          className={inputCls + ' w-full pl-9'}
        />
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(row => (
            <div key={row.id} className="flex items-center gap-2 px-4 py-3 bg-white border border-border rounded-xl group">
              {editId === row.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null); }}
                    className={inputCls + ' flex-1'}
                  />
                  <button onClick={saveEdit} className="h-8 px-3 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">Salvar</button>
                  <button onClick={() => setEditId(null)} className="h-8 px-3 text-xs border border-border rounded-lg hover:bg-muted">Cancelar</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{row.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditId(row.id); setEditName(row.name); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(row.id, row.name)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-4">{filtered.length} registros</p>
    </div>
  );
}
