import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react';
import { fetchEventos } from '../api/bubble';
import { BubbleEvento } from '../types';
import StatusBadge from '../components/StatusBadge';
import { fmtCurrency } from '../lib/format';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const TYPE_COLORS: Record<string, string> = {
  casamento:    'bg-pink-100 text-pink-700',
  corporativo:  'bg-blue-100 text-blue-700',
  aniversário:  'bg-violet-100 text-violet-700',
  debutante:    'bg-rose-100 text-rose-700',
  formatura:    'bg-emerald-100 text-emerald-700',
};
function typeColor(t?: string) {
  return TYPE_COLORS[(t ?? '').toLowerCase()] ?? 'bg-stone-100 text-stone-600';
}

function EventRow({ event }: { event: BubbleEvento }) {
  const date = event.dataDoEvento ? new Date(event.dataDoEvento) : null;
  const day  = date?.toLocaleDateString('pt-BR', { day: '2-digit' });
  const weekday = date?.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

  return (
    <Link
      to={`/eventos/${event._id}`}
      className="flex items-center gap-3 bg-white rounded-2xl border border-stone-200 p-3.5 active:bg-stone-50 transition-colors"
    >
      {/* Date block */}
      <div className="w-12 shrink-0 flex flex-col items-center bg-amber-50 rounded-xl py-2">
        <span className="text-[10px] font-semibold text-amber-600 uppercase">{weekday}</span>
        <span className="text-xl font-bold text-amber-900 leading-none">{day ?? '—'}</span>
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-stone-800 truncate text-[15px]">
          {event.NomeDoContratante ?? '—'}
        </p>
        {event.LocalDoEvento && (
          <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5 truncate">
            <MapPin className="w-3 h-3 shrink-0" />
            {event.LocalDoEvento}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {event.TipoDoEvento && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeColor(event.TipoDoEvento)}`}>
              {event.TipoDoEvento}
            </span>
          )}
          {event.QuantidadeDeConvidados != null && (
            <span className="text-[11px] text-stone-400 flex items-center gap-0.5">
              <Users className="w-3 h-3" />{event.QuantidadeDeConvidados}
            </span>
          )}
          {event.Preco != null && (
            <span className="text-[11px] font-semibold text-emerald-700">
              {fmtCurrency(event.Preco)}
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <StatusBadge status={event.Status} />
        <ChevronRight className="w-4 h-4 text-stone-300" />
      </div>
    </Link>
  );
}

function Skeleton() {
  return <div className="h-20 bg-stone-100 rounded-2xl animate-pulse" />;
}

export default function EventosPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [events, setEvents] = useState<BubbleEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEventos({ limit: 500 })
      .then((r) => setEvents(r.response.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Count events per month for the current year
  const countsByMonth = useMemo(() => {
    const counts = Array(12).fill(0);
    events.forEach((e) => {
      if (!e.dataDoEvento) return;
      const d = new Date(e.dataDoEvento);
      if (d.getFullYear() === year) counts[d.getMonth()]++;
    });
    return counts;
  }, [events, year]);

  // Events for selected month, sorted by date
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

  // Scroll active month tab into view
  useEffect(() => {
    const el = tabsRef.current?.querySelector(`[data-month="${month}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [month]);

  return (
    <div className="pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-stone-200">
        {/* Year selector */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setYear(y => y - 1)}
            className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-stone-600" />
          </button>
          <div className="text-center">
            <p className="font-bold text-stone-800 text-lg">{year}</p>
            <p className="text-xs text-stone-400">
              {loading ? '…' : `${events.filter(e => new Date(e.dataDoEvento ?? '').getFullYear() === year).length} eventos`}
            </p>
          </div>
          <button
            onClick={() => setYear(y => y + 1)}
            className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-stone-600" />
          </button>
        </div>

        {/* Month tabs */}
        <div
          ref={tabsRef}
          className="flex gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-none"
        >
          {MONTHS.map((m, i) => {
            const active = i === month;
            const count  = countsByMonth[i];
            return (
              <button
                key={m}
                data-month={i}
                onClick={() => setMonth(i)}
                className={`shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl transition-colors ${
                  active ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                <span className={`text-[11px] font-semibold`}>{m}</span>
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

      {/* Section title */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="font-bold text-stone-800">{MONTHS_FULL[month]} {year}</h2>
        <span className="text-sm text-stone-400">
          {loading ? '' : `${monthEvents.length} evento${monthEvents.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Event list */}
      <div className="px-4 space-y-2.5">
        {loading ? (
          <>
            <Skeleton /><Skeleton /><Skeleton />
          </>
        ) : monthEvents.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-stone-500 font-medium">Sem eventos em {MONTHS_FULL[month]}</p>
            <p className="text-stone-400 text-sm mt-1">Selecione outro mês</p>
          </div>
        ) : (
          monthEvents.map((e) => <EventRow key={e._id} event={e} />)
        )}
      </div>
    </div>
  );
}
