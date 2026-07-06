import { useOutletContext } from 'react-router-dom';
import type { PortalContextType } from './ClientPortalLayout';
import logoRondello from '@/assets/logo-rondello.png';
import { MapPin, Users, CalendarDays, Clock } from 'lucide-react';

const fmtDateLong = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

function Countdown({ days }: { days: number }) {
  if (days < 0) return null;
  if (days === 0) return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 text-white text-center shadow-lg">
      <p className="text-5xl font-black mb-2">🎉</p>
      <p className="text-2xl font-bold">Hoje é o grande dia!</p>
      <p className="text-sm text-emerald-100 mt-1">Que tudo seja perfeito!</p>
    </div>
  );
  return (
    <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-8 text-white shadow-lg">
      <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-3 text-center">Contagem regressiva</p>
      <div className="flex items-end justify-center gap-1">
        <span className="text-7xl font-black tabular-nums leading-none">{days}</span>
        <span className="text-2xl font-bold mb-2 text-white/80">dias</span>
      </div>
      <p className="text-sm text-center text-white/70 mt-3">até a festa!</p>
    </div>
  );
}

export default function PortalEventoPage() {
  const { event } = useOutletContext<PortalContextType>();
  if (!event) return null;

  const daysLeft = event.event_date
    ? Math.ceil((new Date(event.event_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

      {/* Hero */}
      <div className="text-center space-y-2">
        <img src={logoRondello} alt="Rondello Buffet" className="h-10 mx-auto mb-4 opacity-80" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Bem-vindo ao seu portal</p>
        <h1 className="text-3xl font-black text-foreground leading-tight">{event.event_name}</h1>
        {event.clients?.name && (
          <p className="text-sm text-muted-foreground">{event.clients.name}</p>
        )}
      </div>

      {/* Countdown */}
      {daysLeft !== null && <Countdown days={daysLeft} />}

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3">
        {event.event_date && (
          <div className="bg-white border border-border rounded-2xl p-4 col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Data</p>
            </div>
            <p className="text-sm font-semibold text-foreground capitalize">{fmtDateLong(event.event_date)}</p>
          </div>
        )}
        {event.location_text && (
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Local</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{event.location_text}</p>
          </div>
        )}
        {event.guest_count && (
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Convidados</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{event.guest_count} pessoas</p>
          </div>
        )}
        {event.ceremony_time && (
          <div className="bg-white border border-border rounded-2xl p-4 col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Horário de início</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{event.ceremony_time}</p>
          </div>
        )}
      </div>
    </div>
  );
}
