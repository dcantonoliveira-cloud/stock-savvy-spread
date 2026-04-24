import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react';
import { fetchEventos } from '../api/bubble';
import { BubbleEvento } from '../types';

const MONTHS      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event, past }: { event: BubbleEvento; past?: boolean }) {
  const date    = event.dataDoEvento ? new Date(event.dataDoEvento) : null;
  const day     = date?.toLocaleDateString('pt-BR', { day: '2-digit' });
  const weekday = date?.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','').toUpperCase();

  return (
    <Link
      to={`/eventos/${event._id}`}
      className={`flex items-center gap-4 rounded-3xl p-4 transition-all active:scale-[0.99] ${
        past
          ? 'bg-white/60 opacity-60'
          : 'bg-white shadow-sm shadow-black/5'
      }`}
    >
      {/* Date block */}
      <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 ${
        past ? 'bg-gray-100' : 'bg-amber-50'
      }`}>
        <span className={`text-[10px] font-bold ${past ? 'text-gray-400' : 'text-amber-500'}`}>
          {weekday}
        </span>
        <span className={`text-2xl font-black leading-none ${past ? 'text-gray-500' : 'text-amber-900'}`}>
          {day ?? '—'}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`font-bold truncate text-base ${past ? 'text-gray-500' : 'text-gray-900'}`}>
          {event.NomeDoEvento ?? event.NomeDoContratante ?? '—'}
        </p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {event.LocalDoEvento && (
            <span className="flex items-center gap-1 text-xs text-gray-400 truncate max-w-[150px]">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{event.LocalDoEvento}</span>
            </span>
          )}
          {event.QuantidadeDeConvidados != null && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Users className="w-3 h-3" />
              {event.QuantidadeDeConvidados}
            </span>
          )}
        </div>
      </div>

      <ArrowRight className={`w-4 h-4 shrink-0 ${past ? 'text-gray-200' : 'text-gray-300'}`} />
    </Link>
  );
}

function Skeleton() {
  return <div className="h-20 bg-black/5 rounded-3xl animate-pulse" />;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EventosPage() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth());
  const [events, setEvents] = useState<BubbleEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEventos({
      limit: 500,
      sortOrder: 'asc',
      constraints: [{ key: 'Status', constraint_type: 'equals', value: 'Fechado' }],
    })
      .then((r) => {
        const fechados = r.response.results.filter(
          (e) => e.Status?.toLowerCase() === 'fechado'
        );
        setEvents(fechados);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const countsByMonth = useMemo(() => {
    const counts = Array(12).fill(0);
    events.forEach((e) => {
      if (!e.dataDoEvento) return;
      const d = new Date(e.dataDoEvento);
      if (d.getFullYear() === year) counts[d.getMonth()]++;
    });
    return counts;
  }, [events, year]);

  const monthEvents = useMemo(() =>
    events
      .filter((e) => {
        if (!e.dataDoEvento) return false;
        const d = new Date(e.dataDoEvento);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => new Date(a.dataDoEvento!).getTime() - new Date(b.dataDoEvento!).getTime()),
    [events, year, month]
  );

  const upcoming = monthEvents.filter((e) => e.dataDoEvento && new Date(e.dataDoEvento) >= now);
  const past     = monthEvents.filter((e) => e.dataDoEvento && new Date(e.dataDoEvento) <  now);

  const yearTotal = events.filter(
    (e) => new Date(e.dataDoEvento ?? '').getFullYear() === year
  ).length;

  useEffect(() => {
    const el = tabsRef.current?.querySelector(`[data-month="${month}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [month]);

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#f2f2f2]/95 backdrop-blur-xl pt-safe">

        {/* Year selector */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="w-9 h-9 rounded-2xl bg-white shadow-sm flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="text-center">
            <p className="font-black text-gray-900 text-xl leading-none">{year}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              {loading ? '…' : `${yearTotal} eventos`}
            </p>
          </div>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="w-9 h-9 rounded-2xl bg-white shadow-sm flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Month tabs */}
        <div ref={tabsRef} className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
          {MONTHS.map((m, i) => {
            const active = i === month;
            const count  = countsByMonth[i];
            return (
              <button
                key={m}
                data-month={i}
                onClick={() => setMonth(i)}
                className={`shrink-0 flex flex-col items-center px-3.5 py-2 rounded-2xl transition-all ${
                  active
                    ? 'bg-amber-900 shadow-lg shadow-amber-900/30'
                    : 'bg-white shadow-sm'
                }`}
              >
                <span className={`text-[11px] font-bold ${active ? 'text-amber-200' : 'text-gray-500'}`}>
                  {m}
                </span>
                <span className={`text-base font-black leading-tight ${active ? 'text-white' : count > 0 ? 'text-amber-800' : 'text-gray-300'}`}>
                  {count > 0 ? count : '·'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="px-4 pt-2 space-y-5">

        {loading ? (
          <div className="space-y-3 pt-2">
            <Skeleton /><Skeleton /><Skeleton />
          </div>
        ) : monthEvents.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center mt-4">
            <p className="text-5xl mb-3">📅</p>
            <p className="font-bold text-gray-700">{MONTHS_FULL[month]} sem eventos</p>
            <p className="text-sm text-gray-400 mt-1">Selecione outro mês</p>
          </div>
        ) : (
          <>
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black text-gray-900 uppercase tracking-widest">
                    Próximos
                  </span>
                  <span className="text-xs font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full shadow-sm">
                    {upcoming.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {upcoming.map((e) => <EventCard key={e._id} event={e} />)}
                </div>
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    Realizados
                  </span>
                  <span className="text-xs font-bold text-gray-300 bg-white px-2 py-0.5 rounded-full shadow-sm">
                    {past.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {past.map((e) => <EventCard key={e._id} event={e} past />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
