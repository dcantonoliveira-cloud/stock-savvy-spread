import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Calendar, CalendarDays,
  CircleDot, MapPin, UtensilsCrossed,
} from 'lucide-react';
import { fetchTasting } from '../api/supabase';
import type { Event, TastingSession } from '../types';
import { fmtDate } from '../lib/format';
import { eventDisplayName, eventLocationName, statusLabel, statusBadgeClass } from '../lib/eventFilters';

export default function DegustacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [degu, setDegu]         = useState<TastingSession | null>(null);
  const [eventos, setEventos]   = useState<Event[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchTasting(id)
      .then(({ linkedEvents, ...session }) => {
        setDegu(session);
        setEventos(linkedEvents);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const isPast = degu ? new Date(degu.scheduled_date) < new Date() : false;

  return (
    <div className="pb-36 max-w-lg mx-auto">
      {loading && <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-gold-400 animate-pulse" />}

      {/* Hero */}
      <div className="bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-hero pb-6 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-36 h-36 bg-white/5 rounded-full" />
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center mb-4"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        {loading ? (
          <div className="space-y-2">
            <div className="h-7 w-36 bg-white/20 rounded-xl animate-pulse" />
            <div className="h-4 w-24 bg-white/10 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <UtensilsCrossed className="w-4 h-4 text-gold-400" />
              <p className="text-gold-400 text-xs font-black uppercase tracking-widest">
                {isPast ? 'Realizada' : 'Agendada'}
              </p>
            </div>
            <h1 className="text-2xl font-black text-white leading-tight">Degustação</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {degu?.scheduled_date && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {fmtDate(degu.scheduled_date)}
                </span>
              )}
              {degu?.max_couples != null && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  {degu.max_couples} casais
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          <>{[1,2,3].map((i) => <div key={i} className="h-28 bg-black/5 rounded-3xl animate-pulse" />)}</>
        ) : error || !degu ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500">Erro ao carregar degustação.</p>
          </div>
        ) : eventos.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
            <UtensilsCrossed className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum evento vinculado</p>
          </div>
        ) : (
          eventos.map((ev) => (
            <button
              key={ev.id}
              onClick={() => navigate(`/eventos/${ev.id}`)}
              className="w-full text-left bg-white rounded-3xl p-4 shadow-sm space-y-3 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-gray-900 text-base leading-tight flex-1">
                  {eventDisplayName(ev)}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusBadgeClass(ev.status)}`}>
                    {statusLabel(ev.status)}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-200" />
                </div>
              </div>
              <div className="space-y-1.5">
                {ev.event_date && (
                  <span className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <CalendarDays className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                    {fmtDate(ev.event_date)}
                  </span>
                )}
                {eventLocationName(ev) && (
                  <span className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                    {eventLocationName(ev)}
                  </span>
                )}
                {!ev.event_date && !eventLocationName(ev) && (
                  <span className="flex items-center gap-2 text-xs text-gray-400">
                    <CircleDot className="w-3.5 h-3.5 shrink-0" />
                    Sem detalhes adicionais
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
