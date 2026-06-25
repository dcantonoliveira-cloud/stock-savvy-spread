import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  ChevronLeft, ChevronRight, Users, CalendarCheck,
  TrendingUp, Clock, ExternalLink,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────────
type EventRow = {
  id: string;
  event_name: string | null;
  event_date: string | null;
  status: string | null;
  total_value: number | null;
  guest_count: number | null;
  event_type: string | null;
  location_text: string | null;
  date_reserved: boolean | null;
  clients: { name: string | null } | null;
};

// ── Constants ───────────────────────────────────────────────────────────────────
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const STATUS: Record<string, { label: string; bar: string; dot: string; bg: string; text: string; badge: string }> = {
  lead:              { label: '1° Contato',  bar: 'bg-sky-400',     dot: 'bg-sky-400',     bg: 'bg-sky-50',     text: 'text-sky-700',    badge: 'border-sky-200 bg-sky-50 text-sky-700' },
  negotiating:       { label: 'Negociando',  bar: 'bg-amber-400',   dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',  badge: 'border-amber-200 bg-amber-50 text-amber-700' },
  tasting_scheduled: { label: 'Degustação',  bar: 'bg-purple-400',  dot: 'bg-purple-400',  bg: 'bg-purple-50',  text: 'text-purple-700', badge: 'border-purple-200 bg-purple-50 text-purple-700' },
  confirmed:         { label: 'Confirmado',  bar: 'bg-emerald-500', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700',badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  completed:         { label: 'Realizado',   bar: 'bg-slate-400',   dot: 'bg-slate-400',   bg: 'bg-slate-50',   text: 'text-slate-600',  badge: 'border-slate-200 bg-slate-50 text-slate-600' },
  cancelled:         { label: 'Cancelado',   bar: 'bg-red-400',     dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-600',    badge: 'border-red-200 bg-red-50 text-red-600' },
};

const fmtBRL = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

// ── Calendar helpers ─────────────────────────────────────────────────────────────
const firstDow = (y: number, m: number) => new Date(y, m, 1).getDay();
const daysIn   = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

// ── Component ───────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const navigate   = useNavigate();
  const today      = new Date();
  const [year, setYear]         = useState(today.getFullYear());
  const [month, setMonth]       = useState(today.getMonth());
  const [events, setEvents]     = useState<EventRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Fetch month ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setSelected(null);
      const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const last  = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('events')
        .select('id, event_name, event_date, status, total_value, guest_count, event_type, location_text, date_reserved, clients(name)')
        .gte('event_date', first)
        .lte('event_date', last)
        .not('event_name', 'is', null)
        .neq('event_name', '')
        .order('event_date');
      // Filtro: só mostra confirmados/realizados OU com data reservada
      const visible = (data ?? []).filter((e: any) =>
        e.status === 'confirmed' || e.status === 'completed' || e.date_reserved === true
      );
      setEvents(visible as EventRow[]);
      setLoading(false);
    };
    load();
  }, [year, month]);

  // ── Nav ──────────────────────────────────────────────────────────────────────
  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const byDay = events.reduce<Record<number, EventRow[]>>((acc, ev) => {
    if (!ev.event_date) return acc;
    const d = new Date(ev.event_date + 'T12:00:00').getDate();
    (acc[d] ??= []).push(ev);
    return acc;
  }, {});

  const confirmed = events.filter(e => e.status === 'confirmed' || e.status === 'completed');
  const totalRevenue = confirmed.reduce((s, e) => s + (e.total_value ?? 0), 0);
  const totalGuests  = confirmed.reduce((s, e) => s + (e.guest_count ?? 0), 0);

  const fdow  = firstDow(year, month);
  const total = daysIn(year, month);
  const cells: (number | null)[] = [...Array(fdow).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const selectedEvents = selected ? (byDay[selected] ?? []) : [];

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Nav */}
          <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-0.5">
            <button onClick={prev} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-semibold text-foreground min-w-[140px] text-center">
              {MONTHS[month]} {year}
            </span>
            <button onClick={next} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={goToday} className="px-3 py-2 text-sm font-medium rounded-xl border border-border bg-white hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            Hoje
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip icon={<CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />}
                    label="Confirmados" value={`${confirmed.length} evento${confirmed.length !== 1 ? 's' : ''}`}
                    color="bg-emerald-50 border-emerald-100" />
          <StatChip icon={<Users className="w-3.5 h-3.5 text-blue-600" />}
                    label="Convidados" value={totalGuests > 0 ? totalGuests.toLocaleString('pt-BR') : '—'}
                    color="bg-blue-50 border-blue-100" />
          <StatChip icon={<TrendingUp className="w-3.5 h-3.5 text-primary" />}
                    label="Receita prevista" value={totalRevenue > 0 ? fmtBRL(totalRevenue) : '—'}
                    color="bg-primary/5 border-primary/10" />
        </div>
      </div>

      {/* ── Grid + Panel ────────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* Calendar */}
        <div className="flex-1 bg-white border border-border rounded-2xl overflow-hidden min-w-0">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS_SHORT.map(wd => (
              <div key={wd} className="py-3 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {wd}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-y divide-border">
              {cells.map((day, idx) => {
                if (day === null) return <div key={`e${idx}`} className="h-28 bg-muted/20" />;

                const evs = byDay[day] ?? [];
                const isTod = isToday(day);
                const isSel = selected === day;

                return (
                  <div
                    key={day}
                    onClick={() => setSelected(isSel ? null : day)}
                    className={`h-28 p-2 flex flex-col gap-0.5 cursor-pointer transition-colors relative group
                      ${isSel ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'hover:bg-slate-50'}
                    `}
                  >
                    {/* Day number */}
                    <span className={`self-start w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold shrink-0
                      ${isTod ? 'bg-primary text-white' : 'text-foreground group-hover:bg-muted'}
                    `}>
                      {day}
                    </span>

                    {/* Events */}
                    <div className="flex flex-col gap-0.5 overflow-hidden flex-1 mt-0.5">
                      {evs.slice(0, 3).map(ev => {
                        const st = STATUS[ev.status ?? ''];
                        return (
                          <div key={ev.id}
                               className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${st?.bg ?? 'bg-muted'} min-w-0`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st?.dot ?? 'bg-muted-foreground'}`} />
                            <span className={`text-[10px] font-medium truncate leading-tight ${st?.text ?? 'text-muted-foreground'}`}>
                              {ev.event_name ?? '—'}
                            </span>
                          </div>
                        );
                      })}
                      {evs.length > 3 && (
                        <span className="text-[10px] text-muted-foreground px-1">
                          +{evs.length - 3} mais
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div ref={panelRef} className="w-72 shrink-0 flex flex-col gap-3">

          {/* Events panel */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                {selected ? `${selected} de ${MONTHS[month]}` : 'Próximos eventos'}
              </p>
            </div>

            {selected ? (
              <div className="divide-y divide-border/50">
                {selectedEvents.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    Nenhum evento neste dia.
                  </p>
                ) : selectedEvents.map(ev => (
                  <EventCard key={ev.id} ev={ev} onOpen={() => navigate(`/events/${ev.id}`)} />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {events.filter(e => {
                  if (!e.event_date) return false;
                  const d = new Date(e.event_date + 'T12:00:00').getDate();
                  return d >= today.getDate() || month > today.getMonth() || year > today.getFullYear();
                }).slice(0, 5).map(ev => (
                  <EventCard key={ev.id} ev={ev} showDate onOpen={() => navigate(`/events/${ev.id}`)} />
                ))}
                {events.length === 0 && !loading && (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    Nenhum evento este mês.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white border border-border rounded-2xl p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">Legenda</p>
            <div className="space-y-2">
              {Object.entries(STATUS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${v.bar}`} />
                  <span className="text-xs text-muted-foreground">{v.label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatChip({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${color}`}>
      {icon}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 leading-none">{label}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function EventCard({ ev, showDate, onOpen }: { ev: EventRow; showDate?: boolean; onOpen: () => void }) {
  const st = STATUS[ev.status ?? ''];
  const fmtDate = (d: string) => {
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  };

  return (
    <div className="px-4 py-3 hover:bg-slate-50 transition-colors group/card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${st?.dot ?? 'bg-muted-foreground'}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">{ev.event_name ?? '—'}</p>
            {ev.clients?.name && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{ev.clients.name}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {showDate && ev.event_date && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {fmtDate(ev.event_date)}
                </span>
              )}
              {ev.guest_count != null && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {ev.guest_count}
                </span>
              )}
              {st && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${st.badge}`}>
                  {st.label}
                </span>
              )}
              {ev.date_reserved && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-600 border-violet-200">
                  Reservado
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onOpen}
          className="p-1 rounded-lg opacity-0 group-hover/card:opacity-100 hover:bg-muted transition-all text-muted-foreground shrink-0 mt-0.5"
          title="Abrir evento"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
      {ev.total_value != null && (
        <p className="text-xs font-semibold text-foreground mt-2 text-right">{fmtBRL(ev.total_value)}</p>
      )}
    </div>
  );
}
