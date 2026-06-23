import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  Search, Plus, ChevronLeft, ChevronRight,
  CalendarDays, CheckCircle2, MoreVertical,
  Download, SlidersHorizontal, CalendarX,
  MapPin, Users, DollarSign, FileText, X,
  Phone, Mail, Edit2, Trash2, ClipboardCheck, Filter,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
type EventRow = {
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
  is_paid_in_full: boolean | null;
  contract_signed: boolean | null;
  contract_signed_date: string | null;
  notes: string | null;
  client_id: string | null;
  clients: { id: string; name: string; phone: string | null; email: string | null } | null;
};

type Client = { id: string; name: string; phone: string | null; email: string | null };

// ── Constants ──────────────────────────────────────────────────────
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const STATUS_LABELS: Record<string,string> = {
  lead: '1º Contato', negotiating: 'Negociando', confirmed: 'Confirmado', cancelled: 'Cancelado',
};
const STATUS_CLASSES: Record<string,string> = {
  lead: 'bg-blue-100 text-blue-700',
  negotiating: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};
const EVENT_TYPES = ['Casamento','Formatura','Aniversário','Corporativo','Debutante','Batizado','Confraternização','Outro'];
const EMPTY_FORM = {
  client_id: '', event_name: '', event_type: 'Casamento', status: 'lead',
  event_date: '', location_text: '',
  guest_count: '', children_50_pct: '0', non_paying_guests: '0',
  price_per_person: '', total_value: '',
  contract_signed: false, contract_signed_date: '', is_paid_in_full: false,
  notes: '',
};

