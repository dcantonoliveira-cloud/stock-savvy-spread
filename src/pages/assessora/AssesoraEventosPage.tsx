import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CalendarDays, MapPin, Users, ChevronRight, Clock, Search } from 'lucide-react';
import type { AssesoraInfo } from './AssesoraLayout';

interface Evento {
  id: string;
  event_name: string | null;
  event_date: string | null;
  event_type: string | null;
  status: string | null;
  guest_count: number | null;
  location_text: string | null;
  ceremony_time: string | null;
  total_value: number | null;
  clients: { name: string | null } | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  lead:                { label: 'Lead',          cls: 'bg-slate-100 text-slate-600' },
  negotiating:         { label: 'Negociando',    cls: 'bg-blue-100 text-blue-700' },
  tasting_scheduled:   { label: 'Degustação',    cls: 'bg-amber-100 text-amber-700' },
  confirmed:           { label: 'Confirmado',    cls: 'bg-emerald-100 text-emerald-700' },
  completed:           { label: 'Realizado',     cls: 'bg-emerald-100 text-emerald-700' },
  cancelled:           { label: 'Cancelado',     cls: 'bg-red-100 text-red-600' },
};

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

const fmtDateShort = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export default function AssesoraEventosPage() {
  const { info } = useOutletContext<{ info: AssesoraInfo | null }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user || !info?.id) return;
    (async () => {
      const { data } = await (supabase.from('events' as any) as any)
        .select('id, event_name, event_date, event_type, status, guest_count, location_text, ceremony_time, total_value, clients(name)')
        .or(`organizer_id.eq.${info.id},organizer.eq.${info.name}`)
        .not('status', 'in', '("cancelled","lost")')
        .order('event_date', { ascending: false });
      setEventos((data ?? []) as Evento[]);
      setLoading(false);
    })();
  }, [user, info?.id]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? eventos.filter(e =>
        (e.event_name ?? '').toLowerCase().includes(q) ||
        (e.clients?.name ?? '').toLowerCase().includes(q)
      )
    : eventos;
  const upcoming = filtered.filter(e => e.event_date && e.event_date >= new Date().toISOString().slice(0, 10) && e.status !== 'cancelled');
  const past     = filtered.filter(e => !upcoming.includes(e));

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (eventos.length === 0) return (
    <div className="px-4 py-16 text-center">
      <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>
    </div>
  );

  const EventCard = ({ e }: { e: Evento }) => {
    const st = STATUS_LABEL[e.status ?? ''] ?? { label: e.status ?? '—', cls: 'bg-slate-100 text-slate-600' };
    return (
      <button onClick={() => navigate(`/assessora/evento/${e.id}`)}
        className="w-full text-left bg-white rounded-2xl border border-border p-4 hover:shadow-md transition-all group">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
              {e.event_name ?? e.clients?.name ?? 'Sem nome'}
            </p>
            {e.clients?.name && e.event_name && (
              <p className="text-xs text-muted-foreground mt-0.5">{e.clients.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {e.event_date && (
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              {fmtDate(e.event_date)}
            </span>
          )}
          {e.ceremony_time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {e.ceremony_time}
            </span>
          )}
          {e.guest_count && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {e.guest_count} convidados
            </span>
          )}
          {e.location_text && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[200px]">{e.location_text}</span>
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome do evento ou cliente..."
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
        />
      </div>

      {filtered.length === 0 && q && (
        <div className="text-center py-10 text-sm text-muted-foreground">Nenhum evento encontrado para "{search}".</div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Próximos eventos</h2>
          <div className="space-y-3">
            {upcoming.map(e => <EventCard key={e.id} e={e} />)}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Histórico</h2>
          <div className="space-y-2">
            {past.map(e => {
              const st = STATUS_LABEL[e.status ?? ''] ?? { label: e.status ?? '—', cls: 'bg-slate-100 text-slate-600' };
              return (
                <button key={e.id} onClick={() => navigate(`/assessora/evento/${e.id}`)}
                  className="w-full text-left bg-white rounded-xl border border-border px-4 py-3 hover:bg-muted/30 transition-colors flex items-center gap-3 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.event_name ?? e.clients?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{e.event_date ? fmtDateShort(e.event_date) : '—'} · {e.guest_count ?? '—'} pax</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
