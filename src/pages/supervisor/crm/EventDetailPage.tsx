import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RichTextEditor from '@/components/RichTextEditor';
import LinkedField from '@/components/LinkedField';
import CustomFieldsSection from '@/components/CustomFieldsSection';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  is_paid_in_full: boolean;
  contract_signed: boolean;
  contract_signed_date: string | null;
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
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead', negotiating: 'Negociando', tasting_scheduled: 'Degustação',
  confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado',
};
const STATUS_CLASSES: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-600 border-slate-200',
  negotiating: 'bg-amber-50 text-amber-700 border-amber-200',
  tasting_scheduled: 'bg-purple-50 text-purple-700 border-purple-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};
const TABS = ['Ficha Técnica','Dados do Cliente','Cardápio','Checklist','Cronograma','Financeiro','Arquivos','Equipe','Outros'];
const EVENT_TYPES = ['Casamento','Coorporativo','Formatura','Debutante','Confraternização','Outro'];

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Shared field components ────────────────────────────────────────────────────

const inputCls =
  'w-full h-10 px-3 text-sm bg-background border border-border rounded-lg ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ' +
  'placeholder:text-muted-foreground/50';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5';

function F({ label, value, onChange, type = 'text', placeholder = '', suffix }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; suffix?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls + (suffix ? ' pr-8' : '')} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}

