import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronDown, ChevronRight, Package, Star, ExternalLink } from 'lucide-react';

type SupplierItem = {
  item_id: string;
  item_name: string;
  item_unit: string;
  unit_price: number;
  is_preferred: boolean;
  notes: string | null;
};

type Supplier = {
  name: string;
  items: SupplierItem[];
  preferredCount: number;
};

export default function FornecedoresPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('item_suppliers')
      .select('item_id, supplier_name, unit_price, is_preferred, notes, stock_items(name, unit)')
      .order('supplier_name');

    if (error || !data) { setLoading(false); return; }

    const map: Record<string, SupplierItem[]> = {};
    for (const row of data as any[]) {
      const si = row.stock_items as { name?: string; unit?: string } | null;
      const supplier = row.supplier_name as string;
      if (!map[supplier]) map[supplier] = [];
      map[supplier].push({
        item_id: row.item_id,
        item_name: si?.name || '?',
        item_unit: si?.unit || '',
        unit_price: row.unit_price || 0,
        is_preferred: row.is_preferred || false,
        notes: row.notes || null,
      });
    }

    const list: Supplier[] = Object.entries(map)
      .map(([name, items]) => ({
        name,
        items: items.sort((a, b) => a.item_name.localeCompare(b.item_name)),
        preferredCount: items.filter(i => i.is_preferred).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setSuppliers(list);
    setLoading(false);
  };

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Fornecedores</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fornecedores cadastrados nos insumos do estoque. Para editar, acesse o insumo em{' '}
          <button className="text-primary underline" onClick={() => navigate('/items')}>Estoque Geral</button>.
        </p>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-10 text-center">
          <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum fornecedor cadastrado.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre fornecedores nos insumos em <button className="text-primary underline" onClick={() => navigate('/items')}>Estoque Geral</button>.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map(supplier => {
            const isOpen = expanded.has(supplier.name);
            return (
              <div key={supplier.name} className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
                  onClick={() => toggle(supplier.name)}
                >
                  <div className="flex items-center gap-3">
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    }
                    <div>
                      <p className="font-semibold text-foreground">{supplier.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {supplier.items.length} insumo{supplier.items.length !== 1 ? 's' : ''}
                        {supplier.preferredCount > 0 && ` · ${supplier.preferredCount} preferido${supplier.preferredCount !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {supplier.preferredCount > 0 && (
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 gap-1">
                        <Star className="w-2.5 h-2.5" />
                        {supplier.preferredCount} preferido{supplier.preferredCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border text-xs text-muted-foreground">
                          <th className="text-left px-5 py-2 font-semibold">INSUMO</th>
                          <th className="text-right px-4 py-2 font-semibold">PREÇO UNIT.</th>
                          <th className="text-left px-4 py-2 font-semibold">OBSERVAÇÕES</th>
                          <th className="text-center px-4 py-2 font-semibold">PREFERIDO</th>
                          <th className="w-10 px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {supplier.items.map(item => (
                          <tr key={item.item_id} className="hover:bg-muted/10">
                            <td className="px-5 py-2.5">
                              <span className="font-medium text-foreground">{item.item_name}</span>
                              <span className="text-muted-foreground text-xs ml-1.5">({item.item_unit})</span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">
                              {item.unit_price > 0 ? `R$ ${item.unit_price.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">
                              {item.notes || <span className="opacity-30">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {item.is_preferred && (
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 mx-auto" />
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7"
                                title="Ver insumo"
                                onClick={() => navigate(`/items/${item.item_id}`)}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
