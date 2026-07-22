import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, MapPin, Users, CalendarDays, Clock, Phone,
  User, CheckCircle2, Receipt, AlertCircle,
} from 'lucide-react';

interface Evento {
  id: string;
  event_name: string | null;
  event_date: string | null;
  event_type: string | null;
  status: string | null;
  product_name: string | null;
  guest_count: number | null;
  children_50_pct: number | null;
  non_paying_guests: number | null;
  location_text: string | null;
  ceremony_time: string | null;
  duration_hours: number | null;
  additional_hours: number | null;
  total_value: number | null;
  price_per_person: number | null;
  professional_count: number | null;
  professional_meal_value: number | null;
  professional_meal_type: string | null;
  organizer: string | null;
  decorator: string | null;
  pastry_chef: string | null;
  band_dj: string | null;
  photo_video: string | null;
  bartender: string | null;
  other_professionals: string | null;
  extra_attractions: string | null;
  clients: { name: string | null; phone: string | null } | null;
}

type Payment    = { id: string; value: number; payment_date: string; is_confirmed: boolean; notes: string | null };
type Additional = { id: string; description: string; value: number };

const fmtDateLong = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  lead:              { label: 'Lead',                   color: 'bg-slate-500' },
  negotiating:       { label: 'Negociando',             color: 'bg-blue-500' },
  tasting_scheduled: { label: 'Degustação agendada',    color: 'bg-amber-500' },
  confirmed:         { label: 'Confirmado',              color: 'bg-emerald-500' },
  completed:         { label: 'Realizado',               color: 'bg-emerald-600' },
  cancelled:         { label: 'Cancelado',               color: 'bg-red-500' },
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-36 shrink-0">{label}</span>
      {value
        ? <span className="text-sm text-foreground text-right flex-1">{value}</span>
        : <span className="text-sm text-muted-foreground/40 text-right flex-1 italic">Não informado</span>
      }
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/20">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{title}</p>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