function Sel({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('Ficha Técnica');
  const [form, setForm] = useState<Partial<EventDetail>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase.from('events').select('*, clients(id, name, phone, email, cpf, rg, address, zip_code, source)').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error('Evento não encontrado'); navigate('/events'); return; }
        setEvent(data as EventDetail);
        setForm(data as EventDetail);
        setLoading(false);
      });
  }, [id]);

  const setF = useCallback(<K extends keyof EventDetail>(key: K, val: any) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }, []);

  const s = (key: keyof EventDetail) => String(form[key] ?? '');

  const save = async () => {
    if (!id || !dirty) return;
    setSaving(true);
    const toNum = (v: any) => (v === '' || v == null) ? null : Number(v);
    const { error } = await supabase.from('events').update({
      event_name: form.event_name, event_type: form.event_type,
      event_date: form.event_date || null,
      location_text: form.location_text, location_id: form.location_id ?? null,
      guest_count: toNum(form.guest_count), children_50_pct: toNum(form.children_50_pct),
      non_paying_guests: toNum(form.non_paying_guests), price_per_person: toNum(form.price_per_person),
      product_name: form.product_name, product_id: form.product_id ?? null,
      duration_hours: toNum(form.duration_hours), ceremony_time: form.ceremony_time,
      professional_count: toNum(form.professional_count),
      professional_meal_value: toNum(form.professional_meal_value),
      professional_meal_type: form.professional_meal_type,
      additional_hours: toNum(form.additional_hours), notes: form.notes,
      organizer: form.organizer, organizer_id: form.organizer_id ?? null,
      decorator: form.decorator, decorator_id: form.decorator_id ?? null,
      pastry_chef: form.pastry_chef, band_dj: form.band_dj,
      photo_video: form.photo_video, bartender: form.bartender,
      other_professionals: form.other_professionals, extra_attractions: form.extra_attractions,
      witness_name: form.witness_name ?? null,
      witness_cpf: form.witness_cpf ?? null,
      witness_email: form.witness_email ?? null,
    }).eq('id', id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    setDirty(false);
    toast.success('Evento salvo!');
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
  if (!event) return null;

  const contractShort = event.contract_signed_date
    ? (() => { const [y, m] = event.contract_signed_date.split('-'); return `${m}/${y.slice(2)}`; })()
    : null;
  const statusLabel = event.is_paid_in_full ? 'Quitado' : STATUS_LABELS[event.status] ?? event.status;

  return (
    <div className="-m-8">

      {/* ════ TOP BAR — fixed, da borda do sidebar até a direita ════ */}
      <div className="fixed z-30 bg-white border-b border-border shadow-sm"
           style={{ top: 56, left: 252, right: 0 }}>
        <div className="px-8 py-3 flex items-center justify-between gap-4">

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-0.5">
              <Link to="/events" className="hover:text-foreground transition-colors">Eventos</Link>
              <span>›</span>
              <span className="text-foreground truncate">{event.event_name ?? 'Sem nome'}</span>
            </div>
            <h1 className="text-[17px] font-bold text-foreground truncate leading-tight flex items-center gap-2">
              {event.event_name ?? 'Sem nome'}
              {event.event_date && (
                <span className="text-sm font-normal text-muted-foreground">
                  · {fmtDate(event.event_date)}
                  {event.location_text && ` · ${event.location_text}`}
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {contractShort && (
              <span className="hidden md:block text-xs text-muted-foreground">Fechado em {contractShort}</span>
            )}
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border ${STATUS_CLASSES[event.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
              {statusLabel}
            </span>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden md:flex">
              <Download className="w-3 h-3" />Ficha técnica
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden md:flex">
              <Download className="w-3 h-3" />Fechamento
            </Button>
            {dirty && (
              <Button onClick={save} disabled={saving} size="sm" className="gap-1.5 h-8">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar
              </Button>
            )}
            <button onClick={() => navigate('/events')}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs (part of the white header block) */}
        <div className="px-8 flex gap-0 -mb-px">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ════ CONTENT ════ */}
      {/* Espaçador para compensar o header fixo (topbar ~72px + tabs ~42px) */}
      <div style={{ height: 114 }} />

      <div className="px-8 py-6 space-y-5">

        {/* ── FICHA TÉCNICA ── */}
        {tab === 'Ficha Técnica' && (
          <>
            {/* Card 1: Informações gerais */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionTitle>Informações do Evento</SectionTitle>
              <div className="grid grid-cols-4 gap-4">

                <F label="Nome do evento" value={s('event_name')} onChange={v => setF('event_name', v)} />

                {/* Local: linked */}
                <LinkedField
                  label="Local do evento"
                  table="event_locations"
                  valueId={form.location_id ?? null}
                  valueName={s('location_text')}
                  onChangeId={id => setF('location_id', id)}
                  onChangeName={n => setF('location_text', n)}
                  createLabel="Local"
                />

                <F label="Data do evento" value={s('event_date')} onChange={v => setF('event_date', v)} type="date" />
                <Sel label="Tipo do evento" value={s('event_type')} onChange={v => setF('event_type', v)} options={EVENT_TYPES} />

                {/* Produto: linked */}
                <LinkedField
                  label="Produto escolhido"
                  table="event_products"
                  valueId={form.product_id ?? null}
                  valueName={s('product_name')}
                  onChangeId={id => setF('product_id', id)}
                  onChangeName={n => setF('product_name', n)}
                  createLabel="Produto"
                />

                <F label="Horário da cerimônia" value={s('ceremony_time')} onChange={v => setF('ceremony_time', v)} placeholder="15:30 hs" />
                <F label="Duração (horas)" value={s('duration_hours')} onChange={v => setF('duration_hours', v)} type="number" suffix="h" />
                <F label="Convidados" value={s('guest_count')} onChange={v => setF('guest_count', v)} type="number" />

                <F label="Preço / Pax" value={s('price_per_person')} onChange={v => setF('price_per_person', v)} type="number" suffix="R$" />
                <F label="Crianças 50%" value={s('children_50_pct')} onChange={v => setF('children_50_pct', v)} type="number" />
                <F label="Não pagantes" value={s('non_paying_guests')} onChange={v => setF('non_paying_guests', v)} type="number" />
                <F label="Horas adicionais" value={s('additional_hours')} onChange={v => setF('additional_hours', v)} type="number" suffix="h" />

                <F label="Qtd. profissionais" value={s('professional_count')} onChange={v => setF('professional_count', v)} type="number" />
                <F label="Valor alim. profissionais" value={s('professional_meal_value')} onChange={v => setF('professional_meal_value', v)} type="number" suffix="R$" />
                <div className="col-span-2">
                  <F label="Alimentação profissionais" value={s('professional_meal_type')} onChange={v => setF('professional_meal_type', v)} placeholder="ex: separada" />
                </div>
              </div>

              {/* Observações – rich text */}
              <div className="mt-5">
                <label className={labelCls}>Observações</label>
                <RichTextEditor
                  content={s('notes')}
                  onChange={html => setF('notes', html)}
                  placeholder="Observações do evento..."
                />
              </div>
            </div>

            {/* Card 2: Equipe & Fornecedores */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionTitle>Equipe & Fornecedores</SectionTitle>
              <div className="grid grid-cols-4 gap-4">

                <LinkedField
                  label="Organizadora"
                  table="suppliers"
                  typeFilter="organizer"
                  valueId={form.organizer_id ?? null}
                  valueName={s('organizer')}
                  onChangeId={id => setF('organizer_id', id)}
                  onChangeName={n => setF('organizer', n)}
                  createLabel="Organizadora"
                />
                <LinkedField
                  label="Decorador"
                  table="suppliers"
                  typeFilter="decorator"
                  valueId={form.decorator_id ?? null}
                  valueName={s('decorator')}
                  onChangeId={id => setF('decorator_id', id)}
                  onChangeName={n => setF('decorator', n)}
                  createLabel="Decorador"
                />
                <F label="Confeiteiro(a)" value={s('pastry_chef')} onChange={v => setF('pastry_chef', v)} />
                <F label="Banda / DJ" value={s('band_dj')} onChange={v => setF('band_dj', v)} />

                <F label="Foto / Filmagem" value={s('photo_video')} onChange={v => setF('photo_video', v)} />
                <F label="Bartender" value={s('bartender')} onChange={v => setF('bartender', v)} />
                <F label="Outros profissionais" value={s('other_professionals')} onChange={v => setF('other_professionals', v)} />
                <F label="Atrações à parte" value={s('extra_attractions')} onChange={v => setF('extra_attractions', v)} />
              </div>
            </div>

            {/* Card 3: Campos customizáveis */}
            {id && <CustomFieldsSection eventId={id} onDirty={() => setDirty(true)} />}
          </>
        )}

        {/* ── DADOS DO CLIENTE ── */}
        {tab === 'Dados do Cliente' && (
          <>
            {/* Dados do contratante */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionTitle>Dados do Contratante</SectionTitle>
              {event.clients ? (
                <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                  <div className="col-span-2">
                    <label className={labelCls}>Nome do Contratante</label>
                    <p className="text-sm font-medium border-b border-border pb-2">{event.clients.name ?? '—'}</p>
                  </div>
                  <div>
                    <label className={labelCls}>Telefone com DDD</label>
                    <p className="text-sm border-b border-border pb-2">{event.clients.phone ?? '—'}</p>
                  </div>
                  <div>
                    <label className={labelCls}>CPF/CNPJ</label>
                    <p className="text-sm border-b border-border pb-2">{event.clients.cpf ?? '—'}</p>
                  </div>
                  <div>
                    <label className={labelCls}>RG</label>
                    <p className="text-sm border-b border-border pb-2">{event.clients.rg ?? '—'}</p>
                  </div>
                  <div>
                    <label className={labelCls}>E-mail</label>
                    <p className="text-sm border-b border-border pb-2">{event.clients.email ?? '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Endereço Completo</label>
                    <p className="text-sm border-b border-border pb-2">{event.clients.address ?? '—'}</p>
                  </div>
                  <div>
                    <label className={labelCls}>CEP</label>
                    <p className="text-sm border-b border-border pb-2">{event.clients.zip_code ?? '—'}</p>
                  </div>
                  <div>
                    <label className={labelCls}>De onde nos conheceu</label>
                    <p className="text-sm border-b border-border pb-2">{event.clients.source ?? '—'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum cliente vinculado a este evento.</p>
              )}
            </div>

            {/* Testemunha */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionTitle>Testemunha</SectionTitle>
              <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                <div>
                  <label className={labelCls}>Nome Completo</label>
                  <input
                    className={inputCls}
                    value={s('witness_name')}
                    onChange={e => setF('witness_name', e.target.value)}
                    placeholder="Nome da testemunha"
                  />
                </div>
                <div>
                  <label className={labelCls}>CPF</label>
                  <input
                    className={inputCls}
                    value={s('witness_cpf')}
                    onChange={e => setF('witness_cpf', e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className={labelCls}>E-mail</label>
                  <input
                    className={inputCls}
                    value={s('witness_email')}
                    onChange={e => setF('witness_email', e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── EM CONSTRUÇÃO ── */}
        {['Cardápio','Checklist','Cronograma','Financeiro','Arquivos','Equipe','Outros'].includes(tab) && (
          <div className="bg-white border border-border rounded-2xl p-16 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-2xl">🚧</div>
            <p className="font-semibold">Em construção</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              A aba <strong>{tab}</strong> está sendo desenvolvida.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
