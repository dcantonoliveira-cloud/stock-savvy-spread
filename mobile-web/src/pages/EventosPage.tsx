import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react';
import { fetchEventos } from '../api/bubble';
import { BubbleEvento } from '../types';

const MONTHS      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: BubbleEvento }) {
  const date    = event.dataDoEvento ? new Date(event.dataDoEvento) : null;
  const isPast  = date ? date < new Date() : false;
  const day     = date?.toLocaleDateString('pt-BR', { day: '2-digit' });
  const weekday = date?.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();

  return (
    <Link
      to={`/eventos/${event._id}`}
      className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-colors active:scale-[0.99] ${
        isPast
          ? 'bg-stone-50 border-stone-200 opacity-60'
          : 'bg-white border-amber-200 shadow-sm shadow-amber-100'
      }`}
    >
      {/* Date block */}
      <div className={`w-12 shrink-0 flex flex-col items-center rounded-xl py-2 ${
        isPast ? 'bg-stone-200' : 'bg-amber-100'
      }`}>
        <span className={`text-[10px] font-bold ${isPast ? 'text-stone-500' : 'text-amber-600'}`}>
          {weekday}
        </span>
        <span className={`text-xl font-extrabold leading-none ${isPast ? 'text-stone-600' : 'text-amber-900'}`}>
          {day ?? '—'}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`font-bold truncate text-[15px] ${isPast ? 'text-stone-500' : 'text-stone-800'}`}>
          {event.NomeDoContratante ?? event.NomeDoEvento ?? '—'}
        </p>

        {event.NomeDoEvento && event.NomeDoEvento !== event.NomeDoContratante && (
          <p className="text-xs text-stone-400 truncate">{event.NomeDoEvento}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {event.LocalDoEvento && (
            <span className="flex items-center gap-1 text-xs text-stone-400 truncate max-w-[160px]">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{event.LocalDoEvento}</span>
            </span>
          )}
          {event.QuantidadeDeConvidados != null && (
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <Users className="w-3 h-3 shrink-0" />
              {event.QuantidadeDeConvidados}
            </span>
          )}
        </div>
      </div>

      {/* Future indicator / arrow */}
      <div className="shrink-0">
        {isPast ? (
          <ChevronRight className="w-4 h-4 text-stone-300" />
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
              Próximo
            </span>
            <ChevronRight className="w-4 h-4 text-amber-400" />
          </div>
        )}
      </div>
    </Link>
  );
}

function Skeleton() {
  return <div className="h-20 bg-stone-100 rounded-2xl animate-pulse" />;
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
    // Fetch only "Fechado" events from Bubble API
    fetchEventos({
      limit: 500,
      sortOrder: 'asc',
      constraints: [{ key: 'Status', constraint_type: 'equals', value: 'Fechado' }],
    })
      .then((r) => {
        // Double-check on frontend (case-insensitive) in case Bubble ignores constraint
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

  // Scroll active tab into view when month changes
  useEffect(() => {
    const el = tabsRef.current?.querySelector(`[data-month="${month}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [month]);

  return (
    <div className="pb-28 max-w-lg mx-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-white border-b border-stone-200">
        {/* Year selector */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-stone-600" />
          </button>
          <div className="text-center">
            <p className="font-bold text-stone-800 text-lg leading-none">{year}</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {loading ? '…' : `${events.filter((e) => new Date(e.dataDoEvento ?? '').getFullYear() === year).length} eventos fechados`}
            </p>
          </div>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-stone-600" />
          </button>
        </div>

        {/* Month tabs */}
        <div ref={tabsRef} className="flex gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-none">
          {MONTHS.map((m, i) => {
            const active = i === month;
            const count  = countsByMonth[i];
            return (
              <button
                key={m}
                data-month={i}
                onClick={() => setMonth(i)}
                className={`shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl transition-colors ${
                  active ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-500'
                }`}
              >
                <span className="text-[11px] font-semibold">{m}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-bold mt-0.5 ${active ? 'text-amber-200' : 'text-amber-700'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {loading ? (
          <div className="space-y-2.5">
            <Skeleton /><Skeleton /><Skeleton />
          </div>
        ) : monthEvents.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-stone-500 font-medium">Sem eventos em {MONTHS_FULL[month]}</p>
            <p className="text-stone-400 text-sm mt-1">Selecione outro mês ou ano</p>
          </div>
        ) : (
          <>
            {/* Upcoming events */}
            {upcoming.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">
                  Próximos · {upcoming.length}
                </p>
                <div className="space-y-2.5">
                  {upcoming.map((e) => <EventRow key={e._id} event={e} />)}
                </div>
              </div>
            )}

            {/* Past events */}
            {past.length > 0 && (
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">
                  Realizados · {past.length}
                </p>
                <div className="space-y-2.5">
                  {past.map((e) => <EventRow key={e._id} event={e} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
