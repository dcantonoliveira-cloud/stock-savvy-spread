import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Star, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { fmtCur, fmtDate, fmtNum } from '@/lib/format';

const CORES = ['#b45309','#0ea5e9','#10b981','#8b5cf6','#f59e0b','#ef4444','#6366f1','#14b8a6'];
const LIMIAR_ALERTA = 10;

type ItemComFornecedores = {
  id: string; name: string; unit: string; category: string;
  suppliers: SupplierRow[];
  historico: HistoricoPoint[];
  loaded: boolean;
};

type SupplierRow = {
  item_supplier_id: string; fornecedor_id: string; fornecedor_nome: string;
  unit_price: number; pedido_minimo: number | null; prazo_entrega_dias: number | null;
  condicao_pagamento: string | null; is_preferred: boolean; ativo: boolean;
  updated_at: string; variacao_pct: number | null; media_90d: number | null;
};

type HistoricoPoint = { data: string; [k: string]: number | string };

export default function ComparacaoPrecoPage() {
  const [items, setItems]       = useState<ItemComFornecedores[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    // Carrega todos item_suppliers agrupados por item_id
    const { data: isData } = await (supabase.from('item_suppliers' as any) as any)
      .select('id,item_id,fornecedor_id,unit_price,pedido_minimo,prazo_entrega_dias,condicao_pagamento,is_preferred,ativo,updated_at,fornecedores(nome)')
      .order('unit_price', { ascending: true });

    // Agrupa por item_id
    const byItem: Record<string, any[]> = {};
    for (const r of (isData || []) as any[]) {
      if (!byItem[r.item_id]) byItem[r.item_id] = [];
      byItem[r.item_id].push(r);
    }

    // Só itens com ≥1 fornecedor (mostra tudo, mas itens com ≥2 são os mais úteis)
    const itemIds = Object.keys(byItem).filter(id => byItem[id].length > 0);
    if (itemIds.length === 0) { setLoading(false); return; }

    const { data: siData } = await supabase
      .from('stock_items').select('id,name,unit,category')
      .in('id', itemIds).order('name');

    const cats = [...new Set(((siData || []) as any[]).map((s: any) => s.category).filter(Boolean))].sort();
    setCategorias(cats);

    const result: ItemComFornecedores[] = ((siData || []) as any[]).map((si: any) => ({
      id: si.id, name: si.name, unit: si.unit, category: si.category,
      suppliers: (byItem[si.id] || []).map((r: any) => ({
        item_supplier_id: r.id, fornecedor_id: r.fornecedor_id,
        fornecedor_nome: r.fornecedores?.nome || '?',
        unit_price: r.unit_price ?? 0, pedido_minimo: r.pedido_minimo,
        prazo_entrega_dias: r.prazo_entrega_dias, condicao_pagamento: r.condicao_pagamento,
        is_preferred: r.is_preferred ?? false, ativo: r.ativo ?? true,
        updated_at: r.updated_at, variacao_pct: null, media_90d: null,
      })),
      historico: [], loaded: false,
    }));

    setItems(result);
    setLoading(false);
  };

  const loadDetail = async (item: ItemComFornecedores) => {
    if (item.loaded) return;
    setLoadingDetail(item.id);

    const ids = item.suppliers.map(s => s.item_supplier_id);
    const [{ data: vpData }, { data: hData }] = await Promise.all([
      (supabase.from('vw_variacao_preco' as any) as any)
        .select('item_supplier_id,variacao_pct,media_90d').eq('item_id', item.id),
      (supabase.from('historico_precos' as any) as any)
        .select('item_supplier_id,preco,data_registro')
        .in('item_supplier_id', ids)
        .order('data_registro', { ascending: true }),
    ]);

    const vpMap: Record<string, any> = {};
    for (const r of (vpData || []) as any[]) vpMap[r.item_supplier_id] = r;

    // Pivot histórico
    const byDate: Record<string, Record<string, number>> = {};
    for (const h of (hData || []) as any[]) {
      const sup = item.suppliers.find(s => s.item_supplier_id === h.item_supplier_id);
      if (!sup) continue;
      if (!byDate[h.data_registro]) byDate[h.data_registro] = {};
      byDate[h.data_registro][sup.fornecedor_nome] = h.preco;
    }
    const historico: HistoricoPoint[] = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, vals]) => ({ data, ...vals }));

    setItems(prev => prev.map(i => i.id !== item.id ? i : {
      ...i,
      loaded: true,
      historico,
      suppliers: i.suppliers.map(s => ({
        ...s,
        variacao_pct: vpMap[s.item_supplier_id]?.variacao_pct ?? null,
        media_90d:    vpMap[s.item_supplier_id]?.media_90d    ?? null,
      })),
    }));
    setLoadingDetail(null);
  };

  const handleExpand = async (item: ItemComFornecedores) => {
    if (expanded === item.id) { setExpanded(null); return; }
    setExpanded(item.id);
    await loadDetail(item);
  };

  const filtered = items.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat    = !catFilter || i.category === catFilter;
    return matchSearch && matchCat;
  });

  // Separa: ≥2 fornecedores primeiro, depois 1
  const comMultiplos = filtered.filter(i => i.suppliers.length >= 2);
  const comUm        = filtered.filter(i => i.suppliers.length === 1);

  const melhorPreco = (suppliers: SupplierRow[]) =>
    suppliers.filter(s => s.ativo && s.unit_price > 0)
      .reduce<number | null>((m, s) => m === null ? s.unit_price : Math.min(m, s.unit_price), null);

  const variacaoIcon = (pct: number | null) => {
    if (pct === null) return null;
    if (Math.abs(pct) < 2) return <Minus className="w-3 h-3 text-muted-foreground" />;
    if (pct > 0) return <TrendingUp className="w-3 h-3 text-amber-500" />;
    return <TrendingDown className="w-3 h-3 text-emerald-500" />;
  };

  const SupplierTable = ({ item }: { item: ItemComFornecedores }) => {
    const best  = melhorPreco(item.suppliers);
    const fns   = [...new Set(item.historico.flatMap(p => Object.keys(p).filter(k => k !== 'data')))];
    return (
      <div className="border-t border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                <th className="text-left px-5 py-2.5 font-semibold text-muted-foreground">FORNECEDOR</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">PREÇO/{item.unit}</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">vs. MAIS BARATO</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">VAR. 90d</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">PED. MÍN.</th>
                <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground">PRAZO</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">PAGAMENTO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {item.suppliers.map((s, i) => {
                const isBest  = s.unit_price === best && s.ativo && s.unit_price > 0;
                const eco     = best && s.unit_price > best ? ((s.unit_price - best) / best) * 100 : null;
                const alertar = s.variacao_pct !== null && Math.abs(s.variacao_pct) >= LIMIAR_ALERTA;
                return (
                  <tr key={s.item_supplier_id}
                    className={`transition-colors ${!s.ativo ? 'opacity-40' : isBest ? 'bg-emerald-50/60' : 'hover:bg-muted/20'}`}>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CORES[i % CORES.length] }} />
                        <span className="font-medium text-sm">{s.fornecedor_nome}</span>
                        {s.is_preferred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                        {isBest && <Badge className="text-[10px] h-4 px-1.5 bg-emerald-600 text-white">Mais barato</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-bold ${isBest ? 'text-emerald-700' : 'text-foreground'}`}>
                        {fmtCur(s.unit_price)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {eco !== null
                        ? <span className="text-amber-600 font-medium">+{fmtNum(eco, 1)}% (+{fmtCur(s.unit_price - (best ?? 0))})</span>
                        : <span className="text-emerald-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {s.variacao_pct === null ? (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      ) : (
                        <span className={`flex items-center justify-end gap-1 text-xs font-medium ${alertar ? (s.variacao_pct > 0 ? 'text-amber-600' : 'text-blue-600') : 'text-muted-foreground'}`}>
                          {alertar && <AlertTriangle className="w-3 h-3" />}
                          {variacaoIcon(s.variacao_pct)}
                          {s.variacao_pct > 0 ? '+' : ''}{fmtNum(s.variacao_pct, 1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {s.pedido_minimo != null ? `${fmtNum(s.pedido_minimo, 0)} ${item.unit}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                      {s.prazo_entrega_dias != null ? `${s.prazo_entrega_dias}d` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {s.condicao_pagamento || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Gráfico histórico */}
        {item.historico.length > 1 && (
          <div className="px-5 py-4 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Evolução de preço</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={item.historico} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }}
                  tickFormatter={d => { const [y,m,day] = d.split('-'); return `${day}/${m}`; }} />
                <YAxis tickFormatter={v => `R$${fmtNum(v,2)}`} tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v: number, name: string) => [fmtCur(v), name]}
                  labelFormatter={d => { const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {fns.map((nome, i) => (
                  <Line key={nome} type="monotone" dataKey={nome}
                    stroke={CORES[i % CORES.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {loadingDetail === item.id && (
          <div className="px-5 py-3 text-xs text-muted-foreground flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Carregando detalhes...
          </div>
        )}
      </div>
    );
  };

  const ItemRow = ({ item }: { item: ItemComFornecedores }) => {
    const isExp = expanded === item.id;
    const best  = melhorPreco(item.suppliers);
    const temAlerta = item.suppliers.some(s => s.variacao_pct !== null && Math.abs(s.variacao_pct) >= LIMIAR_ALERTA);

    return (
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <button
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left"
          onClick={() => handleExpand(item)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{item.name}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{item.category}</span>
              {item.suppliers.length >= 2 && (
                <span className="text-xs text-primary font-medium">{item.suppliers.length} fornecedores</span>
              )}
              {temAlerta && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {best != null && (
                <span className="text-xs text-emerald-700 font-medium">
                  Melhor: {fmtCur(best)}/{item.unit}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {item.suppliers.map(s => s.fornecedor_nome).join(' · ')}
              </span>
            </div>
          </div>
          {isExp
            ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </button>

        {isExp && <SupplierTable item={items.find(i => i.id === item.id) ?? item} />}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-display font-bold gold-text">Comparação de Preços</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {items.length} insumo{items.length !== 1 ? 's' : ''} com fornecedor cadastrado
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar insumo..." className="pl-9" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="h-10 text-sm border border-border rounded-md px-3 bg-white text-foreground">
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-xl border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-16 text-center text-muted-foreground text-sm">
          Nenhum insumo encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Itens com ≥2 fornecedores primeiro */}
          {comMultiplos.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-1">
                Comparação disponível ({comMultiplos.length})
              </p>
              {comMultiplos.map(item => <ItemRow key={item.id} item={item} />)}
            </>
          )}

          {/* Itens com 1 fornecedor */}
          {comUm.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-3">
                Fornecedor único ({comUm.length})
              </p>
              {comUm.map(item => <ItemRow key={item.id} item={item} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
