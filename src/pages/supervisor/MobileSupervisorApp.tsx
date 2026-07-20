import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeSVG } from 'qrcode.react';
import {
  Home, List, FileText, CalendarDays, Utensils, BarChart2,
  ChevronRight, ChevronLeft, LogOut, ArrowRight,
  MapPin, Users, Search, X, QrCode,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import MobileEventDetailScreen from './MobileEventDetailScreen';

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

type SessionExtra = Session & {
  total: number;
  fechados: number;
  next_event_date: string | null;
  linked_events: LinkedEvent[];
};

type LinkedEvent = {
  id: string;
  event_name: string | null;
  event_date: string | null;
  status: string;
  guest_count: number | null;
};

type Tab = 'home' | 'events' | 'quotes' | 'agenda' | 'tastings' | 'stats';

// ─── Colors ───────────────────────────────────────────────────────────────────
const RON_950 = '#172554';
const RON_900 = '#1E3A8A';
const RON_800 = '#1D4ED8';
const GOLD_400 = '#C4973A';
const GOLD_300 = '#D4AB52';

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
const STATUS_COLOR: Record<string, string> = {
  lead: '#38bdf8', negotiating: '#fbbf24', tasting_scheduled: '#a78bfa',
  confirmed: '#34d399', completed: '#059669', cancelled: '#f87171', lost: '#ef4444',
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
function today() { return new Date().toISOString().slice(0, 10); }

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-black uppercase tracking-widest mb-3 mt-1" style={{ color: RON_800 }}>
      {children}
    </p>
  );
}

function DarkDateBadge({ date }: { date: string }) {
  const dt = parseDate(date);
  return (
    <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
         style={{ background: RON_950 }}>
      <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest leading-none">
        {MONTH_SHORT[dt.getMonth()].toUpperCase()}
      </span>
      <span className="text-2xl font-bold text-white leading-tight">
        {dt.getDate().toString().padStart(2,'0')}
      </span>
    </div>
  );
}

function GoldDateBadge({ date }: { date: string }) {
  const dt = parseDate(date);
  return (
    <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
         style={{ background: 'rgba(212,171,82,0.15)', border: `1px solid ${GOLD_300}40` }}>
      <span className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: GOLD_400 }}>
        {WEEK_SHORT[dt.getDay()]}
      </span>
      <span className="text-2xl font-bold leading-tight" style={{ color: RON_950 }}>
        {dt.getDate().toString().padStart(2,'0')}
      </span>
    </div>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────
