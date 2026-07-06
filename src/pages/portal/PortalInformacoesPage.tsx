import { useOutletContext } from 'react-router-dom';
import type { PortalContextType } from './ClientPortalLayout';

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/50 last:border-0">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0 w-40">{label}</p>
      <p className="text-sm text-foreground font-medium text-right flex-1">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">{title}</p>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

export default function PortalInformacoesPage() {
  const { event } = useOutletContext<PortalContextType>();
  if (!event) return null;

  const pax = event.price_per_person ? fmtBRL(event.price_per_person) : null;
  const mealVal = event.professional_meal_value ? fmtBRL(event.professional_meal_value) : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">Informações da festa</h1>
        <p className="text-sm text-muted-foreground mt-1">Todos os detalhes confirmados do seu evento.</p>
      </div>

      <Section title="Dados gerais">
        <Row label="Nome do evento"  value={event.event_name} />
        <Row label="Local"           value={event.location_text} />
        <Row label="Data"            value={event.event_date ? fmtDate(event.event_date) : null} />
        <Row label="Tipo"            value={event.event_type} />
        <Row label="Horário de início" value={event.ceremony_time} />
        <Row label="Duração adicional" value={event.additional_hours ? `+${event.additional_hours}h` : null} />
      </Section>

      <Section title="Convidados">
        <Row label="Convidados"        value={event.guest_count} />
        <Row label="Crianças (50%)"    value={event.children_50_pct} />
        <Row label="Não pagantes"      value={event.non_paying_guests} />
        <Row label="Preço por pessoa"  value={pax} />
      </Section>

      <Section title="Profissionais do buffet">
        <Row label="Qtd. profissionais"   value={event.professional_count} />
        <Row label="Valor alim. prof."    value={mealVal} />
        <Row label="Alimentação prof."    value={event.professional_meal_type} />
      </Section>

      <Section title="Equipe contratada">
        <Row label="Organizadora"         value={event.organizer} />
        <Row label="Decorador"            value={event.decorator} />
        <Row label="Confeiteiro(a)"       value={event.pastry_chef} />
        <Row label="Banda / DJ"           value={event.band_dj} />
        <Row label="Foto / Filmagem"      value={event.photo_video} />
        <Row label="Bartender"            value={event.bartender} />
        <Row label="Outros profissionais" value={event.other_professionals} />
      </Section>
    </div>
  );
}
