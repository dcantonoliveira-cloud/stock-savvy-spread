import { useEffect, useMemo, useState } from 'react';
import { Calendar, Users, UtensilsCrossed } from 'lucide-react';
import { fetchAllDegustacoes } from '../api/bubble';
import { BubbleDegustacao } from '../types';
import { fmtDate } from '../lib/format';

const FILTERS = ['Todas', 'Próximas', 'Realizadas'];

function Skeleton() {
  return <div className="h-24 bg-black/5 rounded-3xl animate-pulse" />;
}

export default function DegustacaoPage() {
  const [items, setItems] = useState<BubbleDegustacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('Todas');

  useEffect(() => {
    fetchAllDegustacoes()
      .then((all) => setItems(all))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();

  const filtered = useMemo(() => {
    switch (filter) {
      case 'Próximas':
        return items.filter((d) => d.data && new Date(d.data) >= now);
      case 'Realizadas':
        return items.filter((d) => d.data && new Date(d.data) < now);
      default:
        return items;
    }
  }, [items, filter]);

  // Sort filtered: upcoming first, then past
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = a.data ? new Date(a.data).getTime() : 0;
      const db = b.data ? new Date(b.data).getTime() : 0;
      const aFuture = a.data ? new Date(a.data) >= now : false;
      const bFuture = b.data ? new Date(b.data) >= now : false;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      return aFuture ? da - db : db - da; // upcoming asc, past desc
    });
  }, [filtered]);

  const upcoming = items.filter((d) => d.data && new Date(d.data) >= now).length;

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-safe pt-8 pb-8 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full" />
        <div className="relative">
          <p className="text-gold-400/70 text-xs font-bold uppercase tracking-widest">Menu de prova</p>
          <h1 className="text-4xl font-black text-white tracking-tight mt-1 leading-none">Degustações</h1>
          <p className="text-white/35 text-xs font-bold mt-1.5 uppercase tracking-[0.15em]">
            {loading ? '…' : `${upcoming} próxima${upcoming !== 1 ? 's' : ''} · ${items.length} total`}
          </p>
        </div>
      </div>

      <div className="px-4 space-y-4 pt-4">

        {/* ── Filter tabs ─────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm ${
                filter === f
                  ? 'bg-ron-900 text-white shadow-lg shadow-ron-900/30'
                  : 'bg-white text-gray-500'
              }`}
            >
              {f}
            </button>
          ))}
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
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <UtensilsCrossed className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-700">Nenhuma degustação</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter === 'Todas' ? 'Ainda não há degustações cadastradas' : `Nenhuma degustação ${filter.toLowerCase()}`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((d) => {
              const isPast = d.data ? new Date(d.data) < now : false;
              return (
                <div
                  key={d._id}
                  className={`flex items-start gap-3 bg-white rounded-3xl p-4 shadow-sm ${isPast ? 'opacity-60' : ''}`}
                >
                  {/* color bar */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${isPast ? 'bg-gray-300' : 'bg-violet-400'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm flex-1">
                        Degustação
                      </p>
                      {!isPast && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200">
                          Agendada
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                      {d.data && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-gold-400" />
                          {fmtDate(d.data)}
                        </span>
                      )}
                      {d.convidados != null && d.convidados > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <Users className="w-3.5 h-3.5 text-gold-400" />
                          {d.convidados} convidados
                        </span>
                      )}
                    </div>

                    {d['Observações'] && (
                      <p className="mt-2 text-xs text-gray-500 leading-relaxed line-clamp-2 border-t border-gray-50 pt-2">
                        {d['Observações']}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
