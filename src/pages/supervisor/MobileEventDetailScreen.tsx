import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Phone, MapPin, Users, Clock, Calendar, Building2, Utensils,
  FileText, ExternalLink, Download, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import EventCronogramaTab from '@/components/EventCronogramaTab';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface EventDetail {
  id: string;
  event_name: string | null;
  event_type: string | null;
  status: string;
  event_date: string | null;
  location_text: string | null;
  location_id: string | null;
  guest_count: number | null;
  children_50_pct: number | null;
  non_paying_guests: number | null;
  guests_per_table: number | null;
  table_count: number | null;
  cake_table_location: string | null;
  price_per_person: number | null;
  total_value: number | null;
  contract_signed: boolean;
  notes: string | null;
  duration_hours: number | null;
  product_name: string | null;
  product_id: string | null;
  ceremony_time: string | null;
  professional_count: number | null;
  professional_meal_value: number | null;
  professional_meal_type: string | null;
  additional_hours: number | null;
  organizer: string | null;
  organizer_id: string | null;
  decorator: string | null;
  decorator_id: string | null;
  pastry_chef: string | null;
  band_dj: string | null;
  band_dj_time: string | null;
  photo_video: string | null;
  bartender: string | null;
  other_professionals: string | null;
  extra_attractions: string | null;
  welcome_cocktail: string | null;
  wine: string | null;
  whisky: string | null;
  beer: string | null;
  napkin_holder: string | null;
  tablecloth: string | null;
  rechaud: string | null;
  sousplat: string | null;
  sideboard: string | null;
  glass_type: string | null;
  bridal_suite: string | null;
  kids_area: string | null;
  clients: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    cpf: string | null;
    rg: string | null;
    address: string | null;
    zip_code: string | null;
    source: string | null;
  } | null;
  witness_name: string | null;
  witness_cpf: string | null;
  witness_email: string | null;
  witness_2_name: string | null;
  witness_2_email: string | null;
  paid_value: number | null;
  menu_text: string | null;
  menu_mode: string | null;
  schedule_text: string | null;
  schedule_file_url: string | null;
  schedule_file_name: string | null;
  pricing_mode: string | null;
  contract_value: number | null;
  annex_1_text: string | null;
  contract_text: string | null;
  contract_signed_url: string | null;
}

type MobileTab = 'ficha' | 'cliente' | 'cardapio' | 'cronograma' | 'financeiro' | 'arquivos';

const TABS: { id: MobileTab; label: string }[] = [
  { id: 'ficha',      label: 'Ficha' },
  { id: 'cliente',    label: 'Cliente' },
  { id: 'cardapio',   label: 'Cardápio' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'arquivos',   label: 'Arquivos' },
];

const STATUS_LABEL: Record<string, string> = {
  lead: '1º Contato', negotiating: 'Negociando',
  tasting_scheduled: 'Degustação', confirmed: 'Confirmado',
  completed: 'Realizado', cancelled: 'Não fechou', lost: 'Cancelado',
};

// Semi-transparent badges that look good on the dark hero gradient
const STATUS_CLS: Record<string, string> = {
  lead:               'bg-sky-400/20 text-sky-200 border-sky-300/30',
  negotiating:        'bg-amber-400/20 text-amber-200 border-amber-300/30',
  tasting_scheduled:  'bg-purple-400/20 text-purple-200 border-purple-300/30',
  confirmed:          'bg-emerald-400/20 text-emerald-200 border-emerald-300/30',
  completed:          'bg-emerald-300/20 text-emerald-100 border-emerald-200/30',
  cancelled:          'bg-rose-400/20 text-rose-200 border-rose-300/30',
  lost:               'bg-red-400/20 text-red-200 border-red-300/30',
};

// ─── Design primitives — exact copy of old mobile app ──────────────────────────

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
  return <div className="bg-white rounded-3xl px-5 shadow-sm">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-black text-[#1D4ED8] uppercase tracking-widest mb-3 mt-1">{children}</p>
  );
}

