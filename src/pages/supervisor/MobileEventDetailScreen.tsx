import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ChevronLeft, ChevronRight, Phone, Mail, MapPin, Users, Clock, Tag,
  CheckCircle2, Circle, CalendarDays, FileText, ExternalLink, Download,
  Loader2, AlertCircle, Utensils, List, DollarSign, MoreHorizontal,
  History, Globe, Trash2, XCircle, User,
} from 'lucide-react';
import EventChecklistTab from '@/components/EventChecklistTab';
import EventFinanceiroTab from '@/components/EventFinanceiroTab';
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
  photo_video: string | null;
  bartender: string | null;
  other_professionals: string | null;
  extra_attractions: string | null;
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

type MobileTab = 'ficha' | 'cliente' | 'cardapio' | 'checklist' | 'cronograma' | 'financeiro' | 'arquivos' | 'outros';

const TABS: { id: MobileTab; label: string }[] = [
  { id: 'ficha',      label: 'Ficha' },
  { id: 'cliente',    label: 'Cliente' },
  { id: 'cardapio',   label: 'Cardápio' },
  { id: 'checklist',  label: 'Checklist' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'arquivos',   label: 'Arquivos' },
  { id: 'outros',     label: 'Outros' },
];

const STATUS_LABEL: Record<string, string> = {
  lead: '1º Contato', negotiating: 'Negociando',
  tasting_scheduled: 'Degustação', confirmed: 'Confirmado',
  completed: 'Realizado', cancelled: 'Não fechou', lost: 'Cancelado',
};
const STATUS_CLS: Record<string, string> = {
  lead: 'bg-sky-100 text-sky-700',
  negotiating: 'bg-amber-100 text-amber-800',
  tasting_scheduled: 'bg-purple-100 text-purple-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-200 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-600',
  lost: 'bg-red-100 text-red-700',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const MONTH_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmtFull(d: string) {
  const dt = new Date(d + 'T12:00:00');
  return `${dt.getDate().toString().padStart(2,'0')} de ${MONTH_FULL[dt.getMonth()].toLowerCase()} de ${dt.getFullYear()}`;
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPhone(p: string | null) {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  return d.length === 11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : p;
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-border p-4 space-y-3 ${className}`}>{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{children}</p>;
}

// ─── Ficha Técnica Tab ─────────────────────────────────────────────────────────
function FichaTab({ ev, eventId }: { ev: EventDetail; eventId: string }) {
  const [customFields, setCustomFields] = useState<{ id: string; name: string; value: string }[]>([]);

  useEffect(() => {
    Promise.all([
      (supabase.from as any)('event_field_definitions').select('id,name,sort_order').eq('is_active', true).order('sort_order'),
      (supabase.from as any)('event_field_values').select('field_id,value').eq('event_id', eventId),
    ]).then(([defsRes, valsRes]) => {
      const vals: Record<string, string> = {};
      for (const v of (valsRes.data ?? [])) vals[v.field_id] = v.value;
      setCustomFields((defsRes.data ?? []).map((d: any) => ({ id: d.id, name: d.name, value: vals[d.id] ?? '' })).filter((f: any) => f.value));
    });
  }, [eventId]);

  const isPerPax = ev.pricing_mode === 'per_pax' || (!ev.pricing_mode && ev.price_per_person != null);
  const team = [
    ev.organizer && { label: 'Organizadora', value: ev.organizer },
    ev.decorator && { label: 'Decorador', value: ev.decorator },
    ev.pastry_chef && { label: 'Confeiteiro(a)', value: ev.pastry_chef },
    ev.band_dj && { label: 'Banda/DJ', value: ev.band_dj },
    ev.photo_video && { label: 'Foto/Filmagem', value: ev.photo_video },
    ev.bartender && { label: 'Bartender', value: ev.bartender },
    ev.other_professionals && { label: 'Outros profissionais', value: ev.other_professionals },
    ev.extra_attractions && { label: 'Atrações à parte', value: ev.extra_attractions },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-4">
      {/* Informações do Evento */}
      <Card>
        <SectionTitle>Informações do Evento</SectionTitle>
        <div className="space-y-3">
          <InfoRow label="Nome" value={ev.event_name} />
          <InfoRow label="Tipo" value={ev.event_type} />
          <InfoRow label="Produto" value={ev.product_name} />
          <InfoRow label="Data" value={ev.event_date ? fmtFull(ev.event_date) : null} />
          <InfoRow label="Horário da cerimônia" value={ev.ceremony_time} />
          <InfoRow label="Duração" value={ev.duration_hours ? `${ev.duration_hours}h` : null} />
          <InfoRow label="Local" value={ev.location_text} />
          <InfoRow label="Convidados" value={ev.guest_count} />
          {(ev.children_50_pct ?? 0) > 0 && <InfoRow label="Crianças 50%" value={ev.children_50_pct} />}
          {(ev.non_paying_guests ?? 0) > 0 && <InfoRow label="Não pagantes" value={ev.non_paying_guests} />}
          {(ev.additional_hours ?? 0) > 0 && <InfoRow label="Horas adicionais" value={ev.additional_hours} />}
          {isPerPax
            ? <InfoRow label="Preço por pessoa" value={fmtMoney(ev.price_per_person)} />
            : <InfoRow label="Valor do contrato" value={fmtMoney(ev.contract_value)} />
          }
          {(ev.professional_count ?? 0) > 0 && (
            <>
              <InfoRow label="Qtd. profissionais" value={ev.professional_count} />
              <InfoRow label="Valor alim. profissionais" value={fmtMoney(ev.professional_meal_value)} />
              <InfoRow label="Alimentação profissionais" value={ev.professional_meal_type} />
            </>
          )}
        </div>
      </Card>

      {/* Observações */}
      {ev.notes && (
        <Card>
          <SectionTitle>Observações</SectionTitle>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ev.notes}</p>
        </Card>
      )}

      {/* Equipe & Fornecedores */}
      {team.length > 0 && (
        <Card>
          <SectionTitle>Equipe & Fornecedores</SectionTitle>
          <div className="space-y-3">
            {team.map(t => <InfoRow key={t.label} label={t.label} value={t.value} />)}
          </div>
        </Card>
      )}

      {/* Campos customizáveis */}
      {customFields.length > 0 && (
        <Card>
          <SectionTitle>Campos adicionais</SectionTitle>
          <div className="space-y-3">
            {customFields.map(f => <InfoRow key={f.id} label={f.name} value={f.value} />)}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Cliente Tab ───────────────────────────────────────────────────────────────
function ClienteTab({ ev }: { ev: EventDetail }) {
  const c = ev.clients;
  const whatsUrl = c?.phone ? `https://wa.me/55${c.phone.replace(/\D/g, '')}` : null;

  return (
    <div className="space-y-4">
      {c && (
        <Card>
          <SectionTitle>Dados do Contratante</SectionTitle>
          <p className="text-base font-semibold text-foreground">{c.name ?? '—'}</p>
          {c.phone && (
            <a href={whatsUrl ?? `tel:${c.phone}`}
               className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <Phone className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-emerald-600 font-semibold">WhatsApp / Telefone</p>
                <p className="text-sm font-bold text-emerald-700">{fmtPhone(c.phone)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-500" />
            </a>
          )}
          <div className="space-y-3">
            <InfoRow label="E-mail" value={c.email} />
            <InfoRow label="CPF/CNPJ" value={c.cpf} />
            <InfoRow label="RG" value={c.rg} />
            <InfoRow label="Endereço" value={c.address} />
            <InfoRow label="CEP" value={c.zip_code} />
            <InfoRow label="Como nos conheceu" value={c.source} />
          </div>
        </Card>
      )}

      {ev.witness_name && (
        <Card>
          <SectionTitle>Testemunha</SectionTitle>
          <div className="space-y-3">
            <InfoRow label="Nome" value={ev.witness_name} />
            <InfoRow label="CPF" value={ev.witness_cpf} />
            <InfoRow label="E-mail" value={ev.witness_email} />
          </div>
        </Card>
      )}

      {ev.witness_2_name && (
        <Card>
          <SectionTitle>2ª Testemunha</SectionTitle>
          <div className="space-y-3">
            <InfoRow label="Nome" value={ev.witness_2_name} />
            <InfoRow label="E-mail" value={ev.witness_2_email} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Cardápio Tab ──────────────────────────────────────────────────────────────
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
    return (
      <Card>
        <p className="text-sm text-muted-foreground text-center py-4">Cardápio não cadastrado</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!isSheets && ev.menu_text && (
        <Card>
          <SectionTitle>Cardápio</SectionTitle>
          <div
            className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: ev.menu_text }}
          />
        </Card>
      )}
      {isSheets && (
        <Card>
          <SectionTitle>Fichas técnicas do cardápio</SectionTitle>
          {loadingSheets ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : sheets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhuma ficha adicionada</p>
          ) : (
            <div className="space-y-2">
              {sheets.map(s => (
                <div key={s.id} className="flex items-center gap-3 py-1">
                  <Utensils className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    {s.category && <p className="text-xs text-muted-foreground">{s.category}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Arquivos Tab (simplified) ─────────────────────────────────────────────────
function ArquivosTab({ ev, eventId }: { ev: EventDetail; eventId: string }) {
  const [tastings, setTastings] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    fechado: 'bg-emerald-100 text-emerald-700',
    nao_fechado: 'bg-rose-100 text-rose-600',
    pendente: 'bg-amber-100 text-amber-700',
    ausente: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-4">
      {/* Contrato */}
      <Card>
        <SectionTitle>Contrato</SectionTitle>
        {ev.contract_signed_url ? (
          <a href={ev.contract_signed_url} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-primary font-semibold">Contrato assinado</p>
              <p className="text-sm font-bold text-foreground">Abrir PDF</p>
            </div>
            <ExternalLink className="w-4 h-4 text-primary" />
          </a>
        ) : ev.contract_text ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-semibold">Contrato gerado</p>
              <p className="text-sm text-foreground">Pendente de assinatura</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">Contrato não gerado</p>
        )}
      </Card>

      {/* Degustações */}
      <Card>
        <SectionTitle>Degustações</SectionTitle>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : tastings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">Nenhuma degustação</p>
        ) : (
          <div className="space-y-3">
            {tastings.map((t: any) => (
              <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
                <Utensils className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  {t.tasting_sessions?.scheduled_date && (
                    <p className="text-sm font-semibold text-foreground">
                      {fmtFull(t.tasting_sessions.scheduled_date)}
                    </p>
                  )}
                  {t.tasting_sessions?.type && (
                    <p className="text-xs text-muted-foreground">{t.tasting_sessions.type}</p>
                  )}
                  {t.paid_amount > 0 && (
                    <p className="text-xs text-muted-foreground">Pago: {fmtMoney(t.paid_amount)}</p>
                  )}
                </div>
                {t.situation_snapshot && (
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${SITUATION_CLS[t.situation_snapshot] ?? 'bg-muted text-muted-foreground'}`}>
                    {SITUATION[t.situation_snapshot] ?? t.situation_snapshot}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Arquivos do evento */}
      {!loading && files.length > 0 && (
        <Card>
          <SectionTitle>Arquivos do evento</SectionTitle>
          <div className="space-y-2">
            {files.map((f: any) => (
              <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <Download className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="flex-1 text-sm text-foreground truncate">{f.name}</p>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Outros Tab ────────────────────────────────────────────────────────────────
function OutrosTab({ ev, eventId }: { ev: EventDetail; eventId: string }) {
  const [portal, setPortal] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

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
    ? `https://wa.me/55${ev.clients.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Esperamos que tudo tenha corrido bem. Poderia nos deixar uma avaliação? 😊`)}`
    : null;

  if (loading) return (
    <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="space-y-4">
      {/* Portal do cliente */}
      <Card>
        <SectionTitle>Portal do cliente</SectionTitle>
        {portal ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Status</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${portal.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                {portal.enabled ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            {portal.access_code && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Código de acesso</p>
                <p className="font-mono text-sm bg-muted/50 rounded-lg px-3 py-1.5 text-foreground">{portal.access_code}</p>
              </div>
            )}
            {portal.email && <InfoRow label="E-mail do portal" value={portal.email} />}
            {portal.invite_sent_at && (
              <p className="text-xs text-muted-foreground">Convite enviado em {fmtFull(portal.invite_sent_at.slice(0,10))}</p>
            )}
            {portal.user_id && (
              <p className="text-xs text-emerald-600 font-semibold">✓ Cliente cadastrado no portal</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">Portal não configurado</p>
        )}
      </Card>

      {/* Ações */}
      <Card>
        <SectionTitle>Ações</SectionTitle>
        <div className="space-y-3">
          {reviewMsg && (
            <a href={reviewMsg} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <Phone className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-emerald-600 font-semibold">Solicitar avaliação</p>
                <p className="text-sm text-foreground">Enviar mensagem pelo WhatsApp</p>
              </div>
            </a>
          )}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-red-500 font-semibold">Ações destrutivas</p>
              <p className="text-sm text-muted-foreground">Para cancelar ou excluir o evento, acesse a versão desktop.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Histórico de alterações */}
      {history.length > 0 && (
        <Card>
          <SectionTitle>Histórico de alterações</SectionTitle>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.map((h: any) => (
              <div key={h.id} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {FIELD_LABELS[h.field_name] ?? h.field_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground flex-shrink-0">
                    {h.changed_at ? new Date(h.changed_at).toLocaleDateString('pt-BR') : ''}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Por {profiles[h.user_id] ?? 'Sistema'}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {h.old_value && (
                    <span className="text-xs line-through text-red-400 bg-red-50 px-1.5 py-0.5 rounded max-w-[120px] truncate">{h.old_value}</span>
                  )}
                  {h.old_value && h.new_value && <span className="text-xs text-muted-foreground">→</span>}
                  {h.new_value && (
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded max-w-[120px] truncate">{h.new_value}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function MobileEventDetailScreen({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const [event, setEvent]   = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<MobileTab>('ficha');

  useEffect(() => {
    setLoading(true);
    supabase.from('events')
      .select('*, clients(id,name,phone,email,cpf,rg,address,zip_code,source)')
      .eq('id', eventId).single()
      .then(async ({ data, error }) => {
        if (error || !data) { setLoading(false); return; }
        let ev = data as EventDetail;
        // resolve location/product names if needed
        const proms: Promise<any>[] = [];
        if (!ev.location_text && ev.location_id) {
          proms.push((supabase.from as any)('event_locations').select('name').eq('id', ev.location_id).single()
            .then(({ data: l }: any) => { if (l) ev = { ...ev, location_text: l.name }; }));
        }
        if (!ev.product_name && ev.product_id) {
          proms.push((supabase.from as any)('event_products').select('name').eq('id', ev.product_id).single()
            .then(({ data: p }: any) => { if (p) ev = { ...ev, product_name: p.name }; }));
        }
        await Promise.all(proms);
        setEvent(ev);
        setLoading(false);
      });
  }, [eventId]);

  const isConfirmed = event ? ['confirmed', 'completed'].includes(event.status) : false;
  const visibleTabs = TABS.filter(t => {
    if (!isConfirmed && ['cardapio','checklist','cronograma','financeiro'].includes(t.id)) return false;
    return true;
  });

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!event) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Evento não encontrado</p>
      <button onClick={onBack} className="text-primary font-semibold">Voltar</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10"
           style={{ background: 'linear-gradient(135deg, hsl(222 45% 13%) 0%, hsl(222 35% 22%) 100%)' }}>
        <div className="flex items-center gap-3 px-4 pt-12 pb-3">
          <button onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {isConfirmed ? 'Evento' : 'Orçamento'}
            </p>
            <h1 className="text-base font-bold text-white leading-tight truncate">
              {event.event_name ?? 'Sem nome'}
            </h1>
          </div>
          <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_CLS[event.status] ?? 'bg-muted text-muted-foreground'}`}>
            {STATUS_LABEL[event.status] ?? event.status}
          </span>
        </div>

        {/* Tab bar */}
        <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 pb-0 gap-1">
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-white text-white'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-8">
        {tab === 'ficha'      && <FichaTab ev={event} eventId={eventId} />}
        {tab === 'cliente'    && <ClienteTab ev={event} />}
        {tab === 'cardapio'   && <CardapioTab ev={event} eventId={eventId} />}
        {tab === 'checklist'  && (
          <div className="-mx-4">
            <EventChecklistTab eventId={eventId} />
          </div>
        )}
        {tab === 'cronograma' && (
          <div className="-mx-4">
            <EventCronogramaTab
              eventId={eventId}
              scheduleText={event.schedule_text}
              scheduleFileUrl={event.schedule_file_url}
              scheduleFileName={event.schedule_file_name}
              onChangeText={() => {}}
            />
          </div>
        )}
        {tab === 'financeiro' && (
          <div className="-mx-4">
            <EventFinanceiroTab
              eventId={eventId}
              event={{
                guest_count: event.guest_count,
                children_50_pct: event.children_50_pct,
                price_per_person: event.price_per_person,
                professional_count: event.professional_count,
                professional_meal_value: event.professional_meal_value,
                pricing_mode: event.pricing_mode,
                contract_value: event.contract_value,
              }}
              onUpdateEvent={() => {}}
              clientPhone={event.clients?.phone}
              clientName={event.clients?.name}
              eventName={event.event_name}
            />
          </div>
        )}
        {tab === 'arquivos'   && <ArquivosTab ev={event} eventId={eventId} />}
        {tab === 'outros'     && <OutrosTab ev={event} eventId={eventId} />}
      </div>
    </div>
  );
}
