import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, MapPin, Users, CalendarDays, Clock, Phone, DollarSign, User } from 'lucide-react';

interface Evento {
  id: string;
  event_name: string | null;
  event_date: string | null;
  event_type: string | null;
  status: string | null;
  guest_count: number | null;
  children_50_pct: number | null;
  non_paying_guests: number | null;
  location_text: string | null;
  ceremony_time: string | null;
  additional_hours: number | null;
  total_value: number | null;
  price_per_person: number | null;
  organizer: string | null;
  decorator: string | null;
  pastry_chef: string | null;
  band_dj: string | null;
  photo_video: string | null;
  bartender: string | null;
  other_professionals: string | null;
  clients: { name: string | null; phone: string | null } | null;
}

const fmtDateLong = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_LABEL: Record<string, string> = {
  lead: 'Lead', negotiating: 'Negociando', tasting_scheduled: 'Degustação agendada',
  confirmed: 'Confirmado', completed: 'Realizado', cancelled: 'Cancelado',
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-3 border-b border-border/50 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 sm:w-36 shrink-0">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

export default function AssesoraEventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await (supabase.from('events' as any) as any)
        .select(`id, event_name, event_date, event_type, status,
          guest_count, children_50_pct, non_paying_guests,
          location_text, ceremony_time, additional_hours,
          total_value, price_per_person,
          organizer, decorator, pastry_chef, band_dj, photo_video, bartender, other_professionals,
          clients(name, phone)`)
        .eq('id', id)
        .maybeSingle();
      setEvento(data as Evento);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!evento) return (
    <div className="px-4 py-16 text-center text-sm text-muted-foreground">Evento não encontrado.</div>
  );

  const daysUntil = evento.event_date
    ? Math.ceil((new Date(evento.event_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
    : null;

  const payingGuests = (evento.guest_count ?? 0)
    - Math.round(((evento.guest_count ?? 0) * (evento.children_50_pct ?? 0)) / 100 / 2)
    - (evento.non_paying_guests ?? 0);

  const professionals = [
    evento.decorator && `Decoração: ${evento.decorator}`,
    evento.pastry_chef && `Confeitaria: ${evento.pastry_chef}`,
    evento.band_dj && `Música: ${evento.band_dj}`,
    evento.photo_video && `Foto/Vídeo: ${evento.photo_video}`,
    evento.bartender && `Bar: ${evento.bartender}`,
    evento.other_professionals,
  ].filter(Boolean).join('\n');

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate('/assessora')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5">
        <ArrowLeft className="w-4 h-4" />
        Todos os eventos
      </button>

      {/* Hero card */}
      <div className="rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 text-white shadow-xl mb-5 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
          {STATUS_LABEL[evento.status ?? ''] ?? evento.status}
        </span>
        <h1 className="text-xl font-black mt-1 leading-tight">
          {evento.event_name ?? evento.clients?.name ?? 'Evento'}
        </h1>
        {evento.event_type && (
          <p className="text-sm text-white/70 mt-0.5">{evento.event_type}</p>
        )}
        {evento.event_date && (
          <p className="text-sm text-white/90 mt-3 font-medium capitalize">{fmtDateLong(evento.event_date)}</p>
        )}
        {daysUntil !== null && daysUntil > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/15 rounded-xl px-3 py-1.5">
            <CalendarDays className="w-4 h-4" />
            <span className="text-sm font-semibold">{daysUntil} dias para o evento</span>
          </div>
        )}
        {daysUntil !== null && daysUntil <= 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/15 rounded-xl px-3 py-1.5">
            <span className="text-sm font-semibold">{daysUntil === 0 ? '🎉 Hoje é o grande dia!' : '✨ Evento realizado!'}</span>
          </div>
        )}
      </div>

      {/* Info sections */}
      <div className="bg-white rounded-2xl border border-border p-5 mb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Detalhes do Evento</h2>
        <div>
          <InfoRow label="Local" value={evento.location_text} />
          <InfoRow label="Horário" value={evento.ceremony_time} />
          {evento.additional_hours ? <InfoRow label="Horas adicionais" value={`+${evento.additional_hours}h`} /> : null}
          <InfoRow label="Convidados" value={evento.guest_count ? `${evento.guest_count} convidados` : null} />
          {evento.children_50_pct ? <InfoRow label="Crianças (50%)" value={`${evento.children_50_pct}%`} /> : null}
          {evento.non_paying_guests ? <InfoRow label="Não pagantes" value={String(evento.non_paying_guests)} /> : null}
        </div>
      </div>

      {evento.clients?.name && (
        <div className="bg-white rounded-2xl border border-border p-5 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Clientes</h2>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{evento.clients.name}</p>
              {evento.clients.phone && (
                <a href={`tel:${evento.clients.phone}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />{evento.clients.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {evento.total_value && (
        <div className="bg-white rounded-2xl border border-border p-5 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Financeiro</h2>
          <div>
            <InfoRow label="Valor total" value={fmtBRL(evento.total_value)} />
            {evento.price_per_person ? <InfoRow label="Por pessoa" value={fmtBRL(evento.price_per_person)} /> : null}
          </div>
        </div>
      )}

      {professionals && (
        <div className="bg-white rounded-2xl border border-border p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Equipe & Fornecedores</h2>
          <div>
            {evento.decorator && <InfoRow label="Decoração" value={evento.decorator} />}
            {evento.pastry_chef && <InfoRow label="Confeitaria" value={evento.pastry_chef} />}
            {evento.band_dj && <InfoRow label="Música" value={evento.band_dj} />}
            {evento.photo_video && <InfoRow label="Foto/Vídeo" value={evento.photo_video} />}
            {evento.bartender && <InfoRow label="Bar" value={evento.bartender} />}
            {evento.other_professionals && <InfoRow label="Outros" value={evento.other_professionals} />}
          </div>
        </div>
      )}
    </div>
  );
}
