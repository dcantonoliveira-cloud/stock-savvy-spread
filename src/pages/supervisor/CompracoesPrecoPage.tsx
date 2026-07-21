import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Star, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { fmtCur, fmtDate, fmtNum } from '@/lib/format';

const CORES = ['#b45309','#0ea5e9','#10b981','#8b5cf6','#f59e0b','#ef4444','#6366f1','#14b8a6'];

type StockItem = { id: string; name: string; unit: string; category: string };

type SupplierRow = {
  item_supplier_id: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  unit_price: number;
  pedido_minimo: number | null;
  prazo_entrega_dias: number | null;
  condicao_pagamento: string | null;
  is_preferred: boolean;
  ativo: boolean;
  updated_at: string;
  variacao_pct: number | null;
  media_90d: number | null;
};

type HistoricoPoint = {
  data: string;
  [fornecedor: string]: number | string;
};

const LIMIAR_ALERTA = 10; // %

export default function ComparacaoPrecoPage() {
  const [search, setSearch]         = useState('');
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [showSug, setShowSug]       = useState(false);
  const [selected, setSelected]     = useState<StockItem | null>(null);
  const [suppliers, setSuppliers]   = useState<SupplierRow[]>([]);
  const [historico, setHistorico]   = useState<HistoricoPoint[]>([]);
  const [loading, setLoading]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Busca de insumos
  useEffect(() => {
    if (search.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('stock_items')
        .select('id,name,unit,category')
        .ilike('name', `%${search}%`)
        .order('name')
        .limit(20);
      setSuggestions((data || []) as StockItem[]);
      setShowSug(true);
    }, 220);
    return () => clearTimeout(t);
  }, [search]);

  const selectItem = async (item: StockItem) => {
    setSelected(item);
    setSearch(item.name);
    setShowSug(false);
    setLoading(true);

    // Carregar fornecedores + variação de preço
    const [{ data: isData }, { data: vpData }] = await Promise.all([
      (supabase.from('item_suppliers' as any) as any)
        .select('id,fornecedor_id,unit_price,pedido_minimo,prazo_entrega_dias,condicao_pagamento,is_preferred,ativo,updated_at,fornecedores(nome)')
        .eq('item_id', item.id)
        .order('unit_price', { ascending: true }),
      (supabase.from('vw_variacao_preco' as any) as any)
        .select('item_supplier_id,variacao_pct,media_90d')
        .eq('item_id', item.id),
    ]);

    const vpMap: Record<string, { variacao_pct: number | null; media_90d: number | null }> = {};
    for (const r of (vpData || []) as any[]) {
      vpMap[r.item_supplier_id] = { variacao_pct: r.variacao_pct, media_90d: r.media_90d };
    }

    const rows: SupplierRow[] = ((isData || []) as any[]).map((r: any) => ({
      item_supplier_id:   r.id,
      fornecedor_id:      r.fornecedor_id,
      fornecedor_nome:    r.fornecedores?.nome || r.supplier_name || '?',
      unit_price:         r.unit_price ?? 0,
      pedido_minimo:      r.pedido_minimo,
      prazo_entrega_dias: r.prazo_entrega_dias,
      condicao_pagamento: r.condicao_pagamento,
      is_preferred:       r.is_preferred ?? false,
      ativo:              r.ativo ?? true,
      updated_at:         r.updated_at,
      variacao_pct:       vpMap[r.id]?.variacao_pct ?? null,
      media_90d:          vpMap[r.id]?.media_90d ?? null,
    }));
    setSuppliers(rows);

    // Carregar histórico de preços para gráfico
    if (rows.length > 0) {
      const ids = rows.map(r => r.item_supplier_id);
      const { data: hData } = await (supabase.from('historico_precos' as any) as any)
        .select('item_supplier_id,preco,data_registro')
        .in('item_supplier_id', ids)
        .order('data_registro', { ascending: true });

      // Pivot: data → {fornecedor: preço}
      const byDate: Record<string, Record<string, number>> = {};
      for (const h of (hData || []) as any[]) {
        const row = rows.find(r => r.item_supplier_id === h.item_supplier_id);
        if (!row) continue;
        if (!byDate[h.data_registro]) byDate[h.data_registro] = {};
        byDate[h.data_registro][row.fornecedor_nome] = h.preco;
      }
      const points: HistoricoPoint[] = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, vals]) => ({ data, ...vals }));
      setHistorico(points);
    } else {
      setHistorico([]);
    }

    setLoading(false);
  };

  const melhorPreco = suppliers.filter(s => s.ativo && s.unit_price > 0)
    .reduce<number | null>((min, s) => min === null ? s.unit_price : Math.min(min, s.unit_price), null);

  const fornecedoresNoHistorico = Array.from(new Set(
    historico.flatMap(p => Object.keys(p).filter(k => k !== 'data'))
  ));

  const variacaoIcon = (pct: number | null) => {
    if (pct === null) return null;
    if (Math.abs(pct) < 2) return <Minus className="w-3 h-3 text-muted-foreground" />;
    if (pct > 0) return <TrendingUp className="w-3 h-3 text-amber-500" />;
    return <TrendingDown className="w-3 h-3 text-emerald-500" />;
  };

  const economia = (price: number) => {
    if (!melhorPreco || price === melhorPreco) return null;
    return ((price - melhorPreco) / melhorPreco) * 100;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold gold-text">Comparação de Preços</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Busque um insumo para comparar preços entre fornecedores
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-lg mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); }}
          onFocus={() => suggestions.length > 0 && setShowSug(true)}
          placeholder="Ex: Farinha de trigo, frango, óleo..."
          className="pl-9 text-base"
          autoFocus
        />
        {showSug && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s.id}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50/60 transition-colors text-left"
                onMouseDown={e => { e.preventDefault(); selectItem(s); }}
              >
                <span className="text-sm font-medium text-foreground">{s.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{s.unit}</span>
                  <span className="bg-muted px-1.5 py-0.5 rounded">{s.category}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Resultado */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      )}

      {selected && !loading && (
        <div className="space-y-5">
          {/* Header do insumo */}
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">{selected.name}</h2>
              <p className="text-sm text-muted-foreground">{selected.category} · {selected.unit}</p>
            </div>
          </div>

          {suppliers.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground text-sm">
              Nenhum fornecedor cadastrado para este insumo.
            </div>
          ) : (
            <>
              {/* Tabela de comparação */}
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground">FORNECEDOR</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">PREÇO/{selected.unit}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">vs. MAIS BARATO</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">VARIAÇÃO 90d</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">PED. MÍN.</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground">PRAZO</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">PAGAMENTO</th>
                      <th className="text-center px-3 py-3 font-semibold text-muted-foreground">ATT.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {suppliers.map((s, i) => {
                      const isBest  = s.unit_price === melhorPreco && s.ativo && s.unit_price > 0;
                      const eco     = economia(s.unit_price);
                      const alertar = s.variacao_pct !== null && Math.abs(s.variacao_pct) >= LIMIAR_ALERTA;
                      return (
                        <tr key={s.item_supplier_id}
                          className={`transition-colors ${!s.ativo ? 'opacity-40' : isBest ? 'bg-emerald-50/60' : 'hover:bg-muted/20'}`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: CORES[i % CORES.length] }} />
                              <span className="font-medium">{s.fornecedor_nome}</span>
                              {s.is_preferred && (
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 flex-shrink-0" />
                              )}
                              {isBest && (
                                <Badge className="text-[10px] h-4 px-1.5 bg-emerald-600 text-white">Mais barato</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={`font-bold text-base ${isBest ? 'text-emerald-700' : 'text-foreground'}`}>
                              {fmtCur(s.unit_price)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {eco === null ? (
                              <span className="text-emerald-600 text-xs font-semibold">—</span>
                            ) : (
                              <span className="text-amber-600 text-xs font-semibold">
                                +{fmtNum(eco, 1)}%
                                <span className="block text-muted-foreground font-normal">
                                  +{fmtCur(s.unit_price - (melhorPreco ?? 0))}/{selected.unit}
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {s.variacao_pct === null ? (
                              <span className="text-muted-foreground/40 text-xs">—</span>
                            ) : (
                              <span className={`flex items-center justify-end gap-1 text-xs font-medium ${
                                alertar ? (s.variacao_pct > 0 ? 'text-amber-600' : 'text-blue-600') : 'text-muted-foreground'
                              }`}>
                                {alertar && <AlertTriangle className="w-3 h-3" />}
                                {variacaoIcon(s.variacao_pct)}
                                {s.variacao_pct > 0 ? '+' : ''}{fmtNum(s.variacao_pct, 1)}%
                                {s.media_90d != null && (
                                  <span className="block text-muted-foreground font-normal">
                                    (média {fmtCur(s.media_90d)})
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right text-muted-foreground text-xs">
                            {s.pedido_minimo != null
                              ? `${fmtNum(s.pedido_minimo, 0)} ${selected.unit}`
                              : <span className="opacity-40">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center text-muted-foreground text-xs">
                            {s.prazo_entrega_dias != null ? `${s.prazo_entrega_dias}d` : <span className="opacity-40">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground text-xs">
                            {s.condicao_pagamento || <span className="opacity-40">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-center text-muted-foreground/50 text-xs">
                            {fmtDate(s.updated_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Gráfico histórico */}
              {historico.length > 1 ? (
                <div className="bg-white rounded-xl border border-border p-5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                    Evolução de preço — {selected.name}
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={historico} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="data"
                        tick={{ fontSize: 11 }}
                        tickFormatter={d => {
                          const [y, m, day] = d.split('-');
                          return `${day}/${m}/${y.slice(2)}`;
                        }}
                      />
                      <YAxis
                        tickFormatter={v => `R$${fmtNum(v, 2)}`}
                        tick={{ fontSize: 11 }}
                        width={75}
                      />
                      <Tooltip
                        formatter={(v: number, name: string) => [fmtCur(v), name]}
                        labelFormatter={d => {
                          const [y, m, day] = d.split('-');
                          return `${day}/${m}/${y}`;
                        }}
                      />
                      <Legend />
                      {fornecedoresNoHistorico.map((nome, i) => (
                        <Line
                          key={nome}
                          type="monotone"
                          dataKey={nome}
                          stroke={CORES[i % CORES.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : historico.length === 1 ? (
                <div className="bg-white rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">
                  Histórico insuficiente para gráfico (apenas 1 registro). O gráfico aparecerá conforme os preços forem atualizados.
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {!selected && !loading && (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Digite o nome de um insumo para ver a comparação de preços</p>
        </div>
      )}
    </div>
  );
}
