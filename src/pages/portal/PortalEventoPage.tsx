import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import type { PortalContextType } from './ClientPortalLayout';
import { supabase } from '@/integrations/supabase/client';
import logoRondello from '@/assets/logo-rondello.png';
import { MapPin, Users, CalendarDays, Clock, Phone, Instagram, Heart, CheckCircle2, Circle, ChevronRight, DollarSign } from 'lucide-react';

const fmtDateLong = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CHECKLIST_LABELS = [
  'Contrato assinado',
  'Agendamento da segunda degustação',
  'Envio dos pratos para provar na segunda degustação',
  'Segunda degustação realizada',
  'Definição do cardápio final',
  'Confirmação de convidados',
  'Confirmação de staffs',
  'Definição de brunch da noiva e/ou Noivo',
  'Escolha de materiais',
  'Quitação do evento',
];

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

  const months = Math.floor(days / 30);
  const weeks  = Math.floor((days % 30) / 7);
  const rest   = days % 7;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-7 text-white shadow-xl relative overflow-hidden">
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
  const { event, portalId } = useOutletContext<PortalContextType>();
  const [paid,       setPaid]       = useState<number | null>(null);
  const [checkDone,  setCheckDone]  = useState<Set<number>>(new Set());
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!event?.id || !portalId) return;
    Promise.all([
      // pagamentos confirmados
      (supabase.from as any)('event_payments')
        .select('value')
        .eq('event_id', event.id)
        .eq('is_confirmed', true),
      // checklist
      (supabase.from as any)('client_portal_access')
        .select('checklist_done')
        .eq('id', portalId)
        .maybeSingle(),
    ]).then(([{ data: pays }, { data: chk }]) => {
      setPaid((pays ?? []).reduce((s: number, p: any) => s + (p.value ?? 0), 0));
      if (chk?.checklist_done) setCheckDone(new Set(chk.checklist_done));
      setDataLoaded(true);
    });
  }, [event?.id, portalId]);

  if (!event) return null;

  const daysLeft = event.event_date
    ? Math.ceil((new Date(event.event_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
    : null;

  const total   = event.total_value ?? 0;
  const balance = total - (paid ?? 0);

  // próximos 3 itens não feitos do checklist
  const nextSteps = CHECKLIST_LABELS
    .map((label, id) => ({ id, label }))
    .filter(item => !checkDone.has(item.id))
    .slice(0, 3);

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

      {/* Resumo financeiro */}
      {dataLoaded && total > 0 && (
        <Link to="/portal/financeiro" className="block">
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Financeiro</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
            </div>
            <div className="grid grid-cols-3 divide-x divide-border/50">
              <div className="px-4 py-3.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1">Total</p>
                <p className="text-sm font-bold text-foreground">{fmtBRL(total)}</p>
              </div>
              <div className="px-4 py-3.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1">Pago</p>
                <p className="text-sm font-bold text-emerald-600">{fmtBRL(paid ?? 0)}</p>
              </div>
              <div className="px-4 py-3.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1">Saldo</p>
                <p className={`text-sm font-bold ${balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {fmtBRL(balance)}
                </p>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Próximos passos do checklist */}
      {dataLoaded && nextSteps.length > 0 && (
        <Link to="/portal/checklist" className="block">
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Próximos passos</p>
                <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  {CHECKLIST_LABELS.length - checkDone.size} restantes
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
            </div>
            <ul className="divide-y divide-border/50">
              {nextSteps.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <Circle className="w-4 h-4 text-border shrink-0" />
                  <p className="text-sm text-foreground">{item.label}</p>
                </li>
              ))}
              {CHECKLIST_LABELS.length - checkDone.size > 3 && (
                <li className="px-5 py-2.5 text-xs text-muted-foreground/60 text-center">
                  + {CHECKLIST_LABELS.length - checkDone.size - 3} mais no checklist completo
                </li>
              )}
            </ul>
          </div>
        </Link>
      )}

      {/* Tudo feito! */}
      {dataLoaded && nextSteps.length === 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Checklist completo!</p>
            <p className="text-xs text-emerald-700/70 mt-0.5">Tudo certo por aqui. Agora é só curtir a festa 🎉</p>
          </div>
        </div>
      )}

      {/* Contato */}
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
