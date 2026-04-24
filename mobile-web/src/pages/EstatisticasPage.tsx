import { useEffect, useMemo, useState } from 'react';
import { fetchEventos } from '../api/bubble';
import { BubbleEvento } from '../types';
import PageHeader from '../components/PageHeader';
import { fmtCurrency } from '../lib/format';

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const STATUS_COLORS: Record<string, string> = {
  confirmado: 'bg-emerald-500',
  pendente:   'bg-amber-400',
  realizado:  'bg-blue-500',
  cancelado:  'bg-red-400',
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4">
      <p className="text-xs text-stone-400 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-stone-800">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function EstatisticasPage() {
  const [events, setEvents] = useState<BubbleEvento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventos({ limit: 500 })
      .then((r) => setEvents(r.response.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    // By status
    const byStatus: Record<string, number> = {};
    events.forEach((e) => {
      const k = (e.Status ?? 'Pendente').toLowerCase();
      byStatus[k] = (byStatus[k] ?? 0) + 1;
    });

    // By month (current year)
    const byMonth: number[] = Array(12).fill(0);
    events.forEach((e) => {
      if (!e.dataDoEvento) return;
      const d = new Date(e.dataDoEvento);
      if (d.getFullYear() === currentYear) byMonth[d.getMonth()]++;
    });

    // Revenue
    const totalRevenue = events.reduce((s, e) => s + (e.Valor ?? 0), 0);
    const confirmedRevenue = events
      .filter((e) => e.Status?.toLowerCase() === 'confirmado')
      .reduce((s, e) => s + (e.Valor ?? 0), 0);

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const thisMonth = events.filter((e) => {
      if (!e.dataDoEvento) return false;
      const d = new Date(e.dataDoEvento);
      return d >= monthStart && d <= monthEnd;
    });

    const maxByMonth = Math.max(...byMonth, 1);

    return { byStatus, byMonth, totalRevenue, confirmedRevenue, thisMonth, maxByMonth };
  }, [events]);

  if (loading) {
    return (
      <div className="pb-28 max-w-lg mx-auto">
        <PageHeader title="Estatísticas" />
        <div className="p-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-stone-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 max-w-lg mx-auto">
      <PageHeader title="Estatísticas" subtitle={`${events.length} eventos no total`} />

      <div className="px-4 pt-4 space-y-5">
        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total de Eventos" value={events.length} />
          <StatCard label="Este Mês" value={stats.thisMonth.length} sub={new Date().toLocaleDateString('pt-BR', { month: 'long' })} />
          {stats.totalRevenue > 0 && (
            <StatCard label="Receita Total" value={fmtCurrency(stats.totalRevenue)} />
          )}
          {stats.confirmedRevenue > 0 && (
            <StatCard label="Confirmado" value={fmtCurrency(stats.confirmedRevenue)} />
          )}
        </div>

        {/* Status breakdown */}
        {Object.keys(stats.byStatus).length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">
              Por Status
            </p>
            <div className="space-y-3">
              {Object.entries(stats.byStatus)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const pct = Math.round((count / events.length) * 100);
                  const barColor = STATUS_COLORS[status] ?? 'bg-stone-400';
                  const label = status.charAt(0).toUpperCase() + status.slice(1);
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-stone-700 font-medium">{label}</span>
                        <span className="text-stone-400">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Monthly chart */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">
            Eventos por Mês — {new Date().getFullYear()}
          </p>
          <div className="flex items-end gap-1.5 h-28">
            {stats.byMonth.map((count, i) => {
              const height = stats.maxByMonth > 0 ? (count / stats.maxByMonth) * 100 : 0;
              const isCurrentMonth = i === new Date().getMonth();
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-stone-400">{count > 0 ? count : ''}</span>
                  <div className="w-full flex items-end" style={{ height: 80 }}>
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        isCurrentMonth ? 'bg-amber-600' : 'bg-amber-200'
                      }`}
                      style={{ height: `${Math.max(height, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <span
                    className={`text-[10px] ${isCurrentMonth ? 'font-bold text-amber-700' : 'text-stone-400'}`}
                  >
                    {MONTHS_SHORT[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
