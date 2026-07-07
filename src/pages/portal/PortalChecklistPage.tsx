import { useOutletContext } from 'react-router-dom';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import type { PortalContextType } from './ClientPortalLayout';

type CheckItem = {
  label: string;
  note?: string;
  deadline?: string;
  optional?: boolean;
};

const CHECKLIST: CheckItem[] = [
  {
    label: 'Contrato assinado',
  },
  {
    label: 'Agendamento da segunda degustação',
  },
  {
    label: 'Envio dos pratos para provar na segunda degustação',
  },
  {
    label: 'Segunda degustação realizada',
  },
  {
    label: 'Definição do cardápio final',
    deadline: 'até 15 dias antes da festa',
  },
  {
    label: 'Confirmação de convidados',
    deadline: 'até 15 dias antes da festa',
  },
  {
    label: 'Confirmação de staffs',
    deadline: 'até 15 dias antes da festa',
  },
  {
    label: 'Definição de brunch da noiva',
    note: 'se necessário',
    deadline: 'até 15 dias antes da festa',
    optional: true,
  },
  {
    label: 'Escolha de materiais',
    note: 'sousplat, toalhas, taças, talheres...',
    deadline: 'até 15 dias antes da festa',
  },
  {
    label: 'Quitação do evento',
    deadline: 'até 15 dias antes da festa',
  },
];

function getDaysUntil(eventDate: string | null): number | null {
  if (!eventDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(eventDate + 'T12:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PortalChecklistPage() {
  const { event } = useOutletContext<PortalContextType>();
  if (!event) return null;

  const daysUntil = getDaysUntil(event.event_date);
  const isDeadlinePast = daysUntil !== null && daysUntil <= 15;

  // Itens com deadline que já venceram ficam em destaque
  const deadlineItems = CHECKLIST.filter(i => i.deadline);
  const noDeadlineItems = CHECKLIST.filter(i => !i.deadline);

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-black text-foreground">Checklist do evento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe tudo o que precisa ser definido antes da sua festa.
        </p>
      </div>

      {/* Banner de atenção quando faltam 15 dias ou menos */}
      {isDeadlinePast && daysUntil !== null && daysUntil > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
          <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Atenção — faltam {daysUntil} dias!</p>
            <p className="text-xs text-amber-700 mt-0.5">Certifique-se de que todos os itens com prazo já estão resolvidos.</p>
          </div>
        </div>
      )}

      {/* Bloco: sem prazo */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Etapas do processo</p>
        </div>
        <ul className="divide-y divide-border/50">
          {noDeadlineItems.map((item, i) => (
            <CheckRow key={i} item={item} deadlinePast={false} />
          ))}
        </ul>
      </div>

      {/* Bloco: com prazo */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Com prazo</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            isDeadlinePast
              ? 'bg-amber-100 text-amber-700'
              : 'bg-primary/10 text-primary'
          }`}>
            15 dias antes da festa
          </span>
        </div>
        <ul className="divide-y divide-border/50">
          {deadlineItems.map((item, i) => (
            <CheckRow key={i} item={item} deadlinePast={!!isDeadlinePast} />
          ))}
        </ul>
      </div>

      <p className="text-center text-xs text-muted-foreground/60 pb-2">
        Dúvidas? Fale conosco pelo WhatsApp 😊
      </p>
    </div>
  );
}

function CheckRow({ item, deadlinePast }: { item: CheckItem; deadlinePast: boolean }) {
  const urgent = deadlinePast && !!item.deadline && !item.optional;

  return (
    <li className="flex items-start gap-3.5 px-5 py-4">
      <div className="mt-0.5 shrink-0">
        {urgent
          ? <Clock className="w-5 h-5 text-amber-400" />
          : <Circle className="w-5 h-5 text-border" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${urgent ? 'text-amber-800' : 'text-foreground'}`}>
          {item.label}
          {item.optional && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 border border-border rounded px-1 py-0.5">
              opcional
            </span>
          )}
        </p>
        {item.note && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{item.note}</p>
        )}
        {item.deadline && (
          <p className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${
            urgent ? 'text-amber-500' : 'text-muted-foreground/50'
          }`}>
            <Clock className="w-3 h-3" />
            {item.deadline}
          </p>
        )}
      </div>
    </li>
  );
}
