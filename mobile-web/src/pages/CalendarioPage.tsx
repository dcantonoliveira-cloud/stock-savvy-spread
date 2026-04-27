import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, UtensilsCrossed, Users } from 'lucide-react';
import { fetchAllEventos, fetchDegustacoes, fetchLocaisMap } from '../api/bubble';
import { BubbleEvento, BubbleDegustacao } from '../types';
import { isFechado, isReserva } from '../lib/eventFilters';
// fmtTime not needed — Degustação records have no time field

const WEEKDAYS   = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS     = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ── Unified calendar item type ────────────────────────────────────────────────

type CalItem =
  | { kind: 'fechado'; event: BubbleEvento }
  | { kind: 'reserva'; event: BubbleEvento }
  | { kind: 'degust';  degu:  BubbleDegustacao };

function getDateKey(item: CalItem): string | undefined {
  if (item.kind === 'degust') return item.degu.data?.slice(0, 10);
  return item.event.dataDoEvento?.slice(0, 10);
}

// ── Item cards ────────────────────────────────────────────────────────────────

function EventoCard({
  item, locaisMap,
}: {
  item: Extract<CalItem, { kind: 'fechado' | 'reserva' }>;
  locaisMap: Record<string, string>;
}) {
  const e     = item.event;
  const local = e.LocalDoEvento ? (locaisMap[e.LocalDoEvento] ?? '') : '';

  return (
    <Link
      to={`/eventos/${e._id}`}
      className="flex items-start gap-3 bg-white rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform"
    >
      {/* color bar */}
      <div className={`w-1 self-stretch rounded-full shrink-0 ${
        item.kind === 'fechado' ? 'bg-ron-900' : 'bg-gold-400'
      }`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-gray-900 text-sm flex-1 truncate">
            {e.NomeDoEvento ?? e.NomeDoContratante ?? '—'}
          </p>
          {item.kind === 'reserva' && (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-gold-50 text-gold-600 border border-gold-200">
              Reserva
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {local && (
            <span className="flex items-center gap-1 text-xs text-gray-400 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[140px]">{local}</span>
            </span>
          )}
          {e.QtdConvidados != null && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Users className="w-3 h-3" />
              {e.QtdConvidados}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function DegustacaoCard({ item }: { item: Extract<CalItem, { kind: 'degust' }> }) {
  const d = item.degu;
  return (
    <div className="flex items-start gap-3 bg-white rounded-3xl p-4 shadow-sm">
      {/* color bar — violet for tastings */}
      <div className="w-1 self-stretch rounded-full shrink-0 bg-violet-400" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-gray-900 text-sm flex-1 truncate">
            Degustação
          </p>
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200 flex items-center gap-1">
            <UtensilsCrossed className="w-2.5 h-2.5" />
            Degust.
          </span>
        </div>
        {d.convidados != null && (
          <p className="text-xs text-gray-400 mt-1">{d.convidados} convidados</p>
        )}
        {d['Observações'] && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{d['Observações']}</p>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item, locaisMap }: { item: CalItem; locaisMap: Record<string, string> }) {
  if (item.kind === 'degust') return <DegustacaoCard item={item} />;
  return <EventoCard item={item} locaisMap={locaisMap} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const today = new Date();
  const [year, setYear]     = useState(today.getFullYear());
  const [month, setMonth]   = useState(today.getMonth());
  const [selected, setSelected] = useState<number | null>(today.getDate());
  const [events, setEvents]         = useState<BubbleEvento[]>([]);
  const [degustacoes, setDegustacoes] = useState<BubbleDegustacao[]>([]);
  const [locaisMap, setLocaisMap]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAllEventos(), fetchDegustacoes()])
      .then(([evResults, deguRes]) => {
        setEvents(evResults);
        setDegustacoes(deguRes.response.results);
        fetchLocaisMap(evResults).then(setLocaisMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Build unified calendar items ──────────────────────────────────────────
  const allItems = useMemo<CalItem[]>(() => {
    const items: CalItem[] = [];
    events.filter(isFechado).forEach((e) => items.push({ kind: 'fechado', event: e }));
    events.filter(isReserva).forEach((e) => items.push({ kind: 'reserva', event: e }));
    // Degustação records have no Status field — show all (they are scheduled sessions)
    degustacoes.forEach((d) => items.push({ kind: 'degust', degu: d }));
    return items;
  }, [events, degustacoes]);

  // ── Map items by date key ─────────────────────────────────────────────────
  const byDate = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    allItems.forEach((item) => {
      const key = getDateKey(item);
      if (!key) return;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    });
    return map;
  }, [allItems]);

  // ── Calendar navigation ───────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelected(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelected(null);
  };

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedKey = selected != null
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selected).padStart(2, '0')}`
    : null;
  const selectedItems = selectedKey ? (byDate.get(selectedKey) ?? []) : [];

  const monthItemCount = allItems.filter((item) => {
    const key = getDateKey(item);
    if (!key) return false;
    const d = new Date(key);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;

  const selectedDayLabel = selected != null
    ? new Date(year, month, selected).toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : '';

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-safe pt-8 pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/5 rounded-full" />
        <div className="relative">
          <p className="text-gold-400/70 text-xs font-bold uppercase tracking-widest">Agenda</p>
          <h1 className="text-4xl font-black text-white tracking-tight mt-1 leading-none">
            {MONTHS[month]}
          </h1>
          <p className="text-white/35 text-xs font-bold mt-1.5 uppercase tracking-[0.15em]">
            {loading ? '…' : `${monthItemCount} item${monthItemCount !== 1 ? 's' : ''} · ${year}`}
          </p>
        </div>
      </div>

      <div className="px-4 space-y-4 pt-4">

        {/* ── Month navigator ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <p className="font-black text-gray-900 text-base">{MONTHS[month]} {year}</p>
          <button
            onClick={nextMonth}
            className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* ── Calendar grid ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          {/* Legend */}
          <div className="flex items-center gap-3 mb-3 px-1">
            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
              <span className="w-2 h-2 rounded-full bg-ron-900 inline-block" /> Fechado
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
              <span className="w-2 h-2 rounded-full bg-gold-400 inline-block" /> Reserva
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
              <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> Degust.
            </span>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-[11px] font-black text-gray-300 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} />;

              const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayItems  = byDate.get(key) ?? [];
              const isToday   = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSel     = day === selected;

              // Collect dot colors (up to 3, deduplicated by type)
              const dots: string[] = [];
              if (dayItems.some((i) => i.kind === 'fechado')) dots.push('bg-ron-900');
              if (dayItems.some((i) => i.kind === 'reserva') && dots.length < 3) dots.push('bg-gold-400');
              if (dayItems.some((i) => i.kind === 'degust')  && dots.length < 3) dots.push('bg-violet-400');

              return (
                <button
                  key={key}
                  onClick={() => setSelected(day === selected ? null : day)}
                  className={`flex flex-col items-center py-1.5 rounded-2xl transition-all ${
                    isSel    ? 'bg-ron-900 shadow-lg shadow-ron-900/30'
                    : isToday ? 'bg-gold-50'
                    : ''
                  }`}
                >
                  <span className={`text-[13px] font-bold leading-none ${
                    isSel    ? 'text-white'
                    : isToday ? 'text-ron-900'
                    : 'text-gray-800'
                  }`}>
                    {day}
                  </span>
                  <div className="flex gap-0.5 mt-1 h-1.5">
                    {dots.map((cls, di) => (
                      <span
                        key={di}
                        className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/60' : cls}`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Selected day items ─────────────────────────────────────────── */}
        {selected && (
          <div>
            <p className="text-[11px] font-black text-ron-800 uppercase tracking-widest mb-3 capitalize">
              {selectedDayLabel}
            </p>
            {!loading && selectedItems.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center">
                <p className="text-3xl mb-2">📅</p>
                <p className="text-gray-400 text-sm font-medium">Sem eventos neste dia</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedItems.map((item, i) => (
                  <ItemCard key={i} item={item} locaisMap={locaisMap} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
