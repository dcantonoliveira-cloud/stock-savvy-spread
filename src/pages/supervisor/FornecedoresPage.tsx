import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Truck, Star, ChevronRight, Search } from 'lucide-react';

type Categoria = 'hortifruti' | 'proteinas' | 'bebidas' | 'descartaveis' | 'embalagens' | 'outros';
const CATEGORIAS: { value: Categoria | 'all'; label: string }[] = [
  { value: 'all',          label: 'Todos' },
  { value: 'hortifruti',   label: 'Hortifruti' },
  { value: 'proteinas',    label: 'Proteínas' },
  { value: 'bebidas',      label: 'Bebidas' },
  { value: 'descartaveis', label: 'Descartáveis' },
  { value: 'embalagens',   label: 'Embalagens' },
  { value: 'outros',       label: 'Outros' },
];

type FornecedorRow = {
  id: string;
  nome: string;
  categoria: string | null;
  status: string;
  telefone: string | null;
  email: string | null;
  itemCount: number;
  preferidoCount: number;
};

export default function FornecedoresPage() {
  const navigate = useNavigate();
  const [rows, setRows]       = useState<FornecedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: forn }, { data: items }] = await Promise.all([
      supabase.from('fornecedores' as any).select('id,nome,categoria,status,telefone,email').order('nome'),
      supabase.from('item_suppliers' as any).select('fornecedor_id,is_preferred').not('fornecedor_id', 'is', null),
    ]);

    const countMap: Record<string, { total: number; pref: number }> = {};
    for (const r of (items || []) as any[]) {
      const fid = r.fornecedor_id as string;
      if (!countMap[fid]) countMap[fid] = { total: 0, pref: 0 };
      countMap[fid].total++;
      if (r.is_preferred) countMap[fid].pref++;
    }

    setRows(((forn || []) as any[]).map(f => ({
      id:            f.id,
      nome:          f.nome,
      categoria:     f.categoria,
      status:        f.status,
      telefone:      f.telefone,
      email:         f.email,
      itemCount:     countMap[f.id]?.total ?? 0,
      preferidoCount: countMap[f.id]?.pref ?? 0,
    })));
    setLoading(false);
  };

  const filtered = rows.filter(r => {
    const matchSearch = !search || r.nome.toLowerCase().includes(search.toLowerCase());
    const matchCat    = catFilter === 'all' || r.categoria === catFilter;
    return matchSearch && matchCat;
  });

  const ativos   = filtered.filter(r => r.status === 'ativo');
  const inativos = filtered.filter(r => r.status !== 'ativo');

  const catLabel = (c: string | null) =>
    CATEGORIAS.find(x => x.value === c)?.label ?? '—';

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Fornecedores</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {rows.filter(r => r.status === 'ativo').length} ativo{rows.filter(r => r.status === 'ativo').length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => navigate('/fornecedores/novo')} className="flex-shrink-0 gap-2">
          <Plus className="w-4 h-4" />Novo Fornecedor
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fornecedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 max-w-xs"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIAS.map(c => (
            <button
              key={c.value}
              onClick={() => setCatFilter(c.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                catFilter === c.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-white text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground">FORNECEDOR</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">CATEGORIA</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">INSUMOS</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">PREFERIDO EM</th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground">STATUS</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {[45, 20, 10, 10, 10, 5].map((w, j) => (
                    <td key={j} className="px-5 py-3.5">
                      <div className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-muted-foreground">
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {search ? 'Nenhum resultado.' : 'Nenhum fornecedor cadastrado.'}
                </td>
              </tr>
            ) : [...ativos, ...inativos].map(r => (
              <tr
                key={r.id}
                className={`hover:bg-amber-50/40 transition-colors cursor-pointer ${r.status !== 'ativo' ? 'opacity-50' : ''}`}
                onClick={() => navigate(`/fornecedores/${r.id}`)}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{r.nome}</span>
                      {r.telefone && (
                        <p className="text-xs text-muted-foreground">{r.telefone}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground text-xs">
                  {r.categoria ? catLabel(r.categoria) : <span className="opacity-40">—</span>}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="font-medium">{r.itemCount}</span>
                  <span className="text-muted-foreground text-xs ml-1">item{r.itemCount !== 1 ? 's' : ''}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  {r.preferidoCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 text-xs font-medium px-2 py-0.5 rounded-full">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                      {r.preferidoCount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <Badge variant={r.status === 'ativo' ? 'default' : 'secondary'} className="text-xs">
                    {r.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground/40">
                  <ChevronRight className="w-4 h-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
