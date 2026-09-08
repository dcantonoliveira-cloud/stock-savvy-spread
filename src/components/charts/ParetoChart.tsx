import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts';

export interface ParetoInput { name: string; value: number }
export interface ParetoRow extends ParetoInput { cumPct: number }
export interface ParetoResult { cutoffCount: number; total: number; rows: ParetoRow[] }

/** Ordena desc por valor, calcula % acumulado e acha quantos itens (do topo) somam 80% do total. */
export function computePareto(input: ParetoInput[]): ParetoResult {
  const sorted = [...input].filter(r => r.value > 0).sort((a, b) => b.value - a.value);
  const grandTotal = sorted.reduce((s, r) => s + r.value, 0);
  let cum = 0;
  let cutoffCount = sorted.length;
  let cutoffReached = false;
  const rows = sorted.map((r, idx) => {
    cum += r.value;
    const cumPct = grandTotal > 0 ? (cum / grandTotal) * 100 : 0;
    if (!cutoffReached && cumPct >= 80) { cutoffCount = idx + 1; cutoffReached = true; }
    return { ...r, cumPct };
  });
  return { cutoffCount, total: sorted.length, rows };
}

/** Resumo em uma frase: "N produtos (X% dos Y) respondem por 80% da receita." */
export function ParetoSummary({ result, subject, metricLabel }: { result: ParetoResult; subject: string; metricLabel: string }) {
  if (result.total === 0) return null;
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
      <p className="text-sm text-foreground">
        <span className="font-bold text-primary">{result.cutoffCount} {subject}</span>
        {' '}({((result.cutoffCount / Math.max(1, result.total)) * 100).toFixed(1).replace('.', ',')}% {result.total === 1 ? 'do' : 'dos'} {result.total})
        {' '}respondem por <span className="font-bold text-primary">80%</span> d{metricLabel}.
      </p>
    </div>
  );
}

export function ParetoChart({
  rows, barColor = '#2E4A7A', lineColor = '#B8922A', valueFormatter, limit = 20, cutoffCount,
}: {
  rows: ParetoRow[];
  barColor?: string;
  lineColor?: string;
  valueFormatter: (v: number) => string;
  limit?: number;
  /** Se informado, garante que o ponto de corte dos 80% (result.cutoffCount) apareça no gráfico,
   * mesmo que isso exija mostrar mais barras que `limit` (até um teto de 60). */
  cutoffCount?: number;
}) {
  const effectiveLimit = cutoffCount != null ? Math.min(Math.max(limit, cutoffCount + 3), 60) : limit;
  const shownRows = rows.slice(0, effectiveLimit);
  const cutoffRow = cutoffCount != null ? shownRows[cutoffCount - 1] : undefined;
  return (
    <div className="h-64 -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={shownRows} margin={{ top: 5, right: 10, left: 0, bottom: 45 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#888' }} angle={-40} textAnchor="end" interval={0} height={60} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#888' }} tickFormatter={valueFormatter} width={70} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} tickFormatter={v => `${v}%`} width={40} />
          <Tooltip
            formatter={(v: number, n: string) => n === 'value' ? [valueFormatter(v), 'Valor'] : [`${v.toFixed(1).replace('.', ',')}%`, 'Acumulado']}
          />
          <ReferenceLine yAxisId="right" y={80} stroke={lineColor} strokeDasharray="4 4" />
          {cutoffRow && (
            <ReferenceLine yAxisId="right" x={cutoffRow.name} stroke={lineColor} strokeDasharray="4 4"
              label={{ value: `${cutoffCount}º item`, position: 'insideTopRight', fontSize: 10, fill: lineColor }} />
          )}
          <Bar yAxisId="left" dataKey="value" name="value" fill={barColor} radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" dataKey="cumPct" name="cumPct" stroke={lineColor} strokeWidth={2} dot={false} />
          {cutoffRow && (
            <ReferenceDot yAxisId="right" x={cutoffRow.name} y={cutoffRow.cumPct} r={5} fill={lineColor} stroke="#fff" strokeWidth={2} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
