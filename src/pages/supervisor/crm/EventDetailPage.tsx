import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, X, Plus, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventDetail {
  id: string;
  event_name: string | null;
  event_type: string | null;
  status: string;
  event_date: string | null;
  location_text: string | null;
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
  ceremony_time: string | null;
  professional_count: number | null;
  professional_meal_value: number | null;
  professional_meal_type: string | null;
  additional_hours: number | null;
  organizer: string | null;
  decorator: string | null;
  pastry_chef: string | null;
  band_dj: string | null;
  photo_video: string | null;
  bartender: string | null;
  other_professionals: string | null;
  extra_attractions: string | null;
  welcome_cocktail: string | null;
  wine: string | null;
  whisky: string | null;
  napkin_holder: string | null;
  tablecloth: string | null;
  rechaud: string | null;
  sousplat: string | null;
  sideboard: string | null;
  glass_type: string | null;
  bridal_suite: string | null;
  kids_area: string | null;
  table_count: number | null;
  guests_per_table: number | null;
  cake_table_location: string | null;
  band_dj_time: string | null;
  beer: string | null;
  clients: { id: string; name: string | null; phone: string | null; email: string | null } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead',
  negotiating: 'Negociando',
  tasting_scheduled: 'Degustação Marcada',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const STATUS_CLASSES: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-600 border-slate-200',
  negotiating: 'bg-amber-50 text-amber-700 border-amber-200',
  tasting_scheduled: 'bg-purple-50 text-purple-700 border-purple-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const TABS = [
  'Ficha Técnica',
  'Dados do Cliente',
  'Cardápio',
  'Checklist',
  'Cronograma',
  'Financeiro',
  'Arquivos',
  'Equipe',
  'Outros',
];

const EVENT_TYPES = ['Casamento', 'Coorporativo', 'Formatura', 'Debutante', 'Confraternização', 'Outro'];

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Shared input style ────────────────────────────────────────────────────────

const inputCls =
  'w-full h-10 px-3 text-sm bg-background border border-border rounded-lg ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ' +
  'transition-colors placeholder:text-muted-foreground/50';

const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5';

// ── Field components ──────────────────────────────────────────────────────────

function F({
  label, value, onChange, type = 'text', placeholder = '', suffix,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; suffix?: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls + (suffix ? ' pr-8' : '')}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">{suffix}</span>}
      </div>
    </div>
  );
}

