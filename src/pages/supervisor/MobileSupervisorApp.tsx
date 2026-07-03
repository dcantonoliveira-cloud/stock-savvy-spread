import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Home, List, FileText, CalendarDays, Utensils,
  ChevronRight, ChevronLeft, LogOut, ArrowRight,
  MapPin, Users, Search, X,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Event = {
  id: string;
  event_name: string | null;
  event_date: string | null;
  guest_count: number | null;
  status: string;
  location_text: string | null;
};

type Session = {
  id: string;
  scheduled_date: string | null;
  type: string | null;
  max_couples: number | null;
};

type SessionStats = {
  session_id: string;
  total: number;
  fechados: number;
};

type SessionExtra = Session & { total: number; fechados: number; next_event_date: string | null };

type Tab = 'home' | 'events' | 'quotes' | 'agenda' | 'tastings';

// ─── Constants ────────────────────────────────────────────────────────────────
const CONFIRMED  = ['confirmed', 'completed'];
const OPEN       = ['lead', 'negotiating', 'tasting_scheduled'];
const ALL_OPEN   = ['lead', 'negotiating', 'tasting_scheduled', 'cancelled'];

const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_SHORT  = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

const STATUS_LABEL: Record<string, string> = {
  lead: '1º Contato', negotiating: 'Negociando',
  tasting_scheduled: 'Degustação', confirmed: 'Confirmado',
  completed: 'Realizado', cancelled: 'Não fechou', lost: 'Cancelado',
};
const STATUS_CLS: Record<string, string> = {
  lead: 'bg-sky-100 text-sky-700',
  negotiating: 'bg-amber-100 text-amber-800',
  tasting_scheduled: 'bg-purple-100 text-purple-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-200 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-600',
  lost: 'bg-red-100 text-red-700',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseDate(d: string) { return new Date(d + 'T12:00:00'); }

function fmtFull(d: string) {
  const dt = parseDate(d);
  return `${dt.getDate().toString().padStart(2,'0')} de ${MONTH_FULL[dt.getMonth()].toLowerCase()} de ${dt.getFullYear()}`;
}
function fmtShort(d: string) {
  const dt = parseDate(d);
  return `${dt.getDate().toString().padStart(2,'0')} ${MONTH_SHORT[dt.getMonth()].toLowerCase()}.`;
}
function yyyyMM(d: string) { return d.slice(0, 7); }
function today() { return new Date().toISOString().slice(0, 10); }

// ─── Components ───────────────────────────────────────────────────────────────
function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items = [
    { id: 'home'     as Tab, label: 'Início',  Icon: Home },
    { id: 'events'   as Tab, label: 'Eventos', Icon: List },
    { id: 'quotes'   as Tab, label: 'Orçam.',  Icon: FileText },
    { id: 'agenda'   as Tab, label: 'Agenda',  Icon: CalendarDays },
    { id: 'tastings' as Tab, label: 'Degust.', Icon: Utensils },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex z-50">
      {items.map(({ id, label, Icon }) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
            style={{ color: active ? 'hsl(222 35% 18%)' : 'hsl(215 16% 57%)' }}>
            <div className={active
              ? 'bg-[hsl(222_35%_18%)] text-white rounded-2xl px-4 py-1.5'
              : ''}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function HeroHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="relative overflow-hidden px-5 pt-14 pb-8"
         style={{ background: 'linear-gradient(135deg, hsl(222 45% 13%) 0%, hsl(222 35% 22%) 100%)' }}>
      <div className="absolute top-4 right-8 w-24 h-24 rounded-full opacity-10"
           style={{ background: 'hsl(222 35% 50%)' }} />
      <div className="absolute top-14 right-16 w-12 h-12 rounded-full opacity-8"
           style={{ background: 'hsl(222 35% 50%)' }} />
      <h1 className="text-4xl font-bold text-white tracking-tight">{title}</h1>
      {sub && <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mt-1">{sub}</p>}
    </div>
  );
}

// Amber date badge used in event cards
function DateBadge({ date }: { date: string }) {
  const dt = parseDate(date);
  return (
    <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
         style={{ background: 'hsl(38 75% 94%)', border: '1px solid hsl(38 75% 80%)' }}>
      <span className="text-[9px] font-bold uppercase tracking-widest leading-none"
            style={{ color: 'hsl(38 65% 40%)' }}>
        {WEEK_SHORT[dt.getDay()]}
      </span>
      <span className="text-2xl font-bold leading-tight" style={{ color: 'hsl(222 35% 18%)' }}>
        {dt.getDate().toString().padStart(2,'0')}
      </span>
    </div>
  );
}

// Dark badge used in Inicio list
function DarkDateBadge({ date }: { date: string }) {
  const dt = parseDate(date);
  return (
    <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
         style={{ background: 'hsl(222 35% 18%)' }}>
      <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest leading-none">
        {MONTH_SHORT[dt.getMonth()].toUpperCase()}
      </span>
      <span className="text-2xl font-bold text-white leading-tight">
        {dt.getDate().toString().padStart(2,'0')}
      </span>
    </div>
  );
}

// ─── Home Screen ─────────────────────────────────────────────────────────────
function HomeScreen({ events, sessions, loading, setTab }: {
  events: Event[]; sessions: SessionExtra[]; loading: boolean; setTab: (t: Tab) => void;
}) {
  const { signOut } = useAuth();
  const now = new Date();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const mEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const eventsMonth  = events.filter(e => e.event_date && CONFIRMED.includes(e.status) && e.event_date >= mStart && e.event_date <= mEnd);
  const tastMonth    = sessions.filter(s => s.scheduled_date && s.scheduled_date >= mStart && s.scheduled_date <= mEnd);
  const openQuotes   = events.filter(e => OPEN.includes(e.status));
  const upcoming     = events.filter(e => e.event_date && e.event_date >= today() && CONFIRMED.includes(e.status))
                             .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));
  const nextEvent    = upcoming[0] ?? null;
  const curMonth     = MONTH_FULL[now.getMonth()].toUpperCase();

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden px-5 pt-12 pb-8"
           style={{ background: 'linear-gradient(135deg, hsl(222 45% 13%) 0%, hsl(222 35% 22%) 100%)' }}>
        <div className="absolute top-3 right-6 w-20 h-20 rounded-full opacity-10"
             style={{ background: 'hsl(222 35% 50%)' }} />
        <div className="absolute top-10 right-14 w-10 h-10 rounded-full opacity-8"
             style={{ background: 'hsl(222 35% 50%)' }} />
        <button onClick={signOut}
          className="absolute top-4 right-4 p-2 text-white/30 hover:text-white/60 transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
        <h1 className="text-4xl font-bold text-white tracking-tight">Rondello</h1>
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Buffet</p>
      </div>

      <div className="px-4 -mt-5 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => setTab('events')} className="rounded-2xl p-4 flex flex-col gap-1 active:opacity-80"
                  style={{ background: 'hsl(222 35% 18%)' }}>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">EVENTOS</p>
            <p className="text-3xl font-bold text-white leading-none">{loading ? '—' : eventsMonth.length}</p>
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wide">{curMonth}</p>
          </button>
          <button onClick={() => setTab('tastings')} className="rounded-2xl p-4 flex flex-col gap-1 active:opacity-80"
                  style={{ background: 'hsl(38 55% 42%)' }}>
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">DEGUST.</p>
            <p className="text-3xl font-bold text-white leading-none">{loading ? '—' : tastMonth.length}</p>
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">{curMonth}</p>
          </button>
          <button onClick={() => setTab('quotes')} className="rounded-2xl p-4 flex flex-col gap-1 active:opacity-80"
                  style={{ background: 'hsl(263 55% 45%)' }}>
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">ORÇAM.</p>
            <p className="text-3xl font-bold text-white leading-none">{loading ? '—' : openQuotes.length}</p>
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">EM ABERTO</p>
          </button>
        </div>

        {/* Next event */}
        {nextEvent && (
          <div className="rounded-2xl p-5 relative overflow-hidden"
               style={{ background: 'hsl(222 35% 18%)' }}>
            <div className="absolute inset-0 opacity-5"
                 style={{ background: 'radial-gradient(circle at 80% 50%, hsl(222 60% 60%), transparent 60%)' }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Próximo Evento</p>
              </div>
              <h2 className="text-xl font-bold text-white leading-tight mb-1">
                {nextEvent.event_name ?? 'Sem nome'}
              </h2>
              {nextEvent.location_text && (
                <div className="flex items-center gap-1 mb-3">
                  <MapPin className="w-3 h-3 text-white/40" />
                  <p className="text-sm text-white/50">{nextEvent.location_text}</p>
                </div>
              )}
              <hr className="border-white/10 mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/50">
                  {nextEvent.event_date ? fmtFull(nextEvent.event_date) : '—'}
                  {nextEvent.guest_count ? ` · ${nextEvent.guest_count} conv.` : ''}
                </p>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-foreground">Próximos Eventos</h3>
            <button onClick={() => setTab('events')}
              className="flex items-center gap-1 text-sm font-semibold"
              style={{ color: 'hsl(222 35% 30%)' }}>
              Ver todos <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : upcoming.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhum evento confirmado</p>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 6).map(ev => (
                <div key={ev.id} className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4">
                  {ev.event_date && <DarkDateBadge date={ev.event_date} />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{ev.event_name ?? 'Sem nome'}</p>
                    {ev.location_text && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{ev.location_text}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Events Screen ────────────────────────────────────────────────────────────
function EventsScreen({ events, loading }: { events: Event[]; loading: boolean }) {
  const confirmed = events.filter(e => CONFIRMED.includes(e.status));

  // Year navigation
  const years = useMemo(() => {
    const ys = new Set(confirmed.map(e => e.event_date?.slice(0, 4)).filter(Boolean) as string[]);
    return [...ys].sort();
  }, [confirmed]);

  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(currentYear);

  const yearEvents = confirmed.filter(e => e.event_date?.startsWith(year));

  // Month counts
  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    yearEvents.forEach(e => {
      const m = e.event_date?.slice(5, 7);
      if (m) counts[m] = (counts[m] ?? 0) + 1;
    });
    return counts;
  }, [yearEvents]);

  const months = Object.keys(monthCounts).sort();
  const [month, setMonth] = useState(() => {
    const m = (new Date().getMonth() + 1).toString().padStart(2, '0');
    return monthCounts[m] ? m : months[0] ?? '';
  });

  // Update month when year changes
  useEffect(() => {
    const m = (new Date().getMonth() + 1).toString().padStart(2, '0');
    setMonth(monthCounts[m] ? m : Object.keys(monthCounts).sort()[0] ?? '');
  }, [year]);

  const filtered = yearEvents.filter(e => e.event_date?.slice(5, 7) === month)
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));

  const todayStr = today();
  const upcoming = filtered.filter(e => (e.event_date ?? '') >= todayStr);
  const past     = filtered.filter(e => (e.event_date ?? '') < todayStr);

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <HeroHeader title={year} sub={`${yearEvents.length} eventos`} />
      <div className="px-4 mt-4 space-y-4">
        {/* Year nav */}
        <div className="flex items-center justify-between">
          <button onClick={() => setYear(y => String(Number(y) - 1))} className="p-2 rounded-xl bg-white border border-border text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg font-bold text-foreground">{year}</span>
          <button onClick={() => setYear(y => String(Number(y) + 1))} className="p-2 rounded-xl bg-white border border-border text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Month pills */}
        {months.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {months.map(m => (
              <button key={m} onClick={() => setMonth(m)}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-2xl border text-sm font-bold transition-all ${month === m ? 'text-white border-transparent' : 'bg-white border-border text-muted-foreground'}`}
                style={month === m ? { background: 'hsl(222 35% 18%)' } : {}}>
                <span className="text-[10px] uppercase tracking-wide">{MONTH_SHORT[Number(m) - 1]}</span>
                <span className="text-lg leading-tight">{monthCounts[m]}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
                    Próximos <span className="ml-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{upcoming.length}</span>
                  </p>
                </div>
                <div className="space-y-3">
                  {upcoming.map(ev => <EventCard key={ev.id} ev={ev} />)}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Realizados</p>
                <div className="space-y-3 opacity-50">
                  {past.reverse().map(ev => <EventCard key={ev.id} ev={ev} />)}
                </div>
              </div>
            )}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-12 text-sm">Nenhum evento neste mês</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EventCard({ ev }: { ev: Event }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4">
      {ev.event_date && <DateBadge date={ev.event_date} />}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{ev.event_name ?? 'Sem nome'}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {ev.location_text && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />{ev.location_text}
            </span>
          )}
          {ev.guest_count != null && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />{ev.guest_count}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

// ─── Quotes Screen ────────────────────────────────────────────────────────────
const QUOTE_FILTERS = [
  { key: 'all',              label: 'Em aberto' },
  { key: 'lead',             label: '1º Contato' },
  { key: 'negotiating',      label: 'Negociando' },
  { key: 'tasting_scheduled',label: 'Degustação' },
  { key: 'cancelled',        label: 'Não fechou' },
  { key: 'lost',             label: 'Cancelado' },
];

function QuotesScreen({ events, loading }: { events: Event[]; loading: boolean }) {
  const quotes = events.filter(e => ALL_OPEN.includes(e.status));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = quotes.filter(e => {
    const matchStatus = filter === 'all' || e.status === filter;
    const matchSearch = !search || (e.event_name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }).sort((a, b) => (a.event_date ?? 'zzzz').localeCompare(b.event_date ?? 'zzzz'));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: quotes.length };
    quotes.forEach(e => { c[e.status] = (c[e.status] ?? 0) + 1; });
    return c;
  }, [quotes]);

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <HeroHeader title="Orçamentos" sub={`${counts.all} em aberto`} />
      <div className="px-4 mt-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full h-11 pl-9 pr-10 bg-white rounded-2xl border border-border text-sm outline-none focus:border-primary"
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {QUOTE_FILTERS.filter(f => f.key === 'all' || counts[f.key]).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-semibold border transition-all ${filter === f.key ? 'text-white border-transparent' : 'bg-white border-border text-muted-foreground'}`}
              style={filter === f.key ? { background: 'hsl(222 35% 18%)' } : {}}>
              {f.label}{f.key !== 'all' && counts[f.key] ? ` ${counts[f.key]}` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Nenhum resultado</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(ev => (
              <div key={ev.id} className="bg-white rounded-2xl border border-border p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground flex-1 truncate">{ev.event_name ?? 'Sem nome'}</p>
                    <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_CLS[ev.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {STATUS_LABEL[ev.status] ?? ev.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {ev.event_date && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="w-3 h-3" />{fmtFull(ev.event_date)}
                      </span>
                    )}
                    {ev.location_text && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />{ev.location_text}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agenda Screen ────────────────────────────────────────────────────────────
function AgendaScreen({ events, sessions, loading }: { events: Event[]; sessions: SessionExtra[]; loading: boolean }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [selDay, setSelDay] = useState<number | null>(now.getDate());

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); setSelDay(null); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); setSelDay(null); };

  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Map day → items
  const dayEvents   = useMemo(() => {
    const m: Record<number, Event[]> = {};
    events.filter(e => e.event_date?.startsWith(prefix) && CONFIRMED.includes(e.status))
      .forEach(e => {
        const d = parseInt(e.event_date!.slice(8, 10));
        (m[d] ??= []).push(e);
      });
    return m;
  }, [events, prefix]);

  const dayQuotes   = useMemo(() => {
    const m: Record<number, Event[]> = {};
    events.filter(e => e.event_date?.startsWith(prefix) && OPEN.includes(e.status))
      .forEach(e => {
        const d = parseInt(e.event_date!.slice(8, 10));
        (m[d] ??= []).push(e);
      });
    return m;
  }, [events, prefix]);

  const dayTastings = useMemo(() => {
    const m: Record<number, SessionExtra[]> = {};
    sessions.filter(s => s.scheduled_date?.startsWith(prefix))
      .forEach(s => {
        const d = parseInt(s.scheduled_date!.slice(8, 10));
        (m[d] ??= []).push(s);
      });
    return m;
  }, [sessions, prefix]);

  // Calendar grid
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const selEvents   = selDay ? (dayEvents[selDay]   ?? []) : [];
  const selQuotes   = selDay ? (dayQuotes[selDay]   ?? []) : [];
  const selTastings = selDay ? (dayTastings[selDay] ?? []) : [];
  const selAll      = [...selEvents, ...selQuotes];

  const todayDate = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <HeroHeader title={MONTH_FULL[month]} sub={`${Object.values(dayEvents).flat().length + Object.values(dayTastings).flat().length} items · ${year}`} />
      <div className="px-4 mt-4 space-y-4">
        {/* Month nav */}
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-foreground">{MONTH_FULL[month]} {year}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(222 35% 18%)' }} /> Fechado
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Reserva
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-purple-400" /> Degust.
            </span>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {['D','S','T','Q','Q','S','S'].map((d, i) => (
              <div key={i} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const hasEv = !!(dayEvents[day]?.length);
              const hasQ  = !!(dayQuotes[day]?.length);
              const hasT  = !!(dayTastings[day]?.length);
              const isToday = isCurrentMonth && day === todayDate;
              const isSel   = day === selDay;
              return (
                <button key={i} onClick={() => setSelDay(day === selDay ? null : day)}
                  className={`flex flex-col items-center py-1.5 rounded-xl transition-colors ${isSel ? 'text-white' : isToday ? 'font-bold' : ''}`}
                  style={isSel ? { background: 'hsl(222 35% 18%)' } : {}}>
                  <span className={`text-sm leading-tight ${isSel ? 'text-white' : 'text-foreground'}`}>{day}</span>
                  {(hasEv || hasQ || hasT) && (
                    <div className="flex gap-0.5 mt-0.5">
                      {hasEv && <span className="w-1.5 h-1.5 rounded-full" style={{ background: isSel ? 'white' : 'hsl(222 35% 18%)' }} />}
                      {hasQ  && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      {hasT  && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day events */}
        {selDay && (
          <div>
            <p className="text-sm font-bold text-foreground mb-3 capitalize">
              {WEEK_SHORT[new Date(year, month, selDay).getDay()]}, {selDay} de {MONTH_FULL[month]}
            </p>
            {selAll.length === 0 && selTastings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground text-sm">
                Sem eventos neste dia
              </div>
            ) : (
              <div className="space-y-3">
                {selAll.map(ev => (
                  <div key={ev.id} className="bg-white rounded-2xl border border-border p-4 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0"
                         style={{ background: CONFIRMED.includes(ev.status) ? 'hsl(222 35% 18%)' : 'hsl(38 75% 52%)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{ev.event_name ?? 'Sem nome'}</p>
                      {ev.location_text && (
                        <p className="text-xs text-muted-foreground">{ev.location_text}</p>
                      )}
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[ev.status] ?? ''}`}>
                      {STATUS_LABEL[ev.status] ?? ev.status}
                    </span>
                  </div>
                ))}
                {selTastings.map(s => (
                  <div key={s.id} className="bg-white rounded-2xl border border-purple-200 p-4 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-purple-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">Degustação</p>
                      {s.total > 0 && <p className="text-xs text-muted-foreground">{s.total} eventos</p>}
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Degust.</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tastings Screen ──────────────────────────────────────────────────────────
type TastingTab = 'all' | 'upcoming' | 'past';

function TastingsScreen({ sessions, loading }: { sessions: SessionExtra[]; loading: boolean }) {
  const [tab, setTab] = useState<TastingTab>('all');
  const todayStr = today();

  const upcoming = sessions.filter(s => s.scheduled_date && s.scheduled_date >= todayStr)
                           .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''));
  const past     = sessions.filter(s => s.scheduled_date && s.scheduled_date < todayStr)
                           .sort((a, b) => (b.scheduled_date ?? '').localeCompare(a.scheduled_date ?? ''));
  const all      = [...upcoming, ...past];

  const shown = tab === 'all' ? all : tab === 'upcoming' ? upcoming : past;

  const TABS: { id: TastingTab; label: string }[] = [
    { id: 'all',      label: 'Todas' },
    { id: 'upcoming', label: 'Próximas' },
    { id: 'past',     label: 'Realizadas' },
  ];

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <HeroHeader title="Degustações" sub={`${upcoming.length} próximas · ${sessions.length} total`} />
      <div className="px-4 mt-4 space-y-3">
        {/* Tabs */}
        <div className="flex gap-2 bg-muted/40 rounded-2xl p-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.id ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : shown.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Nenhuma degustação</p>
        ) : (
          <div className="space-y-3">
            {shown.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-border p-4 flex items-start gap-4">
                <div className="w-1 self-stretch rounded-full bg-purple-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground">Degustação</p>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                      Agendada
                    </span>
                  </div>
                  {s.scheduled_date && (
                    <div className="flex items-center gap-1 mt-1">
                      <CalendarDays className="w-3 h-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">{fmtFull(s.scheduled_date)}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{s.total} evento{s.total !== 1 ? 's' : ''}</span>
                    {s.next_event_date && (
                      <>
                        <span className="text-border">·</span>
                        <span>{fmtShort(s.next_event_date)}</span>
                      </>
                    )}
                    <span className="text-border">·</span>
                    <span className={s.fechados > 0 ? 'text-emerald-600 font-semibold' : ''}>
                      {s.fechados} fech.
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function MobileSupervisorApp() {
  const [tab, setTab]         = useState<Tab>('home');
  const [events, setEvents]   = useState<Event[]>([]);
  const [sessions, setSessions] = useState<SessionExtra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [eventsRes, sessRes, statsRes, tseRes] = await Promise.all([
        supabase.from('events').select('id, event_name, event_date, guest_count, status, location_text').order('event_date'),
        (supabase.from as any)('tasting_sessions').select('id, scheduled_date, type, max_couples').order('scheduled_date', { ascending: false }),
        (supabase.from as any)('tasting_session_stats').select('session_id, total, fechados'),
        (supabase.from as any)('tasting_session_events').select('session_id, event_id, events(event_date, status)'),
      ]);

      if (eventsRes.data) setEvents(eventsRes.data as Event[]);

      const statsMap: Record<string, { total: number; fechados: number }> = {};
      for (const r of (statsRes.data ?? []) as any[]) {
        statsMap[r.session_id] = { total: r.total ?? 0, fechados: r.fechados ?? 0 };
      }

      // Next event date per session
      const nextMap: Record<string, string> = {};
      const todayStr = today();
      for (const r of (tseRes.data ?? []) as any[]) {
        const d = (r.events as any)?.event_date;
        if (!d || d < todayStr) continue;
        if (!nextMap[r.session_id] || d < nextMap[r.session_id]) nextMap[r.session_id] = d;
      }

      const enriched: SessionExtra[] = ((sessRes.data ?? []) as Session[]).map(s => ({
        ...s,
        total:           statsMap[s.id]?.total    ?? 0,
        fechados:        statsMap[s.id]?.fechados  ?? 0,
        next_event_date: nextMap[s.id] ?? null,
      }));
      setSessions(enriched);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {tab === 'home'     && <HomeScreen     events={events} sessions={sessions} loading={loading} setTab={setTab} />}
      {tab === 'events'   && <EventsScreen   events={events} loading={loading} />}
      {tab === 'quotes'   && <QuotesScreen   events={events} loading={loading} />}
      {tab === 'agenda'   && <AgendaScreen   events={events} sessions={sessions} loading={loading} />}
      {tab === 'tastings' && <TastingsScreen sessions={sessions} loading={loading} />}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