function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { id: 'home',     label: 'Início',   Icon: Home },
    { id: 'events',   label: 'Eventos',  Icon: List },
    { id: 'quotes',   label: 'Orçam.',   Icon: FileText },
    { id: 'agenda',   label: 'Agenda',   Icon: CalendarDays },
    { id: 'tastings', label: 'Degust.',  Icon: Utensils },
    { id: 'stats',    label: 'Stats',    Icon: BarChart2 },
  ];

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-around bg-white/95 backdrop-blur-xl rounded-3xl px-2 pb-safe"
         style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)' }}>
      {items.map(({ id, label, Icon }) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-3 transition-all">
            <div className={`flex items-center justify-center w-8 h-8 rounded-2xl transition-all ${active ? 'shadow-lg' : ''}`}
                 style={active ? { background: RON_950, boxShadow: `0 4px 12px ${RON_900}50` } : {}}>
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />
            </div>
            <span className={`text-[10px] font-semibold transition-colors ${active ? 'text-gray-800' : 'text-gray-400'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden px-5 pt-hero pb-8"
         style={{ background: `linear-gradient(135deg, ${RON_950} 0%, ${RON_900} 60%, ${RON_900} 100%)` }}>
      <div className="absolute top-12 right-6 w-28 h-28 rounded-full opacity-[0.06]"
           style={{ background: `radial-gradient(circle, white, transparent)` }} />
      {actions && <div className="absolute top-safe right-4 pt-3">{actions}</div>}
      <h1 className="text-4xl font-bold text-white tracking-tight">{title}</h1>
      {sub && <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">{sub}</p>}
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ events, sessions, loading, setTab, onSelect }: {
  events: Event[]; sessions: SessionExtra[]; loading: boolean;
  setTab: (t: Tab) => void; onSelect: (id: string) => void;
}) {
  const { signOut } = useAuth();
  const now = new Date();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const mEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const eventsMonth = events.filter(e => e.event_date && CONFIRMED.includes(e.status) && e.event_date >= mStart && e.event_date <= mEnd);
  const tastMonth   = sessions.filter(s => s.scheduled_date && s.scheduled_date >= mStart && s.scheduled_date <= mEnd);
  const openQuotes  = events.filter(e => OPEN.includes(e.status));
  const upcoming    = events
    .filter(e => e.event_date && e.event_date >= today() && CONFIRMED.includes(e.status))
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));
  const nextEvent = upcoming[0] ?? null;
  const curMonth  = MONTH_FULL[now.getMonth()].toUpperCase();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none pb-32">
      {/* Hero */}
      <div className="relative overflow-hidden px-5 pt-12 pb-8"
           style={{ background: `linear-gradient(135deg, ${RON_950} 0%, ${RON_900} 60%, ${RON_900} 100%)` }}>
        <div className="absolute top-8 right-6 w-28 h-28 rounded-full opacity-[0.06]"
             style={{ background: 'radial-gradient(circle, white, transparent)' }} />
        <button onClick={signOut}
          className="absolute top-4 right-4 p-2 text-white/30 hover:text-white/60 transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
        <h1 className="text-4xl font-bold text-white tracking-tight">Rondello</h1>
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Buffet</p>
      </div>

      <div className="px-4 -mt-5 space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => setTab('events')}
            className="rounded-3xl p-4 flex flex-col gap-1 active:scale-95 transition-transform shadow-sm"
            style={{ background: RON_950 }}>
            <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">EVENTOS</p>
            <p className="text-3xl font-bold text-white leading-none">{loading ? '—' : eventsMonth.length}</p>
            <p className="text-[9px] font-semibold text-white/30 uppercase">{curMonth}</p>
          </button>
          <button onClick={() => setTab('tastings')}
            className="rounded-3xl p-4 flex flex-col gap-1 active:scale-95 transition-transform shadow-sm"
            style={{ background: GOLD_400 }}>
            <p className="text-[9px] font-black text-white/70 uppercase tracking-widest">DEGUST.</p>
            <p className="text-3xl font-bold text-white leading-none">{loading ? '—' : tastMonth.length}</p>
            <p className="text-[9px] font-semibold text-white/50 uppercase">{curMonth}</p>
          </button>
          <button onClick={() => setTab('quotes')}
            className="rounded-3xl p-4 flex flex-col gap-1 active:scale-95 transition-transform shadow-sm"
            style={{ background: '#6D28D9' }}>
            <p className="text-[9px] font-black text-white/70 uppercase tracking-widest">ORÇAM.</p>
            <p className="text-3xl font-bold text-white leading-none">{loading ? '—' : openQuotes.length}</p>
            <p className="text-[9px] font-semibold text-white/50 uppercase">EM ABERTO</p>
          </button>
        </div>

        {/* Próximo evento highlight */}
        {nextEvent && (
          <button onClick={() => onSelect(nextEvent.id)}
            className="rounded-3xl p-5 relative overflow-hidden w-full text-left active:scale-95 transition-transform shadow-sm"
            style={{ background: RON_900 }}>
            <div className="absolute inset-0 opacity-[0.08]"
                 style={{ background: `radial-gradient(circle at 85% 50%, ${GOLD_300}, transparent 65%)` }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: GOLD_300 }} />
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD_300 }}>Próximo Evento</p>
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
          </button>
        )}

        {/* Próximos eventos list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Próximos Eventos</SectionTitle>
            <button onClick={() => setTab('events')}
              className="flex items-center gap-1 text-xs font-semibold text-gray-400">
              Ver todos <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : upcoming.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Nenhum evento confirmado</p>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 6).map(ev => (
                <button key={ev.id} onClick={() => onSelect(ev.id)}
                  className="bg-white rounded-3xl shadow-sm p-4 flex items-center gap-4 w-full text-left active:scale-95 transition-transform">
                  {ev.event_date && <DarkDateBadge date={ev.event_date} />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{ev.event_name ?? 'Sem nome'}</p>
                    {ev.location_text && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />{ev.location_text}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Events Screen ────────────────────────────────────────────────────────────
function EventsScreen({ events, loading, onSelect }: {
  events: Event[]; loading: boolean; onSelect: (id: string) => void;
}) {
  const confirmed = events.filter(e => CONFIRMED.includes(e.status));

  const years = useMemo(() => {
    const ys = new Set(confirmed.map(e => e.event_date?.slice(0, 4)).filter(Boolean) as string[]);
    return [...ys].sort();
  }, [confirmed]);

  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(currentYear);

  const yearEvents = confirmed.filter(e => e.event_date?.startsWith(year));

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

  useEffect(() => {
    const m = (new Date().getMonth() + 1).toString().padStart(2, '0');
    setMonth(monthCounts[m] ? m : Object.keys(monthCounts).sort()[0] ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const filtered = yearEvents
    .filter(e => e.event_date?.slice(5, 7) === month)
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));

  const todayStr = today();
  const upcoming = filtered.filter(e => (e.event_date ?? '') >= todayStr);
  const past     = filtered.filter(e => (e.event_date ?? '') < todayStr);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none pb-32 bg-[#f2f2f2] min-h-screen">
      <Hero title={year} sub={`${yearEvents.length} eventos confirmados`} />
      <div className="px-4 -mt-4 space-y-4 pt-4">
        {/* Year nav */}
        <div className="flex items-center justify-between bg-white rounded-3xl shadow-sm px-4 py-3">
          <button onClick={() => setYear(y => String(Number(y) - 1))}
            className="p-1.5 rounded-xl text-gray-400 active:scale-95 transition-transform">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-gray-900">{year}</span>
          <button onClick={() => setYear(y => String(Number(y) + 1))}
            className="p-1.5 rounded-xl text-gray-400 active:scale-95 transition-transform">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Month pills with count dots */}
        {months.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4">
            {months.map(m => {
              const active = month === m;
              return (
                <button key={m} onClick={() => setMonth(m)}
                  className="flex-shrink-0 flex flex-col items-center px-3.5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm"
                  style={active
                    ? { background: RON_950, color: 'white' }
                    : { background: 'white', color: '#9ca3af' }}>
                  <span className="text-[10px] uppercase tracking-wide">{MONTH_SHORT[Number(m) - 1]}</span>
                  <span className="text-lg leading-tight">{monthCounts[m]}</span>
                  {active && (
                    <span className="w-1 h-1 rounded-full bg-white/60 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">
                    Próximos
                    <span className="ml-1.5 bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {upcoming.length}
                    </span>
                  </p>
                </div>
                <div className="space-y-2">
                  {upcoming.map(ev => <EvCard key={ev.id} ev={ev} onSelect={onSelect} />)}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Realizados</p>
                <div className="space-y-2 opacity-50">
                  {[...past].reverse().map(ev => <EvCard key={ev.id} ev={ev} onSelect={onSelect} />)}
                </div>
              </div>
            )}
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 py-12 text-sm">Nenhum evento neste mês</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EvCard({ ev, onSelect }: { ev: Event; onSelect: (id: string) => void }) {
  return (
    <button onClick={() => onSelect(ev.id)}
      className="bg-white rounded-3xl shadow-sm p-4 flex items-center gap-4 w-full text-left active:scale-95 transition-transform">
      {ev.event_date && <GoldDateBadge date={ev.event_date} />}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{ev.event_name ?? 'Sem nome'}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {ev.location_text && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="w-3 h-3" />{ev.location_text}
            </span>
          )}
          {ev.guest_count != null && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Users className="w-3 h-3" />{ev.guest_count} conv.
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </button>
  );
}

// ─── Quotes Screen ────────────────────────────────────────────────────────────
function QuotesScreen({ events, loading, onSelect }: {
  events: Event[]; loading: boolean; onSelect: (id: string) => void;
}) {
  const pipeline = events.filter(e => ['lead', 'negotiating'].includes(e.status));
  const other    = events.filter(e => ['tasting_scheduled', 'cancelled', 'lost'].includes(e.status));
  const all      = events.filter(e => ALL_OPEN.includes(e.status));
  const [search, setSearch] = useState('');

  const filtered = all
    .filter(e => !search || (e.event_name ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.event_date ?? 'zzzz').localeCompare(b.event_date ?? 'zzzz'));

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none pb-32 bg-[#f2f2f2] min-h-screen">
      <Hero title="Orçamentos" sub={`${pipeline.length} em negociação`} />
      <div className="px-4 -mt-4 pt-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full h-12 pl-11 pr-10 bg-white rounded-3xl shadow-sm text-sm outline-none focus:ring-2 text-gray-900 placeholder-gray-400"
            style={{ focusRingColor: RON_800 } as React.CSSProperties}
            placeholder="Buscar evento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Pipeline */}
        {!search && pipeline.length > 0 && (
          <div>
            <SectionTitle>Pipeline</SectionTitle>
            <div className="space-y-2">
              {pipeline.map(ev => <QuoteCard key={ev.id} ev={ev} onSelect={onSelect} />)}
            </div>
          </div>
        )}

        {!search && other.length > 0 && (
          <div>
            <SectionTitle>Outros</SectionTitle>
            <div className="space-y-2">
              {other.map(ev => <QuoteCard key={ev.id} ev={ev} onSelect={onSelect} />)}
            </div>
          </div>
        )}

        {search && (
          loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">Nenhum resultado</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(ev => <QuoteCard key={ev.id} ev={ev} onSelect={onSelect} />)}
            </div>
          )
        )}

        {!search && all.length === 0 && !loading && (
          <p className="text-center text-gray-400 py-12 text-sm">Nenhum orçamento em aberto</p>
        )}
      </div>
    </div>
  );
}

function QuoteCard({ ev, onSelect }: { ev: Event; onSelect: (id: string) => void }) {
  return (
    <button onClick={() => onSelect(ev.id)}
      className="bg-white rounded-3xl shadow-sm p-4 flex items-start gap-3 w-full text-left active:scale-95 transition-transform">
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-gray-900 flex-1 truncate">{ev.event_name ?? 'Sem nome'}</p>
          <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_CLS[ev.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[ev.status] ?? ev.status}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {ev.event_date && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <CalendarDays className="w-3 h-3" />{fmtFull(ev.event_date)}
            </span>
          )}
          {ev.location_text && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="w-3 h-3" />{ev.location_text}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
    </button>
  );
}

// ─── Agenda Screen ────────────────────────────────────────────────────────────
function AgendaScreen({ events, sessions, loading, onSelect }: {
  events: Event[]; sessions: SessionExtra[]; loading: boolean; onSelect: (id: string) => void;
}) {
  const now = new Date();
  const [year, setYear]    = useState(now.getFullYear());
  const [month, setMonth]  = useState(now.getMonth());
  const [selDay, setSelDay] = useState<number | null>(now.getDate());

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); setSelDay(null); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); setSelDay(null); };

  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const dayEvents = useMemo(() => {
    const m: Record<number, Event[]> = {};
    events.filter(e => e.event_date?.startsWith(prefix) && CONFIRMED.includes(e.status))
      .forEach(e => { const d = parseInt(e.event_date!.slice(8, 10)); (m[d] ??= []).push(e); });
    return m;
  }, [events, prefix]);

  const dayQuotes = useMemo(() => {
    const m: Record<number, Event[]> = {};
    events.filter(e => e.event_date?.startsWith(prefix) && OPEN.includes(e.status))
      .forEach(e => { const d = parseInt(e.event_date!.slice(8, 10)); (m[d] ??= []).push(e); });
    return m;
  }, [events, prefix]);

  const dayTastings = useMemo(() => {
    const m: Record<number, SessionExtra[]> = {};
    sessions.filter(s => s.scheduled_date?.startsWith(prefix))
      .forEach(s => { const d = parseInt(s.scheduled_date!.slice(8, 10)); (m[d] ??= []).push(s); });
    return m;
  }, [sessions, prefix]);

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells       = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const selEvents   = selDay ? (dayEvents[selDay]   ?? []) : [];
  const selQuotes   = selDay ? (dayQuotes[selDay]   ?? []) : [];
  const selTastings = selDay ? (dayTastings[selDay] ?? []) : [];
  const selAll      = [...selEvents, ...selQuotes];

  const todayDate      = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none pb-32 bg-[#f2f2f2] min-h-screen">
      <Hero title={MONTH_FULL[month]} sub={`${Object.values(dayEvents).flat().length + Object.values(dayTastings).flat().length} items · ${year}`} />
      <div className="px-4 -mt-4 pt-4 space-y-4">
        {/* Calendar */}
        <div className="bg-white rounded-3xl shadow-sm p-4">
          {/* Nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-xl text-gray-400 active:scale-95">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-gray-900">{MONTH_FULL[month]} {year}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-xl text-gray-400 active:scale-95">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4">
            {[['Fechado', RON_900], ['Reserva', '#f59e0b'], ['Degust.', '#a78bfa']].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className="w-2 h-2 rounded-full" style={{ background: c }} /> {l}
              </span>
            ))}
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {['D','S','T','Q','Q','S','S'].map((d, i) => (
              <div key={i} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
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
                  className="flex flex-col items-center py-1.5 rounded-xl transition-all active:scale-95"
                  style={isSel ? { background: RON_950 } : isToday ? { background: `${RON_950}15` } : {}}>
                  <span className={`text-sm leading-tight font-${isToday && !isSel ? 'bold' : 'medium'} ${isSel ? 'text-white' : 'text-gray-900'}`}>
                    {day}
                  </span>
                  {(hasEv || hasQ || hasT) && (
                    <div className="flex gap-0.5 mt-0.5">
                      {hasEv && <span className="w-1.5 h-1.5 rounded-full" style={{ background: isSel ? 'white' : RON_900 }} />}
                      {hasQ  && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      {hasT  && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day */}
        {selDay && (
          <div>
            <p className="text-sm font-bold text-gray-900 mb-3 capitalize">
              {WEEK_SHORT[new Date(year, month, selDay).getDay()]}, {selDay} de {MONTH_FULL[month].toLowerCase()}
            </p>
            {selAll.length === 0 && selTastings.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm p-8 text-center text-gray-400 text-sm">
                Sem eventos neste dia
              </div>
            ) : (
              <div className="space-y-2">
                {selAll.map(ev => (
                  <button key={ev.id} onClick={() => onSelect(ev.id)}
                    className="bg-white rounded-3xl shadow-sm p-4 flex items-center gap-3 w-full text-left active:scale-95 transition-transform overflow-hidden">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0"
                         style={{ background: CONFIRMED.includes(ev.status) ? RON_900 : '#f59e0b' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{ev.event_name ?? 'Sem nome'}</p>
                      {ev.location_text && (
                        <p className="text-xs text-gray-400">{ev.location_text}</p>
                      )}
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_CLS[ev.status] ?? ''}`}>
                      {STATUS_LABEL[ev.status] ?? ev.status}
                    </span>
                  </button>
                ))}
                {selTastings.map(s => (
                  <div key={s.id}
                    className="bg-white rounded-3xl shadow-sm p-4 flex items-center gap-3 overflow-hidden">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0 bg-purple-400" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Degustação</p>
                      {s.total > 0 && (
                        <p className="text-xs text-gray-400">{s.total} evento{s.total !== 1 ? 's' : ''} · {s.fechados} fechado{s.fechados !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">Degust.</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}
      </div>
    </div>
  );
}

// ─── Tastings Screen ──────────────────────────────────────────────────────────
type TastingFilter = 'upcoming' | 'past';

function TastingsScreen({ sessions, loading, onTasting }: {
  sessions: SessionExtra[]; loading: boolean; onTasting: (id: string) => void;
}) {
  const [filter, setFilter] = useState<TastingFilter>('upcoming');
  const todayStr = today();

  const upcoming = sessions
    .filter(s => s.scheduled_date && s.scheduled_date >= todayStr)
    .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''));
  const past = sessions
    .filter(s => s.scheduled_date && s.scheduled_date < todayStr)
    .sort((a, b) => (b.scheduled_date ?? '').localeCompare(a.scheduled_date ?? ''));

  const shown = filter === 'upcoming' ? upcoming : past;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none pb-32 bg-[#f2f2f2] min-h-screen">
      <Hero title="Degustações" sub={`${upcoming.length} próximas · ${sessions.length} total`} />
      <div className="px-4 -mt-4 pt-4 space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2 bg-white rounded-3xl shadow-sm p-1">
          {([['upcoming', 'Próximas'], ['past', 'Realizadas']] as [TastingFilter, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className="flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all"
              style={filter === id
                ? { background: RON_950, color: 'white', boxShadow: `0 4px 12px ${RON_900}40` }
                : { color: '#9ca3af' }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : shown.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">Nenhuma degustação</p>
        ) : (
          <div className="space-y-2">
            {shown.map(s => (
              <button key={s.id} onClick={() => onTasting(s.id)}
                className="bg-white rounded-3xl shadow-sm px-4 py-4 flex items-center gap-3 w-full text-left active:scale-95 transition-transform overflow-hidden">
                <div className="w-1 self-stretch rounded-full flex-shrink-0"
                     style={{ background: filter === 'upcoming' ? '#a78bfa' : '#d1d5db' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900">
                      Degustação · {s.type ?? 'Grupo'}
                    </p>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${filter === 'upcoming' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                      {filter === 'upcoming' ? 'Agendada' : 'Realizada'}
                    </span>
                  </div>
                  {s.scheduled_date && (
                    <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />{fmtFull(s.scheduled_date)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {s.total} evento{s.total !== 1 ? 's' : ''}
                    {s.fechados > 0 && <span className="text-emerald-500 font-semibold"> · {s.fechados} fechado{s.fechados !== 1 ? 's' : ''}</span>}
                    {s.next_event_date && <span> · próx. {fmtShort(s.next_event_date)}</span>}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tasting Detail Screen ────────────────────────────────────────────────────
type TastingDetailTab = 'eventos' | 'qrcode';

function TastingDetailScreen({ session, onBack, onSelect }: {
  session: SessionExtra; onBack: () => void; onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<TastingDetailTab>('eventos');
  const qrValue = `https://rondello.com.br/degustacao/${session.id}`;

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex flex-col">
      {/* Hero */}
      <div className="relative overflow-hidden px-5 pt-12 pb-8"
           style={{ background: `linear-gradient(135deg, ${RON_950} 0%, ${RON_900} 60%, ${RON_900} 100%)` }}>
        <div className="absolute top-8 right-6 w-28 h-28 rounded-full opacity-[0.06]"
             style={{ background: 'radial-gradient(circle, white, transparent)' }} />
        <button onClick={onBack} className="flex items-center gap-2 text-white/60 mb-4 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Voltar</span>
        </button>
        <h1 className="text-3xl font-bold text-white tracking-tight">Degustação</h1>
        {session.scheduled_date && (
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">
            {fmtFull(session.scheduled_date)}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-4 pt-4">
        <div className="flex gap-2 bg-white rounded-3xl shadow-sm p-1 mb-4">
          {([['eventos', 'Eventos'], ['qrcode', 'QR Code']] as [TastingDetailTab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all"
              style={tab === id
                ? { background: RON_950, color: 'white' }
                : { color: '#9ca3af' }}>
              {id === 'qrcode' && <QrCode className="w-4 h-4 inline mr-1.5" />}
              {label}
            </button>
          ))}
        </div>

        {tab === 'eventos' && (
          <div className="space-y-2 pb-32">
            <SectionTitle>{session.total} evento{session.total !== 1 ? 's' : ''} vinculados</SectionTitle>
            {session.linked_events.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Nenhum evento vinculado</p>
            ) : (
              session.linked_events
                .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))
                .map(ev => (
                  <button key={ev.id} onClick={() => onSelect(ev.id)}
                    className="bg-white rounded-3xl shadow-sm p-4 flex items-center gap-4 w-full text-left active:scale-95 transition-transform">
                    {ev.event_date && <GoldDateBadge date={ev.event_date} />}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{ev.event_name ?? 'Sem nome'}</p>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-block mt-1 ${STATUS_CLS[ev.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[ev.status] ?? ev.status}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                ))
            )}
          </div>
        )}

        {tab === 'qrcode' && (
          <div className="pb-32">
            <div className="bg-white rounded-3xl shadow-sm p-8 flex flex-col items-center gap-4">
              <div className="p-4 rounded-2xl" style={{ background: `${RON_950}08` }}>
                <QRCodeSVG value={qrValue} size={200} bgColor="transparent" fgColor={RON_950} />
              </div>
              <p className="text-xs text-gray-400 text-center break-all">{qrValue}</p>
              <p className="text-sm text-gray-500 text-center">
                Mostre este QR Code para o casal acessar as informações da degustação
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stats Screen ─────────────────────────────────────────────────────────────
function StatsScreen({ events, loading }: { events: Event[]; loading: boolean }) {
  const now = new Date();

  const total     = events.length;
  const confirmed = events.filter(e => CONFIRMED.includes(e.status)).length;
  const open      = events.filter(e => OPEN.includes(e.status)).length;
  const lost      = events.filter(e => ['cancelled', 'lost'].includes(e.status)).length;

  // By status counts
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    events.forEach(e => { c[e.status] = (c[e.status] ?? 0) + 1; });
    return c;
  }, [events]);

  const statusOrder = ['confirmed', 'completed', 'lead', 'negotiating', 'tasting_scheduled', 'cancelled', 'lost'];
  const maxCount = Math.max(...Object.values(statusCounts), 1);

  // Monthly confirmed events — last 12 months
  const monthly = useMemo(() => {
    const months: { label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const count = events.filter(e => CONFIRMED.includes(e.status) && e.event_date?.startsWith(prefix)).length;
      months.push({ label: MONTH_SHORT[d.getMonth()], count });
    }
    return months;
  }, [events]);

  const maxMonthly = Math.max(...monthly.map(m => m.count), 1);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none pb-32 bg-[#f2f2f2] min-h-screen">
      <Hero title="Estatísticas" sub="Visão geral do negócio" />
      <div className="px-4 -mt-4 pt-4 space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total', value: total, color: RON_950 },
            { label: 'Confirmados', value: confirmed, color: '#059669' },
            { label: 'Em aberto', value: open, color: GOLD_400 },
            { label: 'Não fechou', value: lost, color: '#f87171' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-3xl shadow-sm p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
              <p className="text-4xl font-bold leading-none" style={{ color }}>
                {loading ? '—' : value}
              </p>
            </div>
          ))}
        </div>

        {/* By status */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <SectionTitle>Por status</SectionTitle>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-3">
              {statusOrder.filter(s => statusCounts[s]).map(s => (
                <div key={s}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">{STATUS_LABEL[s]}</span>
                    <span className="text-xs font-bold text-gray-900">{statusCounts[s]}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                         style={{ width: `${(statusCounts[s] / maxCount) * 100}%`, background: STATUS_COLOR[s] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly chart */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <SectionTitle>Eventos por mês (12m)</SectionTitle>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="flex items-end gap-1.5 h-28">
              {monthly.map(({ label, count }, i) => {
                const isCurrentMonth = i === 11;
                const height = count === 0 ? 4 : Math.max(10, (count / maxMonthly) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    {count > 0 && (
                      <span className="text-[9px] font-bold text-gray-500">{count}</span>
                    )}
                    <div className="w-full rounded-t-lg transition-all duration-500"
                         style={{
                           height: `${height}%`,
                           background: isCurrentMonth ? RON_800 : `${RON_900}40`,
                           minHeight: '4px',
                         }} />
                    <span className={`text-[9px] font-bold ${isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MobileSupervisorApp() {
  const [tab, setTab]                       = useState<Tab>('home');
  const [events, setEvents]                 = useState<Event[]>([]);
  const [sessions, setSessions]             = useState<SessionExtra[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedEventId, setSelectedEventId]     = useState<string | null>(null);
  const [selectedTastingId, setSelectedTastingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [eventsRes, sessRes, statsRes, tseRes] = await Promise.all([
        supabase.from('events').select('id, event_name, event_date, guest_count, status, location_text').order('event_date'),
        (supabase.from as any)('tasting_sessions').select('id, scheduled_date, type, max_couples').order('scheduled_date', { ascending: false }),
        (supabase.from as any)('tasting_session_stats').select('session_id, total, fechados'),
        (supabase.from as any)('tasting_session_events').select('session_id, event_id, events(id, event_name, event_date, status, guest_count)'),
      ]);

      if (eventsRes.data) setEvents(eventsRes.data as Event[]);

      const statsMap: Record<string, { total: number; fechados: number }> = {};
      for (const r of (statsRes.data ?? []) as any[]) {
        statsMap[r.session_id] = { total: r.total ?? 0, fechados: r.fechados ?? 0 };
      }

      // Group linked events per session
      const linkedMap: Record<string, LinkedEvent[]> = {};
      const nextMap: Record<string, string> = {};
      const todayStr = today();

      for (const r of (tseRes.data ?? []) as any[]) {
        const ev = r.events as any;
        if (!ev) continue;
        (linkedMap[r.session_id] ??= []).push({
          id: ev.id, event_name: ev.event_name, event_date: ev.event_date,
          status: ev.status, guest_count: ev.guest_count,
        });
        const d = ev.event_date;
        if (d && d >= todayStr) {
          if (!nextMap[r.session_id] || d < nextMap[r.session_id]) nextMap[r.session_id] = d;
        }
      }

      const enriched: SessionExtra[] = ((sessRes.data ?? []) as Session[]).map(s => ({
        ...s,
        total:           statsMap[s.id]?.total    ?? 0,
        fechados:        statsMap[s.id]?.fechados  ?? 0,
        next_event_date: nextMap[s.id] ?? null,
        linked_events:   linkedMap[s.id] ?? [],
      }));

      setSessions(enriched);
      setLoading(false);
    })();
  }, []);

  const selectedSession = selectedTastingId ? sessions.find(s => s.id === selectedTastingId) ?? null : null;

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex flex-col">
      {selectedEventId ? (
        <MobileEventDetailScreen eventId={selectedEventId} onBack={() => setSelectedEventId(null)} />
      ) : selectedSession ? (
        <TastingDetailScreen
          session={selectedSession}
          onBack={() => setSelectedTastingId(null)}
          onSelect={(id) => { setSelectedTastingId(null); setSelectedEventId(id); }}
        />
      ) : (
        <>
          {tab === 'home'     && <HomeScreen     events={events} sessions={sessions} loading={loading} setTab={setTab} onSelect={setSelectedEventId} />}
          {tab === 'events'   && <EventsScreen   events={events} loading={loading} onSelect={setSelectedEventId} />}
          {tab === 'quotes'   && <QuotesScreen   events={events} loading={loading} onSelect={setSelectedEventId} />}
          {tab === 'agenda'   && <AgendaScreen   events={events} sessions={sessions} loading={loading} onSelect={setSelectedEventId} />}
          {tab === 'tastings' && <TastingsScreen sessions={sessions} loading={loading} onTasting={setSelectedTastingId} />}
          {tab === 'stats'    && <StatsScreen    events={events} loading={loading} />}
          <BottomNav tab={tab} setTab={setTab} />
        </>
      )}
    </div>
  );
}
