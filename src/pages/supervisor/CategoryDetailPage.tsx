import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Package, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, ChevronLeft, ChevronRight, BarChart3
} from 'lucide-react';

type Item = {
  id: string; name: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
};

type Movement = {
  id: string; type: 'entrada' | 'saida'; date: string; qty: number;
  cost: number | null; item_name: string; who: string | null;
};

const PAGE_SIZE = 50;

export default function CategoryDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const categoryName = decodeURIComponent(name || '');

  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'itens' | 'movimentos'>('itens');
  const [movPage, setMovPage] = useState(0);

  useEffect(() => { load(); }, [name]);

  const load = async () => {
    setLoading(true);
    const { data: itemsData } = await supabase
      .from('stock_items')
      .select('id, name, unit, current_stock, min_stock, unit_cost')
      .eq('category', categoryName)
      .order('name');

    const itemList = (itemsData || []) as Item[];
    setItems(itemList);

    if (itemList.length > 0) {
      const ids = itemList.map(i => i.id);
      const [entriesRes, outputsRes] = await Promise.all([
        supabase.from('stock_entries').select('id, item_id, created_at, quantity, unit_cost, supplier').in('item_id', ids).order('created_at', { ascending: false }),
        supabase.from('stock_outputs').select('id, item_id, created_at, quantity, employee_name, event_name').in('item_id', ids).order('created_at', { ascending: false }),
      ]);

      const itemMap = Object.fromEntries(itemList.map(i => [i.id, i.name]));
      const movs: Movement[] = [
        ...((entriesRes.data || []).map((e: any) => ({ id: e.id, type: 'entrada' as const, date: e.created_at, qty: e.quantity, cost: e.unit_cost, item_name: itemMap[e.item_id] || '?', who: e.supplier }))),
        ...((outputsRes.data || []).map((o: any) => ({ id: o.id, type: 'saida' as const, date: o.created_at, qty: o.quantity, cost: null, item_name: itemMap[o.item_id] || '?', who: o.employee_name || o.event_name }))),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMovements(movs);
    }
    setLoading(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  const totalValue = items.reduce((s, i) => s + i.current_stock * i.unit_cost, 0);
  const totalStock = items.length;
  const lowItems = items.filter(i => i.current_stock < i.min_stock).length;
  const totalEntries = movements.filter(m => m.type === 'entrada').reduce((s, m) => s + m.qty, 0);
  const totalOutputs = movements.filter(m => m.type === 'saida').reduce((s, m) => s + m.qty, 0);

  const totalMovPages = Math.ceil(movements.length / PAGE_SIZE);
  const pagedMovements = movements.slice(movPage * PAGE_SIZE, (movPage + 1) * PAGE_SIZE);

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/categories')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{categoryName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Centro de custo · {totalStock} itens</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Itens', value: String(totalStock), icon: Package, color: 'text-foreground' },
          { label: 'Valor em Estoque', value: `R$ ${fmt(totalValue)}`, icon: DollarSign, color: 'text-amber-600' },
          { label: 'Estoque Baixo', value: String(lowItems), icon: AlertTriangle, color: lowItems > 0 ? 'text-destructive' : 'text-muted-foreground' },
          { label: 'Total Entradas', value: String(movements.filter(m => m.type === 'entrada').length), icon: TrendingUp, color: 'text-success' },
          { label: 'Total Saídas', value: String(movements.filter(m => m.type === 'saida').length), icon: TrendingDown, color: 'text-destructive' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-border p-1 w-fit">
        {([
          ['itens', `Itens (${items.length})`, Package],
          ['movimentos', `Movimentações (${movements.length})`, BarChart3],
        ] as const).map(([tab, label, Icon]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${activeTab === tab ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon className="w-3 h-3" />{label}
          </button>
        ))}
      </div>

      {/* Tab: Itens */}
      {activeTab === 'itens' && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                <th className="text-left px-5 py-2">ITEM</th>
                <th className="text-center px-3 py-2">UN</th>
                <th className="text-right px-3 py-2">ESTOQUE ATUAL</th>
                <th className="text-right px-3 py-2">ESTOQUE MÍN.</th>
                <th className="text-right px-3 py-2">CUSTO UNIT.</th>
                <th className="text-right px-3 py-2">VALOR TOTAL</th>
                <th className="text-center px-3 py-2">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {items.map(item => {
                const isLow = item.current_stock < item.min_stock;
                return (
                  <tr key={item.id}
                    className="hover:bg-amber-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/items/${item.id}`)}>
                    <td className="px-5 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-3 py-3 text-center text-xs text-muted-foreground">{item.unit}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${isLow ? 'text-destructive' : 'text-foreground'}`}>{fmt(item.current_stock)}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{fmt(item.min_stock)}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">R$ {fmt(item.unit_cost)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-amber-700">R$ {fmt(item.current_stock * item.unit_cost)}</td>
                    <td className="px-3 py-3 text-center">
                      {isLow
                        ? <Badge variant="destructive" className="text-[10px]">Baixo</Badge>
                        : <Badge variant="outline" className="text-[10px] text-success border-success/30">OK</Badge>}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground text-sm">Nenhum item nesta categoria</td></tr>
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td colSpan={5} className="px-5 py-2.5 text-xs font-semibold text-muted-foreground text-right">Valor total em estoque:</td>
                  <td className="px-3 py-2.5 text-right font-bold text-amber-700">R$ {fmt(totalValue)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Tab: Movimentações */}
      {activeTab === 'movimentos' && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <p className="font-semibold text-sm">Todas as movimentações da categoria</p>
            {totalMovPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Página {movPage + 1} de {totalMovPages}</span>
                <Button variant="outline" size="icon" className="w-7 h-7" disabled={movPage === 0} onClick={() => setMovPage(p => p - 1)}><ChevronLeft className="w-3 h-3" /></Button>
                <Button variant="outline" size="icon" className="w-7 h-7" disabled={movPage >= totalMovPages - 1} onClick={() => setMovPage(p => p + 1)}><ChevronRight className="w-3 h-3" /></Button>
              </div>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
                <th className="text-left px-5 py-2">DATA</th>
                <th className="text-left px-3 py-2">ITEM</th>
                <th className="text-center px-3 py-2">TIPO</th>
                <th className="text-right px-3 py-2">QUANTIDADE</th>
                <th className="text-left px-3 py-2">REFERÊNCIA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {pagedMovements.map(m => (
                <tr key={m.id} className="hover:bg-amber-50/40 transition-colors">
                  <td className="px-5 py-2.5 text-muted-foreground text-xs">{fmtDate(m.date)}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{m.item_name}</td>
                  <td className="px-3 py-2.5 text-center">
                    {m.type === 'entrada'
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-semibold"><TrendingUp className="w-2.5 h-2.5" />Entrada</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-semibold"><TrendingDown className="w-2.5 h-2.5" />Saída</span>}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${m.type === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                    {m.type === 'entrada' ? '+' : '-'}{m.qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.who || '—'}</td>
                </tr>
              ))}
              {pagedMovements.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground text-sm">Nenhuma movimentação nesta categoria</td></tr>
              )}
            </tbody>
          </table>
          {totalMovPages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Mostrando {movPage * PAGE_SIZE + 1}–{Math.min((movPage + 1) * PAGE_SIZE, movements.length)} de {movements.length}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={movPage === 0} onClick={() => setMovPage(p => p - 1)}>← Anterior</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={movPage >= totalMovPages - 1} onClick={() => setMovPage(p => p + 1)}>Próxima →</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
