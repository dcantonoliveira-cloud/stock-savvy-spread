import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Download, X, Plus, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  // ficha técnica extra
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
  // client join
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
  lead: 'bg-slate-100 text-slate-700',
  negotiating: 'bg-amber-100 text-amber-700',
  tasting_scheduled: 'bg-purple-100 text-purple-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PAID_BADGE: Record<string, string> = {
  true: 'bg-emerald-500 text-white',
  false: 'bg-amber-100 text-amber-700',
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

function fmtBRL(n: number | null) {
  if (n == null) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 bg-white text-sm border-b border-border rounded-none border-x-0 border-t-0 focus-visible:ring-0 focus-visible:border-primary px-0"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-9 bg-white text-sm border-b border-border border-x-0 border-t-0 focus:outline-none focus:border-primary px-0"
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
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

  const setF = useCallback(<K extends keyof EventDetail>(key: K, val: EventDetail[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }, []);

  const s = (key: keyof EventDetail) => String(form[key] ?? '');
  const n = (key: keyof EventDetail) => String(form[key] ?? '');

  const save = async () => {
    if (!id || !dirty) return;
    setSaving(true);
    const { error } = await supabase.from('events').update({
      event_name: form.event_name,
      event_type: form.event_type,
      event_date: form.event_date || null,
      location_text: form.location_text,
      guest_count: form.guest_count ? Number(form.guest_count) : null,
      children_50_pct: form.children_50_pct ? Number(form.children_50_pct) : null,
      non_paying_guests: form.non_paying_guests ? Number(form.non_paying_guests) : null,
      price_per_person: form.price_per_person ? Number(form.price_per_person) : null,
      product_name: form.product_name,
      duration_hours: form.duration_hours ? Number(form.duration_hours) : null,
      ceremony_time: form.ceremony_time,
      professional_count: form.professional_count ? Number(form.professional_count) : null,
      professional_meal_value: form.professional_meal_value ? Number(form.professional_meal_value) : null,
      professional_meal_type: form.professional_meal_type,
      additional_hours: form.additional_hours ? Number(form.additional_hours) : null,
      notes: form.notes,
      organizer: form.organizer,
      decorator: form.decorator,
      pastry_chef: form.pastry_chef,
      band_dj: form.band_dj,
      photo_video: form.photo_video,
      bartender: form.bartender,
      other_professionals: form.other_professionals,
      extra_attractions: form.extra_attractions,
      welcome_cocktail: form.welcome_cocktail,
      wine: form.wine,
      whisky: form.whisky,
      napkin_holder: form.napkin_holder,
      tablecloth: form.tablecloth,
      rechaud: form.rechaud,
      sousplat: form.sousplat,
      sideboard: form.sideboard,
      glass_type: form.glass_type,
      bridal_suite: form.bridal_suite,
      kids_area: form.kids_area,
      table_count: form.table_count ? Number(form.table_count) : null,
      guests_per_table: form.guests_per_table ? Number(form.guests_per_table) : null,
      cake_table_location: form.cake_table_location,
      band_dj_time: form.band_dj_time,
      beer: form.beer,
    }).eq('id', id);

    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    setDirty(false);
    toast.success('Evento salvo com sucesso!');
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

  return (
    <div className="max-w-[1100px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
            <Link to="/events" className="hover:text-foreground transition-colors">Eventos</Link>
            <span>›</span>
            <span className="text-foreground font-medium">{event.event_name ?? 'Sem nome'}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-foreground leading-tight">
            {event.event_name ?? 'Sem nome'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {event.event_date && <>Dia <strong>{fmtDate(event.event_date)}</strong></>}
            {event.location_text && <> no <strong>{event.location_text}</strong></>}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Fechamento */}
          {contractShort && (
            <span className="text-sm text-muted-foreground">Fechado em {contractShort}</span>
          )}

          {/* Status badge */}
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide ${STATUS_CLASSES[event.status] ?? 'bg-muted text-muted-foreground'}`}>
            {event.is_paid_in_full ? 'Evento Quitado' : STATUS_LABELS[event.status] ?? event.status}
          </span>

          {/* Download buttons */}
          <Button variant="outline" size="sm" className="gap-1.5 h-8">
            <Download className="w-3.5 h-3.5" />
            Ficha técnica
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8">
            <Download className="w-3.5 h-3.5" />
            Fechamento
          </Button>

          {/* Close */}
          <button
            onClick={() => navigate('/events')}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Save bar ── */}
      {dirty && (
        <div className="fixed bottom-6 right-8 z-50">
          <Button onClick={save} disabled={saving} className="shadow-lg gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar alterações
          </Button>
        </div>
      )}

      {/* ── Tab: Ficha Técnica ── */}
      {tab === 'Ficha Técnica' && (
        <div className="space-y-8">

          {/* Bloco 1 — Informações gerais */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="grid grid-cols-3 gap-x-8 gap-y-6">
              <Field label="Nome do Evento" value={s('event_name')} onChange={v => setF('event_name', v)} />
              <Field label="Local do evento" value={s('location_text')} onChange={v => setF('location_text', v)} />
              <Field label="Data do evento" value={s('event_date')} onChange={v => setF('event_date', v)} type="date" />

              <SelectField label="Tipo do Evento" value={s('event_type')} onChange={v => setF('event_type', v)} options={EVENT_TYPES} />
              <Field label="Quantidade de convidados" value={n('guest_count')} onChange={v => setF('guest_count', v as any)} type="number" />
              <Field label="Preço negociado" value={n('price_per_person')} onChange={v => setF('price_per_person', v as any)} type="number" placeholder="R$" />

              <div className="flex items-end gap-2">
                <Field label="Produto escolhido" value={s('product_name')} onChange={v => setF('product_name', v)} />
                <button className="mb-0.5 p-1 text-primary hover:bg-primary/10 rounded transition-colors shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <Field label="Horário da cerimônia" value={s('ceremony_time')} onChange={v => setF('ceremony_time', v)} placeholder="ex: 15:30 hs" />
              <Field label="Duração do evento (em horas)" value={n('duration_hours')} onChange={v => setF('duration_hours', v as any)} type="number" placeholder="ex: 6" />

              <Field label="Quantidade de profissionais" value={n('professional_count')} onChange={v => setF('professional_count', v as any)} type="number" />
              <Field label="Valor Alimentação Profissionais" value={n('professional_meal_value')} onChange={v => setF('professional_meal_value', v as any)} type="number" placeholder="R$" />
              <Field label="Alimentação Profissionais" value={s('professional_meal_type')} onChange={v => setF('professional_meal_type', v)} placeholder="ex: separada" />

              <Field label="Crianças 50%" value={n('children_50_pct')} onChange={v => setF('children_50_pct', v as any)} type="number" />
              <Field label="Não pagantes" value={n('non_paying_guests')} onChange={v => setF('non_paying_guests', v as any)} type="number" />
              <Field label="Quantidade de horas adicionais" value={n('additional_hours')} onChange={v => setF('additional_hours', v as any)} type="number" />
            </div>

            {/* Observações */}
            <div className="mt-6">
              <label className="block text-xs font-medium text-muted-foreground mb-2">Observações</label>
              <div className="border border-border rounded-xl overflow-hidden">
                {/* Simple toolbar */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-muted/30">
                  {['B', 'I', 'U'].map(f => (
                    <button key={f} className="w-6 h-6 text-xs font-bold rounded hover:bg-muted transition-colors">{f}</button>
                  ))}
                </div>
                <textarea
                  value={s('notes').replace(/<[^>]*>/g, '')}
                  onChange={e => setF('notes', e.target.value)}
                  rows={8}
                  className="w-full p-4 text-sm resize-none focus:outline-none"
                  placeholder="Observações do evento..."
                />
              </div>
            </div>
          </div>

          {/* Bloco 2 — Equipe / Fornecedores */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="grid grid-cols-4 gap-x-8 gap-y-6">
              <div className="flex items-end gap-2">
                <Field label="Organizadora" value={s('organizer')} onChange={v => setF('organizer', v)} />
                <button className="mb-0.5 p-1 text-primary hover:bg-primary/10 rounded transition-colors shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <Field label="Decorador" value={s('decorator')} onChange={v => setF('decorator', v)} />
              <Field label="Confeiteiro(a)" value={s('pastry_chef')} onChange={v => setF('pastry_chef', v)} />
              <Field label="Banda/DJ" value={s('band_dj')} onChange={v => setF('band_dj', v)} />

              <Field label="Foto/Filmagem" value={s('photo_video')} onChange={v => setF('photo_video', v)} />
              <Field label="Bartender" value={s('bartender')} onChange={v => setF('bartender', v)} />
              <Field label="Outros Profissionais" value={s('other_professionals')} onChange={v => setF('other_professionals', v)} />
              <Field label="Atrações a parte" value={s('extra_attractions')} onChange={v => setF('extra_attractions', v)} />
            </div>
          </div>

          {/* Bloco 3 — Detalhes da festa */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="grid grid-cols-4 gap-x-8 gap-y-6">
              <Field label="Coquetel de boas vindas" value={s('welcome_cocktail')} onChange={v => setF('welcome_cocktail', v)} />
              <Field label="Vinho" value={s('wine')} onChange={v => setF('wine', v)} />
              <Field label="Whisky" value={s('whisky')} onChange={v => setF('whisky', v)} />
              <Field label="Porta guardanapo" value={s('napkin_holder')} onChange={v => setF('napkin_holder', v)} />

              <Field label="Toalha" value={s('tablecloth')} onChange={v => setF('tablecloth', v)} />
              <Field label="Rechaud" value={s('rechaud')} onChange={v => setF('rechaud', v)} />
              <Field label="Sousplát" value={s('sousplat')} onChange={v => setF('sousplat', v)} />
              <Field label="Aparador" value={s('sideboard')} onChange={v => setF('sideboard', v)} />

              <Field label="Taça" value={s('glass_type')} onChange={v => setF('glass_type', v)} />
              <Field label="Sala dos noivos" value={s('bridal_suite')} onChange={v => setF('bridal_suite', v)} />
              <Field label="Espaço kids" value={s('kids_area')} onChange={v => setF('kids_area', v)} />
              <Field label="Quantidade de mesas" value={n('table_count')} onChange={v => setF('table_count', v as any)} type="number" />

              <Field label="Convidados por mesa" value={n('guests_per_table')} onChange={v => setF('guests_per_table', v as any)} type="number" />
              <Field label="Localização mesa do bolo" value={s('cake_table_location')} onChange={v => setF('cake_table_location', v)} />
              <Field label="Horário Banda/DJ" value={s('band_dj_time')} onChange={v => setF('band_dj_time', v)} />
              <Field label="Cerveja" value={s('beer')} onChange={v => setF('beer', v)} />
            </div>
          </div>

        </div>
      )}

      {/* ── Tab: Dados do Cliente ── */}
      {tab === 'Dados do Cliente' && (
        <div className="bg-white border border-border rounded-2xl p-6">
          {event.clients ? (
            <div className="grid grid-cols-3 gap-x-8 gap-y-6">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome</label>
                <p className="text-sm text-foreground font-medium">{event.clients.name ?? '—'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Telefone</label>
                <p className="text-sm text-foreground">{event.clients.phone ?? '—'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">E-mail</label>
                <p className="text-sm text-foreground">{event.clients.email ?? '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum cliente vinculado.</p>
          )}
        </div>
      )}

      {/* ── Tabs em construção ── */}
      {['Cardápio', 'Checklist', 'Cronograma', 'Financeiro', 'Arquivos', 'Equipe', 'Outros'].includes(tab) && (
        <div className="bg-white border border-border rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <span className="text-xl">🚧</span>
          </div>
          <p className="font-semibold text-foreground">Em construção</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            A aba <strong>{tab}</strong> está sendo desenvolvida. Em breve estará disponível.
          </p>
        </div>
      )}

    </div>
  );
}
