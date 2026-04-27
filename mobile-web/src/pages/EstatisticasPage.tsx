import { useEffect, useMemo, useState } from 'react';
import { fetchEventos } from '../api/bubble';
import { BubbleEvento } from '../types';
import { fmtCurrency } from '../lib/format';

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function StatCard({
  label, value, sub, accent = false,
}: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl p-5 shadow-sm ${accent ? 'bg-ron-900 shadow-ron-900/30' : 'bg-white'}`}>
      <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${accent ? 'text-gold-300' : 'text-gray-400'}`}>
        {label}
      </p>
      <p className={`text-2xl font-black ${accent ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sub && (
        <p className={`text-xs font-medium mt-0.5 capitalize ${accent ? 'text-gold-300/70' : 'text-gray-400'}`}>
          {sub}
        </p>
      )}
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

    const byStatus: Record<string, number> = {};
    events.forEach((e) => {
      const k = (e.Status ?? 'Pendente');
      byStatus[k] = (byStatus[k] ?? 0) + 1;
    });

    const byMonth: number[] = Array(12).fill(0);
    events.forEach((e) => {
      if (!e.dataDoEvento) return;
      const d = new Date(e.dataDoEvento);
      if (d.getFullYear() === currentYear) byMonth[d.getMonth()]++;
    });

    const totalRevenue = events.reduce((s, e) => s + (e.Preco ?? 0), 0);
    const fechadosRevenue = events
      .filter((e) => e.Status === 'Fechado')
      .reduce((s, e) => s + (e.Preco ?? 0), 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const thisMonth = events.filter((e) => {
      if (!e.dataDoEvento) return false;
      const d = new Date(e.dataDoEvento);
      return d >= monthStart && d <= monthEnd;
    });

    const maxByMonth = Math.max(...byMonth, 1);
    return { byStatus, byMonth, totalRevenue, fechadosRevenue, thisMonth, maxByMonth };
  }, [events]);

  const currentMonthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-safe pt-12 pb-20 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-6  w-36 h-36 bg-white/5 rounded-full" />
        <div className="relative">
          <p className="text-gold-400/80 text-sm">Visão geral</p>
          <h1 className="text-4xl font-black text-white tracking-tight mt-1 leading-none">Estatísticas</h1>
          <p className="text-gold-400/70 text-sm font-medium mt-1">
            {loading ? '…' : `${events.length} eventos no total`}
          </p>
        </div>
      </div>

      <div className="px-4 space-y-5">

        {/* ── KPI grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 -mt-10">
          {loading ? (
            <>
              {[1,2,3,4].map(i => (
                <div key={i} className="h-24 bg-black/5 rounded-3xl animate-pulse" />
              ))}
            </>
          ) : (
            <>
              <StatCard label="Total de Eventos" value={events.length} accent />
              <StatCard
                label="Este Mês"
                value={stats.thisMonth.length}
                sub={currentMonthName}
              />
              {stats.totalRevenue > 0 && (
                <StatCard label="Receita Total" value={fmtCurrency(stats.totalRevenue)} />
              )}
              {stats.fechadosRevenue > 0 && (
                <StatCard label="Fechados" value={fmtCurrency(stats.fechadosRevenue)} />
              )}
            </>
          )}
        </div>

        {/* ── Status breakdown ────────────────────────────────────────── */}
        {!loading && Object.keys(stats.byStatus).length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <p className="text-[11px] font-black text-ron-800 uppercase tracking-widest mb-4">
              Por Status
            </p>
            <div className="space-y-3.5">
              {Object.entries(stats.byStatus)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const pct = Math.round((count / events.length) * 100);
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-semibold text-gray-800">{status}</span>
                        <span className="text-gray-400 font-medium">{count} <span className="text-gray-300">({pct}%)</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-ron-800 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── Monthly bar chart ───────────────────────────────────────── */}
        {!loading && (
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <p className="text-[11px] font-black text-ron-800 uppercase tracking-widest mb-4">
              Eventos por Mês — {new Date().getFullYear()}
            </p>
            <div className="flex items-end gap-1 h-28 mt-2">
              {stats.byMonth.map((count, i) => {
                const heightPct = stats.maxByMonth > 0 ? (count / stats.maxByMonth) * 100 : 0;
                const isCurrent = i === new Date().getMonth();
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    {count > 0 && (
                      <span className="text-[9px] font-bold text-gray-400">{count}</span>
                    )}
                    <div className="w-full flex items-end" style={{ height: 72 }}>
                      <div
                        className={`w-full rounded-t-xl transition-all duration-700 ${
                          isCurrent ? 'bg-ron-800' : 'bg-gold-200'
                        }`}
                        style={{ height: `${Math.max(heightPct, count > 0 ? 8 : 2)}%` }}
                      />
                    </div>
                    <span className={`text-[9px] font-bold ${isCurrent ? 'text-ron-800' : 'text-gray-400'}`}>
                      {MONTHS_SHORT[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
