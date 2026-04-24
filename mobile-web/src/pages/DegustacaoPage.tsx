import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, UtensilsCrossed } from 'lucide-react';
import { fetchDegustacoes } from '../api/bubble';
import { BubbleDegustacao } from '../types';
import { fmtDate, fmtTime } from '../lib/format';

const STATUS_TABS = ['Todas', 'Agendada', 'Realizada', 'Cancelada'];

const STATUS_PILL: Record<string, string> = {
  agendada:  'bg-violet-100 text-violet-800',
  realizada: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-red-100 text-red-700',
};

function Skeleton() {
  return <div className="h-24 bg-black/5 rounded-3xl animate-pulse" />;
}

export default function DegustacaoPage() {
  const [items, setItems] = useState<BubbleDegustacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('Todas');

  useEffect(() => {
    fetchDegustacoes()
      .then((r) => setItems(r.response.results))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'Todas') return items;
    return items.filter((d) => d.Status?.toLowerCase() === tab.toLowerCase());
  }, [items, tab]);

  const upcoming = items.filter(
    (d) => d.DataDaDegustacao && new Date(d.DataDaDegustacao) >= new Date()
  ).length;

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-amber-950 via-amber-900 to-amber-800 px-5 pt-safe pt-12 pb-20 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-6  w-36 h-36 bg-white/5 rounded-full" />
        <div className="relative">
          <p className="text-amber-400/80 text-sm">Menu de prova</p>
          <h1 className="text-4xl font-black text-white tracking-tight mt-1 leading-none">Degustações</h1>
          <p className="text-amber-400/70 text-sm font-medium mt-1">
            {loading ? '…' : `${upcoming} próxima${upcoming !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Status filter tabs ──────────────────────────────────────── */}
        <div className="-mt-6 relative z-10">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm ${
                  tab === t
                    ? 'bg-amber-900 text-white shadow-lg shadow-amber-900/30'
                    : 'bg-white text-gray-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── List ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton /><Skeleton /><Skeleton />
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500 text-sm">Erro ao carregar degustações</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <UtensilsCrossed className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-700">Nenhuma degustação</p>
            <p className="text-sm text-gray-400 mt-1">
              {tab === 'Todas' ? 'Ainda não há degustações cadastradas' : `Nenhuma com status "${tab}"`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((d) => {
              const statusKey = (d.Status ?? '').toLowerCase();
              const pillCls = STATUS_PILL[statusKey] ?? 'bg-gray-100 text-gray-600';
              const isPast = d.DataDaDegustacao && new Date(d.DataDaDegustacao) < new Date();

              return (
                <div
                  key={d._id}
                  className={`bg-white rounded-3xl p-4 shadow-sm ${isPast ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="font-bold text-gray-900 flex-1 min-w-0 truncate">
                      {d.NomeDoContratante ?? 'Contratante não informado'}
                    </p>
                    {d.Status && (
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${pillCls}`}>
                        {d.Status}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {d.DataDaDegustacao && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        {fmtDate(d.DataDaDegustacao)}
                      </span>
                    )}
                    {d.HorarioDaDegustacao && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        {fmtTime(d.HorarioDaDegustacao)}
                      </span>
                    )}
                  </div>

                  {d.Observacoes && (
                    <p className="mt-2.5 text-xs text-gray-500 leading-relaxed line-clamp-2 border-t border-gray-50 pt-2.5">
                      {d.Observacoes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
