import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Package, Loader2, Search, ArrowRightLeft } from 'lucide-react';

type Kitchen = { id: string; name: string; is_default: boolean };
type LocationItem = {
  location_id: string;
  item_id: string;
  name: string;
  category: string;
  unit: string;
  unit_cost: number;
  current_stock: number;
};

export default function KitchenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [kitchen, setKitchen] = useState<Kitchen | null>(null);
  const [locationItems, setLocationItems] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const [kRes, locRes] = await Promise.all([
      supabase.from('kitchens').select('id, name, is_default').eq('id', id!).single(),
      supabase.from('stock_item_locations').select('id, item_id, current_stock').eq('kitchen_id', id!),
    ]);
    if (!kRes.data) { navigate('/kitchens'); return; }
    setKitchen(kRes.data as Kitchen);

    if (locRes.data && locRes.data.length > 0) {
      const itemIds = locRes.data.map((l: any) => l.item_id);
      const { data: itemsData } = await supabase
        .from('stock_items')
        .select('id, name, category, unit, unit_cost')
        .in('id', itemIds)
        .order('category')
        .order('name');

      const mapped: LocationItem[] = (locRes.data as any[]).map(loc => {
        const item = (itemsData || []).find((i: any) => i.id === loc.item_id);
        return {
          location_id: loc.id,
          item_id: loc.item_id,
          name: item?.name || '—',
          category: item?.category || '—',
          unit: item?.unit || '',
          unit_cost: item?.unit_cost || 0,
          current_stock: loc.current_stock,
        };
      }).filter(l => l.current_stock > 0).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

      setLocationItems(mapped);
    } else {
      setLocationItems([]);
    }
    setLoading(false);
  };

  useEffect(() => { if (id) load(); }, [id]);

  const filtered = locationItems.filter(l =>
    !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.category.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped = filtered.reduce<Record<string, LocationItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const totalValue = locationItems.reduce((s, l) => s + l.current_stock * l.unit_cost, 0);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!kitchen) return null;

  return (
    <div>
      {/* Back */}
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate('/kitchens')}>
        <ArrowLeft className="w-4 h-4 mr-1" />Voltar a Centros de Custo
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${kitchen.is_default ? 'bg-primary/20' : 'bg-primary/10'}`}>
            {kitchen.is_default ? <Package className="w-6 h-6 text-primary" /> : <Building2 className="w-6 h-6 text-primary" />}
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold gold-text">{kitchen.name}</h1>
            <p className="text-muted-foreground mt-0.5">
              {locationItems.length} iten{locationItems.length !== 1 ? 's' : ''} em estoque
              {totalValue > 0 && <span> · Valor total: <strong>R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/transfers')}>
          <ArrowRightLeft className="w-4 h-4 mr-2" />Transferir
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar item ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Content */}
      {locationItems.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum item alocado neste centro</p>
          <p className="text-sm mt-1">Use a função Transferir para mover itens para cá</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</p>
                <Badge variant="secondary" className="text-xs">{catItems.length} {catItems.length === 1 ? 'item' : 'itens'}</Badge>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="text-left px-5 py-2">Insumo</th>
                    <th className="text-right px-4 py-2">Qtde</th>
                    <th className="text-center px-3 py-2">Un.</th>
                    <th className="text-right px-4 py-2">Custo Unit.</th>
                    <th className="text-right px-5 py-2">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {catItems.map(item => (
                    <tr
                      key={item.location_id}
                      className="hover:bg-muted/10 cursor-pointer transition-colors"
                      onClick={() => navigate(`/items/${item.item_id}`)}
                    >
                      <td className="px-5 py-3 font-medium text-foreground">{item.name}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.current_stock.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      </td>
                      <td className="px-3 py-3 text-center text-muted-foreground">{item.unit}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        R$ {item.unit_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground">
                        R$ {(item.current_stock * item.unit_cost).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20">
                    <td colSpan={4} className="px-5 py-2 text-right text-xs font-semibold text-muted-foreground">Total {category}:</td>
                    <td className="px-5 py-2 text-right font-bold text-primary text-sm">
                      R$ {catItems.reduce((s, i) => s + i.current_stock * i.unit_cost, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
