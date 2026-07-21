import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { fmtCur, fmtNum } from '@/lib/format';

type ParetoItem = {
  item_id: string; item_name: string; gasto: number;
  pct: number; pctAcum: number; classe: 'A' | 'B' | 'C';
};
type MensalItem = { mes: string; gasto: number };
type AlertaItem = {
  item_id: string; item_name: string; supplier_name: string;
  variacao_pct: number; preco_atual: number; media_90d: number;
};

const LIMITE_ALERTA = 10; // %

export default function ComprasDashboardPage() {
  const navigate = useNavigate();
  const [pareto, setPareto]       = useState<ParetoItem[]>([]);
  const [mensal, setMensal]       = useState<MensalItem[]>([]);
  const [alertas, setAlertas]     = useState<AlertaItem[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    await Promise.all([loadPareto(), loadMensal(), loadAlertas()]);
    setLoading(false);
  };

  const loadPareto = async () => {
    const { data } = await (supabase.from('historico_precos' as any) as any)
      .select('preco, quantidade, item_supplier_id, item_suppliers(item_id, stock_items(name))')
      .gte('data_registro', new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]);

    const gastoMap: Record<string, { name: string; gasto: number }> = {};
    for (const r of (data || []) as any[]) {
      const iid  = r.item_suppliers?.item_id;
      const name = r.item_suppliers?.stock_items?.name || '?';
      if (!iid) continue;
      if (!gastoMap[iid]) gastoMap[iid] = { name, gasto: 0 };
      const qtd = r.quantidade ?? 1;
      gastoMap[iid].gasto += r.preco * qtd;
    }

    const sorted = Object.entries(gastoMap)
      .map(([id, v]) => ({ item_id: id, item_name: v.name, gasto: v.gasto }))
      .filter(x => x.gasto > 0)
      .sort((a, b) => b.gasto - a.gasto);

    const total = sorted.reduce((s, x) => s + x.gasto, 0);
    let acum = 0;
    const result: ParetoItem[] = sorted.map(x => {
      const pct = total > 0 ? (x.gasto / total) * 100 : 0;
      acum += pct;
      return {
        ...x,
        pct,
        pctAcum: acum,
        classe: acum <= 80 ? 'A' : acum <= 95 ? 'B' : 'C',
      };
    });
    setPareto(result.slice(0, 30));
  };

  const loadMensal = async () => {
    const { data } = await (supabase.from('historico_precos' as any) as any)
      .select('preco, quantidade, data_registro')
      .gte('data_registro', new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0])
      .order('data_registro');

    const map: Record<string, number> = {};
    for (const r of (data || []) as any[]) {
      const mes = (r.data_registro as string).slice(0, 7); // yyyy-mm
      if (!map[mes]) map[mes] = 0;
      map[mes] += r.preco * (r.quantidade ?? 1);
    }
    setMensal(
      Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, gasto]) => ({ mes: mes.split('-').reverse().join('/'), gasto }))
    );
  };

  const loadAlertas = async () => {
    const { data } = await (supabase.from('vw_variacao_preco' as any) as any)
      .select('item_id,supplier_name,variacao_pct,preco_atual,media_90d')
      .not('variacao_pct', 'is', null)
      .gt('variacao_pct', LIMITE_ALERTA)
      .order('variacao_pct', { ascending: false })
      .limit(20);

    const itemIds = [...new Set(((data || []) as any[]).map((r: any) => r.item_id))];
    let nameMap: Record<string, string> = {};
    if (itemIds.length > 0) {
      const { data: si } = await supabase.from('stock_items').select('id,name').in('id', itemIds as string[]);
      for (const s of (si || []) as any[]) nameMap[s.id] = s.name;
    }

    setAlertas(((data || []) as any[]).map((r: any) => ({
      item_id:      r.item_id,
      item_name:    nameMap[r.item_id] || '?',
      supplier_name: r.supplier_name,
      variacao_pct: r.variacao_pct,
      preco_atual:  r.preco_atual,
      media_90d:    r.media_90d,
    })));
  };

  const classeColor = (c: 'A' | 'B' | 'C') =>
    c === 'A' ? '#b45309' : c === 'B' ? '#d97706' : '#92400e';

  const gastoTotal = pareto.reduce((s, x) => s + x.gasto, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold gold-text">Dashboard de Compras</h1>
        <p className="text-muted-foreground mt-1 text-sm">Análise dos últimos 12 meses</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[200, 180, 120].map((h, i) => (
            <div key={i} className="bg-white rounded-xl border border-border animate-pulse" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">

          {/* Gasto mensal */}
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Gasto mensal em compras</h2>
            {mensal.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de histórico ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={mensal} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip formatter={(v: number) => fmtCur(v)} labelStyle={{ fontWeight: 600 }} />
                  <Line type="monotone" dataKey="gasto" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Curva ABC / Pareto */}
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Curva ABC — Insumos por gasto</h2>
              <span className="text-xs text-muted-foreground">Total: {fmtCur(gastoTotal)}</span>
            </div>
            <div className="flex gap-3 mb-4">
              {(['A', 'B', 'C'] as const).map(c => (
                <span key={c} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: classeColor(c) }} />
                  Classe {c}
                </span>
              ))}
            </div>
            {pareto.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem histórico de preços ainda.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={pareto} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="item_name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={55} />
                    <Tooltip formatter={(v: number) => fmtCur(v)} />
                    <Bar dataKey="gasto" radius={[2, 2, 0, 0]}>
                      {pareto.map((p, i) => (
                        <Cell key={i} fill={classeColor(p.classe)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Tabela ABC resumida */}
                <div className="mt-4 overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">INSUMO</th>
                        <th className="text-center px-3 py-2 font-semibold text-muted-foreground">CLASSE</th>
                        <th className="text-right px-4 py-2 font-semibold text-muted-foreground">GASTO</th>
                        <th className="text-right px-4 py-2 font-semibold text-muted-foreground">% ACUM.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {pareto.map(p => (
                        <tr key={p.item_id}
                          className="hover:bg-amber-50/30 cursor-pointer"
                          onClick={() => navigate(`/items/${p.item_id}`)}>
                          <td className="px-4 py-2 font-medium">{p.item_name}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold"
                              style={{ background: classeColor(p.classe) }}>
                              {p.classe}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">{fmtCur(p.gasto)}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{fmtNum(p.pctAcum, 1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Alertas de variação */}
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Alertas de preço — variação &gt; {LIMITE_ALERTA}% vs. média 90 dias
            </h2>
            {alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum insumo com variação significativa. ✓
              </p>
            ) : (
              <div className="space-y-2">
                {alertas.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(`/items/${a.item_id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-amber-50/40 transition-colors text-left"
                  >
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.variacao_pct > 0 ? 'text-amber-500' : 'text-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-foreground">{a.item_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">via {a.supplier_name}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-bold ${a.variacao_pct > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                        {a.variacao_pct > 0 ? '+' : ''}{fmtNum(a.variacao_pct, 1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtCur(a.preco_atual)} vs. {fmtCur(a.media_90d)} (90d)
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
