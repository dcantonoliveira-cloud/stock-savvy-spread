import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { PortalContextType } from './ClientPortalLayout';

type CheckItem = {
  id: number;
  label: string;
  note?: string;
  deadline?: string;
  optional?: boolean;
};

const CHECKLIST: CheckItem[] = [
  { id: 0,  label: 'Contrato assinado' },
  { id: 1,  label: 'Agendamento da segunda degustação' },
  { id: 2,  label: 'Envio dos pratos para provar na segunda degustação' },
  { id: 3,  label: 'Segunda degustação realizada' },
  { id: 4,  label: 'Definição do cardápio final',              deadline: 'até 15 dias antes da festa' },
  { id: 5,  label: 'Confirmação de convidados',                deadline: 'até 15 dias antes da festa' },
  { id: 6,  label: 'Confirmação de staffs',                   deadline: 'até 15 dias antes da festa' },
  { id: 7,  label: 'Definição de brunch da noiva', note: 'se necessário', deadline: 'até 15 dias antes da festa', optional: true },
  { id: 8,  label: 'Escolha de materiais', note: 'sousplat, toalhas, taças, talheres...', deadline: 'até 15 dias antes da festa' },
  { id: 9,  label: 'Quitação do evento',                      deadline: 'até 15 dias antes da festa' },
];

function getDaysUntil(eventDate: string | null): number | null {
  if (!eventDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(eventDate + 'T12:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PortalChecklistPage() {
  const { event, portalId } = useOutletContext<PortalContextType>();
  const [done, setDone]       = useState<Set<number>>(new Set());
  const [saving, setSaving]   = useState<number | null>(null);
  const [loaded, setLoaded]   = useState(false);

  // Carrega estado salvo
  useEffect(() => {
    if (!portalId) return;
    (supabase.from as any)('client_portal_access')
      .select('checklist_done')
      .eq('id', portalId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.checklist_done) setDone(new Set(data.checklist_done));
        setLoaded(true);
      });
  }, [portalId]);

  const toggle = async (id: number) => {
    if (!portalId || saving !== null) return;
    setSaving(id);

    const next = new Set(done);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDone(next);

    await (supabase.from as any)('client_portal_access')
      .update({ checklist_done: [...next] })
      .eq('id', portalId);

    setSaving(null);
  };

  if (!event) return null;

  const daysUntil    = getDaysUntil(event.event_date);
  const deadlinePast = daysUntil !== null && daysUntil <= 15;
  const noDeadline   = CHECKLIST.filter(i => !i.deadline);
  const withDeadline = CHECKLIST.filter(i =>  i.deadline);
  const totalDone    = done.size;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-foreground">Checklist do evento</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe tudo o que precisa ser definido antes da sua festa.</p>
      </div>

      {/* Progresso */}
      {loaded && (
        <div className="bg-white border border-border rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-foreground">{totalDone} de {CHECKLIST.length} concluídos</p>
            <p className="text-sm font-bold text-primary">{Math.round(totalDone / CHECKLIST.length * 100)}%</p>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-2 bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(totalDone / CHECKLIST.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Banner prazo */}
      {deadlinePast && daysUntil !== null && daysUntil > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
          <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Atenção — faltam {daysUntil} dias!</p>
            <p className="text-xs text-amber-700 mt-0.5">Certifique-se de que todos os itens com prazo já estão resolvidos.</p>
          </div>
        </div>
      )}

      {/* Etapas sem prazo */}
      <Block title="Etapas do processo">
        {noDeadline.map(item => (
          <CheckRow
            key={item.id}
            item={item}
            checked={done.has(item.id)}
            saving={saving === item.id}
            deadlinePast={false}
            onToggle={() => toggle(item.id)}
          />
        ))}
      </Block>

      {/* Com prazo */}
      <Block
        title="Com prazo"
        badge={
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            deadlinePast ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
          }`}>
            15 dias antes da festa
          </span>
        }
      >
        {withDeadline.map(item => (
          <CheckRow
            key={item.id}
            item={item}
            checked={done.has(item.id)}
            saving={saving === item.id}
            deadlinePast={deadlinePast}
            onToggle={() => toggle(item.id)}
          />
        ))}
      </Block>

      <p className="text-center text-xs text-muted-foreground/60 pb-2">Dúvidas? Fale conosco pelo WhatsApp 😊</p>
    </div>
  );
}

function Block({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">{title}</p>
        {badge}
      </div>
      <ul className="divide-y divide-border/50">{children}</ul>
    </div>
  );
}

function CheckRow({
  item, checked, saving, deadlinePast, onToggle,
}: {
  item: CheckItem;
  checked: boolean;
  saving: boolean;
  deadlinePast: boolean;
  onToggle: () => void;
}) {
  const urgent = deadlinePast && !!item.deadline && !item.optional && !checked;

  return (
    <li
      className={`flex items-start gap-3.5 px-5 py-4 cursor-pointer transition-colors select-none
        ${checked ? 'bg-emerald-50/60' : urgent ? 'bg-amber-50/40' : 'hover:bg-muted/30'}`}
      onClick={onToggle}
    >
      {/* Ícone */}
      <div className="mt-0.5 shrink-0">
        {saving ? (
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        ) : checked ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : urgent ? (
          <Clock className="w-5 h-5 text-amber-400" />
        ) : (
          <Circle className="w-5 h-5 text-border" />
        )}
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug transition-colors ${
          checked ? 'line-through text-muted-foreground' : urgent ? 'text-amber-800' : 'text-foreground'
        }`}>
          {item.label}
          {item.optional && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 border border-border rounded px-1 py-0.5 no-underline" style={{textDecoration:'none'}}>
              opcional
            </span>
          )}
        </p>
        {item.note && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{item.note}</p>
        )}
        {item.deadline && !checked && (
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
