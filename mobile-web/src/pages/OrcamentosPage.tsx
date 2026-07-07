import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, MapPin, FileText, UtensilsCrossed } from 'lucide-react';
import { fetchAllEvents, fetchAllTastings } from '../api/supabase';
import type { Event, TastingSession } from '../types';
import { fmtDate } from '../lib/format';
import { eventDisplayName, eventLocationName, statusLabel, statusBadgeClass } from '../lib/eventFilters';

const ALL_FILTERS = [
  { key: 'abertos',    label: 'Em aberto',  statuses: ['lead', 'negotiating', 'tasting_scheduled'] },
  { key: 'lead',       label: '1º Contato', statuses: ['lead'] },
  { key: 'negociando', label: 'Negociando', statuses: ['negotiating'] },
  { key: 'tasting',    label: 'Degustação', statuses: ['tasting_scheduled'] },
  { key: 'naofechou',  label: 'Não fechou', statuses: ['lost'] },
  { key: 'cancelado',  label: 'Cancelado',  statuses: ['cancelled'] },
];

function Skeleton() {
  return <div className="h-20 bg-black/5 rounded-3xl animate-pulse" />;
}

export default function OrcamentosPage() {
  const [eventos, setEventos]   = useState<Event[]>([]);
  const [tastings, setTastings] = useState<TastingSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [filter, setFilter]     = useState('abertos');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    Promise.all([fetchAllEvents(), fetchAllTastings()])
      .then(([allEvents, allTastings]) => {
        const prospects = allEvents.filter((e) => {
          const EXCLUIDOS = new Set(['confirmed', 'completed']);
          return !EXCLUIDOS.has(e.status) && e.event_name?.trim();
        });
        setEventos(prospects);
        setTastings(allTastings);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Map eventId → earliest tasting date
  const degMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of tastings) {
      for (const eid of (t.event_ids ?? [])) {
        if (!map[eid] || t.scheduled_date < map[eid]) map[eid] = t.scheduled_date;
      }
    }
    return map;
  }, [tastings]);

  const activeStatuses = ALL_FILTERS.find((f) => f.key === filter)?.statuses ?? ['lead', 'negotiating'];

  const filtered = useMemo(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();

    let list = eventos.filter((e) => activeStatuses.includes(e.status ?? ''));

    if (!q && filter === 'abertos') {
      list = list.filter((e) => e.event_date ? new Date(e.event_date) >= now : true);
    }

    if (q) {
      list = list.filter((e) => eventDisplayName(e).toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      const da = a.event_date ? new Date(a.event_date).getTime() : 0;
      const db = b.event_date ? new Date(b.event_date).getTime() : 0;
      return da - db;
    });
  }, [eventos, filter, search, activeStatuses]);

  return (
    <div className="pb-36 max-w-lg mx-auto">
      {loading && <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-gold-400 animate-pulse" />}

      {/* Hero */}
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
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          className="w-full bg-white rounded-2xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 shadow-sm outline-none focus:ring-2 focus:ring-ron-800/20"
        />

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {ALL_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm ${
                filter === f.key ? 'bg-ron-900 text-white shadow-lg shadow-ron-900/30' : 'bg-white text-gray-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3"><Skeleton /><Skeleton /><Skeleton /></div>
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
              const local = eventLocationName(e);
              return (
                <Link
                  key={e.id}
                  to={`/eventos/${e.id}`}
                  className="flex items-center gap-3 bg-white rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="font-bold text-gray-900 text-sm leading-tight flex-1 truncate">
                        {eventDisplayName(e)}
                      </p>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black border ${statusBadgeClass(e.status)}`}>
                        {statusLabel(e.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {e.event_date && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <Calendar className="w-3 h-3 text-gold-400" />
                          {fmtDate(e.event_date)}
                        </span>
                      )}
                      {local && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <MapPin className="w-3 h-3 text-gold-400" />
                          <span className="truncate max-w-[140px]">{local}</span>
                        </span>
                      )}
                      {degMap[e.id] && (
                        <span className="flex items-center gap-1 text-xs text-violet-600 font-medium">
                          <UtensilsCrossed className="w-3 h-3" />
                          Deg. {fmtDate(degMap[e.id])}
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