// ── Helpers ────────────────────────────────────────────────────────
const fmtBRL = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const fmtShort = (d: string | null) => {
  if (!d) return null;
  const dt = new Date(d + 'T12:00:00');
  return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getFullYear()).slice(2)}`;
};
const calcTotal = (guests: string, children: string, nonPaying: string, price: string) => {
  const g = parseFloat(guests) || 0;
  const c = parseFloat(children) || 0;
  const n = parseFloat(nonPaying) || 0;
  const p = parseFloat(price) || 0;
  return (g - n - c * 0.5) * p;
};

// ══════════════════════════════════════════════════════════════════
export default function EventsPage() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const [events, setEvents] = useState<EventRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState<number | null>(today.getMonth());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(['confirmed']));
  const [filterOpen, setFilterOpen] = useState(false);

  // Sheets
  const [newOpen, setNewOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<EventRow | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Form
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const clientSearchRef = useRef<HTMLInputElement>(null);
  const [clientQuery, setClientQuery] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);

  // ── Load data ────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    const [evRes, clRes] = await Promise.all([
      supabase.from('events')
        .select('id, event_name, event_type, status, event_date, location_text, guest_count, children_50_pct, non_paying_guests, price_per_person, total_value, is_paid_in_full, contract_signed, contract_signed_date, notes, client_id, clients(id, name, phone, email)')
        .order('event_date', { ascending: true }),
      supabase.from('clients').select('id, name, phone, email').order('name'),
    ]);
    setEvents((evRes.data as EventRow[]) ?? []);
    setClients((clRes.data as Client[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // ── Derived data ─────────────────────────────────────────────────
  const monthsWithEvents = useMemo(() => {
    const s = new Set<number>();
    events.forEach(e => {
      if (!e.event_date) return;
      const d = new Date(e.event_date + 'T12:00:00');
      if (d.getFullYear() === year) s.add(d.getMonth());
    });
    return s;
  }, [events, year]);

  const filtered = useMemo(() => events.filter(e => {
    if (statusFilter.size > 0 && !statusFilter.has(e.status)) return false;
    if (!e.event_date) return month === null;
    const d = new Date(e.event_date + 'T12:00:00');
    if (d.getFullYear() !== year) return false;
    if (month !== null && d.getMonth() !== month) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (e.event_name ?? '').toLowerCase().includes(q) ||
        (e.clients?.name ?? '').toLowerCase().includes(q) ||
        (e.location_text ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [events, year, month, search, statusFilter]);

  const confirmedFiltered = filtered.filter(e => e.status === 'confirmed');
  const statsValue = confirmedFiltered.reduce((s,e) => s + (e.total_value ?? 0), 0);
  const statsReceivable = confirmedFiltered.filter(e => !e.is_paid_in_full).reduce((s,e) => s + (e.total_value ?? 0), 0);

  // ── Form helpers ──────────────────────────────────────────────────
  const setF = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const autoTotal = useMemo(() =>
    calcTotal(form.guest_count, form.children_50_pct, form.non_paying_guests, form.price_per_person),
    [form.guest_count, form.children_50_pct, form.non_paying_guests, form.price_per_person]
  );

  const filteredClients = useMemo(() =>
    clients.filter(c => c.name.toLowerCase().includes(clientQuery.toLowerCase())).slice(0, 8),
    [clients, clientQuery]
  );

  const selectedClient = clients.find(c => c.id === form.client_id);

  // ── Save event ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.client_id) { toast.error('Selecione um cliente'); return; }
    if (!form.event_date) { toast.error('Informe a data do evento'); return; }
    setSaving(true);

    const payload = {
      client_id: form.client_id || null,
      event_name: form.event_name || null,
      event_type: form.event_type || null,
      status: form.status,
      event_date: form.event_date || null,
      location_text: form.location_text || null,
      guest_count: parseInt(form.guest_count) || null,
      children_50_pct: parseInt(form.children_50_pct) || 0,
      non_paying_guests: parseInt(form.non_paying_guests) || 0,
      price_per_person: parseFloat(form.price_per_person) || null,
      total_value: autoTotal > 0 ? autoTotal : parseFloat(form.total_value) || null,
      contract_signed: form.contract_signed,
      contract_signed_date: form.contract_signed_date || null,
      is_paid_in_full: form.is_paid_in_full,
      notes: form.notes || null,
    };

    if (editMode && detailEvent) {
      const { error } = await supabase.from('events').update(payload).eq('id', detailEvent.id);
      if (error) { toast.error('Erro ao salvar: ' + error.message); setSaving(false); return; }
      toast.success('Evento atualizado!');
      setEditMode(false);
    } else {
      const { error } = await supabase.from('events').insert(payload);
      if (error) { toast.error('Erro ao criar: ' + error.message); setSaving(false); return; }
      toast.success('Evento criado!');
      setNewOpen(false);
    }

    setSaving(false);
    setForm({ ...EMPTY_FORM });
    setClientQuery('');
    load();
  };

  const openDetail = (event: EventRow) => {
    setDetailEvent(event);
    setEditMode(false);
  };

  const openEdit = (event: EventRow) => {
    setDetailEvent(event);
    setEditMode(true);
    const c = clients.find(cl => cl.id === event.client_id);
    setClientQuery(c?.name ?? '');
    setForm({
      client_id: event.client_id ?? '',
      event_name: event.event_name ?? '',
      event_type: event.event_type ?? 'Casamento',
      status: event.status,
      event_date: event.event_date ?? '',
      location_text: event.location_text ?? '',
      guest_count: String(event.guest_count ?? ''),
      children_50_pct: String(event.children_50_pct ?? '0'),
      non_paying_guests: String(event.non_paying_guests ?? '0'),
      price_per_person: String(event.price_per_person ?? ''),
      total_value: String(event.total_value ?? ''),
      contract_signed: event.contract_signed ?? false,
      contract_signed_date: event.contract_signed_date ?? '',
      is_paid_in_full: event.is_paid_in_full ?? false,
      notes: event.notes ?? '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este evento?')) return;
    await supabase.from('events').delete().eq('id', id);
    setDetailEvent(null);
    toast.success('Evento excluído');
    load();
  };

  // ── Form panel (shared for new + edit) ───────────────────────────
  const FormPanel = () => (
    <div className="flex flex-col gap-5 pb-6">

      {/* Cliente */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Cliente *</label>
        <div className="relative">
          <input
            ref={clientSearchRef}
            value={clientQuery}
            onChange={e => { setClientQuery(e.target.value); setClientDropOpen(true); setF('client_id',''); }}
            onFocus={() => setClientDropOpen(true)}
            placeholder="Buscar cliente..."
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {form.client_id && selectedClient && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-medium">✓</span>
          )}
          {clientDropOpen && clientQuery && filteredClients.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-border rounded-lg shadow-lg overflow-hidden">
              {filteredClients.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 text-left"
                  onClick={() => { setF('client_id', c.id); setClientQuery(c.name); setClientDropOpen(false); }}
                >
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {c.name.split(' ').map(w=>w[0]).slice(0,2).join('')}
                  </span>
                  <span className="font-medium">{c.name}</span>
                  {c.phone && <span className="text-muted-foreground text-xs ml-auto">{c.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nome e Tipo */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Nome do Evento</label>
          <Input value={form.event_name} onChange={e => setF('event_name', e.target.value)} placeholder="Ex: João e Maria" className="h-9" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Tipo</label>
          <select value={form.event_type} onChange={e => setF('event_type', e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
            {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Data e Status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Data do Evento *</label>
          <Input type="date" value={form.event_date} onChange={e => setF('event_date', e.target.value)} className="h-9" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Status</label>
          <select value={form.status} onChange={e => setF('status', e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
            {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Local */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Local do Evento</label>
        <Input value={form.location_text} onChange={e => setF('location_text', e.target.value)} placeholder="Ex: Fazenda São José" className="h-9" />
      </div>

      {/* Convidados */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Convidados</label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground mb-1 block">Total</span>
            <Input type="number" min="0" value={form.guest_count} onChange={e => setF('guest_count', e.target.value)} placeholder="0" className="h-9" />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground mb-1 block">Crianças 50%</span>
            <Input type="number" min="0" value={form.children_50_pct} onChange={e => setF('children_50_pct', e.target.value)} placeholder="0" className="h-9" />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground mb-1 block">Não pagantes</span>
            <Input type="number" min="0" value={form.non_paying_guests} onChange={e => setF('non_paying_guests', e.target.value)} placeholder="0" className="h-9" />
          </div>
        </div>
      </div>

      {/* Preço */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Preço por pessoa (R$)</label>
          <Input type="number" min="0" step="0.01" value={form.price_per_person} onChange={e => setF('price_per_person', e.target.value)} placeholder="0,00" className="h-9" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Valor Total</label>
          <div className="h-9 px-3 rounded-lg border border-border bg-muted/30 flex items-center text-sm font-semibold text-primary">
            {autoTotal > 0 ? fmtBRL(autoTotal) : form.total_value ? fmtBRL(parseFloat(form.total_value)) : '—'}
          </div>
        </div>
      </div>

      {/* Contrato */}
      <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contrato & Pagamento</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.contract_signed} onChange={e => setF('contract_signed', e.target.checked)}
              className="w-4 h-4 rounded accent-primary" />
            <span className="text-sm text-foreground">Contrato assinado</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_paid_in_full} onChange={e => setF('is_paid_in_full', e.target.checked)}
              className="w-4 h-4 rounded accent-primary" />
            <span className="text-sm text-foreground">Quitado</span>
          </label>
        </div>
        {form.contract_signed && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Data da assinatura</label>
            <Input type="date" value={form.contract_signed_date} onChange={e => setF('contract_signed_date', e.target.value)} className="h-9" />
          </div>
        )}
      </div>

      {/* Observações */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Observações</label>
        <textarea
          value={form.notes}
          onChange={e => setF('notes', e.target.value)}
          placeholder="Informações adicionais sobre o evento..."
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full h-10 font-semibold rounded-lg">
        {saving ? 'Salvando...' : editMode ? 'Salvar Alterações' : 'Criar Evento'}
      </Button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex gap-0 -mx-8 -mt-8 min-h-[calc(100vh-56px)]">

      {/* ── Sidebar mensal ── */}
      <aside className="w-52 shrink-0 border-r border-border bg-card/60 pt-6 pb-4 flex flex-col">
        <div className="flex items-center justify-between px-4 mb-4">
          <button onClick={() => setYear(y => y-1)} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground">{year}</span>
          <button onClick={() => setYear(y => y+1)} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          <button
            onClick={() => setMonth(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              month === null ? 'bg-primary text-white font-semibold' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            Ano Completo
          </button>

          {MONTHS.map((name, idx) => {
            const isCurrent = idx === today.getMonth() && year === today.getFullYear();
            const isPast = year < today.getFullYear() || (year === today.getFullYear() && idx < today.getMonth());
            const isSelected = month === idx;
            const hasEvents = monthsWithEvents.has(idx);
            return (
              <button
                key={idx}
                onClick={() => setMonth(idx)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isSelected ? 'bg-primary text-white font-semibold'
                  : isPast ? 'text-muted-foreground/55 hover:bg-muted hover:text-muted-foreground'
                  : isCurrent ? 'text-primary font-semibold hover:bg-primary/8'
                  : 'text-foreground/80 hover:bg-muted'
                }`}
              >
                <span className={`w-3.5 h-3.5 shrink-0 rounded-sm border flex items-center justify-center ${
                  isSelected ? 'border-white bg-white'
                  : isPast ? 'border-muted-foreground/30 bg-muted-foreground/10'
                  : isCurrent ? 'border-primary bg-primary/10'
                  : 'border-border'
                }`}>
                  {(isPast || isSelected) && (
                    <svg className={`w-2 h-2 ${isSelected ? 'text-primary' : 'text-muted-foreground/40'}`} fill="none" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 4l2 2 4-4"/>
                    </svg>
                  )}
                </span>
                <span className="flex-1 text-left">{name}</span>
                {hasEvents && !isSelected && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPast ? 'bg-muted-foreground/30' : 'bg-primary/50'}`} />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col pt-6 px-6 pb-6 min-w-0">

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, cliente ou local..."
              className="pl-9 bg-white h-9" />
          </div>
          <button className="p-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors text-muted-foreground" title="Exportar">
            <Download className="w-4 h-4" />
          </button>
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(o => !o)}
              className={`relative p-2 rounded-lg border transition-colors ${
                statusFilter.size !== 1 || !statusFilter.has('confirmed')
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-white hover:bg-muted text-muted-foreground'
              }`}
              title="Filtrar por status"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {(statusFilter.size !== 1 || !statusFilter.has('confirmed')) && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                  {statusFilter.size === 0 ? '4' : statusFilter.size}
                </span>
              )}
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 w-52 bg-white border border-border rounded-xl shadow-xl p-3 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">Filtrar por status</p>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => {
                    const active = statusFilter.has(key);
                    return (
                      <label key={key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {
                            setStatusFilter(prev => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key); else next.add(key);
                              return next;
                            });
                          }}
                          className="w-3.5 h-3.5 accent-primary"
                        />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASSES[key]}`}>{label}</span>
                      </label>
                    );
                  })}
                  <div className="pt-2 border-t border-border flex gap-2">
                    <button onClick={() => { setStatusFilter(new Set(['confirmed'])); setFilterOpen(false); }}
                      className="flex-1 text-[11px] py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground font-medium">
                      Resetar
                    </button>
                    <button onClick={() => setStatusFilter(new Set(Object.keys(STATUS_LABELS)))}
                      className="flex-1 text-[11px] py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium">
                      Todos
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <Button onClick={() => { setForm({...EMPTY_FORM}); setClientQuery(''); setNewOpen(true); }}
            className="gap-1.5 shrink-0 rounded-lg h-9 px-4">
            <Plus className="w-4 h-4" />
            Novo Evento
          </Button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Neste período', value: filtered.length, cls: 'text-foreground text-xl' },
            { label: 'Confirmados', value: confirmedFiltered.length, cls: 'text-emerald-700 text-xl' },
            { label: 'Valor confirmado', value: fmtBRL(statsValue), cls: 'text-primary text-base' },
            { label: 'A receber', value: fmtBRL(statsReceivable), cls: 'text-amber-700 text-base' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-border px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-0.5">{s.label}</p>
              <p className={`font-bold leading-tight ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {['DATA','NOME DO EVENTO','LOCAL DO EVENTO','TIPO DO EVENTO','PREÇO/PAX','CONVIDADOS','STATUS','FECHAMENTO','PGTO %',''].map(h => (
                  <th key={h} className={`px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide whitespace-nowrap ${
                    h === 'PREÇO/PAX' || h === 'CONVIDADOS' ? 'text-right'
                    : h === 'STATUS' || h === 'FECHAMENTO' || h === 'PGTO %' ? 'text-center'
                    : 'text-left'
                  }`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:8}).map((_,i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[50,32,25,18,14,12,14,10,10,4].map((w,j) => (
                      <td key={j} className="px-4 py-2.5">
                        <div className="h-3 bg-muted/40 rounded animate-pulse" style={{width:`${w}%`}} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-20 text-center">
                  <CalendarX className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Nenhum evento neste período</p>
                </td></tr>
              ) : filtered.map(ev => {
                const past = !!ev.event_date && ev.event_date < todayStr;
                const isToday_ = ev.event_date === todayStr;
                const contractShort = fmtShort(ev.contract_signed_date);
                return (
                  <tr
                    key={ev.id}
                    onClick={() => openDetail(ev)}
                    className={`border-b border-border/50 cursor-pointer group transition-colors ${
                      isToday_ ? 'bg-primary/5 hover:bg-primary/8'
                      : past ? 'opacity-55 hover:opacity-80 hover:bg-muted/20'
                      : 'hover:bg-primary/4'
                    }`}
                  >
                    {/* DATA */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`text-sm ${isToday_ ? 'font-bold text-primary' : past ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>
                        {fmtDate(ev.event_date)}
                      </span>
                      {isToday_ && <span className="ml-1.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Hoje</span>}
                    </td>
                    {/* NOME DO EVENTO — só uma linha */}
                    <td className="px-4 py-2">
                      <span className={`text-sm font-medium truncate max-w-[200px] block ${past ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {ev.event_name ?? ev.clients?.name ?? '—'}
                      </span>
                    </td>
                    {/* LOCAL */}
                    <td className="px-4 py-2">
                      <span className="text-sm text-muted-foreground truncate max-w-[130px] block">{ev.location_text || '—'}</span>
                    </td>
                    {/* TIPO */}
                    <td className="px-4 py-2">
                      <span className="text-sm text-muted-foreground">{ev.event_type || '—'}</span>
                    </td>
                    {/* PREÇO/PAX */}
                    <td className="px-4 py-2 text-right font-medium text-foreground whitespace-nowrap text-sm">
                      {fmtBRL(ev.price_per_person)}
                    </td>
                    {/* CONVIDADOS */}
                    <td className="px-4 py-2 text-right text-sm text-muted-foreground">
                      {ev.guest_count ?? '—'}
                    </td>
                    {/* STATUS */}
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_CLASSES[ev.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {STATUS_LABELS[ev.status] ?? ev.status}
                      </span>
                    </td>
                    {/* FECHAMENTO — mês/ano do contrato */}
                    <td className="px-4 py-2 text-center">
                      {contractShort
                        ? <span className="text-[12px] font-mono text-muted-foreground">{contractShort}</span>
                        : <span className="text-muted-foreground/30 text-xs">—</span>}
                    </td>
                    {/* PGTO % */}
                    <td className="px-4 py-2 text-center">
                      {ev.status === 'confirmed' ? (
                        ev.is_paid_in_full
                          ? <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600">
                              <CheckCircle2 className="w-3 h-3"/>100%
                            </span>
                          : <span className="text-[12px] font-semibold text-amber-600">0%</span>
                      ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                    </td>
                    {/* AÇÕES */}
                    <td className="px-2 py-2">
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(ev); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all text-muted-foreground"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-right">
            {filtered.length} evento{filtered.length !== 1 ? 's' : ''} · eventos passados com opacidade reduzida
          </p>
        )}
      </div>

      {/* ── Sheet: Novo Evento ── */}
      <Sheet open={newOpen} onOpenChange={o => { setNewOpen(o); if (!o) setClientDropOpen(false); }}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-lg font-bold text-foreground">Novo Evento</SheetTitle>
          </SheetHeader>
          <FormPanel />
        </SheetContent>
      </Sheet>

      {/* ── Sheet: Detalhe do evento ── */}
      <Sheet open={!!detailEvent} onOpenChange={o => { if (!o) { setDetailEvent(null); setEditMode(false); } }}>
        <SheetContent side="right" className="w-[520px] sm:max-w-[520px] overflow-y-auto p-0">
          {detailEvent && !editMode && (
            <>
              {/* Header colorido */}
              <div className={`px-6 pt-6 pb-5 ${STATUS_CLASSES[detailEvent.status]?.split(' ')[0] ?? 'bg-muted/30'}`}>
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_CLASSES[detailEvent.status] ?? 'bg-white/60'}`}>
                    {STATUS_LABELS[detailEvent.status] ?? detailEvent.status}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(detailEvent)} className="p-1.5 rounded-lg hover:bg-white/40 transition-colors" title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(detailEvent.id)} className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDetailEvent(null)} className="p-1.5 rounded-lg hover:bg-white/40 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-foreground leading-tight">
                  {detailEvent.clients?.name ?? detailEvent.event_name ?? '—'}
                </h2>
                {detailEvent.event_name && detailEvent.clients?.name && (
                  <p className="text-sm text-muted-foreground mt-0.5">{detailEvent.event_name}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                  <CalendarDays className="w-4 h-4" />
                  {fmtDate(detailEvent.event_date)}
                  {detailEvent.event_type && <span className="mx-1">·</span>}
                  {detailEvent.event_type}
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">

                {/* Cliente */}
                {detailEvent.clients && (
                  <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cliente</p>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {detailEvent.clients.name.split(' ').map(w=>w[0]).slice(0,2).join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{detailEvent.clients.name}</p>
                        {detailEvent.clients.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3"/>{detailEvent.clients.phone}
                          </p>
                        )}
                        {detailEvent.clients.email && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3"/>{detailEvent.clients.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <InfoCard icon={MapPin} label="Local" value={detailEvent.location_text || '—'} />
                  <InfoCard icon={Users} label="Convidados" value={
                    detailEvent.guest_count
                      ? `${detailEvent.guest_count} pax${(detailEvent.children_50_pct||0) > 0 ? ` · ${detailEvent.children_50_pct} cri 50%` : ''}${(detailEvent.non_paying_guests||0) > 0 ? ` · ${detailEvent.non_paying_guests} cortesia` : ''}`
                      : '—'
                  } />
                  <InfoCard icon={DollarSign} label="Preço/pessoa" value={fmtBRL(detailEvent.price_per_person)} />
                  <InfoCard icon={DollarSign} label="Valor Total" value={fmtBRL(detailEvent.total_value)} accent />
                </div>

                {/* Contrato & Pagamento */}
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contrato & Pagamento</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4"/>Contrato assinado</span>
                    {detailEvent.contract_signed
                      ? <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/>Sim {detailEvent.contract_signed_date ? `· ${fmtDate(detailEvent.contract_signed_date)}` : ''}</span>
                      : <span className="text-xs text-muted-foreground">Não</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5"><DollarSign className="w-4 h-4"/>Pagamento</span>
                    {detailEvent.is_paid_in_full
                      ? <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/>Quitado</span>
                      : <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pendente</span>}
                  </div>
                </div>

                {/* Observações */}
                {detailEvent.notes && (
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5"/>Observações
                    </p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{detailEvent.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Modo edição */}
          {detailEvent && editMode && (
            <>
              <div className="flex items-center justify-between px-6 pt-6 mb-6">
                <h2 className="text-lg font-bold text-foreground">Editar Evento</h2>
                <button onClick={() => setEditMode(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6">
                <FormPanel />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border p-3 bg-muted/10">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
