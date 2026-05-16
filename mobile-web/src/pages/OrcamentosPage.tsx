import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, MapPin, FileText, UtensilsCrossed } from 'lucide-react';
import { fetchAllEventos, fetchAllDegustacoes, fetchLocaisMap } from '../api/bubble';
import { BubbleEvento } from '../types';
import { fmtDate } from '../lib/format';

// Statuses shown by default (open prospects)
const DEFAULT_STATUSES = ['1º contato', 'negociando'];

const ALL_FILTERS = [
  { key: 'abertos',    label: 'Em aberto',  statuses: ['1º contato', 'negociando'] },
  { key: '1contato',   label: '1º Contato', statuses: ['1º contato'] },
  { key: 'negociando', label: 'Negociando', statuses: ['negociando'] },
  { key: 'naofechou',  label: 'Não fechou', statuses: ['não fechou'] },
  { key: 'cancelado',  label: 'Cancelado',  statuses: ['cancelado'] },
];

const STATUS_STYLE: Record<string, string> = {
  '1º contato':  'bg-violet-50 text-violet-700 border-violet-200',
  'negociando':  'bg-blue-50   text-blue-700   border-blue-200',
  'não fechou':  'bg-gray-100  text-gray-600   border-gray-200',
  'cancelado':   'bg-red-50    text-red-700    border-red-200',
};

function statusStyle(s?: string) {
  return STATUS_STYLE[(s ?? '').toLowerCase()] ?? 'bg-gray-100 text-gray-500 border-gray-200';
}

function Skeleton() {
  return <div className="h-20 bg-black/5 rounded-3xl animate-pulse" />;
}

export default function OrcamentosPage() {
  const [eventos, setEventos]           = useState<BubbleEvento[]>([]);
  const [locaisMap, setLocaisMap]       = useState<Record<string, string>>({});
  // map: eventId → tasting date string
  const [degMap, setDegMap]             = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(false);
  const [filter, setFilter]             = useState('abertos');
  const [search, setSearch]             = useState('');

  useEffect(() => {
    Promise.all([fetchAllEventos(), fetchAllDegustacoes()])
      .then(async ([allEventos, allDegs]) => {
        // Keep only non-closed prospects with a name
        const prospects = allEventos.filter((e) => {
          const s = (e.status ?? '').toLowerCase();
          return (
            e.NomeDoEvento?.trim() &&
            ['1º contato', 'negociando', 'não fechou', 'cancelado'].includes(s)
          );
        });
        setEventos(prospects);

        // Build eventId → tasting date map from all degustações
        const map: Record<string, string> = {};
        for (const deg of allDegs) {
          if (!deg.data) continue;
          const ids = [...(deg.eventos ?? []), ...(deg.Eventos ?? []), ...(deg.evento ? [deg.evento] : [])];
          for (const eid of ids) {
            // Keep the earliest future tasting date per event
            if (!map[eid] || deg.data < map[eid]) map[eid] = deg.data;
          }
        }
        setDegMap(map);

        const locMap = await fetchLocaisMap(prospects);
        setLocaisMap(locMap);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const activeStatuses = ALL_FILTERS.find((f) => f.key === filter)?.statuses ?? DEFAULT_STATUSES;

  const filtered = useMemo(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();

    let list = eventos.filter((e) =>
      activeStatuses.includes((e.status ?? '').toLowerCase())
    );

    // Without search: "Em aberto" only shows future events
    if (!q && filter === 'abertos') {
      list = list.filter((e) =>
        e.dataDoEvento ? new Date(e.dataDoEvento) >= now : true
      );
    }

    // With search: include past events too, filter by name
    if (q) {
      list = list.filter((e) =>
        (e.NomeDoEvento ?? '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      const da = a.dataDoEvento ? new Date(a.dataDoEvento).getTime() : 0;
      const db = b.dataDoEvento ? new Date(b.dataDoEvento).getTime() : 0;
      return da - db;
    });
  }, [eventos, filter, search, activeStatuses]);

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-gold-400 animate-pulse" />
      )}

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-safe pb-8 overflow-hidden min-h-[130px] flex flex-col justify-end">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full" />
        <div className="relative">
          <h1 className="text-4xl font-black text-white tracking-tight leading-none">Orçamentos</h1>
          <p className="text-white/35 text-xs font-bold mt-1.5 uppercase tracking-[0.15em]">
            {loading ? '…' : `${filtered.length} em aberto`}
          </p>
        </div>
      </div>

      <div className="px-4 space-y-3 pt-4">

        {/* ── Search ───────────────────────────────────────────────────── */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          className="w-full bg-white rounded-2xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 shadow-sm outline-none focus:ring-2 focus:ring-ron-800/20"
        />

        {/* ── Filter tabs ──────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {ALL_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm ${
                filter === f.key
                  ? 'bg-ron-900 text-white shadow-lg shadow-ron-900/30'
                  : 'bg-white text-gray-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── List ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton /><Skeleton /><Skeleton />
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500 text-sm">Erro ao carregar orçamentos</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-700">Nenhum orçamento</p>
            <p className="text-sm text-gray-400 mt-1">
              {search ? `Nenhum resultado para "${search}"` : 'Nenhum evento com este status'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => {
              const local = e.LocalDoEvento ? (locaisMap[e.LocalDoEvento] ?? '') : '';
              return (
                <Link
                  key={e._id}
                  to={`/eventos/${e._id}`}
                  className="flex items-center gap-3 bg-white rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="font-bold text-gray-900 text-sm leading-tight flex-1 truncate">
                        {e.NomeDoEvento ?? '—'}
                      </p>
                      {e.status && (
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black border ${statusStyle(e.status)}`}>
                          {e.status}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {e.dataDoEvento && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <Calendar className="w-3 h-3 text-gold-400" />
                          {fmtDate(e.dataDoEvento)}
                        </span>
                      )}
                      {local && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <MapPin className="w-3 h-3 text-gold-400" />
                          <span className="truncate max-w-[140px]">{local}</span>
                        </span>
                      )}
                      {degMap[e._id] && (
                        <span className="flex items-center gap-1 text-xs text-violet-600 font-medium">
                          <UtensilsCrossed className="w-3 h-3" />
                          Deg. {fmtDate(degMap[e._id])}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-200 shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
