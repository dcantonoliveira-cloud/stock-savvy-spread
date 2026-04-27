import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react';
import { fetchEventos, fetchLocaisMap } from '../api/bubble';
import { BubbleEvento } from '../types';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export default function CalendarioPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<number | null>(today.getDate());
  const [events, setEvents] = useState<BubbleEvento[]>([]);
  const [locaisMap, setLocaisMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventos({ limit: 500 })
      .then((r) => {
        const results = r.response.results;
        setEvents(results);
        fetchLocaisMap(results).then(setLocaisMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, BubbleEvento[]>();
    events.forEach((e) => {
      if (!e.dataDoEvento) return;
      const key = e.dataDoEvento.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [events]);

  const firstDay = new Date(year, month, 1).getDay();
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

  const monthEventCount = events.filter((e) => {
    if (!e.dataDoEvento) return false;
    const d = new Date(e.dataDoEvento);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedDayLabel = selected != null
    ? new Date(year, month, selected).toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : '';

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-safe pt-12 pb-20 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-6  w-36 h-36 bg-white/5 rounded-full" />
        <div className="relative">
          <p className="text-gold-400/80 text-sm">Agenda</p>
          <h1 className="text-4xl font-black text-white tracking-tight mt-1 leading-none">
            {MONTHS[month]}
          </h1>
          <p className="text-gold-400/70 text-sm font-medium mt-1">
            {loading ? '…' : `${monthEventCount} evento${monthEventCount !== 1 ? 's' : ''} · ${year}`}
          </p>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Month navigator ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between -mt-6 relative z-10">
          <button
            onClick={prevMonth}
            className="w-11 h-11 rounded-2xl bg-white shadow-xl shadow-black/10 flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <p className="font-black text-gray-900 text-base">
            {MONTHS[month]} {year}
          </p>
          <button
            onClick={nextMonth}
            className="w-11 h-11 rounded-2xl bg-white shadow-xl shadow-black/10 flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* ── Calendar grid ───────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-[11px] font-black text-gray-300 py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} />;
              const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = byDate.get(key) ?? [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = day === selected;

              return (
                <button
                  key={key}
                  onClick={() => setSelected(day === selected ? null : day)}
                  className={`flex flex-col items-center py-1.5 rounded-2xl transition-all ${
                    isSelected ? 'bg-ron-900 shadow-lg shadow-ron-900/30'
                    : isToday  ? 'bg-gold-50'
                    : ''
                  }`}
                >
                  <span className={`text-[13px] font-bold leading-none ${
                    isSelected ? 'text-white'
                    : isToday  ? 'text-ron-900'
                    : 'text-gray-800'
                  }`}>
                    {day}
                  </span>
                  <div className="flex gap-0.5 mt-1 h-1.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e._id}
                        className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/60' : 'bg-gold-400'}`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Selected day events ─────────────────────────────────────── */}
        {selected && (
          <div>
            <p className="text-[11px] font-black text-ron-800 uppercase tracking-widest mb-3 capitalize">
              {selectedDayLabel}
            </p>
            {!loading && selectedEvents.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center">
                <p className="text-3xl mb-2">📅</p>
                <p className="text-gray-400 text-sm font-medium">Sem eventos neste dia</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedEvents.map((e) => (
                  <Link
                    key={e._id}
                    to={`/eventos/${e._id}`}
                    className="flex items-center gap-4 bg-white rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate text-sm">
                        {e.NomeDoEvento ?? e.NomeDoContratante ?? '—'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {e.LocalDoEvento && locaisMap[e.LocalDoEvento] && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[140px]">{locaisMap[e.LocalDoEvento]}</span>
                          </span>
                        )}
                        {e.QuantidadeDeConvidados != null && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Users className="w-3 h-3" />
                            {e.QuantidadeDeConvidados}
                          </span>
                        )}
                      </div>
                    </div>
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