export default function AssesoraEventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evento,      setEvento]      = useState<Evento | null>(null);
  const [payments,    setPayments]    = useState<Payment[]>([]);
  const [additionals, setAdditionals] = useState<Additional[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: ev }, { data: pay }, { data: add }] = await Promise.all([
        (supabase.from('events' as any) as any)
          .select(`id, event_name, event_date, event_type, status,
            product_name, guest_count, children_50_pct, non_paying_guests,
            location_text, ceremony_time, duration_hours, additional_hours,
            total_value, price_per_person,
            professional_count, professional_meal_value, professional_meal_type,
            organizer, decorator, pastry_chef, band_dj, photo_video, bartender, other_professionals, extra_attractions,
            clients(name, phone)`)
          .eq('id', id)
          .maybeSingle(),
        (supabase.from('event_payments' as any) as any)
          .select('id, value, payment_date, is_confirmed, notes')
          .eq('event_id', id)
          .order('payment_date'),
        (supabase.from('event_additional_values' as any) as any)
          .select('id, description, value')
          .eq('event_id', id),
      ]);
      setEvento(ev as Evento);
      setPayments(pay ?? []);
      setAdditionals(add ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!evento) return (
    <div className="px-4 py-16 text-center text-sm text-muted-foreground">Evento não encontrado.</div>
  );

  const daysUntil = evento.event_date
    ? Math.ceil((new Date(evento.event_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
    : null;

  const st         = STATUS_LABEL[evento.status ?? ''] ?? { label: evento.status ?? '—', color: 'bg-slate-500' };
  const baseValue  = evento.total_value ?? 0;
  const addTotal   = additionals.reduce((s, a) => s + a.value, 0);
  const total      = baseValue + addTotal;
  const confirmed  = payments.filter(p => p.is_confirmed);
  const scheduled  = payments.filter(p => !p.is_confirmed);
  const paid       = confirmed.reduce((s, p) => s + p.value, 0);
  const outstanding = total - paid;
  const pct        = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <div className="px-4 py-5 max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate('/assessora')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5">
        <ArrowLeft className="w-4 h-4" />
        Todos os eventos
      </button>

      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 text-white shadow-xl mb-6 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-2 ${st.color} bg-opacity-80`}>
              {st.label}
            </span>
            <h1 className="text-2xl lg:text-3xl font-black leading-tight">
              {evento.event_name ?? evento.clients?.name ?? 'Evento'}
            </h1>
            {evento.event_type && (
              <p className="text-sm text-white/70 mt-0.5">{evento.event_type}</p>
            )}
            {evento.event_date && (
              <p className="text-sm text-white/90 mt-2 font-medium capitalize">{fmtDateLong(evento.event_date)}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {evento.ceremony_time && (
              <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-semibold">{evento.ceremony_time}</span>
              </div>
            )}
            {evento.guest_count && (
              <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5">
                <Users className="w-4 h-4" />
                <span className="text-sm font-semibold">{evento.guest_count} convidados</span>
              </div>
            )}
            {daysUntil !== null && daysUntil > 0 && (
              <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5">
                <CalendarDays className="w-4 h-4" />
                <span className="text-sm font-semibold">{daysUntil} dias</span>
              </div>
            )}
            {daysUntil !== null && daysUntil === 0 && (
              <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5">
                <span className="text-sm font-semibold">🎉 Hoje!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop 2-col / mobile 1-col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Coluna esquerda */}
        <div className="space-y-4">

          {/* Detalhes */}
          <Card title="Detalhes do evento">
            <InfoRow label="Nome do evento"    value={evento.event_name} />
            <InfoRow label="Local"             value={evento.location_text} />
            <InfoRow label="Data"              value={evento.event_date ? fmtDateLong(evento.event_date) : null} />
            <InfoRow label="Tipo"              value={evento.event_type} />
            <InfoRow label="Produto escolhido" value={evento.product_name} />
            <InfoRow label="Horário de início" value={evento.ceremony_time} />
            <InfoRow label="Duração"           value={evento.duration_hours != null ? `${Math.floor(evento.duration_hours)}h${Math.round((evento.duration_hours % 1) * 60) > 0 ? ` ${Math.round((evento.duration_hours % 1) * 60)}min` : ''}` : null} />
            <InfoRow label="Convidados"        value={evento.guest_count != null ? String(evento.guest_count) : null} />
            <InfoRow label="Preço / Pax"       value={evento.price_per_person != null ? fmtBRL(evento.price_per_person) : null} />
            <InfoRow label="Crianças (50%)"    value={evento.children_50_pct != null ? String(evento.children_50_pct) : null} />
            <InfoRow label="Não pagantes"      value={evento.non_paying_guests != null ? String(evento.non_paying_guests) : null} />
            <InfoRow label="Qtd. profissionais"      value={evento.professional_count != null ? String(evento.professional_count) : null} />
            <InfoRow label="Valor alim. prof." value={evento.professional_meal_value != null ? fmtBRL(evento.professional_meal_value) : null} />
          </Card>

          {/* Cliente */}
          {evento.clients?.name && (
            <Card title="Cliente">
              <div className="flex items-center gap-3 py-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{evento.clients.name}</p>
                  {evento.clients.phone && (
                    <a href={`tel:${evento.clients.phone}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />{evento.clients.phone}
                    </a>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Equipe contratada — sempre mostra */}
          <Card title="Equipe contratada">
            <InfoRow label="Organizadora"        value={evento.organizer} />
            <InfoRow label="Decoração"           value={evento.decorator} />
            <InfoRow label="Confeitaria"         value={evento.pastry_chef} />
            <InfoRow label="Banda / DJ"          value={evento.band_dj} />
            <InfoRow label="Foto / Filmagem"     value={evento.photo_video} />
            <InfoRow label="Bartender"           value={evento.bartender} />
            <InfoRow label="Outros profissionais" value={evento.other_professionals} />
            <InfoRow label="Atrações à parte"    value={evento.extra_attractions} />
          </Card>
        </div>

        {/* Coluna direita — Financeiro */}
        <div className="space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-border rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Total</p>
              <p className="text-sm font-bold tabular-nums text-foreground">{fmtBRL(total)}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/70 mb-1">Pago</p>
              <p className="text-sm font-bold tabular-nums text-emerald-700">{fmtBRL(paid)}</p>
            </div>
            <div className={`border rounded-2xl p-4 ${outstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${outstanding > 0 ? 'text-red-400' : 'text-emerald-600/70'}`}>Saldo</p>
              <p className={`text-sm font-bold tabular-nums ${outstanding > 0 ? 'text-red-500' : 'text-emerald-700'}`}>{fmtBRL(outstanding)}</p>
            </div>
          </div>

          {/* Barra progresso */}
          {total > 0 && (
            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">Progresso de pagamento</p>
                <p className="text-sm font-bold text-emerald-600">{pct}%</p>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {/* Composição */}
          {total > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-muted/20">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Composição</p>
              </div>
              <div className="divide-y divide-border/40">
                {evento.guest_count && evento.price_per_person ? (
                  <div className="px-5 py-3 flex items-center justify-between">
                    <p className="text-sm text-foreground">{evento.guest_count} × {fmtBRL(evento.price_per_person)}</p>
                    <p className="text-sm font-semibold tabular-nums">{fmtBRL(baseValue)}</p>
                  </div>
                ) : (
                  <div className="px-5 py-3 flex items-center justify-between">
                    <p className="text-sm text-foreground">Valor base</p>
                    <p className="text-sm font-semibold tabular-nums">{fmtBRL(baseValue)}</p>
                  </div>
                )}
                {additionals.map(a => (
                  <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                    <p className="text-sm text-foreground">{a.description}</p>
                    <p className="text-sm font-semibold tabular-nums text-amber-600">+{fmtBRL(a.value)}</p>
                  </div>
                ))}
                <div className="px-5 py-3 flex items-center justify-between bg-muted/20">
                  <p className="text-sm font-bold">Total</p>
                  <p className="text-sm font-bold tabular-nums">{fmtBRL(total)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Pagamentos confirmados */}
          {confirmed.length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-muted/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Pagamentos realizados</p>
              </div>
              <div className="divide-y divide-border/40">
                {confirmed.map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{fmtDate(p.payment_date)}</p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.notes}</p>}
                    </div>
                    <span className="text-sm font-bold tabular-nums text-emerald-600 shrink-0">+{fmtBRL(p.value)}</span>
                  </div>
                ))}
                <div className="px-5 py-3 flex items-center justify-between bg-emerald-50/50">
                  <p className="text-xs font-bold text-emerald-700">Total pago</p>
                  <p className="text-sm font-bold tabular-nums text-emerald-700">{fmtBRL(paid)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Parcelas agendadas */}
          {scheduled.length > 0 && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-muted/20">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Parcelas agendadas</p>
              </div>
              <div className="divide-y divide-border/40">
                {scheduled.map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{fmtDate(p.payment_date)}</p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.notes}</p>}
                    </div>
                    <span className="text-sm font-bold tabular-nums text-amber-600 shrink-0">{fmtBRL(p.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payments.length === 0 && total > 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground bg-white border border-border rounded-2xl">
              Nenhum pagamento registrado ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