function Box({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-3xl p-5 shadow-sm ${className}`}>{children}</div>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function fmtFull(d: string) {
  const dt = new Date(d + 'T12:00:00');
  return `${dt.getDate().toString().padStart(2,'0')} de ${MONTH_FULL[dt.getMonth()].toLowerCase()} de ${dt.getFullYear()}`;
}

function fmtMoney(v: number | null | undefined): string | null {
  if (v == null) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPhone(p: string | null) {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  return d.length === 11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : p;
}

// ─── Ficha Tab ────────────────────────────────────────────────────────────────

function FichaTab({ ev, eventId }: { ev: EventDetail; eventId: string }) {
  const [customFields, setCustomFields] = useState<{ id: string; name: string; value: string }[]>([]);

  useEffect(() => {
    Promise.all([
      (supabase.from as any)('event_field_definitions').select('id,name,sort_order').eq('is_active', true).order('sort_order'),
      (supabase.from as any)('event_field_values').select('field_id,value').eq('event_id', eventId),
    ]).then(([defsRes, valsRes]) => {
      const vals: Record<string, string> = {};
      for (const v of (valsRes.data ?? [])) vals[v.field_id] = v.value;
      setCustomFields(
        (defsRes.data ?? [])
          .map((d: any) => ({ id: d.id, name: d.name, value: vals[d.id] ?? '' }))
          .filter((f: any) => f.value),
      );
    });
  }, [eventId]);

  const isPerPax = ev.pricing_mode === 'per_pax' || (!ev.pricing_mode && ev.price_per_person != null);

  const team = [
    ev.organizer          && { label: 'Organizadora',        value: ev.organizer },
    ev.decorator          && { label: 'Decorador',           value: ev.decorator },
    ev.pastry_chef        && { label: 'Confeiteiro(a)',       value: ev.pastry_chef },
    ev.band_dj            && { label: 'Banda / DJ',           value: ev.band_dj },
    ev.band_dj_time       && { label: 'Horário banda/DJ',     value: ev.band_dj_time },
    ev.photo_video        && { label: 'Foto / Filmagem',      value: ev.photo_video },
    ev.bartender          && { label: 'Bartender',            value: ev.bartender },
    ev.other_professionals && { label: 'Outros profissionais', value: ev.other_professionals },
    ev.extra_attractions  && { label: 'Atrações à parte',     value: ev.extra_attractions },
  ].filter(Boolean) as { label: string; value: string }[];

  const setup = [
    ev.welcome_cocktail && { label: 'Coquetel boas-vindas', value: ev.welcome_cocktail },
    ev.wine             && { label: 'Vinho',                value: ev.wine },
    ev.whisky           && { label: 'Whisky',               value: ev.whisky },
    ev.beer             && { label: 'Cerveja',              value: ev.beer },
    ev.napkin_holder    && { label: 'Porta guardanapo',     value: ev.napkin_holder },
    ev.tablecloth       && { label: 'Toalha',               value: ev.tablecloth },
    ev.rechaud          && { label: 'Rechaud',              value: ev.rechaud },
    ev.sousplat         && { label: 'Sousplát',             value: ev.sousplat },
    ev.sideboard        && { label: 'Aparador',             value: ev.sideboard },
    ev.glass_type       && { label: 'Taça',                 value: ev.glass_type },
    ev.bridal_suite     && { label: 'Sala dos noivos',      value: ev.bridal_suite },
    ev.kids_area        && { label: 'Espaço kids',          value: ev.kids_area },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Evento</SectionTitle>
        <FieldGrid>
          <Field label="Nome / Casal"      value={ev.event_name} />
          <Field label="Tipo"              value={ev.event_type} />
          <Field label="Produto"           value={ev.product_name} />
          <Field label="Local"             value={ev.location_text} />
          <Field label="Data"              value={ev.event_date ? fmtFull(ev.event_date) : null} />
          <Field label="Horário cerimônia" value={ev.ceremony_time} />
          <Field label="Duração"           value={ev.duration_hours ? `${ev.duration_hours}h` : null} />
          <Field label="Horas adicionais"  value={ev.additional_hours ? `${ev.additional_hours}h` : null} />
          <Field
            label={isPerPax ? 'Preço por pessoa' : 'Valor do contrato'}
            value={isPerPax ? fmtMoney(ev.price_per_person) : fmtMoney(ev.contract_value)}
          />
        </FieldGrid>
      </div>

      <div>
        <SectionTitle>Convidados</SectionTitle>
        <FieldGrid>
          <Field label="Quantidade"          value={ev.guest_count} />
          <Field label="Crianças 50%"        value={ev.children_50_pct} />
          <Field label="Não pagantes"        value={ev.non_paying_guests} />
          <Field label="Convidados por mesa" value={ev.guests_per_table} />
          <Field label="Qtd. de mesas"       value={ev.table_count} />
          <Field label="Local do bolo"       value={ev.cake_table_location} />
        </FieldGrid>
      </div>

      {(ev.professional_count || team.length > 0) && (
        <div>
          <SectionTitle>Equipe & Profissionais</SectionTitle>
          <FieldGrid>
            <Field label="Qtd. profissionais" value={ev.professional_count} />
            <Field label="Tipo alim. prof."   value={ev.professional_meal_type} />
            <Field label="Valor alim. prof."  value={fmtMoney(ev.professional_meal_value)} />
            {team.map(t => <Field key={t.label} label={t.label} value={t.value} />)}
          </FieldGrid>
        </div>
      )}

      {setup.length > 0 && (
        <div>
          <SectionTitle>Setup</SectionTitle>
          <FieldGrid>
            {setup.map(s => <Field key={s.label} label={s.label} value={s.value} />)}
          </FieldGrid>
        </div>
      )}

      {ev.notes && (
        <div>
          <SectionTitle>Observações</SectionTitle>
          <Box>
            <div
              className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: ev.notes }}
            />
          </Box>
        </div>
      )}

      {customFields.length > 0 && (
        <div>
          <SectionTitle>Campos adicionais</SectionTitle>
          <FieldGrid>
            {customFields.map(f => <Field key={f.id} label={f.name} value={f.value} />)}
          </FieldGrid>
        </div>
      )}
    </div>
  );
}

// ─── Cliente Tab ──────────────────────────────────────────────────────────────

function ClienteTab({ ev }: { ev: EventDetail }) {
  const c = ev.clients;
  const whatsUrl = c?.phone ? `https://wa.me/55${c.phone.replace(/\D/g, '')}` : null;

  return (
    <div className="space-y-4">
      {c && (
        <div>
          <SectionTitle>Dados do Contratante</SectionTitle>
          <FieldGrid>
            <Field label="Nome"              value={c.name} />
            <Field label="E-mail"            value={c.email} />
            <Field label="CPF/CNPJ"          value={c.cpf} />
            <Field label="RG"                value={c.rg} />
            <Field label="Endereço"          value={c.address} />
            <Field label="CEP"               value={c.zip_code} />
            <Field label="Como nos conheceu" value={c.source} />
          </FieldGrid>
          {c.phone && (
            <a
              href={whatsUrl ?? `tel:${c.phone}`}
              className="mt-3 flex items-center gap-4 bg-white rounded-3xl px-5 py-4 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">WhatsApp / Telefone</p>
                <p className="text-gray-900 font-bold text-base">{fmtPhone(c.phone)}</p>
              </div>
            </a>
          )}
        </div>
      )}

      {ev.witness_name && (
        <div>
          <SectionTitle>Testemunha</SectionTitle>
          <FieldGrid>
            <Field label="Nome"   value={ev.witness_name} />
            <Field label="CPF"    value={ev.witness_cpf} />
            <Field label="E-mail" value={ev.witness_email} />
          </FieldGrid>
        </div>
      )}

      {ev.witness_2_name && (
        <div>
          <SectionTitle>2ª Testemunha</SectionTitle>
          <FieldGrid>
            <Field label="Nome"   value={ev.witness_2_name} />
            <Field label="E-mail" value={ev.witness_2_email} />
          </FieldGrid>
        </div>
      )}
    </div>
  );
}

// ─── Cardápio Tab ─────────────────────────────────────────────────────────────

function CardapioTab({ ev, eventId }: { ev: EventDetail; eventId: string }) {
  const [sheets, setSheets] = useState<{ id: string; name: string; category: string }[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const isSheets = ev.menu_mode === 'sheets';

  useEffect(() => {
    if (!isSheets) return;
    setLoadingSheets(true);
    (supabase.from as any)('event_menu_dishes')
      .select('id,technical_sheets(id,name,sheet_categories(name))')
      .eq('event_id', eventId)
      .then(({ data }: any) => {
        setSheets((data ?? []).map((d: any) => ({
          id: d.id,
          name: d.technical_sheets?.name ?? '—',
          category: d.technical_sheets?.sheet_categories?.name ?? '',
        })));
        setLoadingSheets(false);
      });
  }, [eventId, isSheets]);

  if (!ev.menu_mode && !ev.menu_text) {
    return <Box><p className="text-sm text-gray-400 text-center py-4">Cardápio não cadastrado</p></Box>;
  }

  return (
    <div className="space-y-4">
      {!isSheets && ev.menu_text && (
        <div>
          <SectionTitle>Cardápio</SectionTitle>
          <Box>
            <div
              className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: ev.menu_text }}
            />
          </Box>
        </div>
      )}
      {isSheets && (
        <div>
          <SectionTitle>Fichas técnicas do cardápio</SectionTitle>
          <Box>
            {loadingSheets ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : sheets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">Nenhuma ficha adicionada</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {sheets.map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                    <Utensils className="w-4 h-4 text-gray-300 shrink-0" />
                    <div>
                      <p className="text-gray-900 font-semibold text-sm">{s.name}</p>
                      {s.category && <p className="text-[11px] text-gray-400 mt-0.5">{s.category}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Box>
        </div>
      )}
    </div>
  );
}

// ─── Arquivos Tab ─────────────────────────────────────────────────────────────

function ArquivosTab({ ev, eventId }: { ev: EventDetail; eventId: string }) {
  const [tastings, setTastings] = useState<any[]>([]);
  const [files, setFiles]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      (supabase.from as any)('tasting_session_events')
        .select('id,situation_snapshot,paid_amount,tasting_sessions(id,scheduled_date,type)')
        .eq('event_id', eventId),
      (supabase.from as any)('event_files')
        .select('id,name,url,created_at')
        .eq('event_id', eventId)
        .order('created_at'),
    ]).then(([tastRes, filesRes]) => {
      setTastings(tastRes.data ?? []);
      setFiles(filesRes.data ?? []);
      setLoading(false);
    });
  }, [eventId]);

  const SITUATION: Record<string, string> = {
    fechado: 'Fechado', nao_fechado: 'Não fechou', pendente: 'Pendente', ausente: 'Ausente',
  };
  const SITUATION_CLS: Record<string, string> = {
    fechado:     'bg-emerald-100 text-emerald-700',
    nao_fechado: 'bg-rose-100 text-rose-600',
    pendente:    'bg-amber-100 text-amber-700',
    ausente:     'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-4">
      {/* Contrato */}
      <div>
        <SectionTitle>Contrato</SectionTitle>
        <Box>
          {ev.contract_signed_url ? (
            <a href={ev.contract_signed_url} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-4 active:opacity-70 transition-opacity">
              <div className="w-12 h-12 rounded-2xl bg-[#1D4ED8] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Contrato assinado</p>
                <p className="text-gray-900 font-bold text-base">Abrir PDF</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-300 shrink-0" />
            </a>
          ) : ev.contract_text ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Contrato gerado</p>
                <p className="text-gray-900 font-semibold text-sm">Pendente de assinatura</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">Contrato não gerado</p>
          )}
        </Box>
      </div>

      {/* Degustações */}
      <div>
        <SectionTitle>Degustações</SectionTitle>
        {loading ? (
          <div className="h-16 bg-black/5 rounded-3xl animate-pulse" />
        ) : tastings.length === 0 ? (
          <Box><p className="text-sm text-gray-400 text-center py-2">Nenhuma degustação</p></Box>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            {tastings.map((t: any) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  {t.tasting_sessions?.scheduled_date && (
                    <p className="text-gray-900 font-semibold text-sm">
                      {fmtFull(t.tasting_sessions.scheduled_date)}
                    </p>
                  )}
                  {t.tasting_sessions?.type && (
                    <p className="text-[11px] text-gray-400 mt-0.5">{t.tasting_sessions.type}</p>
                  )}
                  {t.paid_amount > 0 && (
                    <p className="text-[11px] text-gray-400">Pago: {fmtMoney(t.paid_amount)}</p>
                  )}
                </div>
                {t.situation_snapshot && (
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${SITUATION_CLS[t.situation_snapshot] ?? 'bg-gray-100 text-gray-500'}`}>
                    {SITUATION[t.situation_snapshot] ?? t.situation_snapshot}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Arquivos */}
      {!loading && files.length > 0 && (
        <div>
          <SectionTitle>Arquivos do evento</SectionTitle>
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            {files.map((f: any) => (
              <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 last:border-0 active:bg-gray-50 transition-colors">
                <Download className="w-4 h-4 text-gray-300 shrink-0" />
                <p className="flex-1 text-gray-900 font-semibold text-sm truncate">{f.name}</p>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Outros Tab ───────────────────────────────────────────────────────────────

function OutrosTab({ ev, eventId }: { ev: EventDetail; eventId: string }) {
  const [portal, setPortal]     = useState<any>(null);
  const [history, setHistory]   = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);

  const FIELD_LABELS: Record<string, string> = {
    event_name: 'Nome', status: 'Status', event_date: 'Data', guest_count: 'Convidados',
    price_per_person: 'Preço/Pax', contract_value: 'Valor contrato', notes: 'Observações',
    location_text: 'Local', ceremony_time: 'Horário', additional_hours: 'Horas adicionais',
    organizer: 'Organizadora', decorator: 'Decorador', pastry_chef: 'Confeiteiro',
    band_dj: 'Banda/DJ', photo_video: 'Foto/Filmagem', bartender: 'Bartender',
    menu_text: 'Cardápio', schedule_text: 'Cronograma',
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      (supabase.from as any)('client_portal_access').select('*').eq('event_id', eventId).maybeSingle(),
      (supabase.from as any)('event_history')
        .select('id,field_name,old_value,new_value,changed_at,user_id')
        .eq('event_id', eventId)
        .order('changed_at', { ascending: false })
        .limit(80),
      supabase.from('profiles').select('user_id,display_name'),
    ]).then(([portalRes, histRes, profRes]) => {
      setPortal(portalRes.data);
      setHistory(histRes.data ?? []);
      const m: Record<string, string> = {};
      for (const p of (profRes.data ?? [])) m[p.user_id] = p.display_name;
      setProfiles(m);
      setLoading(false);
    });
  }, [eventId]);

  const reviewMsg = ev.clients?.phone
    ? `https://wa.me/55${ev.clients.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Esperamos que tudo tenha corrido bem. Poderia nos deixar uma avaliação? 😊')}`
    : null;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-black/5 rounded-3xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Portal */}
      <div>
        <SectionTitle>Portal do cliente</SectionTitle>
        <Box>
          {portal ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</p>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${portal.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {portal.enabled ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {portal.access_code && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Código de acesso</p>
                  <p className="font-mono text-sm bg-gray-50 rounded-2xl px-4 py-2 text-gray-900 tracking-widest">{portal.access_code}</p>
                </div>
              )}
              {portal.email && (
                <div className="pt-1 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">E-mail do portal</p>
                  <p className="text-gray-900 font-semibold text-sm">{portal.email}</p>
                </div>
              )}
              {portal.invite_sent_at && (
                <p className="text-xs text-gray-400">Convite enviado em {fmtFull(portal.invite_sent_at.slice(0,10))}</p>
              )}
              {portal.user_id && (
                <p className="text-xs text-emerald-600 font-semibold">✓ Cliente cadastrado no portal</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">Portal não configurado</p>
          )}
        </Box>
      </div>

      {/* Ação WhatsApp */}
      {reviewMsg && (
        <div>
          <SectionTitle>Ações</SectionTitle>
          <a href={reviewMsg} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-4 bg-white rounded-3xl px-5 py-4 shadow-sm active:scale-[0.99] transition-transform">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Solicitar avaliação</p>
              <p className="text-gray-900 font-semibold text-sm">Enviar pelo WhatsApp</p>
            </div>
          </a>
        </div>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div>
          <SectionTitle>Histórico de alterações</SectionTitle>
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            {history.map((h: any) => (
              <div key={h.id} className="px-5 py-3.5 border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-gray-900 font-semibold text-sm truncate">
                    {FIELD_LABELS[h.field_name] ?? h.field_name}
                  </p>
                  <p className="text-[10px] text-gray-400 shrink-0">
                    {h.changed_at ? new Date(h.changed_at).toLocaleDateString('pt-BR') : ''}
                  </p>
                </div>
                <p className="text-[11px] text-gray-400 mb-1.5">Por {profiles[h.user_id] ?? 'Sistema'}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {h.old_value && (
                    <span className="text-xs line-through text-red-400 bg-red-50 px-1.5 py-0.5 rounded-lg max-w-[120px] truncate">
                      {h.old_value}
                    </span>
                  )}
                  {h.old_value && h.new_value && <span className="text-xs text-gray-300">→</span>}
                  {h.new_value && (
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-lg max-w-[120px] truncate">
                      {h.new_value}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Financeiro Tab ───────────────────────────────────────────────────────────

interface Payment { id: string; payment_date: string | null; value: number; type: string; is_confirmed: boolean; notes: string | null; }
interface Additional { id: string; description: string; value: number; }

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  payment: 'Pagamento', tasting: 'Degustação', deposit: 'Entrada', other: 'Outro',
};
const PAYMENT_TYPE_CLS: Record<string, string> = {
  payment: 'bg-emerald-100 text-emerald-700',
  tasting: 'bg-purple-100 text-purple-700',
  deposit: 'bg-blue-100 text-blue-700',
  other:   'bg-gray-100 text-gray-600',
};

function FinanceiroTab({ ev, eventId }: { ev: EventDetail; eventId: string }) {
  const [payments, setPayments]     = useState<Payment[]>([]);
  const [additionals, setAdditionals] = useState<Additional[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      (supabase.from as any)('event_payments')
        .select('id,payment_date,value,type,is_confirmed,notes')
        .eq('event_id', eventId)
        .order('payment_date', { ascending: true }),
      (supabase.from as any)('event_additional_values')
        .select('id,description,value')
        .eq('event_id', eventId)
        .order('sort_order'),
    ]).then(([payRes, addRes]) => {
      setPayments(payRes.data ?? []);
      setAdditionals(addRes.data ?? []);
      setLoading(false);
    });
  }, [eventId]);

  const pricingMode = ev.pricing_mode ?? 'per_person';
  const baseValue = pricingMode === 'fixed'
    ? (ev.contract_value ?? 0)
    : ((ev.guest_count ?? 0) * (ev.price_per_person ?? 0))
      + ((ev.children_50_pct ?? 0) * (ev.price_per_person ?? 0) * 0.5)
      + ((ev.professional_count ?? 0) * (ev.professional_meal_value ?? 0));

  const addTotal   = additionals.reduce((s, a) => s + Number(a.value), 0);
  const totalValue = baseValue + addTotal;
  const confirmed  = payments.filter(p => p.is_confirmed);
  const scheduled  = payments.filter(p => !p.is_confirmed);
  const paidTotal  = confirmed.reduce((s, p) => s + Number(p.value), 0);
  const balance    = totalValue - paidTotal;
  const pctPaid    = totalValue > 0 ? Math.min((paidTotal / totalValue) * 100, 100) : 0;

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-black/5 rounded-3xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Resumo */}
      <div>
        <SectionTitle>Resumo</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-3xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Valor total</p>
            <p className="text-lg font-black text-gray-900">{fmtMoney(totalValue)}</p>
          </div>
          <div className="bg-white rounded-3xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Valor pago</p>
            <p className="text-lg font-black text-emerald-600">{fmtMoney(paidTotal)}</p>
          </div>
          <div className={`rounded-3xl p-4 shadow-sm ${balance > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${balance > 0 ? 'text-red-400' : 'text-emerald-500'}`}>Saldo</p>
            <p className={`text-lg font-black ${balance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtMoney(balance)}</p>
          </div>
          <div className="bg-white rounded-3xl p-4 shadow-sm flex flex-col justify-between">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">% Pago</p>
            <p className="text-lg font-black text-gray-900">{pctPaid.toFixed(0)}%</p>
            <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pctPaid}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Modo de cobrança */}
      <Box>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Modo de cobrança</p>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${pricingMode === 'per_person' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
            {pricingMode === 'per_person' ? 'Por convidado' : 'Valor fixo'}
          </span>
          <span className="text-sm font-semibold text-gray-700">
            {pricingMode === 'per_person'
              ? `${ev.guest_count ?? 0} conv × ${fmtMoney(ev.price_per_person)}`
              : fmtMoney(ev.contract_value)}
          </span>
        </div>
        {pricingMode === 'per_person' && (ev.children_50_pct ?? 0) > 0 && (
          <p className="text-xs text-gray-400 mt-1">+ {ev.children_50_pct} crianças 50%</p>
        )}
        {pricingMode === 'per_person' && (ev.professional_count ?? 0) > 0 && (
          <p className="text-xs text-gray-400">+ {ev.professional_count} profissionais</p>
        )}
      </Box>

      {/* Adicionais */}
      {additionals.length > 0 && (
        <div>
          <SectionTitle>Valores adicionais</SectionTitle>
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            {additionals.map((a, idx) => (
              <div key={a.id} className={`flex items-center justify-between px-5 py-3.5 ${idx < additionals.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <p className="text-sm text-gray-700 font-medium">{a.description}</p>
                <p className="text-sm font-bold text-gray-900">{fmtMoney(a.value)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">Total adicionais</p>
              <p className="text-sm font-black text-gray-900">{fmtMoney(addTotal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pagamentos confirmados */}
      <div>
        <SectionTitle>Recebimentos confirmados</SectionTitle>
        {confirmed.length === 0 ? (
          <Box>
            <div className="flex items-center gap-3 py-2">
              <AlertCircle className="w-4 h-4 text-gray-300" />
              <p className="text-sm text-gray-400">Nenhum pagamento recebido</p>
            </div>
          </Box>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            {confirmed.map((p, idx) => (
              <div key={p.id} className={`flex items-center gap-3 px-5 py-3.5 ${idx < confirmed.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PAYMENT_TYPE_CLS[p.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {PAYMENT_TYPE_LABEL[p.type] ?? p.type}
                    </span>
                    <span className="text-[11px] text-gray-400">{fmtDate(p.payment_date)}</span>
                  </div>
                  {p.notes && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{p.notes}</p>}
                </div>
                <p className="text-sm font-bold text-emerald-600 shrink-0">{fmtMoney(p.value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agendados */}
      {scheduled.length > 0 && (
        <div>
          <SectionTitle>Agendados</SectionTitle>
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            {scheduled.map((p, idx) => (
              <div key={p.id} className={`flex items-center gap-3 px-5 py-3.5 ${idx < scheduled.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className="w-4 h-4 rounded-full border-2 border-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] text-gray-400">{fmtDate(p.payment_date)}</span>
                  {p.notes && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{p.notes}</p>}
                </div>
                <p className="text-sm font-bold text-amber-600 shrink-0">{fmtMoney(p.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function MobileEventDetailScreen({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const [event, setEvent]     = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<MobileTab>('ficha');
  const tabsRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setTab('ficha');
    supabase.from('events')
      .select('*, clients(id,name,phone,email,cpf,rg,address,zip_code,source)')
      .eq('id', eventId).single()
      .then(async ({ data, error }) => {
        if (error || !data) { setLoading(false); return; }
        let ev = data as EventDetail;
        const proms: Promise<any>[] = [];
        if (!ev.location_text && ev.location_id) {
          proms.push(
            (supabase.from as any)('event_locations').select('name').eq('id', ev.location_id).single()
              .then(({ data: l }: any) => { if (l) ev = { ...ev, location_text: l.name }; }),
          );
        }
        if (!ev.product_name && ev.product_id) {
          proms.push(
            (supabase.from as any)('event_products').select('name').eq('id', ev.product_id).single()
              .then(({ data: p }: any) => { if (p) ev = { ...ev, product_name: p.name }; }),
          );
        }
        await Promise.all(proms);
        setEvent(ev);
        setLoading(false);
      });
  }, [eventId]);

  const isConfirmed = event ? ['confirmed', 'completed'].includes(event.status) : false;
  const visibleTabs = TABS.filter(t => {
    if (!isConfirmed && ['cardapio','cronograma','financeiro'].includes(t.id)) return false;
    return true;
  });

  const goToTab = (id: MobileTab) => {
    setTab(id);
    const idx = visibleTabs.findIndex(t => t.id === id);
    const el = tabsRef.current?.querySelector(`[data-tab="${idx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const date = event?.event_date ? new Date(event.event_date + 'T12:00:00') : null;
  const day  = date?.toLocaleDateString('pt-BR', { day: '2-digit' });
  const mon  = date?.toLocaleDateString('pt-BR', { month: 'short' })?.replace('.','').toUpperCase();

  return (
    <div className="min-h-screen bg-[#f2f2f2]">
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-[#C4973A] animate-pulse" />
      )}

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-[#0e1f4a] via-[#152d6b] to-[#152d6b] px-5 pb-5 relative overflow-hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <div className="absolute -top-8 -right-8 w-36 h-36 bg-white/5 rounded-full" />
        <div className="absolute top-8 right-6 w-2.5 h-2.5 bg-[#C4973A]/40 rounded-full" />
        <div className="absolute top-14 right-16 w-1.5 h-1.5 bg-[#C4973A]/25 rounded-full" />

        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-24 bg-white/20 rounded-xl animate-pulse" />
            <div className="h-6 w-52 bg-white/20 rounded-xl animate-pulse" />
            <div className="h-3 w-36 bg-white/10 rounded-xl animate-pulse" />
          </div>
        ) : event ? (
          <>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-white" />
              </button>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${STATUS_CLS[event.status] ?? 'bg-white/10 text-white border-white/20'}`}>
                {STATUS_LABEL[event.status] ?? event.status}
              </span>
            </div>
            <h1 className="text-xl font-black text-white leading-tight ml-1">
              {event.event_name ?? 'Sem nome'}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 ml-1">
              {event.event_date && (
                <span className="flex items-center gap-1.5 text-[#D4AB52] text-xs font-medium">
                  <Calendar className="w-3 h-3" />
                  {day} {mon}
                </span>
              )}
              {event.location_text && (
                <span className="flex items-center gap-1.5 text-[#D4AB52] text-xs font-medium">
                  <MapPin className="w-3 h-3" />
                  {event.location_text}
                </span>
              )}
              {event.guest_count != null && (
                <span className="flex items-center gap-1.5 text-[#D4AB52] text-xs font-medium">
                  <Users className="w-3 h-3" />
                  {event.guest_count} conv.
                </span>
              )}
              {event.ceremony_time && (
                <span className="flex items-center gap-1.5 text-[#D4AB52]/70 text-xs font-medium">
                  <Clock className="w-3 h-3" />
                  {event.ceremony_time}
                </span>
              )}
              {event.organizer && (
                <span className="flex items-center gap-1.5 text-[#D4AB52]/70 text-xs font-medium">
                  <Building2 className="w-3 h-3" />
                  {event.organizer}
                </span>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="sticky top-0 z-40 bg-[#f2f2f2]/95 backdrop-blur-xl">
        <div ref={tabsRef} className="flex overflow-x-auto scrollbar-none px-4 pt-3 pb-2 gap-1">
          {visibleTabs.map((t, i) => (
            <button
              key={t.id}
              data-tab={i}
              onClick={() => goToTab(t.id)}
              className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                tab === t.id
                  ? 'bg-[#1D4ED8] text-white shadow-lg shadow-blue-900/30'
                  : 'bg-white text-gray-400 shadow-sm'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-4 pb-36">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-14 bg-black/5 rounded-3xl animate-pulse" />)}
          </div>
        ) : !event ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500 text-sm">Evento não encontrado</p>
            <button
              onClick={onBack}
              className="mt-4 px-6 py-2 bg-[#1D4ED8] text-white text-sm font-bold rounded-2xl"
            >
              Voltar
            </button>
          </div>
        ) : (
          <>
            {tab === 'ficha'      && <FichaTab ev={event} eventId={eventId} />}
            {tab === 'cliente'    && <ClienteTab ev={event} />}
            {tab === 'cardapio'   && <CardapioTab ev={event} eventId={eventId} />}
            {tab === 'cronograma' && (
              <EventCronogramaTab
                eventId={eventId}
                scheduleText={event.schedule_text}
                scheduleFileUrl={event.schedule_file_url}
                scheduleFileName={event.schedule_file_name}
                onChangeText={() => {}}
              />
            )}
            {tab === 'financeiro' && <FinanceiroTab ev={event} eventId={eventId} />}
            {tab === 'arquivos'   && <ArquivosTab ev={event} eventId={eventId} />}
          </>
        )}
      </div>
    </div>
  );
}
