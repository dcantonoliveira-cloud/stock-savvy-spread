import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, X, Loader2, FileText, AlignLeft, BookOpen, Search, Trash2, Clock, Users, MapPin, CalendarDays, Check, ChevronDown, MessageCircle, UtensilsCrossed } from 'lucide-react';
import { openWhatsAppLink } from '@/lib/whatsapp';
import { Button } from '@/components/ui/button';
import RichTextEditor from '@/components/RichTextEditor';
import LinkedField from '@/components/LinkedField';
import CustomFieldsSection from '@/components/CustomFieldsSection';
import MenuSheetsTab from '@/components/MenuSheetsTab';
import EventChecklistTab from '@/components/EventChecklistTab';
import EventCronogramaTab from '@/components/EventCronogramaTab';
import EventFinanceiroTab from '@/components/EventFinanceiroTab';
import EventArquivosTab from '@/components/EventArquivosTab';
import EventOutrosTab from '@/components/EventOutrosTab';
import WhatsAppConfirmModal, { WhatsAppTrigger } from '@/components/WhatsAppConfirmModal';
import { printFechamento } from '@/utils/printFechamento';
import { printFichaTecnica } from '@/utils/printFichaTecnica';

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
  witness_2_name: string | null;
  witness_2_email: string | null;
  paid_value: number | null;
  menu_text: string | null;
  menu_mode: string | null;
  annex_1_text: string | null;
  schedule_text: string | null;
  schedule_file_url: string | null;
  schedule_file_name: string | null;
  pricing_mode: string | null;
  contract_value: number | null;
  date_reserved: boolean | null;
  contract_form_token: string | null;
  contract_form_submitted: boolean | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

import { STATUS_LABELS, STATUS_CLS, ALL_STATUS_KEYS } from '@/lib/eventStatus';
const STATUS_CLASSES: Record<string, string> = Object.fromEntries(ALL_STATUS_KEYS.map(k => [k, STATUS_CLS(k)]));
const TABS_ALL = ['Ficha Técnica','Dados do Cliente','Cardápio','Checklist','Cronograma','Financeiro','Arquivos','Equipe','Outros'];
const TABS_CLOSED_ONLY = ['Cardápio','Checklist','Cronograma','Financeiro','Equipe'];
const EVENT_TYPES = ['Aniversário','Batizado','Casamento','Confraternização','Corporativo','Debutante','Formatura','Outro'];

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

import { EVENT_STATUS } from '@/lib/eventStatus';
const ALL_STATUS_OPTIONS = ALL_STATUS_KEYS.map(k => ({ key: k, label: EVENT_STATUS[k].label, cls: EVENT_STATUS[k].cls }));

