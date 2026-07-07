// Supabase data client for Rondello Buffet mobile app.
import { supabase } from '../lib/supabase';
import type { Event, TastingSession, EventPayment } from '../types';

const EVENT_SELECT = `
  id, event_name, event_date, status, event_type,
  location_id, location_text,
  guest_count, children_50_pct, non_paying_guests, guests_per_table,
  table_count, cake_table_location, additional_hours,
  total_value, paid_value, is_paid_in_full,
  ceremony_time,
  professional_count, professional_meal_value, professional_meal_type,
  organizer, decorator, pastry_chef, band_dj, band_dj_time,
  photo_video, bartender, other_professionals, extra_attractions,
  welcome_cocktail, wine, whisky, beer,
  napkin_holder, tablecloth, rechaud, sousplat, sideboard,
  glass_type, bridal_suite, kids_area,
  notes, client_id,
  clients(id, name, phone),
  event_locations(name),
  contract_signed_url
`.replace(/\s+/g, ' ').trim();

// ── Events ───────────────────────────────────────────────────────────────────

export async function fetchAllEvents(opts?: { year?: number }): Promise<Event[]> {
  let q = (supabase as any).from('events').select(EVENT_SELECT).not('event_name', 'is', null);
  if (opts?.year) {
    q = q.gte('event_date', `${opts.year}-01-01`).lte('event_date', `${opts.year}-12-31`);
  }
  const { data, error } = await q.order('event_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function fetchEvent(id: string): Promise<Event> {
  const { data, error } = await (supabase as any)
    .from('events')
    .select(EVENT_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Event;
}

// ── Tastings ─────────────────────────────────────────────────────────────────

export async function fetchAllTastings(): Promise<TastingSession[]> {
  const [sessionsRes, statsRes, eventsRes] = await Promise.all([
    (supabase as any)
      .from('tasting_sessions')
      .select('id, scheduled_date, type, max_couples')
      .order('scheduled_date', { ascending: false }),
    (supabase as any)
      .from('tasting_session_stats')
      .select('session_id, total, fechados'),
    (supabase as any)
      .from('tasting_session_events')
      .select('session_id, event_id'),
  ]);

  const sessions: any[] = sessionsRes.data ?? [];
  const stats: any[]    = statsRes.data ?? [];
  const evts: any[]     = eventsRes.data ?? [];

  const statsMap   = Object.fromEntries(stats.map((s: any) => [s.session_id, s]));
  const evtMap: Record<string, string[]> = {};
  for (const row of evts) {
    if (!evtMap[row.session_id]) evtMap[row.session_id] = [];
    evtMap[row.session_id].push(row.event_id);
  }

  return sessions.map((s: any) => ({
    id:             s.id,
    scheduled_date: s.scheduled_date,
    type:           s.type ?? null,
    max_couples:    s.max_couples ?? null,
    total:          statsMap[s.id]?.total ?? null,
    fechados:       statsMap[s.id]?.fechados ?? null,
    event_ids:      evtMap[s.id] ?? [],
  }));
}

export async function fetchTasting(id: string): Promise<TastingSession & { linkedEvents: Event[] }> {
  const [sessionRes, evtLinksRes] = await Promise.all([
    (supabase as any).from('tasting_sessions').select('id, scheduled_date, type, max_couples').eq('id', id).single(),
    (supabase as any).from('tasting_session_events').select('event_id').eq('session_id', id),
  ]);

  if (sessionRes.error) throw sessionRes.error;
  const session: TastingSession = { ...sessionRes.data, event_ids: [] };

  const eventIds: string[] = (evtLinksRes.data ?? []).map((r: any) => r.event_id);
  let linkedEvents: Event[] = [];

  if (eventIds.length > 0) {
    const { data: evData } = await (supabase as any)
      .from('events')
      .select(EVENT_SELECT)
      .in('id', eventIds);
    linkedEvents = (evData ?? []) as Event[];
  }

  return { ...session, linkedEvents };
}

// ── Payments ─────────────────────────────────────────────────────────────────

export async function fetchPaymentsForEvent(eventId: string): Promise<EventPayment[]> {
  const { data, error } = await (supabase as any)
    .from('event_payments')
    .select('id, payment_date, value, type, is_confirmed')
    .eq('event_id', eventId)
    .order('payment_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventPayment[];
}
