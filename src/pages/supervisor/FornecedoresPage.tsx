import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Truck, Star, ChevronRight } from 'lucide-react';

type SupplierSummary = {
  name: string;
  itemCount: number;
  preferredCount: number;
};

export default function FornecedoresPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('item_suppliers')
      .select('supplier_name, is_preferred');

    const map: Record<string, { total: number; preferred: number }> = {};
    for (const row of (data || []) as any[]) {
      const n = row.supplier_name as string;
      if (!map[n]) map[n] = { total: 0, preferred: 0 };
      map[n].total++;
      if (row.is_preferred) map[n].preferred++;
    }

    const list = Object.entries(map)
      .map(([name, v]) => ({ name, itemCount: v.total, preferredCount: v.preferred }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setSuppliers(list);
    setLoading(false);
  };

  const filtered = suppliers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Fornecedores</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {suppliers.length} fornecedor{suppliers.length !== 1 ? 'es' : ''} cadastrado{suppliers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => navigate('/fornecedores/novo')} className="flex-shrink-0 gap-2">
          <Plus className="w-4 h-4" />Novo Fornecedor
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Buscar fornecedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground">FORNECEDOR</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">ITENS</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">PREFERIDO EM</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[70, 20, 20, 5].map((w, j) => (
                    <td key={j} className="px-5 py-3.5">
                      <div className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center text-muted-foreground">
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {search ? 'Nenhum resultado.' : 'Nenhum fornecedor cadastrado.'}
                </td>
              </tr>
            ) : filtered.map(s => (
              <tr key={s.name}
                className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                onClick={() => navigate(`/fornecedores/${encodeURIComponent(s.name)}`)}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-semibold text-foreground">{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="font-medium text-foreground">{s.itemCount}</span>
                  <span className="text-muted-foreground text-xs ml-1">item{s.itemCount !== 1 ? 's' : ''}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  {s.preferredCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 text-xs font-medium px-2 py-0.5 rounded-full">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                      {s.preferredCount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
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
