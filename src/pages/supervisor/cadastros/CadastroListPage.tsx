import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, Search, X, Check, Merge } from 'lucide-react';
import { toast } from 'sonner';

interface Config {
  title: string;
  table: string;
  typeFilter?: { column: string; value: string };
  namePlaceholder?: string;
  columns?: { key: string; label: string }[];
  /** Habilita botão de mesclar. Passa a tabela que referencia este cadastro e o nome da coluna FK. */
  merge?: { refTable: string; refColumn: string };
}

export default function CadastroListPage({
  title,
  table,
  typeFilter,
  namePlaceholder = 'Nome...',
  columns = [{ key: 'name', label: 'Nome' }],
  merge,
}: Config) {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mergeTarget, setMergeTarget] = useState<any | null>(null);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');

  const load = async () => {
    setLoading(true);
    let q = supabase.from(table as any).select('id, name, created_at').order('name');
    if (typeFilter) q = (q as any).eq(typeFilter.column, typeFilter.value);
    const { data, error } = await q;
    if (error) toast.error('Erro ao carregar: ' + error.message);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r =>
    (r.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const add = async () => {
    if (!newName.trim()) return;
    const payload: any = { name: newName.trim() };
    if (typeFilter) payload[typeFilter.column] = typeFilter.value;
    const { error } = await supabase.from(table as any).insert(payload);
    if (error) { toast.error('Erro: ' + error.message); return; }
    setNewName('');
    setAdding(false);
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

  const fmtDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const doMerge = async () => {
    if (!mergeTarget || mergeSelected.size === 0) return;
    setMerging(true);
    const ids = Array.from(mergeSelected);
    const { error } = await supabase
      .from(merge!.refTable as any)
      .update({ [merge!.refColumn]: mergeTarget.id } as any)
      .in(merge!.refColumn, ids);
    if (error) { toast.error('Erro ao mesclar: ' + error.message); setMerging(false); return; }
    for (const id of ids) {
      await supabase.from(table as any).delete().eq('id', id);
    }
    toast.success(`${ids.length} local(is) mesclado(s) em "${mergeTarget.name}"`);
    setMergeTarget(null);
    setMergeSelected(new Set());
    setMerging(false);
    load();
  };

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Modal de merge */}
      {mergeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setMergeTarget(null); setMergeSelected(new Set()); setMergeSearch(''); }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-1">Mesclar em "{mergeTarget.name}"</h3>
            <p className="text-xs text-muted-foreground mb-3">Selecione os locais duplicados que serão substituídos por este. Os eventos vinculados a eles serão atualizados automaticamente.</p>
            <input
              autoFocus
              type="text"
              value={mergeSearch}
              onChange={e => setMergeSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full h-8 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 mb-3"
            />
            <div className="space-y-1.5 max-h-56 overflow-y-auto mb-5">
              {rows.filter(r => r.id !== mergeTarget.id && r.name.toLowerCase().includes(mergeSearch.toLowerCase())).map(r => (
                <label key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mergeSelected.has(r.id)}
                    onChange={e => {
                      setMergeSelected(prev => {
                        const n = new Set(prev);
                        e.target.checked ? n.add(r.id) : n.delete(r.id);
                        return n;
                      });
                    }}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-medium">{r.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setMergeTarget(null); setMergeSelected(new Set()); setMergeSearch(''); }}
                className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={doMerge} disabled={mergeSelected.size === 0 || merging}
                className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {merging ? 'Mesclando...' : `Mesclar (${mergeSelected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Buscar em ${title.toLowerCase()}...`}
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>

        <button
          onClick={() => { setAdding(true); setNewName(''); }}
          className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <div className="bg-white border border-border rounded-xl px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{rows.length}</p>
        </div>
        {search && (
          <div className="bg-white border border-border rounded-xl px-4 py-2.5">
            <p className="text-[11px] text-muted-foreground">Filtrados</p>
            <p className="text-lg font-bold text-primary">{filtered.length}</p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left w-8">
                #
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left">
                NOME
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left w-32">
                CADASTRADO EM
              </th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {/* New row inline */}
            {adding && (
              <tr className="border-b border-border/50 bg-primary/3">
                <td className="px-4 py-2 text-muted-foreground text-xs">{rows.length + 1}</td>
                <td className="px-4 py-2">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }}
                    placeholder={namePlaceholder}
                    className="w-full h-8 px-3 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </td>
                <td className="px-4 py-2 text-muted-foreground text-xs">Hoje</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={add} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setAdding(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-4 py-3"><div className="h-3 w-4 bg-muted/40 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 bg-muted/40 rounded animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} /></td>
                  <td className="px-4 py-3"><div className="h-3 w-16 bg-muted/40 rounded animate-pulse" /></td>
                  <td />
                </tr>
              ))
            ) : filtered.length === 0 && !adding ? (
              <tr>
                <td colSpan={4} className="py-20 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 group transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null); }}
                        className="w-full h-8 px-3 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    ) : (
                      <span className="font-medium text-foreground">{row.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {editId === row.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={saveEdit} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {merge && (
                          <button
                            onClick={() => { setMergeTarget(row); setMergeSelected(new Set()); setMergeSearch(''); }}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors"
                            title="Mesclar duplicados neste"
                          >
                            <Merge className="w-3.5 h-3.5" />
                          </button>
                        )}
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
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
