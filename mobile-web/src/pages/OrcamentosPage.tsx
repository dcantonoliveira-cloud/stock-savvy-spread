import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, MapPin, FileText, UtensilsCrossed } from 'lucide-react';
import { fetchAllEvents, fetchAllTastings } from '../api/supabase';
import type { Event, TastingSession } from '../types';
import { fmtDate } from '../lib/format';
import { eventDisplayName, eventLocationName, statusLabel, statusBadgeClass } from '../lib/eventFilters';

// Somente 1º Contato e Negociando com data futura
const PIPELINE_STATUSES = ['lead', 'negotiating'];

function Skeleton() {
  return <div className="h-20 bg-black/5 rounded-3xl animate-pulse" />;
}

export default function OrcamentosPage() {
  const [eventos, setEventos]   = useState<Event[]>([]);
  const [tastings, setTastings] = useState<TastingSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    Promise.all([fetchAllEvents(), fetchAllTastings()])
      .then(([allEvents, allTastings]) => {
        const now = new Date();
        const prospects = allEvents.filter((e) =>
          PIPELINE_STATUSES.includes(e.status) &&
          e.event_name?.trim() &&
          (e.event_date ? new Date(e.event_date) >= now : true)
        );
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [...eventos].sort((a, b) => {
      const da = a.event_date ? new Date(a.event_date).getTime() : Infinity;
      const db = b.event_date ? new Date(b.event_date).getTime() : Infinity;
      return da - db;
    });
    return eventos
      .filter((e) => eventDisplayName(e).toLowerCase().includes(q))
      .sort((a, b) => {
        const da = a.event_date ? new Date(a.event_date).getTime() : Infinity;
        const db = b.event_date ? new Date(b.event_date).getTime() : Infinity;
        return da - db;
      });
  }, [eventos, search]);

  const leadCount       = eventos.filter((e) => e.status === 'lead').length;
  const negotiatingCount = eventos.filter((e) => e.status === 'negotiating').length;

  return (
    <div className="pb-36 max-w-lg mx-auto">
      {loading && <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-gold-400 animate-pulse" />}

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-safe pb-8 overflow-hidden min-h-[140px] flex flex-col justify-end">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full" />
        <div className="relative">
          <h1 className="text-4xl font-black text-white tracking-tight leading-none">Orçamentos</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1.5 bg-white/10 rounded-xl px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span className="text-white/70 text-[11px] font-bold">{leadCount} 1º Contato</span>
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 rounded-xl px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-white/70 text-[11px] font-bold">{negotiatingCount} Negociando</span>
            </span>
          </div>
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
              {search ? `Nenhum resultado para "${search}"` : 'Sem 1º Contato ou Negociando com data futura'}
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
