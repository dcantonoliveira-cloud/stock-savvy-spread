import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, TrendingUp, Users } from 'lucide-react';
import { fetchEventos } from '../api/bubble';
import { BubbleEvento } from '../types';
import { fmtDate } from '../lib/format';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-black/5 rounded-2xl animate-pulse ${className}`} />;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<BubbleEvento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventos({ limit: 500, sortOrder: 'desc' })
      .then((r) => setEvents(r.response.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const upcoming = events
    .filter((e) => e.dataDoEvento && new Date(e.dataDoEvento) >= now)
    .sort((a, b) => new Date(a.dataDoEvento!).getTime() - new Date(b.dataDoEvento!).getTime());

  const thisMonth = events.filter((e) => {
    if (!e.dataDoEvento) return false;
    const d = new Date(e.dataDoEvento);
    return d >= monthStart && d <= monthEnd;
  });

  const fechados = events.filter((e) => e.Status?.toLowerCase() === 'fechado');
  const nextEvent = upcoming[0];

  const todayFull = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-amber-950 via-amber-900 to-amber-800 px-5 pt-safe pt-12 pb-20 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-6  w-36 h-36 bg-white/5 rounded-full" />
        <div className="relative">
          <p className="text-amber-400/80 text-sm capitalize">{todayFull}</p>
          <h1 className="text-4xl font-black text-white tracking-tight mt-1 leading-none">Rondello</h1>
          <p className="text-amber-400/70 text-sm font-medium mt-1">Gestão de Eventos</p>
        </div>
      </div>

      <div className="px-4 space-y-5">

        {/* ── KPI cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 -mt-10">
          {[
            { label: 'Total',     value: events.length,      Icon: Calendar,    color: 'text-blue-500',  bg: 'bg-blue-50'   },
            { label: 'Este mês',  value: thisMonth.length,   Icon: TrendingUp,  color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'Fechados',  value: fechados.length,    Icon: Users,       color: 'text-amber-600', bg: 'bg-amber-50'  },
          ].map(({ label, value, Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-3xl p-4 shadow-xl shadow-black/10 text-center">
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-black text-gray-900">{loading ? '—' : value}</p>
              <p className="text-[11px] font-semibold text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Next event highlight ────────────────────────────────────── */}
        {!loading && nextEvent && (
          <Link
            to={`/eventos/${nextEvent._id}`}
            className="block bg-amber-900 rounded-3xl p-5 shadow-xl shadow-amber-900/30 overflow-hidden relative"
          >
            <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
            <p className="text-amber-400 text-[11px] font-black uppercase tracking-widest mb-2">
              ● Próximo evento
            </p>
            <p className="text-white font-black text-xl leading-tight">
              {nextEvent.NomeDoEvento ?? nextEvent.NomeDoContratante ?? '—'}
            </p>
            {nextEvent.LocalDoEvento && (
              <p className="text-amber-300/80 text-sm mt-1">{nextEvent.LocalDoEvento}</p>
            )}
            <div className="flex items-center justify-between mt-4">
              <p className="text-amber-300 text-sm font-semibold">
                {fmtDate(nextEvent.dataDoEvento)}
                {nextEvent.QuantidadeDeConvidados != null && ` · ${nextEvent.QuantidadeDeConvidados} conv.`}
              </p>
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
            </div>
          </Link>
        )}

        {/* ── Upcoming list ───────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-black text-gray-900 text-lg">Próximos Eventos</p>
            <Link to="/eventos" className="flex items-center gap-1 text-sm font-semibold text-amber-800">
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : upcoming.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center">
              <p className="text-4xl mb-2">📅</p>
              <p className="text-gray-500 font-medium text-sm">Nenhum evento agendado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 5).map((e) => {
                const date    = e.dataDoEvento ? new Date(e.dataDoEvento) : null;
                const day     = date?.toLocaleDateString('pt-BR', { day: '2-digit' });
                const weekday = date?.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','').toUpperCase();
                return (
                  <Link
                    key={e._id}
                    to={`/eventos/${e._id}`}
                    className="flex items-center gap-4 bg-white rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-amber-500">{weekday}</span>
                      <span className="text-2xl font-black text-amber-900 leading-none">{day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">
                        {e.NomeDoEvento ?? e.NomeDoContratante ?? '—'}
                      </p>
                      <p className="text-sm text-gray-400 truncate mt-0.5">
                        {e.LocalDoEvento ?? '—'}
                        {e.QuantidadeDeConvidados != null && ` · ${e.QuantidadeDeConvidados} conv.`}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-200 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
