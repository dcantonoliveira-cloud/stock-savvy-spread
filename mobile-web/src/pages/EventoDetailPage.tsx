import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle2, Clock, MapPin, Users } from 'lucide-react';
import { fetchEvent, fetchPaymentsForEvent } from '../api/supabase';
import type { Event, EventPayment } from '../types';
import { fmtCurrency, fmtDate } from '../lib/format';
import { eventDisplayName, eventLocationName } from '../lib/eventFilters';

// ── Field components ─────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '' || value === 0) return null;
  return (
    <div className="py-3.5 border-b border-gray-100 last:border-0">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-gray-900 font-semibold text-sm">{value}</p>
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-3xl px-5 shadow-sm divide-y divide-gray-100">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-black text-ron-800 uppercase tracking-widest mb-3 mt-1">{children}</p>
  );
}

// ── Tab: Ficha Técnica ────────────────────────────────────────────────────────

function FichaTecnica({ e }: { e: Event }) {
  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Evento</SectionTitle>
        <FieldGrid>
          <Field label="Nome do Evento"    value={e.event_name} />
          <Field label="Tipo"              value={e.event_type} />
          <Field label="Local"             value={eventLocationName(e) || undefined} />
          <Field label="Data"              value={fmtDate(e.event_date ?? undefined)} />
          <Field label="Horário cerimônia" value={e.ceremony_time} />
          <Field label="Horas adicionais"  value={e.additional_hours != null ? `${e.additional_hours}h` : null} />
          <Field label="Valor total"       value={e.total_value != null ? fmtCurrency(e.total_value) : null} />
        </FieldGrid>
      </div>

      <div>
        <SectionTitle>Convidados</SectionTitle>
        <FieldGrid>
          <Field label="Quantidade"          value={e.guest_count} />
          <Field label="Crianças 50%"        value={e.children_50_pct} />
          <Field label="Não pagantes"        value={e.non_paying_guests} />
          <Field label="Convidados por mesa" value={e.guests_per_table} />
          <Field label="Qtd. de mesas"       value={e.table_count} />
          <Field label="Local do bolo"       value={e.cake_table_location} />
        </FieldGrid>
      </div>

      <div>
        <SectionTitle>Equipe & Profissionais</SectionTitle>
        <FieldGrid>
          <Field label="Qtd. profissionais"   value={e.professional_count} />
          <Field label="Tipo alim. prof."     value={e.professional_meal_type} />
          <Field label="Valor alim. prof."    value={e.professional_meal_value != null ? fmtCurrency(e.professional_meal_value) : null} />
          <Field label="Organizador(a)"       value={e.organizer} />
          <Field label="Decorador"            value={e.decorator} />
          <Field label="Confeiteiro(a)"       value={e.pastry_chef} />
          <Field label="Banda / DJ"           value={e.band_dj} />
          <Field label="Horário banda/DJ"     value={e.band_dj_time} />
          <Field label="Foto / Filmagem"      value={e.photo_video} />
          <Field label="Bartender"            value={e.bartender} />
          <Field label="Outros profissionais" value={e.other_professionals} />
          <Field label="Atrações à parte"     value={e.extra_attractions} />
        </FieldGrid>
      </div>

      <div>
        <SectionTitle>Setup</SectionTitle>
        <FieldGrid>
          <Field label="Coquetel boas-vindas" value={e.welcome_cocktail} />
          <Field label="Vinho"                value={e.wine} />
          <Field label="Whisky"               value={e.whisky} />
          <Field label="Cerveja"              value={e.beer} />
          <Field label="Porta guardanapo"     value={e.napkin_holder} />
          <Field label="Toalha"               value={e.tablecloth} />
          <Field label="Rechaud"              value={e.rechaud} />
          <Field label="Sousplát"             value={e.sousplat} />
          <Field label="Aparador"             value={e.sideboard} />
          <Field label="Taça"                 value={e.glass_type} />
          <Field label="Sala dos noivos"      value={e.bridal_suite} />
          <Field label="Espaço kids"          value={e.kids_area} />
        </FieldGrid>
      </div>

      {e.notes && (
        <div>
          <SectionTitle>Observações</SectionTitle>
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{e.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Financeiro ───────────────────────────────────────────────────────────

function FinanceiroTab({ e }: { e: Event }) {
  const [payments, setPayments] = useState<EventPayment[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetchPaymentsForEvent(e.id)
      .then(setPayments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [e.id]);

  const valorTotal = e.total_value ?? 0;
  const valorPago  = e.paid_value ?? payments.filter(p => p.is_confirmed).reduce((s, p) => s + (p.value ?? 0), 0);
  const saldo      = valorTotal - valorPago;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-black/5 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Resumo Financeiro</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p>
            <p className="text-base font-black text-ron-900 leading-tight">
              {valorTotal > 0 ? fmtCurrency(valorTotal) : '—'}
            </p>
          </div>
          <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pago</p>
            <p className="text-base font-black text-emerald-600 leading-tight">
              {valorPago > 0 ? fmtCurrency(valorPago) : '—'}
            </p>
          </div>
          <div className={`rounded-3xl p-4 shadow-sm text-center ${saldo > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Saldo</p>
            <p className={`text-base font-black leading-tight ${saldo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {valorTotal > 0 ? fmtCurrency(Math.abs(saldo)) : '—'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <SectionTitle>Pagamentos</SectionTitle>
        {payments.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm">
            <p className="text-gray-400 text-sm font-medium">Nenhum pagamento registrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm divide-y divide-gray-100 overflow-hidden">
            {payments.map((pg) => (
              <div key={pg.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-700 font-semibold">
                      {pg.payment_date ? fmtDate(pg.payment_date) : '—'}
                    </p>
                    {pg.is_confirmed && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                  </div>
                </div>
                <p className="text-sm font-black text-ron-900 shrink-0">
                  {pg.value != null ? fmtCurrency(pg.value) : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['Ficha Técnica', 'Financeiro'];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EventoDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const [evento, setEvento]     = useState<Event | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchEvent(id)
      .then(setEvento)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const goToTab = (i: number) => {
    setActiveTab(i);
    const el = tabsRef.current?.querySelector(`[data-tab="${i}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  function renderTab() {
    if (!evento) return null;
    switch (activeTab) {
      case 0: return <FichaTecnica e={evento} />;
      case 1: return <FinanceiroTab e={evento} />;
      default: return null;
    }
  }

  return (
    <div className="pb-36 max-w-lg mx-auto">
      {loading && <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-gold-400 animate-pulse" />}

      {/* Hero header */}
      <div className="bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-hero pb-6 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-36 h-36 bg-white/5 rounded-full" />
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center mb-4"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        {loading ? (
          <div className="space-y-2">
            <div className="h-7 w-48 bg-white/20 rounded-xl animate-pulse" />
            <div className="h-4 w-32 bg-white/10 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white leading-tight">
              {evento ? eventDisplayName(evento) : 'Evento'}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {evento?.event_date && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {fmtDate(evento.event_date)}
                </span>
              )}
              {evento && eventLocationName(evento) && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  {eventLocationName(evento)}
                </span>
              )}
              {evento?.guest_count != null && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  <Users className="w-3.5 h-3.5" />
                  {evento.guest_count} convidados
                </span>
              )}
              {evento?.ceremony_time && (
                <span className="flex items-center gap-1.5 text-gold-300/70 text-sm font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {evento.ceremony_time}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-40 bg-[#f2f2f2]/95 backdrop-blur-xl">
        <div ref={tabsRef} className="flex gap-0 overflow-x-auto scrollbar-none px-4 pt-3 pb-2">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              data-tab={i}
              onClick={() => goToTab(i)}
              className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all mr-1 ${
                activeTab === i
                  ? 'bg-ron-900 text-white shadow-lg shadow-ron-900/30'
                  : 'bg-white text-gray-400 shadow-sm'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map((i) => <div key={i} className="h-14 bg-black/5 rounded-2xl animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500">Erro ao carregar o evento.</p>
          </div>
        ) : renderTab()}
      </div>
    </div>
  );
}
