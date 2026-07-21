import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Coffee, CalendarDays, Users, ChevronDown, ChevronUp } from 'lucide-react';
import type { AssesoraInfo } from './AssesoraLayout';

interface TastingRow {
  id: string;
  scheduled_date: string;
  type: string | null;
  max_couples: number | null;
  eventos: { id: string; event_name: string | null; clients: { name: string | null } | null }[];
}

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

const fmtDateShort = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export default function AssesoraDegustacoes() {
  const { info } = useOutletContext<{ info: AssesoraInfo | null }>();
  const { user } = useAuth();
  const [tastings, setTastings] = useState<TastingRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !info?.id) return;
    (async () => {
      // Get events for this assessora
      const { data: evts } = await (supabase.from('events' as any) as any)
        .select('id, event_name, clients(name)')
        .or(`organizer_id.eq.${info.id},organizer.eq.${info.name}`);

      if (!evts || evts.length === 0) { setLoading(false); return; }

      const eventIds = evts.map((e: any) => e.id);
      const eventMap: Record<string, any> = {};
      evts.forEach((e: any) => { eventMap[e.id] = e; });

      // Get tasting_session_events for those events
      const { data: tses } = await (supabase.from('tasting_session_events' as any) as any)
        .select('tasting_session_id, event_id')
        .in('event_id', eventIds);

      if (!tses || tses.length === 0) { setLoading(false); return; }

      const sessionIds = [...new Set((tses as any[]).map((t: any) => t.tasting_session_id))] as string[];

      const { data: sessions } = await (supabase.from('tasting_sessions' as any) as any)
        .select('id, scheduled_date, type, max_couples')
        .in('id', sessionIds)
        .order('scheduled_date', { ascending: false });

      // Build mapping session → events
      const sessionEvents: Record<string, any[]> = {};
      (tses as any[]).forEach((tse: any) => {
        if (!sessionEvents[tse.tasting_session_id]) sessionEvents[tse.tasting_session_id] = [];
        const evt = eventMap[tse.event_id];
        if (evt) sessionEvents[tse.tasting_session_id].push(evt);
      });

      const rows: TastingRow[] = (sessions ?? []).map((s: any) => ({
        ...s,
        eventos: sessionEvents[s.id] ?? [],
      }));

      setTastings(rows);
      setLoading(false);
    })();
  }, [user, info?.id]);

  const toggle = (id: string) => setExpanded(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const now = new Date().toISOString().slice(0, 10);
  const upcoming = tastings.filter(t => t.scheduled_date >= now);
  const past     = tastings.filter(t => t.scheduled_date < now);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (tastings.length === 0) return (
    <div className="px-4 py-16 text-center">
      <Coffee className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">Nenhuma degustação encontrada.</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Quando seus clientes participarem de degustações, elas aparecerão aqui.</p>
    </div>
  );

  const TastingCard = ({ t, isPast }: { t: TastingRow; isPast?: boolean }) => {
    const open = expanded.has(t.id);
    return (
      <div className={`bg-white rounded-2xl border border-border overflow-hidden ${isPast ? 'opacity-70' : ''}`}>
        <button onClick={() => toggle(t.id)}
          className="w-full text-left px-4 py-4 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPast ? 'bg-slate-100' : 'bg-primary/10'}`}>
              <Coffee className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-primary'}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold capitalize ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                {fmtDate(t.scheduled_date)}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {t.type && <span>{t.type}</span>}
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t.eventos.length} cliente{t.eventos.length !== 1 ? 's' : ''} seu{t.eventos.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
        </button>

        {open && t.eventos.length > 0 && (
          <div className="border-t border-border/50 px-4 py-3 space-y-2">
            {t.eventos.map(e => (
              <div key={e.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary">
                    {(e.clients?.name ?? e.event_name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {e.clients?.name ?? e.event_name ?? '—'}
                  </p>
                  {e.event_name && e.clients?.name && (
                    <p className="text-[10px] text-muted-foreground truncate">{e.event_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Próximas degustações</h2>
          <div className="space-y-3">
            {upcoming.map(t => <TastingCard key={t.id} t={t} />)}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Histórico</h2>
          <div className="space-y-2">
            {past.map(t => <TastingCard key={t.id} t={t} isPast />)}
          </div>
        </section>
      )}
    </div>
  );
}
