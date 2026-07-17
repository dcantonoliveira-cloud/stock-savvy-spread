import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  ChevronLeft, ChevronRight, Users, CalendarCheck,
  Clock, ExternalLink, UtensilsCrossed, X, CalendarPlus, Mail, MapPin,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

// ── Types ───────────────────────────────────────────────────────────────────────
type TastingRow = {
  id: string;
  scheduled_date: string;
  type: string | null;
  max_couples: number | null;
};

type EventRow = {
  id: string;
  event_name: string | null;
  event_date: string | null;
  status: string | null;
  total_value: number | null;
  guest_count: number | null;
  event_type: string | null;
  location_text: string | null;
  location_id: string | null;
  date_reserved: boolean | null;
  clients: { name: string | null } | null;
};

type AppointmentRow = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  notes: string | null;
  invited_emails: string | null;
};

// ── Constants ───────────────────────────────────────────────────────────────────
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const STATUS: Record<string, { label: string; bar: string; dot: string; bg: string; text: string; badge: string }> = {
  lead:              { label: '1° Contato',  bar: 'bg-amber-400',   dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',  badge: 'border-amber-200 bg-amber-50 text-amber-700' },
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
  const location   = useLocation();
  const [searchParams] = useSearchParams();
  const backTo     = (location.state as any)?.backTo as string | undefined;
  const backLabel  = (location.state as any)?.backLabel as string | undefined;
  const today      = new Date();
  const initYear  = parseInt(searchParams.get('year') ?? '') || today.getFullYear();
  const initMonth = (parseInt(searchParams.get('month') ?? '') || today.getMonth() + 1) - 1;
  const [year, setYear]         = useState(initYear);
  const [month, setMonth]       = useState(initMonth);
  const [events,       setEvents]       = useState<EventRow[]>([]);
  const [tastings,     setTastings]     = useState<TastingRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState<number | null>(null);
  const [showApptModal, setShowApptModal] = useState(false);
  const [apptDate,      setApptDate]     = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Fetch month ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setSelected(null);
      const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const last  = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysIn(year, month)).padStart(2, '0')}`;
      const [{ data }, { data: tsData }, { data: apptData }] = await Promise.all([
        supabase
          .from('events')
          .select('id, event_name, event_date, status, total_value, guest_count, event_type, location_text, location_id, date_reserved, clients(name)')
          .gte('event_date', first)
          .lte('event_date', last)
          .not('event_name', 'is', null)
          .neq('event_name', '')
          .order('event_date'),
        supabase
          .from('tasting_sessions' as any)
          .select('id, scheduled_date, type, max_couples')
          .gte('scheduled_date', first)
          .lte('scheduled_date', last)
          .order('scheduled_date'),
        supabase
          .from('appointments' as any)
          .select('id, title, date, time, location, notes, invited_emails')
          .gte('date', first)
          .lte('date', last)
          .order('date'),
      ]);
      const visible = (data ?? []).filter((e: any) =>
        e.status !== 'cancelled' && e.status !== 'lost' &&
        (e.status === 'confirmed' || e.status === 'completed' || e.date_reserved === true)
      );
      // Resolve location_id → location_text para eventos sem location_text
      const missingLocIds = [...new Set(
        visible.filter((e: any) => !e.location_text && e.location_id).map((e: any) => e.location_id)
      )];
      if (missingLocIds.length > 0) {
        const { data: locs } = await supabase.from('event_locations' as any)
          .select('id, name').in('id', missingLocIds);
        const locMap = Object.fromEntries((locs ?? []).map((l: any) => [l.id, l.name]));
        visible.forEach((e: any) => {
          if (!e.location_text && e.location_id && locMap[e.location_id])
            e.location_text = locMap[e.location_id];
        });
      }
      setEvents(visible as EventRow[]);
      setTastings((tsData ?? []) as TastingRow[]);
      setAppointments((apptData ?? []) as AppointmentRow[]);
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
    const [evY, evM, evD] = ev.event_date.split('-').map(Number);
    if (evY !== year || evM !== month + 1) return acc;
    (acc[evD] ??= []).push(ev);
    return acc;
  }, {});

  const tastingsByDay = tastings.reduce<Record<number, TastingRow[]>>((acc, t) => {
    const [tY, tM, tD] = t.scheduled_date.split('-').map(Number);
    if (tY !== year || tM !== month + 1) return acc;
    (acc[tD] ??= []).push(t);
    return acc;
  }, {});

  const apptsByDay = appointments.reduce<Record<number, AppointmentRow[]>>((acc, a) => {
    const [aY, aM, aD] = a.date.split('-').map(Number);
    if (aY !== year || aM !== month + 1) return acc;
    (acc[aD] ??= []).push(a);
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
  const selectedEvents       = selected ? (byDay[selected]       ?? []) : [];
  const selectedTastings     = selected ? (tastingsByDay[selected] ?? []) : [];
  const selectedAppointments = selected ? (apptsByDay[selected]   ?? []) : [];

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {backTo && (
            <button
              onClick={() => navigate(backTo, { state: location.state })}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-border bg-white hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
              {backLabel ?? 'Voltar'}
            </button>
          )}
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
          <button
            onClick={() => {
              const d = selected
                ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selected).padStart(2, '0')}`
                : new Date().toISOString().slice(0, 10);
              setApptDate(d);
              setShowApptModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            Compromisso
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip icon={<CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />}
                    label="Confirmados" value={`${confirmed.length} evento${confirmed.length !== 1 ? 's' : ''}`}
                    color="bg-emerald-50 border-emerald-100" />
          <StatChip icon={<UtensilsCrossed className="w-3.5 h-3.5 text-violet-600" />}
                    label="Degustações" value={tastings.length > 0 ? `${tastings.length}` : '—'}
                    color="bg-violet-50 border-violet-100" />
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
            <>
            <div className="grid grid-cols-7 divide-x divide-y divide-border">
              {cells.map((day, idx) => {
                if (day === null) return <div key={`e${idx}`} className="h-28 bg-muted/20" />;

                const evs  = byDay[day] ?? [];
                const tsgs = tastingsByDay[day] ?? [];
                const apts = apptsByDay[day] ?? [];
                const isTod = isToday(day);
                const isSel = selected === day;
                const total = evs.length + tsgs.length + apts.length;

                return (
                  <div
                    key={day}
                    onClick={() => setSelected(isSel ? null : day)}
                    className={`h-28 p-2 flex flex-col gap-0.5 cursor-pointer transition-colors relative group
                      ${isSel ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'hover:bg-slate-50'}
                    `}
                  >
                    <span className={`self-start w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold shrink-0
                      ${isTod ? 'bg-primary text-white' : 'text-foreground group-hover:bg-muted'}
                    `}>
                      {day}
                    </span>

                    <div className="flex flex-col gap-0.5 overflow-hidden flex-1 mt-0.5">
                      {/* Events — up to 3 slots total */}
                      {evs.slice(0, 3).map(ev => {
                        const st = STATUS[ev.status ?? ''];
                        return (
                          <div key={ev.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${st?.bg ?? 'bg-muted'} min-w-0`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st?.dot ?? 'bg-muted-foreground'}`} />
                            <span className={`text-[10px] font-medium truncate leading-tight ${st?.text ?? 'text-muted-foreground'}`}>
                              {ev.event_name ?? '—'}
                            </span>
                          </div>
                        );
                      })}
                      {/* Tastings */}
                      {tsgs.slice(0, Math.max(0, 3 - evs.length)).map(t => (
                        <div key={t.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 min-w-0">
                          <UtensilsCrossed className="w-2.5 h-2.5 shrink-0 text-violet-500" />
                          <span className="text-[10px] font-medium truncate leading-tight text-violet-700">
                            Deg. {t.type ?? ''}
                          </span>
                        </div>
                      ))}
                      {/* Appointments */}
                      {apts.slice(0, Math.max(0, 3 - evs.length - tsgs.length)).map(a => (
                        <div key={a.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 min-w-0">
                          <CalendarPlus className="w-2.5 h-2.5 shrink-0 text-blue-500" />
                          <span className="text-[10px] font-medium truncate leading-tight text-blue-700">{a.title}</span>
                        </div>
                      ))}
                      {total > 3 && (
                        <span className="text-[10px] text-muted-foreground px-1">+{total - 3} mais</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend — horizontal below calendar */}
            <div className="px-4 py-3 border-t border-border flex items-center gap-5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Legenda</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Confirmado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-amber-400" />
                <span className="text-xs text-muted-foreground">Reservado / Negociando</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-purple-400" />
                <span className="text-xs text-muted-foreground">Degustação</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-blue-400" />
                <span className="text-xs text-muted-foreground">Compromisso</span>
              </div>
            </div>
            </>
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
                {selectedEvents.length === 0 && selectedTastings.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    Nenhum item neste dia.
                  </p>
                ) : (
                  <>
                    {selectedEvents.map(ev => (
                      <EventCard key={ev.id} ev={ev} onOpen={() => navigate(`/events/${ev.id}`)} />
                    ))}
                    {selectedTastings.map(t => (
                      <div key={t.id}
                        onClick={() => navigate(`/tastings/${t.id}`)}
                        className="px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer group/card flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-violet-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">Degustação — {t.type ?? 'Sem tipo'}</p>
                          {t.max_couples && <p className="text-xs text-muted-foreground mt-0.5">Até {t.max_couples} casais</p>}
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover/card:opacity-100 shrink-0 transition-opacity" />
                      </div>
                    ))}
                    {selectedAppointments.map(a => (
                      <div key={a.id} className="px-4 py-3 hover:bg-blue-50/50 transition-colors group/card">
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                            <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground leading-tight">{a.title}</p>
                            {a.time && <p className="text-xs text-muted-foreground mt-0.5">{a.time}</p>}
                            {a.location && (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" />{a.location}
                              </p>
                            )}
                            {a.invited_emails && (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Mail className="w-3 h-3 shrink-0" />{a.invited_emails}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
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


        </div>
      </div>

      {showApptModal && (
        <AppointmentModal
          defaultDate={apptDate}
          onClose={() => setShowApptModal(false)}
          onCreated={(a) => {
            setAppointments(prev => [...prev, a]);
            setShowApptModal(false);
          }}
        />
      )}
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
      {ev.location_text && (
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" />{ev.location_text}
        </p>
      )}
    </div>
  );
}

// ── AppointmentModal ───────────────────────────────────────────────────────────
function AppointmentModal({ defaultDate, onClose, onCreated }: {
  defaultDate: string;
  onClose: () => void;
  onCreated: (a: AppointmentRow) => void;
}) {
  const [title,   setTitle]   = useState('');
  const [date,    setDate]    = useState(defaultDate);
  const [time,    setTime]    = useState('');
  const [location, setLocation] = useState('');
  const [notes,   setNotes]   = useState('');
  const [invited, setInvited] = useState('');
  const [saving,  setSaving]  = useState(false);

  const save = async () => {
    if (!title || !date) { toast.error('Título e data são obrigatórios'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('appointments' as any)
      .insert({
        title,
        date,
        time: time || null,
        location: location || null,
        notes: notes || null,
        invited_emails: invited || null,
      })
      .select('id, title, date, time, location, notes, invited_emails')
      .single();
    if (error) { toast.error('Erro ao salvar'); setSaving(false); return; }
    toast.success('Compromisso adicionado');
    onCreated(data as AppointmentRow);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Novo compromisso</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Título *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Reunião com fornecedor"
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Data *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Horário</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">
              <MapPin className="inline w-3 h-3 mr-1" />Local
            </label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Endereço ou link de reunião"
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">
              <Mail className="inline w-3 h-3 mr-1" />Convidar (e-mails)
            </label>
            <input type="text" value={invited} onChange={e => setInvited(e.target.value)}
              placeholder="email@exemplo.com, outro@email.com"
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Detalhes, pauta..."
              className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? 'Salvando...' : 'Adicionar compromisso'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
