import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchEventos } from '../api/bubble';
import { BubbleEvento } from '../types';
import StatusBadge from '../components/StatusBadge';
import PageHeader from '../components/PageHeader';
import { fmtDate } from '../lib/format';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const STATUS_DOT: Record<string, string> = {
  confirmado: 'bg-emerald-500',
  pendente:   'bg-amber-400',
  cancelado:  'bg-red-400',
  realizado:  'bg-blue-400',
};

function dotColor(status?: string) {
  return STATUS_DOT[(status ?? '').toLowerCase()] ?? 'bg-stone-400';
}

export default function CalendarioPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selected, setSelected] = useState<number | null>(today.getDate());
  const [events, setEvents] = useState<BubbleEvento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventos({ limit: 500 })
      .then((r) => setEvents(r.response.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Map: "YYYY-MM-DD" → events on that day
  const byDate = useMemo(() => {
    const map = new Map<string, BubbleEvento[]>();
    events.forEach((e) => {
      if (!e.dataDoEvento) return;
      const key = e.dataDoEvento.slice(0, 10); // "YYYY-MM-DD"
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [events]);

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelected(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelected(null);
  };

  const selectedKey = selected != null
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selected).padStart(2, '0')}`
    : null;

  const selectedEvents = selectedKey ? (byDate.get(selectedKey) ?? []) : [];

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="pb-28 max-w-lg mx-auto">
      <PageHeader title="Agenda" subtitle={`${MONTHS[month]} ${year}`} />

      <div className="px-4 pt-4 space-y-4">
        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 text-stone-600" />
          </button>
          <span className="font-bold text-stone-800">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5 text-stone-600" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="bg-white rounded-2xl border border-stone-200 p-3">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-stone-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;

              const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = byDate.get(key) ?? [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = day === selected;

              return (
                <button
                  key={key}
                  onClick={() => setSelected(day === selected ? null : day)}
                  className={`flex flex-col items-center py-1 rounded-xl transition-colors ${
                    isSelected
                      ? 'bg-amber-800'
                      : isToday
                      ? 'bg-amber-100'
                      : 'hover:bg-stone-50'
                  }`}
                >
                  <span
                    className={`text-[13px] font-semibold ${
                      isSelected ? 'text-white' : isToday ? 'text-amber-800' : 'text-stone-700'
                    }`}
                  >
                    {day}
                  </span>
                  {/* Event dots */}
                  <div className="flex gap-0.5 mt-0.5 h-1.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e._id}
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white/70' : dotColor(e.Status)
                        }`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Events for selected day */}
        {selected && (
          <div>
            <p className="text-sm font-semibold text-stone-600 mb-2">
              {selectedEvents.length === 0
                ? 'Sem eventos neste dia'
                : `${selectedEvents.length} evento${selectedEvents.length > 1 ? 's' : ''} — ${fmtDate(selectedKey!)}`}
            </p>
            {!loading && selectedEvents.length > 0 && (
              <div className="space-y-2">
                {selectedEvents.map((e) => (
                  <Link
                    key={e._id}
                    to={`/eventos/${e._id}`}
                    className="flex items-start justify-between gap-2 bg-white rounded-xl border border-stone-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-800 truncate text-sm">
                        {e.NomeDoContratante ?? '—'}
                      </p>
                      {e.NomeDoEvento && (
                        <p className="text-xs text-stone-400 truncate">{e.NomeDoEvento}</p>
                      )}
                    </div>
                    <StatusBadge status={e.Status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