function Sel({
  label, value, onChange, options,
}: {
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

// ── Main component ────────────────────────────────────────────────────────────

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
    supabase
      .from('events')
      .select('*, clients(id, name, phone, email)')
      .eq('id', id)
      .single()
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
      event_date: form.event_date || null, location_text: form.location_text,
      guest_count: toNum(form.guest_count), children_50_pct: toNum(form.children_50_pct),
      non_paying_guests: toNum(form.non_paying_guests), price_per_person: toNum(form.price_per_person),
      product_name: form.product_name, duration_hours: toNum(form.duration_hours),
      ceremony_time: form.ceremony_time, professional_count: toNum(form.professional_count),
      professional_meal_value: toNum(form.professional_meal_value),
      professional_meal_type: form.professional_meal_type, additional_hours: toNum(form.additional_hours),
      notes: form.notes, organizer: form.organizer, decorator: form.decorator,
      pastry_chef: form.pastry_chef, band_dj: form.band_dj, photo_video: form.photo_video,
      bartender: form.bartender, other_professionals: form.other_professionals,
      extra_attractions: form.extra_attractions, welcome_cocktail: form.welcome_cocktail,
      wine: form.wine, whisky: form.whisky, napkin_holder: form.napkin_holder,
      tablecloth: form.tablecloth, rechaud: form.rechaud, sousplat: form.sousplat,
      sideboard: form.sideboard, glass_type: form.glass_type, bridal_suite: form.bridal_suite,
      kids_area: form.kids_area, table_count: toNum(form.table_count),
      guests_per_table: toNum(form.guests_per_table), cake_table_location: form.cake_table_location,
      band_dj_time: form.band_dj_time, beer: form.beer,
    }).eq('id', id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    setDirty(false);
    toast.success('Salvo com sucesso!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!event) return null;

  const contractShort = event.contract_signed_date
    ? (() => { const [y, m] = event.contract_signed_date.split('-'); return `${m}/${y.slice(2)}`; })()
    : null;

  const statusLabel = event.is_paid_in_full
    ? 'Evento Quitado'
    : STATUS_LABELS[event.status] ?? event.status;

  return (
    <div className="-m-8">

      {/* ── Top bar ── */}
      <div className="sticky top-14 z-30 bg-card/95 backdrop-blur border-b border-border px-8 py-3 flex items-center justify-between gap-4">

        {/* Left: breadcrumb + title */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
            <Link to="/events" className="hover:text-foreground transition-colors">Eventos</Link>
            <span>›</span>
            <span className="text-foreground truncate">{event.event_name ?? 'Sem nome'}</span>
          </div>
          <h1 className="text-lg font-bold text-foreground truncate leading-tight">
            {event.event_name ?? 'Sem nome'}
            {event.event_date && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {fmtDate(event.event_date)}
                {event.location_text && ` · ${event.location_text}`}
              </span>
            )}
          </h1>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {contractShort && (
            <span className="text-xs text-muted-foreground hidden md:block">Fechado em {contractShort}</span>
          )}

          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border ${STATUS_CLASSES[event.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
            {statusLabel}
          </span>

          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Download className="w-3 h-3" />
            Ficha técnica
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Download className="w-3 h-3" />
            Fechamento
          </Button>

          {dirty && (
            <Button onClick={save} disabled={saving} size="sm" className="gap-1.5 h-8">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </Button>
          )}

          <button
            onClick={() => navigate('/events')}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-border bg-card px-8">
        <div className="flex gap-0 -mb-px">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-8 py-6 space-y-5">

        {/* ════ FICHA TÉCNICA ════ */}
        {tab === 'Ficha Técnica' && (
          <>
            {/* Card: Informações do evento */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionTitle>Informações do Evento</SectionTitle>
              <div className="grid grid-cols-4 gap-4">
                <F label="Nome do evento" value={s('event_name')} onChange={v => setF('event_name', v)} />
                <F label="Local do evento" value={s('location_text')} onChange={v => setF('location_text', v)} />
                <F label="Data do evento" value={s('event_date')} onChange={v => setF('event_date', v)} type="date" />
                <Sel label="Tipo do evento" value={s('event_type')} onChange={v => setF('event_type', v)} options={EVENT_TYPES} />

                {/* Produto com botão + */}
                <div>
                  <label className={labelCls}>Produto escolhido</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={s('product_name')}
                      onChange={e => setF('product_name', e.target.value)}
                      className={inputCls}
                    />
                    <button className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-border hover:bg-primary/5 hover:border-primary/30 transition-colors text-primary">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <F label="Horário da cerimônia" value={s('ceremony_time')} onChange={v => setF('ceremony_time', v)} placeholder="15:30 hs" />
                <F label="Duração (horas)" value={s('duration_hours')} onChange={v => setF('duration_hours', v)} type="number" placeholder="6" suffix="h" />
                <F label="Convidados" value={s('guest_count')} onChange={v => setF('guest_count', v)} type="number" />

                <F label="Preço / Pax" value={s('price_per_person')} onChange={v => setF('price_per_person', v)} type="number" placeholder="0,00" suffix="R$" />
                <F label="Crianças 50%" value={s('children_50_pct')} onChange={v => setF('children_50_pct', v)} type="number" />
                <F label="Não pagantes" value={s('non_paying_guests')} onChange={v => setF('non_paying_guests', v)} type="number" />
                <F label="Horas adicionais" value={s('additional_hours')} onChange={v => setF('additional_hours', v)} type="number" suffix="h" />

                <F label="Qtd. profissionais" value={s('professional_count')} onChange={v => setF('professional_count', v)} type="number" />
                <F label="Valor alim. profissionais" value={s('professional_meal_value')} onChange={v => setF('professional_meal_value', v)} type="number" suffix="R$" />
                <F label="Alimentação profissionais" value={s('professional_meal_type')} onChange={v => setF('professional_meal_type', v)} placeholder="ex: separada" />
              </div>

              {/* Observações */}
              <div className="mt-5">
                <label className={labelCls}>Observações</label>
                <div className="border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
                  <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border bg-muted/20">
                    {[['B','font-bold'],['I','italic'],['U','underline']].map(([f,cls]) => (
                      <button key={f} className={`w-7 h-7 text-xs ${cls} rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground`}>{f}</button>
                    ))}
                  </div>
                  <textarea
                    value={s('notes').replace(/<[^>]*>/g, '')}
                    onChange={e => setF('notes', e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 text-sm resize-none focus:outline-none bg-white"
                    placeholder="Observações do evento..."
                  />
                </div>
              </div>
            </div>

            {/* Card: Equipe & Fornecedores */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionTitle>Equipe & Fornecedores</SectionTitle>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Organizadora</label>
                  <div className="flex gap-1.5">
                    <input type="text" value={s('organizer')} onChange={e => setF('organizer', e.target.value)} className={inputCls} />
                    <button className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-border hover:bg-primary/5 hover:border-primary/30 transition-colors text-primary">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <F label="Decorador" value={s('decorator')} onChange={v => setF('decorator', v)} />
                <F label="Confeiteiro(a)" value={s('pastry_chef')} onChange={v => setF('pastry_chef', v)} />
                <F label="Banda / DJ" value={s('band_dj')} onChange={v => setF('band_dj', v)} />

                <F label="Foto / Filmagem" value={s('photo_video')} onChange={v => setF('photo_video', v)} />
                <F label="Bartender" value={s('bartender')} onChange={v => setF('bartender', v)} />
                <F label="Outros profissionais" value={s('other_professionals')} onChange={v => setF('other_professionals', v)} />
                <F label="Atrações à parte" value={s('extra_attractions')} onChange={v => setF('extra_attractions', v)} />
              </div>
            </div>

            {/* Card: Detalhes da festa */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionTitle>Detalhes da Festa</SectionTitle>
              <div className="grid grid-cols-4 gap-4">
                <F label="Coquetel de boas-vindas" value={s('welcome_cocktail')} onChange={v => setF('welcome_cocktail', v)} />
                <F label="Vinho" value={s('wine')} onChange={v => setF('wine', v)} />
                <F label="Whisky" value={s('whisky')} onChange={v => setF('whisky', v)} />
                <F label="Cerveja" value={s('beer')} onChange={v => setF('beer', v)} />

                <F label="Porta guardanapo" value={s('napkin_holder')} onChange={v => setF('napkin_holder', v)} />
                <F label="Toalha" value={s('tablecloth')} onChange={v => setF('tablecloth', v)} />
                <F label="Rechaud" value={s('rechaud')} onChange={v => setF('rechaud', v)} />
                <F label="Sousplát" value={s('sousplat')} onChange={v => setF('sousplat', v)} />

                <F label="Aparador" value={s('sideboard')} onChange={v => setF('sideboard', v)} />
                <F label="Taça" value={s('glass_type')} onChange={v => setF('glass_type', v)} />
                <F label="Sala dos noivos" value={s('bridal_suite')} onChange={v => setF('bridal_suite', v)} />
                <F label="Espaço kids" value={s('kids_area')} onChange={v => setF('kids_area', v)} />

                <F label="Qtd. de mesas" value={s('table_count')} onChange={v => setF('table_count', v)} type="number" />
                <F label="Convidados por mesa" value={s('guests_per_table')} onChange={v => setF('guests_per_table', v)} type="number" />
                <F label="Local mesa do bolo" value={s('cake_table_location')} onChange={v => setF('cake_table_location', v)} />
                <F label="Horário Banda / DJ" value={s('band_dj_time')} onChange={v => setF('band_dj_time', v)} />
              </div>
            </div>
          </>
        )}

        {/* ════ DADOS DO CLIENTE ════ */}
        {tab === 'Dados do Cliente' && (
          <div className="bg-white border border-border rounded-2xl p-6">
            <SectionTitle>Cliente vinculado</SectionTitle>
            {event.clients ? (
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Nome</label>
                  <p className="text-sm font-medium text-foreground">{event.clients.name ?? '—'}</p>
                </div>
                <div>
                  <label className={labelCls}>Telefone</label>
                  <p className="text-sm text-foreground">{event.clients.phone ?? '—'}</p>
                </div>
                <div>
                  <label className={labelCls}>E-mail</label>
                  <p className="text-sm text-foreground">{event.clients.email ?? '—'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum cliente vinculado.</p>
            )}
          </div>
        )}

        {/* ════ EM CONSTRUÇÃO ════ */}
        {['Cardápio', 'Checklist', 'Cronograma', 'Financeiro', 'Arquivos', 'Equipe', 'Outros'].includes(tab) && (
          <div className="bg-white border border-border rounded-2xl p-16 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-2xl">🚧</div>
            <p className="font-semibold text-foreground">Em construção</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              A aba <strong>{tab}</strong> está sendo desenvolvida e estará disponível em breve.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
