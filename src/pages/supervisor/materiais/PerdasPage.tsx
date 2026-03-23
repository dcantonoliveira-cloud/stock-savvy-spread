import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, TrendingDown, Package, PackageX } from 'lucide-react';
import { Input } from '@/components/ui/input';

type LossRow = {
  loan_id: string;
  event_name: string;
  date_out: string;
  date_return: string | null;
  status: string;
  item_name: string;
  unit: string;
  qty_out: number;
  qty_returned: number;
  qty_damaged: number;
  lost: number;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  returned: { label: 'Devolvido', color: 'bg-green-100 text-green-700 border-green-200' },
  partial:  { label: 'Parcial',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  active:   { label: 'Ativo',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

export default function PerdasPage() {
  const [rows, setRows] = useState<LossRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'lost' | 'damaged'>('all');

  const load = async () => {
    setLoading(true);
    // Only load events where a devolution was already made (returned or partial)
    const { data: loans } = await supabase
      .from('material_loans' as any)
      .select('id, event_name, date_out, date_return, status')
      .in('status', ['returned', 'partial'])
      .order('date_out', { ascending: false });

    if (!loans || (loans as any[]).length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const loanIds = (loans as any[]).map((l: any) => l.id);
    const { data: items } = await supabase
      .from('material_loan_items' as any)
      .select('*, material_items(name, unit)')
      .in('loan_id', loanIds);

    const result: LossRow[] = [];
    for (const li of (items || []) as any[]) {
      const loan = (loans as any[]).find((l: any) => l.id === li.loan_id);
      if (!loan) continue;
      const lost = (li.qty_out ?? 0) - (li.qty_returned ?? 0);
      const damaged = li.qty_damaged ?? 0;
      // For partial loans: only show items where a return was actually recorded
      if (loan.status === 'partial' && (li.qty_returned ?? 0) === 0 && damaged === 0) continue;
      // Only show rows with actual losses or damage
      if (lost <= 0 && damaged <= 0) continue;
      result.push({
        loan_id: loan.id,
        event_name: loan.event_name,
        date_out: loan.date_out,
        date_return: loan.date_return,
        status: loan.status,
        item_name: li.material_items?.name || '?',
        unit: li.material_items?.unit || '',
        qty_out: li.qty_out ?? 0,
        qty_returned: li.qty_returned ?? 0,
        qty_damaged: damaged,
        lost: Math.max(0, lost),
      });
    }

    setRows(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    const matchSearch = !search ||
      r.event_name.toLowerCase().includes(search.toLowerCase()) ||
      r.item_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'lost' && r.lost > 0) ||
      (filter === 'damaged' && r.qty_damaged > 0);
    return matchSearch && matchFilter;
  });

  const totalLost = rows.reduce((s, r) => s + r.lost, 0);
  const totalDamaged = rows.reduce((s, r) => s + r.qty_damaged, 0);
  const eventsWithLoss = new Set(rows.filter(r => r.lost > 0 || r.qty_damaged > 0).map(r => r.loan_id)).size;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Perdas & Avarias</h1>
          <p className="text-muted-foreground mt-0.5">Histórico de itens perdidos ou avariados em eventos</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-border p-4 text-center shadow-sm">
          <p className="text-3xl font-bold text-foreground">{eventsWithLoss}</p>
          <p className="text-sm text-muted-foreground mt-1">Eventos com perdas</p>
        </div>
        <div className={`rounded-xl border p-4 text-center shadow-sm ${totalLost > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-3xl font-bold ${totalLost > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{totalLost}</p>
          <p className="text-sm text-muted-foreground mt-1">Total de itens perdidos</p>
        </div>
        <div className={`rounded-xl border p-4 text-center shadow-sm ${totalDamaged > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-3xl font-bold ${totalDamaged > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{totalDamaged}</p>
          <p className="text-sm text-muted-foreground mt-1">Total de itens avariados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Buscar evento ou item..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs h-9 text-sm"
        />
        <div className="flex gap-2">
          {(['all', 'lost', 'damaged'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'lost' ? '⚠️ Com Perdas' : '🔧 Com Avarias'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {rows.length === 0 ? (
            <>
              <PackageX className="w-14 h-14 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhuma perda ou avaria registrada</p>
              <p className="text-sm mt-1">As perdas são registradas automaticamente ao finalizar devoluções</p>
            </>
          ) : (
            <>
              <Package className="w-14 h-14 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhum resultado para este filtro</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">DATA</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full">EVENTO</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ITEM</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SAIU</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">VOLTOU</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-red-500 uppercase tracking-wider">PERDIDO</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-amber-600 uppercase tracking-wider">AVARIADO</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((row, idx) => {
                  const st = STATUS_LABEL[row.status] || STATUS_LABEL.active;
                  return (
                    <tr key={idx} className={row.lost > 0 ? 'bg-red-50/20' : ''}>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.date_out + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {row.date_return && (
                          <div className="text-[10px] text-green-600 mt-0.5">
                            Dev: {new Date(row.date_return + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium text-foreground">{row.event_name}</span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{row.item_name}</td>
                      <td className="px-3 py-3 text-center text-muted-foreground">
                        {row.qty_out} <span className="text-xs">{row.unit}</span>
                      </td>
                      <td className="px-3 py-3 text-center text-green-600 font-medium">{row.qty_returned}</td>
                      <td className="px-3 py-3 text-center">
                        {row.lost > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                            <TrendingDown className="w-3 h-3" />{row.lost}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.qty_damaged > 0 ? (
                          <span className="text-amber-600 font-bold">{row.qty_damaged}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-muted/10 text-xs text-muted-foreground">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