function StatusDropdown({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const current = ALL_STATUS_OPTIONS.find(o => o.key === status);
  const cls = current?.cls ?? STATUS_CLASSES[status] ?? 'bg-muted text-muted-foreground border-border';
  const label = current?.label ?? STATUS_LABELS[status] ?? status;

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border transition-colors hover:opacity-80 ${cls}`}
      >
        {label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 bg-white border border-border rounded-xl shadow-xl py-1.5 min-w-[190px]"
               style={{ top: pos.top, left: pos.left }}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Alterar status</p>
            {ALL_STATUS_OPTIONS.map(o => (
              <button
                key={o.key}
                onClick={() => { onChange(o.key); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium hover:bg-muted transition-colors ${o.key === status ? 'opacity-40 pointer-events-none' : ''}`}
              >
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${o.cls}`}>{o.label}</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [tab, setTab] = useState('Ficha Técnica');
  const [waTrigger, setWaTrigger] = useState<WhatsAppTrigger | null>(null);
  const [allocTastingOpen, setAllocTastingOpen] = useState(false);
  const [form, setForm] = useState<Partial<EventDetail>>({});
  const [clientForm, setClientForm] = useState<Record<string, string>>({});
  const eventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<Partial<EventDetail>>({});
  const clientFormRef = useRef<Record<string, string>>({});
  const eventIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase.from('events').select('*, clients(id, name, phone, email, cpf, rg, address, zip_code, source)').eq('id', id).single()
      .then(async ({ data, error }) => {
        if (error || !data) { toast.error('Evento não encontrado'); navigate('/events'); return; }
        // fallback: busca nome do local se location_text estiver vazio mas location_id existir
        let eventData = data as EventDetail;
        if (!eventData.location_text && eventData.location_id) {
          const { data: loc } = await supabase.from('event_locations' as any).select('name').eq('id', eventData.location_id).single();
          if (loc) eventData = { ...eventData, location_text: (loc as any).name };
        }
        // fallback: busca nome do produto se product_name estiver vazio mas product_id existir
        if (!eventData.product_name && eventData.product_id) {
          const { data: prod } = await supabase.from('event_products' as any).select('name').eq('id', eventData.product_id).single();
          if (prod) eventData = { ...eventData, product_name: (prod as any).name };
        }
        setEvent(eventData);
        setForm(eventData);
        formRef.current = eventData;
        eventIdRef.current = id;
        const c = (data as EventDetail).clients;
        if (c) {
          const cf = { name: c.name ?? '', phone: c.phone ?? '', email: c.email ?? '', cpf: c.cpf ?? '', rg: c.rg ?? '', address: c.address ?? '', zip_code: c.zip_code ?? '', source: c.source ?? '' };
          setClientForm(cf);
          clientFormRef.current = cf;
        }
        setLoading(false);
      });
  }, [id]);

  const toNum = (v: any) => (v === '' || v == null) ? null : Number(v);

  const persistEvent = useCallback(async (data: Partial<EventDetail>) => {
    const eid = eventIdRef.current;
    if (!eid) return;
    setSaveStatus('saving');
    const { error } = await supabase.from('events').update({
      event_name: data.event_name, event_type: data.event_type,
      event_date: data.event_date || null,
      location_text: data.location_text, location_id: data.location_id ?? null,
      guest_count: toNum(data.guest_count), children_50_pct: toNum(data.children_50_pct),
      non_paying_guests: toNum(data.non_paying_guests), price_per_person: toNum(data.price_per_person),
      product_name: data.product_name, product_id: data.product_id ?? null,
      duration_hours: toNum(data.duration_hours), ceremony_time: data.ceremony_time,
      professional_count: toNum(data.professional_count),
      professional_meal_value: toNum(data.professional_meal_value),
      professional_meal_type: data.professional_meal_type,
      additional_hours: toNum(data.additional_hours), notes: data.notes,
      organizer: data.organizer, organizer_id: data.organizer_id ?? null,
      decorator: data.decorator, decorator_id: data.decorator_id ?? null,
      pastry_chef: data.pastry_chef, band_dj: data.band_dj,
      photo_video: data.photo_video, bartender: data.bartender,
      other_professionals: data.other_professionals, extra_attractions: data.extra_attractions,
      witness_name: data.witness_name ?? null,
      witness_cpf: data.witness_cpf ?? null,
      witness_email: data.witness_email ?? null,
      witness_2_name: data.witness_2_name ?? null,
      witness_2_email: data.witness_2_email ?? null,
      menu_text: data.menu_text ?? null,
      menu_mode: data.menu_mode ?? 'text',
      annex_1_text: data.annex_1_text ?? null,
      schedule_text: data.schedule_text ?? null,
      pricing_mode: data.pricing_mode ?? 'per_person',
      contract_value: toNum(data.contract_value),
    }).eq('id', eid);
    if (error) { setSaveStatus('idle'); toast.error('Erro ao salvar: ' + error.message); return; }
    setSaveStatus('saved');
    toast.success('Salvo com sucesso');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  const copyContractLink = async () => {
    if (!id) return;
    let token = event?.contract_form_token;
    if (!token) {
      token = crypto.randomUUID();
      await (supabase.from as any)('events').update({ contract_form_token: token }).eq('id', id);
      setEvent(prev => prev ? { ...prev, contract_form_token: token! } : prev);
    }
    const link = `${window.location.origin}/contrato-cliente/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success('Link copiado! Cole no WhatsApp para o cliente preencher.');
  };

  const toggleDateReserved = async () => {
    if (!id || !event) return;
    const next = !event.date_reserved;
    setEvent(prev => prev ? { ...prev, date_reserved: next } : prev);
    await supabase.from('events').update({ date_reserved: next } as any).eq('id', id);
    toast.success(next ? 'Data marcada como reservada' : 'Reserva de data removida');
  };

  const changeStatus = async (newStatus: string) => {
    if (!id) return;
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === 'confirmed') {
      updates.contract_signed = true;
      updates.contract_signed_date = new Date().toISOString().split('T')[0];
      updates.date_reserved = false;
    }
    if (newStatus === 'cancelled' || newStatus === 'lost') {
      updates.date_reserved = false;
    }
    const { error } = await supabase.from('events').update(updates).eq('id', id);
    if (error) { toast.error('Erro ao alterar status: ' + error.message); return; }
    setEvent(prev => prev ? { ...prev, ...updates } : prev);
    toast.success(newStatus === 'confirmed' ? 'Evento confirmado — contrato registrado!' : 'Status atualizado');
  };

  const cancelEvent = async () => {
    if (!id) return;
    if (!confirm('Cancelar este evento? O status será alterado para CANCELADO.')) return;
    const { error } = await supabase.from('events').update({ status: 'cancelled' }).eq('id', id);
    if (error) { toast.error('Erro ao cancelar'); return; }
    setEvent(prev => prev ? { ...prev, status: 'cancelled' } : prev);
    toast.success('Evento cancelado');
  };

  const deleteEvent = async () => {
    if (!id) return;
    if (!confirm('Deletar permanentemente este evento? Esta ação não pode ser revertida.')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { toast.error('Erro ao deletar: ' + error.message); return; }
    toast.success('Evento deletado');
    navigate('/events');
  };

  const persistClient = useCallback(async (data: Record<string, string>, clientId: string) => {
    setSaveStatus('saving');
    const { error } = await supabase.from('clients').update({
      name: data.name || null, phone: data.phone || null, email: data.email || null,
      cpf: data.cpf || null, rg: data.rg || null, address: data.address || null,
      zip_code: data.zip_code || null, source: data.source || null,
    }).eq('id', clientId);
    if (error) { setSaveStatus('idle'); toast.error('Erro ao salvar: ' + error.message); return; }
    setSaveStatus('saved');
    toast.success('Salvo com sucesso');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  const setF = useCallback(<K extends keyof EventDetail>(key: K, val: any) => {
    const next = { ...formRef.current, [key]: val };
    formRef.current = next;
    setForm(next);
    if (eventTimerRef.current) clearTimeout(eventTimerRef.current);
    eventTimerRef.current = setTimeout(() => persistEvent(formRef.current), 1500);
  }, [persistEvent]);

  const s = (key: keyof EventDetail) => String(form[key] ?? '');

  const handleFichaTecnica = async () => {
    if (!event || !id) return;
    const [{ data: fieldDefs }, { data: fieldVals }, { data: companies }] = await Promise.all([
      supabase.from('event_field_definitions' as any).select('id, name, sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('event_field_values' as any).select('field_id, value').eq('event_id', id),
      supabase.from('companies').select('name, logo_base64, endereco, telefone, website').limit(1),
    ]);
    const valMap: Record<string, string> = {};
    (fieldVals ?? []).forEach((r: any) => { valMap[r.field_id] = r.value ?? ''; });
    const customFields = (fieldDefs ?? []).map((d: any) => ({ name: d.name, value: valMap[d.id] ?? '' }));
    printFichaTecnica(
      { ...event, ...form } as any,
      customFields,
      ((companies ?? [])[0] ?? null) as any,
    );
  };

  const handleFechamento = async () => {
    if (!event || !id) return;
    const [{ data: payments }, { data: additionals }, { data: companies }] = await Promise.all([
      supabase.from('event_payments' as any).select('payment_date, value, notes, is_confirmed').eq('event_id', id).order('payment_date'),
      supabase.from('event_additional_values' as any).select('description, value').eq('event_id', id),
      supabase.from('companies').select('name, logo_base64, razao_social, cnpj, banco, agencia, conta, endereco, telefone, website').limit(1),
    ]);
    printFechamento(
      { ...event, ...form },
      (payments ?? []) as any,
      (additionals ?? []) as any,
      ((companies ?? [])[0] ?? null) as any,
    );
  };

  const setC = useCallback((key: string, val: string) => {
    const next = { ...clientFormRef.current, [key]: val };
    clientFormRef.current = next;
    setClientForm(next);
    const clientId = event?.clients?.id;
    if (!clientId) return;
    if (clientTimerRef.current) clearTimeout(clientTimerRef.current);
    clientTimerRef.current = setTimeout(() => persistClient(clientFormRef.current, clientId), 1500);
  }, [event?.clients?.id, persistClient]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
  if (!event) return null;

  const contractShort = event.contract_signed_date
    ? (() => { const [y, m] = event.contract_signed_date.split('-'); return `${m}/${y.slice(2)}`; })()
    : null;
  const isClosed = ['confirmed', 'completed'].includes(event.status);
  const isPipeline = ['lead', 'negotiating', 'tasting_scheduled'].includes(event.status);
  const isLost = ['lost', 'cancelled'].includes(event.status);
  const statusLabel = event.is_paid_in_full ? 'Quitado' : STATUS_LABELS[event.status] ?? event.status;
  const stateFrom = (location.state as any)?.from;
  const stateLabel = (location.state as any)?.fromLabel;
  const backPath = stateFrom ?? (isClosed ? '/events' : '/orcamentos');
  const backLabel = stateLabel ?? (isClosed ? 'Eventos' : 'Orçamentos');

  return (
    <div className="-m-8">

      {/* TOP BAR */}
      <div className="sticky top-14 z-30 bg-white border-b border-border shadow-sm">
        <div className="px-8 py-3 flex items-center justify-between gap-4">

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
              <Link to={backPath} className="hover:text-foreground transition-colors">{backLabel}</Link>
              <span>›</span>
              <span className="text-foreground truncate">{event.event_name ?? 'Sem nome'}</span>
            </div>
            <h1 className="text-xl font-bold text-foreground truncate leading-tight">
              {event.event_name ?? 'Sem nome'}
            </h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {event.event_date && (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <CalendarDays className="w-3 h-3" />{fmtDate(event.event_date)}
                </span>
              )}
              {event.location_text && (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <MapPin className="w-3 h-3" />{event.location_text}
                </span>
              )}
              {event.guest_count && (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <Users className="w-3 h-3" />{event.guest_count} convidados
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <StatusDropdown status={event.status} onChange={changeStatus} />

            {/* Reservar data — só pipeline */}
            {isPipeline && (
              <button onClick={toggleDateReserved}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  event.date_reserved
                    ? 'bg-violet-100 text-violet-700 border-violet-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                    : 'bg-white text-muted-foreground border-border hover:bg-muted'
                }`}>
                <CalendarDays className="w-3.5 h-3.5" />
                {event.date_reserved
                  ? <><span className="group-hover:hidden">Reservado</span><span className="hidden group-hover:inline">Cancelar reserva</span></>
                  : 'Reservar data'}
              </button>
            )}

            {/* Tag de pagamento — só fechados */}
            {isClosed && (() => {
              const total = event.total_value ?? 0;
              const paid = event.paid_value ?? 0;
              const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;
              if (event.is_paid_in_full || pct >= 100)
                return <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border bg-emerald-50 text-emerald-700 border-emerald-200"><Check className="w-3 h-3" />QUITADO</span>;
              if (pct > 0)
                return <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border bg-amber-50 text-amber-700 border-amber-200">{pct}% pago</span>;
              return <span className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border bg-red-50 text-red-600 border-red-200">Não quitado</span>;
            })()}

            {/* Chamar no WhatsApp — sempre visível se tiver telefone */}
            {event.clients?.phone && (
              <button
                onClick={() => openWhatsAppLink(event.clients!.phone!, `Olá, ${event.clients!.name ?? ''}!`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border bg-white border-border text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors">
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </button>
            )}

            {/* Alocar a uma degustação — só pipeline */}
            {isPipeline && (
              <button onClick={() => setAllocTastingOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                Alocar degustação
              </button>
            )}

            {/* Ficha Técnica — imprimir */}
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden md:flex" onClick={handleFichaTecnica}>
              <FileText className="w-3 h-3" />
              Ficha Técnica
            </Button>

            {/* Dados do contrato — copia link para cliente preencher */}
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden md:flex" onClick={copyContractLink}>
              <FileText className="w-3 h-3" />
              Dados do contrato
              {event.contract_form_submitted && (
                <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Já preenchido pelo cliente" />
              )}
            </Button>
            {isClosed && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs hidden md:flex" onClick={handleFechamento}>
                <Download className="w-3 h-3" />Fechamento
              </Button>
            )}

            {saveStatus === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/50" />}

            <button onClick={() => navigate(backPath)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Banner: orçamento em andamento */}
        {isPipeline && (
          <div className="mx-8 mb-3 flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            Orçamento em negociação — contrato ainda não assinado. Confirme o evento antes de avançar.
          </div>
        )}
        {isLost && (
          <div className="mx-8 mb-3 flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-500 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
            Orçamento não fechado — nenhum contrato foi assinado.
          </div>
        )}

        {/* Tabs (part of the white header block) */}
        {(() => {
          const isClosed = ['confirmed', 'completed'].includes(event.status);
          const tabs = isClosed ? TABS_ALL : TABS_ALL.filter(t => !TABS_CLOSED_ONLY.includes(t));
          return (
        <div className="px-8 flex gap-0 -mb-px overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t}
            </button>
          ))}
        </div>
          );
        })()}
      </div>

      {/* CONTENT */}

      <div className="px-8 py-6 space-y-5">

        {/* ── FICHA TÉCNICA ── */}
        {tab === 'Ficha Técnica' && (
          <>
            {/* Card 1: Informações gerais */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <SectionTitle>Informações do Evento</SectionTitle>
                {/* Pricing mode toggle — inline no header do card */}
                <div className="flex items-center gap-2 -mt-5">
                  <span className="text-[11px] text-muted-foreground/60 font-medium">Cobrança:</span>
                  <div className="flex items-center bg-muted rounded-lg p-0.5">
                    {(['per_person', 'fixed'] as const).map(mode => (
                      <button key={mode} onClick={() => setF('pricing_mode', mode)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          (form.pricing_mode ?? 'per_person') === mode
                            ? 'bg-white shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}>
                        {mode === 'per_person' ? 'Por convidado' : 'Valor fixo'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
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

                <F label="Horário de início" value={s('ceremony_time')} onChange={v => setF('ceremony_time', v)} placeholder="15:30 hs" />
                <F label="Duração (horas)" value={s('duration_hours')} onChange={v => setF('duration_hours', v)} type="number" suffix="h" />
                <F label="Convidados" value={s('guest_count')} onChange={v => setF('guest_count', v)} type="number" />

                {/* Preço: muda conforme o modo */}
                {(form.pricing_mode ?? 'per_person') === 'per_person' ? (
                  <F label="Preço / Pax" value={s('price_per_person')} onChange={v => setF('price_per_person', v)} type="number" suffix="R$" />
                ) : (
                  <F label="Valor do contrato" value={s('contract_value')} onChange={v => setF('contract_value', v)} type="number" suffix="R$" />
                )}

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
            {id && <CustomFieldsSection eventId={id} onSaveStatus={setSaveStatus} />}
          </>
        )}

        {/* ── DADOS DO CLIENTE ── */}
        {tab === 'Dados do Cliente' && (
          <>
            {/* Dados do contratante */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <SectionTitle>Dados do Contratante</SectionTitle>
              {event.clients ? (
                <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                  <div className="col-span-2">
                    <label className={labelCls}>Nome do Contratante</label>
                    <input className={inputCls} value={clientForm.name ?? ''} onChange={e => setC('name', e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div>
                    <label className={labelCls}>Telefone com DDD</label>
                    <input className={inputCls} value={clientForm.phone ?? ''} onChange={e => setC('phone', e.target.value)} placeholder="(11) 99999-9999" />
                  </div>
                  <div>
                    <label className={labelCls}>CPF/CNPJ</label>
                    <input className={inputCls} value={clientForm.cpf ?? ''} onChange={e => setC('cpf', e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className={labelCls}>RG</label>
                    <input className={inputCls} value={clientForm.rg ?? ''} onChange={e => setC('rg', e.target.value)} placeholder="00.000.000-0" />
                  </div>
                  <div>
                    <label className={labelCls}>E-mail</label>
                    <input className={inputCls} value={clientForm.email ?? ''} onChange={e => setC('email', e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Endereço Completo</label>
                    <input className={inputCls} value={clientForm.address ?? ''} onChange={e => setC('address', e.target.value)} placeholder="Rua, número, complemento, bairro, cidade" />
                  </div>
                  <div>
                    <label className={labelCls}>CEP</label>
                    <input className={inputCls} value={clientForm.zip_code ?? ''} onChange={e => setC('zip_code', e.target.value)} placeholder="00000-000" />
                  </div>
                  <div>
                    <label className={labelCls}>De onde nos conheceu</label>
                    <input className={inputCls} value={clientForm.source ?? ''} onChange={e => setC('source', e.target.value)} placeholder="Instagram, indicação..." />
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

        {/* ── CARDÁPIO ── */}
        {tab === 'Cardápio' && (
          <div className="bg-white border border-border rounded-2xl p-6">
            {/* Mode toggle */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Cardápio do Evento</span>
              <div className="flex-1 h-px bg-border" />
              <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setF('menu_mode', 'text')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    (form.menu_mode ?? 'text') === 'text' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  Texto livre
                </button>
                <button
                  onClick={() => setF('menu_mode', 'sheets')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    form.menu_mode === 'sheets' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Fichas Técnicas
                </button>
              </div>
            </div>

            {(form.menu_mode ?? 'text') === 'text' ? (
              <RichTextEditor
                content={form.annex_1_text ?? form.menu_text ?? ''}
                onChange={val => setF('annex_1_text', val)}
                placeholder="Descreva o cardápio do evento..."
              />
            ) : (
              id && <MenuSheetsTab eventId={id} />
            )}
          </div>
        )}

        {/* ── OUTROS ── portal do cliente + ações + histórico */}
        {tab === 'Outros' && id && (
          <EventOutrosTab
            eventId={id}
            clientEmail={event.clients?.email ?? null}
            clientWhatsapp={event.clients?.phone ?? null}
            clientName={event.clients?.name ?? null}
            eventName={form.event_name ?? null}
            onCancelEvent={cancelEvent}
            onDeleteEvent={deleteEvent}
          />
        )}

        {/* ── CHECKLIST ── */}
        {tab === 'Checklist' && id && <EventChecklistTab eventId={id} />}

        {/* ── CRONOGRAMA ── */}
        {tab === 'Cronograma' && id && (
          <EventCronogramaTab
            eventId={id}
            scheduleText={form.schedule_text ?? null}
            scheduleFileUrl={form.schedule_file_url ?? null}
            scheduleFileName={form.schedule_file_name ?? null}
            onChangeText={v => setF('schedule_text', v)}
          />
        )}

        {/* ── FINANCEIRO ── */}
        {tab === 'Financeiro' && id && (
          <EventFinanceiroTab
            eventId={id}
            clientPhone={event.clients?.phone ?? null}
            clientName={event.clients?.name ?? null}
            eventName={form.event_name ?? null}
            event={{
              guest_count: form.guest_count ?? null,
              children_50_pct: form.children_50_pct ?? null,
              price_per_person: form.price_per_person ?? null,
              professional_count: form.professional_count ?? null,
              professional_meal_value: form.professional_meal_value ?? null,
              pricing_mode: form.pricing_mode ?? 'per_person',
              contract_value: form.contract_value ?? null,
            }}
            onUpdateEvent={(field, value) => setF(field as keyof EventDetail, value)}
            onTotalsChange={(total, paid) => {
              setEvent(prev => prev ? { ...prev, total_value: total, paid_value: paid } : prev);
            }}
          />
        )}

        {tab === 'Arquivos' && id && event && (
          <EventArquivosTab
            eventId={id}
            clientPhone={event.clients?.phone ?? null}
            event={{
              event_name: form.event_name ?? null,
              event_date: form.event_date ?? null,
              event_type: form.event_type ?? null,
              ceremony_time: form.ceremony_time ?? null,
              duration_hours: form.duration_hours ?? null,
              location_text: form.location_text ?? null,
              guest_count: form.guest_count ?? null,
              price_per_person: form.price_per_person ?? null,
              total_value: event.total_value ?? null,
              product_name: form.product_name ?? null,
              pricing_mode: form.pricing_mode ?? null,
              contract_value: form.contract_value ?? null,
              witness_name: form.witness_name ?? null,
              witness_cpf: form.witness_cpf ?? null,
              witness_email: form.witness_email ?? null,
              witness_2_name: form.witness_2_name ?? null,
              witness_2_email: form.witness_2_email ?? null,
              clients: event.clients ? {
                name: event.clients.name ?? null,
                cpf: event.clients.cpf ?? null,
                rg: event.clients.rg ?? null,
                address: event.clients.address ?? null,
                email: event.clients.email ?? null,
              } : null,
            }}
          />
        )}

        {/* ── EM CONSTRUÇÃO ── */}
        {['Equipe'].includes(tab) && (
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

// ── Event History Section ────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  event_name: 'Nome do Evento', event_type: 'Tipo', event_date: 'Data',
  location_id: 'Local', product_id: 'Produto', guest_count: 'Convidados',
  price_per_person: 'Preço/Pax', organizer_id: 'Assessora', decorator_id: 'Decoradora',
  notes: 'Observações', menu_text: 'Cardápio (texto)', menu_mode: 'Modo Cardápio',
  status: 'Status', ceremony_time: 'Horário Cerimônia',
};

function EventHistorySection({ eventId }: { eventId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('event_history' as any)
      .select('id, field_name, old_value, new_value, changed_at, profiles:user_id(display_name)')
      .eq('event_id', eventId)
      .order('changed_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setHistory(data ?? []); setLoading(false); });
  }, [eventId]);

  const fmtDT = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white border border-border rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Histórico de Alterações</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(h => (
            <div key={h.id} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{FIELD_LABELS[h.field_name] ?? h.field_name}</span>
                  {h.old_value && (
                    <span className="text-muted-foreground"> · de <span className="line-through text-muted-foreground/60">{h.old_value.slice(0, 60)}</span></span>
                  )}
                  {h.new_value && (
                    <span className="text-muted-foreground"> para <span className="text-foreground">{h.new_value.slice(0, 60)}</span></span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  {h.profiles?.display_name ?? 'Usuário'} · {fmtDT(h.changed_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {waTrigger && (
        <WhatsAppConfirmModal trigger={waTrigger} onClose={() => setWaTrigger(null)} />
      )}

      {allocTastingOpen && event && (
        <AllocTastingModal
          eventId={event.id}
          eventName={event.event_name ?? ''}
          onClose={() => setAllocTastingOpen(false)}
        />
      )}
    </div>
  );
}

// ── Modal: Alocar a uma degustação ────────────────────────────────────────────
type TastingSession = { id: string; scheduled_date: string | null; max_couples: number | null; current_count: number };

function AllocTastingModal({ eventId, eventName, onClose }: { eventId: string; eventName: string; onClose: () => void }) {
  const [sessions, setSessions] = useState<TastingSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      const { data: sessData } = await (supabase.from as any)('tasting_sessions')
        .select('id, scheduled_date, max_couples')
        .gte('scheduled_date', today)
        .order('scheduled_date');

      if (!sessData) { setLoading(false); return; }

      // Conta casais em cada sessão
      const counts = await Promise.all(sessData.map(async (s: any) => {
        const { count } = await (supabase.from as any)('tasting_session_events')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', s.id);
        return { ...s, current_count: count ?? 0 };
      }));

      setSessions(counts);
      setLoading(false);
    })();
  }, []);

  const alloc = async (session: TastingSession) => {
    setSaving(session.id);
    const { error } = await (supabase.from as any)('tasting_session_events')
      .insert({ session_id: session.id, event_id: eventId, situation_snapshot: 'new' });
    if (error) { toast.error('Erro ao alocar'); setSaving(null); return; }
    toast.success('Evento alocado na degustação!');
    onClose();
  };

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Alocar a uma degustação</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{eventName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma degustação agendada para os próximos dias.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => {
                const full = s.max_couples !== null && s.current_count >= s.max_couples;
                return (
                  <button key={s.id} onClick={() => !full && alloc(s)} disabled={full || saving === s.id}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                      full ? 'opacity-40 cursor-not-allowed border-border bg-muted/30'
                           : 'border-border hover:border-violet-300 hover:bg-violet-50'
                    }`}>
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {s.scheduled_date ? fmtDate(s.scheduled_date) : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.current_count}{s.max_couples ? `/${s.max_couples}` : ''} casais
                        {full && ' — lotado'}
                      </p>
                    </div>
                    {saving === s.id
                      ? <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                      : !full && <UtensilsCrossed className="w-4 h-4 text-violet-400" />
                    }
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

