import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Home, List, FileText, CalendarDays, Utensils, ChevronRight, LogOut, ArrowRight, Users } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
type Event = {
  id: string;
  event_name: string | null;
  event_date: string | null;
  guest_count: number | null;
  status: string;
};

type Tasting = {
  id: string;
  tasting_date: string | null;
  status: string;
};

type Tab = 'home' | 'events' | 'quotes' | 'agenda' | 'tastings';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTH_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTH_FULL_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function parseLocalDate(d: string) {
  return new Date(d + 'T12:00:00');
}

function fmtDay(d: string) {
  return parseLocalDate(d).getDate().toString().padStart(2, '0');
}
function fmtMonthShort(d: string) {
  return MONTH_PT[parseLocalDate(d).getMonth()].toUpperCase();
}
function fmtMonthFull(d: string) {
  return MONTH_FULL_PT[parseLocalDate(d).getMonth()].toUpperCase();
}
function fmtFull(d: string) {
  const dt = parseLocalDate(d);
  return `${dt.getDate().toString().padStart(2,'0')} de ${MONTH_FULL_PT[dt.getMonth()].toLowerCase()} de ${dt.getFullYear()}`;
}

const CONFIRMED_STATUS = ['confirmed', 'completed'];
const OPEN_STATUS = ['lead', 'negotiating', 'tasting_scheduled'];
const TASTING_OPEN = ['agendado', 'confirmado'];

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'home'     as Tab, label: 'Início',  Icon: Home },
  { id: 'events'   as Tab, label: 'Eventos', Icon: List },
  { id: 'quotes'   as Tab, label: 'Orçam.',  Icon: FileText },
  { id: 'agenda'   as Tab, label: 'Agenda',  Icon: CalendarDays },
  { id: 'tastings' as Tab, label: 'Degust.', Icon: Utensils },
];

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex z-50 pb-safe">
      {NAV_ITEMS.map(({ id, label, Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
            style={{ color: active ? 'hsl(222 35% 20%)' : 'hsl(215 16% 57%)' }}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[11px] font-semibold">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Date Badge ───────────────────────────────────────────────────────────────
function DateBadge({ date }: { date: string }) {
  return (
    <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
         style={{ background: 'hsl(222 35% 18%)' }}>
      <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest leading-none">
        {fmtMonthShort(date)}
      </span>
      <span className="text-2xl font-bold text-white leading-tight">
        {fmtDay(date)}
      </span>
    </div>
  );
}

// ─── Home Screen ─────────────────────────────────────────────────────────────
function HomeScreen({
  events, tastings, openQuotes, loading, setTab,
}: {
  events: Event[]; tastings: Tasting[]; openQuotes: Event[]; loading: boolean; setTab: (t: Tab) => void;
}) {
  const { signOut } = useAuth();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const eventsThisMonth  = events.filter(e => e.event_date && e.event_date >= monthStart && e.event_date <= monthEnd && CONFIRMED_STATUS.includes(e.status));
  const tastingsThisMonth = tastings.filter(t => t.tasting_date && t.tasting_date >= monthStart && t.tasting_date <= monthEnd);

  const upcoming = events
    .filter(e => e.event_date && e.event_date >= now.toISOString().slice(0, 10) && CONFIRMED_STATUS.includes(e.status))
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));

  const nextEvent = upcoming[0] ?? null;

  const currentMonthLabel = MONTH_FULL_PT[now.getMonth()].toUpperCase();

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      {/* Hero header */}
      <div className="relative overflow-hidden px-5 pt-12 pb-8"
           style={{ background: 'linear-gradient(135deg, hsl(222 45% 14%) 0%, hsl(222 35% 20%) 100%)' }}>
        {/* Decorative circles */}
        <div className="absolute top-4 right-8 w-20 h-20 rounded-full opacity-10"
             style={{ background: 'hsl(38 75% 52%)' }} />
        <div className="absolute top-12 right-16 w-10 h-10 rounded-full opacity-10"
             style={{ background: 'hsl(38 75% 52%)' }} />

        <button
          onClick={signOut}
          className="absolute top-5 right-5 p-2 rounded-xl text-white/40 hover:text-white/70 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>

        <h1 className="text-4xl font-bold text-white tracking-tight">Rondello</h1>
        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mt-0.5">Buffet</p>
      </div>

      <div className="px-4 -mt-5 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Eventos */}
          <button
            onClick={() => setTab('events')}
            className="rounded-2xl p-4 flex flex-col gap-1 active:opacity-80 transition-opacity"
            style={{ background: 'hsl(222 35% 18%)' }}
          >
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">EVENTOS</p>
            <p className="text-3xl font-bold text-white leading-none">
              {loading ? '—' : eventsThisMonth.length}
            </p>
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">{currentMonthLabel}</p>
          </button>

          {/* Degustações */}
          <button
            onClick={() => setTab('tastings')}
            className="rounded-2xl p-4 flex flex-col gap-1 active:opacity-80 transition-opacity"
            style={{ background: 'hsl(38 65% 40%)' }}
          >
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">DEGUST.</p>
            <p className="text-3xl font-bold text-white leading-none">
              {loading ? '—' : tastingsThisMonth.length}
            </p>
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">{currentMonthLabel}</p>
          </button>

          {/* Orçamentos */}
          <button
            onClick={() => setTab('quotes')}
            className="rounded-2xl p-4 flex flex-col gap-1 active:opacity-80 transition-opacity"
            style={{ background: 'hsl(263 60% 45%)' }}
          >
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">ORÇAM.</p>
            <p className="text-3xl font-bold text-white leading-none">
              {loading ? '—' : openQuotes.length}
            </p>
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">EM ABERTO</p>
          </button>
        </div>

        {/* Próximo evento */}
        {nextEvent && (
          <div className="rounded-2xl p-5 relative overflow-hidden"
               style={{ background: 'hsl(222 35% 18%)' }}>
            <div className="absolute inset-0 opacity-5"
                 style={{ background: 'radial-gradient(circle at 80% 50%, hsl(38 75% 52%), transparent 60%)' }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Próximo Evento</p>
              </div>
              <h2 className="text-xl font-bold text-white mb-3 leading-tight">
                {nextEvent.event_name ?? 'Sem nome'}
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">
                    {nextEvent.event_date ? fmtFull(nextEvent.event_date) : '—'}
                    {nextEvent.guest_count ? ` · ${nextEvent.guest_count} conv.` : ''}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Próximos Eventos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-foreground">Próximos Eventos</h3>
            <button
              onClick={() => setTab('events')}
              className="flex items-center gap-1 text-sm font-semibold"
              style={{ color: 'hsl(222 35% 30%)' }}
            >
              Ver todos <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : upcoming.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhum evento confirmado</p>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 5).map(ev => (
                <div key={ev.id}
                     className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4 shadow-xs active:bg-muted/30 transition-colors">
                  {ev.event_date && <DateBadge date={ev.event_date} />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{ev.event_name ?? 'Sem nome'}</p>
                    {ev.guest_count != null && (
                      <p className="text-sm text-muted-foreground mt-0.5">{ev.guest_count} convidados</p>
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
  const allConfirmed = events
    .filter(e => e.event_date && CONFIRMED_STATUS.includes(e.status))
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = allConfirmed.filter(e => (e.event_date ?? '') >= today);
  const past     = allConfirmed.filter(e => (e.event_date ?? '') < today).reverse();

  return (
    <div className="flex-1 overflow-y-auto pb-24 p-4 space-y-4">
      <h2 className="text-xl font-bold text-foreground">Eventos Confirmados</h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section title="Próximos" items={upcoming} />
          )}
          {past.length > 0 && (
            <Section title="Realizados" items={past} muted />
          )}
          {allConfirmed.length === 0 && (
            <p className="text-center text-muted-foreground py-12 text-sm">Nenhum evento confirmado</p>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, items, muted }: { title: string; items: Event[]; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <div className="space-y-3">
        {items.map(ev => (
          <div key={ev.id}
               className={`bg-white rounded-2xl border border-border p-4 flex items-center gap-4 ${muted ? 'opacity-50' : ''}`}>
            {ev.event_date && <DateBadge date={ev.event_date} />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{ev.event_name ?? 'Sem nome'}</p>
              {ev.guest_count != null && (
                <p className="text-sm text-muted-foreground">{ev.guest_count} convidados</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quotes Screen ────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  lead:              '1º Contato',
  negotiating:       'Negociando',
  tasting_scheduled: 'Degustação',
};
const STATUS_COLOR: Record<string, string> = {
  lead:              'bg-sky-100 text-sky-700',
  negotiating:       'bg-amber-100 text-amber-800',
  tasting_scheduled: 'bg-purple-100 text-purple-700',
};

function QuotesScreen({ quotes, loading }: { quotes: Event[]; loading: boolean }) {
  const sorted = [...quotes].sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));
  return (
    <div className="flex-1 overflow-y-auto pb-24 p-4 space-y-4">
      <h2 className="text-xl font-bold text-foreground">Orçamentos em Aberto</h2>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : sorted.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">Nenhum orçamento em aberto</p>
      ) : (
        <div className="space-y-3">
          {sorted.map(ev => (
            <div key={ev.id} className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4">
              {ev.event_date ? <DateBadge date={ev.event_date} /> : (
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{ev.event_name ?? 'Sem nome'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ev.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABEL[ev.status] ?? ev.status}
                  </span>
                  {ev.guest_count != null && (
                    <span className="text-xs text-muted-foreground">{ev.guest_count} conv.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Agenda Screen ────────────────────────────────────────────────────────────
function AgendaScreen({ events, tastings, loading }: { events: Event[]; tastings: Tasting[]; loading: boolean }) {
  const today = new Date().toISOString().slice(0, 10);

  // Next 30 days
  const end = new Date();
  end.setDate(end.getDate() + 60);
  const endStr = end.toISOString().slice(0, 10);

  const items: { date: string; label: string; kind: 'event' | 'tasting' }[] = [
    ...events.filter(e => e.event_date && e.event_date >= today && e.event_date <= endStr).map(e => ({
      date: e.event_date!,
      label: e.event_name ?? 'Evento',
      kind: 'event' as const,
    })),
    ...tastings.filter(t => t.tasting_date && t.tasting_date >= today && t.tasting_date <= endStr).map(t => ({
      date: t.tasting_date!,
      label: 'Degustação',
      kind: 'tasting' as const,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex-1 overflow-y-auto pb-24 p-4 space-y-4">
      <h2 className="text-xl font-bold text-foreground">Agenda — Próximos 60 dias</h2>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">Nenhum item nos próximos 60 dias</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4">
              <DateBadge date={item.date} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{item.label}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${item.kind === 'event' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {item.kind === 'event' ? 'Evento' : 'Degustação'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tastings Screen ──────────────────────────────────────────────────────────
function TastingsScreen({ tastings, loading }: { tastings: Tasting[]; loading: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = tastings.filter(t => t.tasting_date && t.tasting_date >= today).sort((a, b) => (a.tasting_date ?? '').localeCompare(b.tasting_date ?? ''));
  const past = tastings.filter(t => t.tasting_date && t.tasting_date < today).reverse();

  return (
    <div className="flex-1 overflow-y-auto pb-24 p-4 space-y-4">
      <h2 className="text-xl font-bold text-foreground">Degustações</h2>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Próximas</p>
              <div className="space-y-3">
                {upcoming.map(t => (
                  <div key={t.id} className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4">
                    {t.tasting_date && <DateBadge date={t.tasting_date} />}
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">Degustação</p>
                      <p className="text-sm text-muted-foreground capitalize">{t.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Realizadas</p>
              <div className="space-y-3">
                {past.slice(0, 10).map(t => (
                  <div key={t.id} className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4 opacity-50">
                    {t.tasting_date && <DateBadge date={t.tasting_date} />}
                    <p className="font-semibold text-foreground">Degustação</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tastings.length === 0 && (
            <p className="text-center text-muted-foreground py-12 text-sm">Nenhuma degustação cadastrada</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function MobileSupervisorApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [events, setEvents] = useState<Event[]>([]);
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [eventsRes, tastingsRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, event_name, event_date, guest_count, status')
          .order('event_date', { ascending: true }),
        (supabase.from as any)('tastings')
          .select('id, tasting_date, status')
          .order('tasting_date', { ascending: true }),
      ]);
      if (eventsRes.data) setEvents(eventsRes.data as Event[]);
      if (tastingsRes.data) setTastings(tastingsRes.data as Tasting[]);
      setLoading(false);
    };
    load();
  }, []);

  const openQuotes = events.filter(e => OPEN_STATUS.includes(e.status));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {tab === 'home'     && <HomeScreen events={events} tastings={tastings} openQuotes={openQuotes} loading={loading} setTab={setTab} />}
      {tab === 'events'   && <EventsScreen events={events} loading={loading} />}
      {tab === 'quotes'   && <QuotesScreen quotes={openQuotes} loading={loading} />}
      {tab === 'agenda'   && <AgendaScreen events={events} tastings={tastings} loading={loading} />}
      {tab === 'tastings' && <TastingsScreen tastings={tastings} loading={loading} />}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
