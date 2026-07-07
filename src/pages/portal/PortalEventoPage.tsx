import { useOutletContext } from 'react-router-dom';
import type { PortalContextType } from './ClientPortalLayout';
import logoRondello from '@/assets/logo-rondello.png';
import { MapPin, Users, CalendarDays, Clock, Phone, Instagram, Heart } from 'lucide-react';

const fmtDateLong = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

function Countdown({ days }: { days: number }) {
  if (days < 0) return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-700 to-slate-800 p-8 text-white text-center shadow-xl">
      <p className="text-4xl mb-2">✨</p>
      <p className="text-xl font-bold">Que festa incrível!</p>
      <p className="text-sm text-white/60 mt-1">Esperamos que tenha sido tudo perfeito.</p>
    </div>
  );
  if (days === 0) return (
    <div className="rounded-3xl bg-gradient-to-br from-rose-500 to-pink-600 p-8 text-white text-center shadow-xl">
      <p className="text-5xl mb-3">🎉</p>
      <p className="text-2xl font-black">Hoje é o grande dia!</p>
      <p className="text-sm text-rose-100 mt-2">Que tudo seja absolutamente perfeito!</p>
    </div>
  );

  // divide em meses, semanas e dias para deixar mais bonito
  const months = Math.floor(days / 30);
  const weeks  = Math.floor((days % 30) / 7);
  const rest   = days % 7;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-7 text-white shadow-xl relative overflow-hidden">
      {/* fundo decorativo */}
      <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
      <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />

      <p className="text-[11px] font-bold uppercase tracking-[.22em] text-white/60 text-center mb-5">Contagem regressiva</p>

      <div className="flex items-end justify-center gap-5">
        {months > 0 && (
          <div className="text-center">
            <p className="text-5xl font-black tabular-nums leading-none">{months}</p>
            <p className="text-[11px] text-white/60 mt-1 uppercase tracking-wide">mes{months > 1 ? 'es' : ''}</p>
          </div>
        )}
        {weeks > 0 && (
          <div className="text-center">
            <p className="text-5xl font-black tabular-nums leading-none">{weeks}</p>
            <p className="text-[11px] text-white/60 mt-1 uppercase tracking-wide">sem{weeks > 1 ? 's' : ''}</p>
          </div>
        )}
        <div className="text-center">
          <p className="text-5xl font-black tabular-nums leading-none">{rest}</p>
          <p className="text-[11px] text-white/60 mt-1 uppercase tracking-wide">dia{rest !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        <Heart className="w-3.5 h-3.5 text-rose-300 fill-rose-300" />
        <p className="text-sm text-white/70">até a festa!</p>
        <Heart className="w-3.5 h-3.5 text-rose-300 fill-rose-300" />
      </div>
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
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

      {/* Hero */}
      <div className="text-center space-y-2 pb-2">
        <img src={logoRondello} alt="Rondello Buffet" className="h-9 mx-auto mb-4 opacity-75" />
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-muted-foreground/50">Bem-vindo ao seu portal</p>
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
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarDays className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Data</p>
            </div>
            <p className="text-sm font-semibold text-foreground capitalize">{fmtDateLong(event.event_date)}</p>
          </div>
        )}
        {event.location_text && (
          <div className="bg-white border border-border rounded-2xl p-4 col-span-2">
            <div className="flex items-center gap-2 mb-1.5">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Local</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{event.location_text}</p>
          </div>
        )}
        {event.guest_count && (
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Users className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Convidados</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{event.guest_count} pessoas</p>
          </div>
        )}
        {event.ceremony_time && (
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Início</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{event.ceremony_time}</p>
          </div>
        )}
      </div>

      {/* Contato & Redes */}
      <div className="space-y-3 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center">Fale com a gente</p>
        <a
          href="https://wa.me/5515997650209"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-semibold text-sm shadow-sm hover:bg-emerald-600 active:scale-95 transition-all"
        >
          <Phone className="w-4 h-4" />
          Falar com o Rondello
        </a>
        <a
          href="https://www.instagram.com/buffetrondello"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-semibold text-sm shadow-sm active:scale-95 transition-all"
        >
          <Instagram className="w-4 h-4" />
          @buffetrondello
        </a>
      </div>

    </div>
  );
}
