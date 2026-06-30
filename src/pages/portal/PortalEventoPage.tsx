import { useOutletContext } from 'react-router-dom';
import { CalendarDays, MapPin, Users, Tag } from 'lucide-react';
import type { PortalContextType } from './ClientPortalLayout';
import { getStatus } from '@/lib/eventStatus';

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PortalEventoPage() {
  const { event } = useOutletContext<PortalContextType>();
  if (!event) return null;

  const st = getStatus(event.status);
  const daysLeft = event.event_date
    ? Math.ceil((new Date(event.event_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
    : null;

  const infos = [
    { icon: CalendarDays, label: 'Data do evento',  value: event.event_date ? fmtDate(event.event_date) : '—' },
    { icon: MapPin,       label: 'Local',            value: event.location_text ?? '—' },
    { icon: Users,        label: 'Convidados',       value: event.guest_count ? `${event.guest_count} pessoas` : '—' },
    { icon: Tag,          label: 'Tipo',             value: event.event_type ?? '—' },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">{event.event_name}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${st.cls}`}>
            {st.label}
          </span>
        </div>
        {event.clients?.name && (
          <p className="text-sm text-muted-foreground">{event.clients.name}</p>
        )}
      </div>

      {/* Countdown */}
      {daysLeft !== null && daysLeft > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-primary tabular-nums">{daysLeft}</p>
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-widest">dias</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Faltam {daysLeft} dias para o grande dia!</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {event.event_date ? fmtDate(event.event_date) : ''}
            </p>
          </div>
        </div>
      )}
      {daysLeft !== null && daysLeft === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <p className="font-bold text-emerald-700 text-lg">Hoje é o grande dia! 🎉</p>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3">
        {infos.map((info, i) => (
          <div key={i} className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <info.icon className="w-4 h-4 text-primary shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{info.label}</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{info.value}</p>
          </div>
        ))}
      </div>

      {/* Valor total */}
      {event.total_value && (
        <div className="bg-white border border-border rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Valor contratado</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{fmtBRL(event.total_value)}</p>
          </div>
          <p className="text-xs text-muted-foreground">Veja detalhes em Financeiro</p>
        </div>
      )}
    </div>
  );
}
