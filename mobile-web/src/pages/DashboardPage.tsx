import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { fetchAllEventos, fetchLocaisMap } from '../api/bubble';
import { BubbleEvento } from '../types';
import { fmtDate } from '../lib/format';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-black/5 rounded-2xl animate-pulse ${className}`} />;
}

function EventRow({ e, locaisMap }: { e: BubbleEvento; locaisMap: Record<string, string> }) {
  const date   = e.dataDoEvento ? new Date(e.dataDoEvento) : null;
  const day    = date?.toLocaleDateString('pt-BR', { day: '2-digit' });
  const mon    = date?.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  const local  = e.LocalDoEvento ? (locaisMap[e.LocalDoEvento] ?? '') : '';
  const isPast = date ? date < new Date() : false;

  return (
    <Link
      to={`/eventos/${e._id}`}
      className="flex items-center gap-4 bg-white rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 ${
        isPast ? 'bg-gray-50' : 'bg-ron-900'
      }`}>
        <span className={`text-[10px] font-bold ${isPast ? 'text-gray-400' : 'text-gold-300'}`}>{mon}</span>
        <span className={`text-2xl font-black leading-none ${isPast ? 'text-gray-500' : 'text-white'}`}>
          {day ?? '—'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 truncate">
          {e.NomeDoEvento ?? e.NomeDoContratante ?? '—'}
        </p>
        {local ? (
          <span className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{local}</span>
          </span>
        ) : (
          e.QuantidadeDeConvidados != null && (
            <p className="text-xs text-gray-400 mt-0.5">{e.QuantidadeDeConvidados} convidados</p>
          )
        )}
      </div>
      <ArrowRight className="w-4 h-4 text-gray-200 shrink-0" />
    </Link>
  );
}

export default function DashboardPage() {
  const [events, setEvents] = useState<BubbleEvento[]>([]);
  const [locaisMap, setLocaisMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllEventos({ sortOrder: 'desc' })
      .then((results) => {
        setEvents(results);
        fetchLocaisMap(results).then(setLocaisMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();

  // Most recent year with events (may differ from current calendar year)
  const latestYear = events.reduce((best, e) => {
    const y = e.dataDoEvento ? new Date(e.dataDoEvento).getFullYear() : 0;
    return y > best ? y : best;
  }, 0) || now.getFullYear();

  const eventosPorAno = events.filter(
    (e) => e.dataDoEvento && new Date(e.dataDoEvento).getFullYear() === latestYear
  ).length;

  const upcoming = events
    .filter((e) => e.dataDoEvento && new Date(e.dataDoEvento) >= now)
    .sort((a, b) => new Date(a.dataDoEvento!).getTime() - new Date(b.dataDoEvento!).getTime());

  const hasUpcoming     = upcoming.length > 0;
  const highlightEvent  = hasUpcoming ? upcoming[0] : events[0];      // próximo OU último
  const displayEvents   = hasUpcoming ? upcoming.slice(0, 5) : events.slice(0, 5);
  const sectionTitle    = hasUpcoming ? 'Próximos Eventos' : 'Eventos Recentes';

  const todayFull = now.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-safe pt-8 pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/5 rounded-full" />
        <div className="absolute top-6 right-8 w-2 h-2 bg-gold-400/50 rounded-full" />
        <div className="absolute top-11 right-16 w-1 h-1 bg-gold-400/30 rounded-full" />

        <div className="relative">
          <h1 className="text-4xl font-black text-white tracking-tight leading-none">
            Rondello
          </h1>
          <p className="text-white/35 text-xs font-bold mt-1.5 uppercase tracking-[0.2em]">
            Buffet · Gestão de Eventos
          </p>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* ── KPI cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mt-4">

          {/* Total — grande */}
          <div className="bg-white rounded-3xl p-5 shadow-xl shadow-black/10 flex flex-col justify-between min-h-[120px]">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Total de Eventos
            </p>
            <div>
              <p className="text-5xl font-black text-ron-900 leading-none">
                {loading ? '—' : events.length}
              </p>
              <p className="text-xs text-gray-400 mt-1">cadastrados</p>
            </div>
          </div>

          {/* Coluna direita: Ano + Próximos */}
          <div className="flex flex-col gap-3">
            <div className="bg-ron-900 rounded-3xl p-4 shadow-xl shadow-ron-900/25 flex-1">
              <p className="text-[10px] font-black text-gold-400/70 uppercase tracking-widest">
                {loading ? '—' : latestYear}
              </p>
              <p className="text-3xl font-black text-white leading-none mt-1">
                {loading ? '—' : eventosPorAno}
              </p>
              <p className="text-[10px] text-white/40 mt-0.5">eventos</p>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm flex-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Próximos
              </p>
              <p className={`text-3xl font-black leading-none mt-1 ${upcoming.length > 0 ? 'text-ron-900' : 'text-gray-300'}`}>
                {loading ? '—' : upcoming.length}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">agendados</p>
            </div>
          </div>
        </div>

        {/* ── Evento destaque ─────────────────────────────────────────── */}
        {!loading && highlightEvent && (
          <Link
            to={`/eventos/${highlightEvent._id}`}
            className="block rounded-3xl p-5 shadow-xl shadow-ron-900/25 overflow-hidden relative bg-gradient-to-br from-ron-900 to-ron-800"
          >
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/5 rounded-full" />
            <div className="absolute -bottom-10 -left-6 w-28 h-28 bg-black/10 rounded-full" />

            <div className="relative">
              <p className="text-gold-400 text-[11px] font-black uppercase tracking-widest mb-3">
                {hasUpcoming ? '● Próximo evento' : '◆ Último evento'}
              </p>
              <p className="text-white font-black text-xl leading-tight">
                {highlightEvent.NomeDoEvento ?? highlightEvent.NomeDoContratante ?? '—'}
              </p>

              {highlightEvent.LocalDoEvento && locaisMap[highlightEvent.LocalDoEvento] && (
                <p className="text-gold-300/70 text-sm mt-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {locaisMap[highlightEvent.LocalDoEvento]}
                </p>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                <p className="text-white/50 text-sm font-semibold">
                  {fmtDate(highlightEvent.dataDoEvento)}
                  {highlightEvent.QuantidadeDeConvidados != null &&
                    ` · ${highlightEvent.QuantidadeDeConvidados} conv.`}
                </p>
                <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* ── Lista ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-black text-gray-900 text-lg">{sectionTitle}</p>
            <Link
              to="/eventos"
              className="flex items-center gap-1 text-sm font-semibold text-ron-800"
            >
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : (
            <div className="space-y-3">
              {displayEvents.map((e) => (
                <EventRow key={e._id} e={e} locaisMap={locaisMap} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
