import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronRight, TrendingUp, Users } from 'lucide-react';
import { fetchEventos } from '../api/bubble';
import { BubbleEvento } from '../types';
import EventCard from '../components/EventCard';
import { fmtDate } from '../lib/format';

function Skeleton() {
  return <div className="h-[88px] bg-stone-100 rounded-2xl animate-pulse" />;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<BubbleEvento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventos({ limit: 200, sortOrder: 'desc' })
      .then((r) => setEvents(r.response.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const upcoming = events
    .filter((e) => e.dataDoEvento && new Date(e.dataDoEvento) >= now)
    .sort((a, b) => new Date(a.dataDoEvento!).getTime() - new Date(b.dataDoEvento!).getTime());

  const thisMonth = events.filter((e) => {
    if (!e.dataDoEvento) return false;
    const d = new Date(e.dataDoEvento);
    return d >= monthStart && d <= monthEnd;
  });

  const confirmed = events.filter((e) => e.Status?.toLowerCase() === 'confirmado');

  const nextEvent = upcoming[0];
  const todayStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="pb-28 max-w-lg mx-auto">
      {/* Top bar */}
      <div className="bg-amber-800 pt-safe px-5 pt-10 pb-8">
        <p className="text-amber-300 text-xs capitalize mb-1">{todayStr}</p>
        <h1 className="text-2xl font-bold text-white tracking-wide">Rondello Buffet</h1>
        <p className="text-amber-300/80 text-sm">Gestão de Eventos</p>
      </div>

      <div className="px-4 -mt-4 space-y-5">
        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: events.length, Icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Este mês', value: thisMonth.length, Icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Confirmados', value: confirmed.length, Icon: Users, color: 'text-amber-700', bg: 'bg-amber-50' },
          ].map(({ label, value, Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl p-3 shadow-sm border border-stone-100 text-center">
              <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center mx-auto mb-1.5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-xl font-bold text-stone-800">{loading ? '—' : value}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Next event highlight */}
        {!loading && nextEvent && (
          <Link
            to={`/eventos/${nextEvent._id}`}
            className="block bg-amber-800 rounded-2xl p-4 shadow text-white"
          >
            <p className="text-amber-300 text-xs font-medium uppercase tracking-widest mb-1">
              Próximo evento
            </p>
            <p className="font-bold text-lg leading-tight">
              {nextEvent.NomeDoContratante ?? '—'}
            </p>
            {nextEvent.NomeDoEvento && (
              <p className="text-amber-200 text-sm">{nextEvent.NomeDoEvento}</p>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-amber-300 text-sm">
              <Calendar className="w-4 h-4" />
              {fmtDate(nextEvent.dataDoEvento)}
            </div>
          </Link>
        )}

        {/* Upcoming list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-stone-800">Próximos Eventos</h2>
            <Link
              to="/eventos"
              className="flex items-center gap-0.5 text-xs text-amber-700 font-medium"
            >
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton /><Skeleton /><Skeleton />
            </div>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-10 text-stone-400">
              <Calendar className="w-9 h-9 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum evento agendado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 5).map((e) => (
                <EventCard key={e._id} event={e} showRelative />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
