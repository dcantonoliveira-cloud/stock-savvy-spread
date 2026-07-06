import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
  location_id: string | null;
  guest_count: number | null;
  children_50_pct: number | null;
  non_paying_guests: number | null;
  price_per_person: number | null;
  total_value: number | null;
  paid_value: number | null;
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

import { STATUS_LABELS, STATUS_CLS, ALL_STATUS_KEYS } from '@/lib/eventStatus';
const STATUS_CLASSES: Record<string,string> = Object.fromEntries(ALL_STATUS_KEYS.map(k => [k, STATUS_CLS(k)]));
const EVENT_TYPES = ['Aniversário','Batizado','Casamento','Confraternização','Corporativo','Debutante','Formatura','Outro'];
const EMPTY_FORM = {
  client_id: '', event_name: '', event_type: 'Casamento', status: 'lead',
  event_date: '', location_text: '', location_id: '',
  guest_count: '', children_50_pct: '0', non_paying_guests: '0',
  price_per_person: '', contract_value: '', total_value: '',
  pricing_mode: 'per_person',
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
  const { permissions } = useAuth();
  const finBlur = !permissions.access_financeiro ? 'blur-sm select-none pointer-events-none' : '';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const location = useLocation();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [searchResults, setSearchResults] = useState<EventRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [locationMap, setLocationMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState<number | null>(today.getMonth());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(['confirmed']));
  const [filterOpen, setFilterOpen] = useState(false);

  // Sheets
  const [newOpen, setNewOpen] = useState(() => !!(location.state as any)?.openNew);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventRow | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Form
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const clientSearchRef = useRef<HTMLInputElement>(null);
  const [clientQuery, setClientQuery] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationDropOpen, setLocationDropOpen] = useState(false);

  // ── Load data ────────────────────────────────────────────────────
  const loadEvents = async (y: number) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('id, event_name, event_type, status, event_date, location_text, location_id, guest_count, children_50_pct, non_paying_guests, price_per_person, total_value, paid_value, is_paid_in_full, contract_signed, contract_signed_date, notes, client_id, clients(id, name, phone, email)')
      .gte('event_date', `${y}-01-01`)
      .lte('event_date', `${y}-12-31`)
      .not('event_name', 'is', null)
      .neq('event_name', '')
      .order('event_date', { ascending: true });
    if (error) console.error('events query error:', error);
    setEvents((data as EventRow[]) ?? []);
    setLoading(false);
  };

  const loadClients = async () => {
    if (clients.length > 0) return;
    const { data } = await supabase.from('clients').select('id, name, phone, email').order('name');
    setClients((data as Client[]) ?? []);
  };

  // Busca global quando há termo de pesquisa (sem filtro de ano)
  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const q = search.trim().toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);

      const { data } = await supabase
        .from('events')
        .select('id, event_name, event_type, status, event_date, location_text, location_id, guest_count, children_50_pct, non_paying_guests, price_per_person, total_value, paid_value, is_paid_in_full, contract_signed, contract_signed_date, notes, client_id, clients(id, name, phone, email)')
        .not('event_name', 'is', null)
        .order('event_date', { ascending: false })
        .limit(300);

      const all = (data as EventRow[]) ?? [];

      // Score de similaridade: exact match > starts with > contains word > contains any char
      const score = (e: EventRow) => {
        const name     = (e.event_name ?? '').toLowerCase();
        const location = (e.location_text ?? '').toLowerCase();
        const client   = (e.clients?.name ?? '').toLowerCase();
        const haystack = [name, location, client];

        if (haystack.some(h => h === q)) return 100;
        if (haystack.some(h => h.startsWith(q))) return 80;
        if (haystack.some(h => h.includes(q))) return 60;
        const matchedWords = words.filter(w => haystack.some(h => h.includes(w)));
        if (matchedWords.length === words.length) return 40;
        if (matchedWords.length > 0) return 20 + matchedWords.length;
        return 0;
      };

      const scored = all.map(e => ({ e, s: score(e) })).filter(x => x.s > 0);
      scored.sort((a, b) => b.s - a.s);
      setSearchResults(scored.map(x => x.e));
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Carrega locais uma vez + eventos do ano inicial
  useEffect(() => {
    Promise.all([
      supabase.from('event_locations').select('id, name').order('name'),
      loadEvents(year),
    ]).then(([locRes]) => {
      const locs: { id: string; name: string }[] = locRes.data ?? [];
      setLocations(locs);
      setLocationMap(new Map(locs.map(l => [l.id, l.name])));
    });
  }, []);

  // Re-carrega eventos quando o ano muda
  useEffect(() => { loadEvents(year); }, [year]);

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

  const filtered = useMemo(() => {
    // Busca ativa: usa resultados vindos direto do banco (todos os anos)
    const pool = search.trim().length >= 2 ? searchResults : events;
    return pool.filter(e => {
      if (statusFilter.size > 0 && !statusFilter.has(e.status)) return false;
      if (search.trim().length >= 2) return true; // já filtrado pelo banco/searchResults
      if (!e.event_date) return false;
      const d = new Date(e.event_date + 'T12:00:00');
      if (d.getFullYear() !== year) return false;
      if (month !== null && d.getMonth() !== month) return false;
      return true;
    });
  }, [events, searchResults, year, month, search, statusFilter]);

  const confirmedFiltered = filtered.filter(e => e.status === 'confirmed');
  const statsValue = confirmedFiltered.reduce((s,e) => s + (e.total_value ?? 0), 0);
  const statsReceivable = confirmedFiltered.reduce((s,e) => {
    const balance = (e.total_value ?? 0) - (e.paid_value ?? 0);
    return s + (balance > 0 ? balance : 0);
  }, 0);
  const totalGuests = confirmedFiltered.reduce((s,e) => s + (e.guest_count ?? 0), 0);
  const avgPerGuest = totalGuests > 0 ? statsValue / totalGuests : 0;
  const avgPerEvent = confirmedFiltered.length > 0 ? statsValue / confirmedFiltered.length : 0;

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
    if (!form.event_date) { toast.error('Informe a data do evento'); return; }
    setSaving(true);

    let clientId = form.client_id || null;
    if (!clientId && clientQuery.trim()) {
      const { data: newClient } = await supabase.from('clients').insert({
        name: clientQuery.trim(),
        company_id: 'c56c2ccd-2c35-4ebb-b868-e153727e5d89',
      }).select('id, name, phone, email').single();
      if (newClient) {
        clientId = newClient.id;
        setClients(prev => [...prev, newClient as Client]);
      }
    }

    const payload = {
      client_id: clientId,
      event_name: form.event_name || null,
      event_type: form.event_type || null,
      status: form.status,
      event_date: form.event_date || null,
      location_text: form.location_text || null,
      location_id: form.location_id || null,
      guest_count: parseInt(form.guest_count) || null,
      children_50_pct: parseInt(form.children_50_pct) || 0,
      non_paying_guests: parseInt(form.non_paying_guests) || 0,
      pricing_mode: form.pricing_mode,
      price_per_person: form.pricing_mode === 'per_person' ? (parseFloat(form.price_per_person) || null) : null,
      contract_value: form.pricing_mode === 'fixed' ? (parseFloat(form.contract_value) || null) : null,
      total_value: form.pricing_mode === 'fixed'
        ? (parseFloat(form.contract_value) || null)
        : autoTotal > 0 ? autoTotal : parseFloat(form.total_value) || null,
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
    setLocationQuery('');
    loadEvents(year);
  };

  const navigate = useNavigate();
  const openDetail = (event: EventRow) => {
    navigate(`/events/${event.id}`);
  };

  const openEdit = (event: EventRow) => {
    loadClients();
    setDetailEvent(event);
    setEditMode(true);
    const c = clients.find(cl => cl.id === event.client_id);
    setClientQuery(c?.name ?? '');
    const locName = event.location_id ? (locationMap.get(event.location_id) ?? '') : (event.location_text ?? '');
    setLocationQuery(locName);
    setForm({
      client_id: event.client_id ?? '',
      event_name: event.event_name ?? '',
      event_type: event.event_type ?? 'Casamento',
      status: event.status,
      event_date: event.event_date ?? '',
      location_text: event.location_text ?? '',
      location_id: event.location_id ?? '',
      guest_count: String(event.guest_count ?? ''),
      children_50_pct: String(event.children_50_pct ?? '0'),
      non_paying_guests: String(event.non_paying_guests ?? '0'),
      price_per_person: String(event.price_per_person ?? ''),
      contract_value: String(event.contract_value ?? ''),
      total_value: String(event.total_value ?? ''),
      pricing_mode: event.pricing_mode ?? 'per_person',
      contract_signed: event.contract_signed ?? false,
      contract_signed_date: event.contract_signed_date ?? '',
      is_paid_in_full: event.is_paid_in_full ?? false,
      notes: event.notes ?? '',
    });
  };

  const handleDelete = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
    setDetailEvent(null);
    setDeleteId(null);
    toast.success('Evento excluído');
    loadEvents(year);
  };

  // ── Form panel (shared for new + edit) ───────────────────────────
  // Chamado como função ({renderFormPanel()}) — NÃO como <FormPanel /> — para não
  // criar um novo componente a cada render (o que remontaria os inputs e faria
  // o campo perder o foco a cada tecla digitada).
  const renderFormPanel = () => (
    <div className="flex flex-col gap-5 pb-6">

      {/* Cliente */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Cliente</label>
        <div className="relative">
          <input
            ref={clientSearchRef}
            value={clientQuery}
            onChange={e => {
              const v = e.target.value;
              setClientQuery(v);
              setClientDropOpen(true);
              setF('client_id', '');
              if (!form.event_name) setF('event_name', v);
            }}
            onFocus={() => setClientDropOpen(true)}
            onBlur={() => setTimeout(() => setClientDropOpen(false), 150)}
            placeholder="Nome do cliente..."
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
        <div className="relative">
          <input
            value={locationQuery}
            onChange={e => { setLocationQuery(e.target.value); setLocationDropOpen(true); setF('location_id', ''); setF('location_text', e.target.value); }}
            onFocus={() => setLocationDropOpen(true)}
            onBlur={() => setTimeout(() => setLocationDropOpen(false), 150)}
            placeholder="Buscar ou criar local..."
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {form.location_id && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-medium">✓</span>
          )}
          {locationDropOpen && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
              {locations
                .filter(l => !locationQuery || l.name.toLowerCase().includes(locationQuery.toLowerCase()))
                .map(l => (
                  <button
                    key={l.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 text-left"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setF('location_id', l.id); setF('location_text', l.name); setLocationQuery(l.name); setLocationDropOpen(false); }}
                  >
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>{l.name}</span>
                  </button>
                ))}
              {locationQuery.trim() && !locations.some(l => l.name.toLowerCase() === locationQuery.trim().toLowerCase()) && (
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-primary/5 text-primary text-left font-medium border-t border-border"
                  onMouseDown={e => e.preventDefault()}
                  onClick={async () => {
                    const name = locationQuery.trim();
                    const { data, error } = await supabase.from('event_locations' as any).insert({ name, company_id: 'c56c2ccd-2c35-4ebb-b868-e153727e5d89' }).select('id, name').single();
                    if (error || !data) { toast.error('Erro ao criar local'); return; }
                    const newLoc = data as { id: string; name: string };
                    setLocations(prev => [...prev, newLoc].sort((a, b) => a.name.localeCompare(b.name)));
                    setLocationMap(prev => new Map([...prev, [newLoc.id, newLoc.name]]));
                    setF('location_id', newLoc.id);
                    setF('location_text', newLoc.name);
                    setLocationQuery(newLoc.name);
                    setLocationDropOpen(false);
                    toast.success('Local criado!');
                  }}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  Criar "{locationQuery.trim()}"
                </button>
              )}
              {!locationQuery && locations.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum local cadastrado. Digite para criar.</p>
              )}
            </div>
          )}
        </div>
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

      {/* Modo de cobrança */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Modo de Cobrança</label>
        <div className="flex items-center bg-muted rounded-xl p-1 gap-1 w-fit">
          {(['per_person', 'fixed'] as const).map(mode => (
            <button key={mode} type="button" onClick={() => setF('pricing_mode', mode)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                form.pricing_mode === mode ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {mode === 'per_person' ? 'Por convidado' : 'Valor fixo'}
            </button>
          ))}
        </div>
      </div>

      {/* Preço */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          {form.pricing_mode === 'per_person' ? (
            <>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Preço por pessoa (R$)</label>
              <Input type="number" min="0" step="0.01" value={form.price_per_person} onChange={e => setF('price_per_person', e.target.value)} placeholder="0,00" className="h-9" />
            </>
          ) : (
            <>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Valor do contrato (R$)</label>
              <Input type="number" min="0" step="0.01" value={form.contract_value} onChange={e => setF('contract_value', e.target.value)} placeholder="0,00" className="h-9" />
            </>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Valor Total</label>
          <div className="h-9 px-3 rounded-lg border border-border bg-muted/30 flex items-center text-sm font-semibold text-primary">
            {form.pricing_mode === 'fixed'
              ? (form.contract_value ? fmtBRL(parseFloat(form.contract_value)) : '—')
              : autoTotal > 0 ? fmtBRL(autoTotal) : form.total_value ? fmtBRL(parseFloat(form.total_value)) : '—'}
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
    <div className="flex gap-6 min-h-[calc(100vh-56px)]">

      {/* ── Sidebar mensal ── */}
      <aside className="w-48 shrink-0 self-start sticky top-6">
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <button onClick={() => setYear(y => y-1)} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground">{year}</span>
          <button onClick={() => setYear(y => y+1)} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <nav className="px-2 py-2 space-y-0.5">
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
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

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
          <Button onClick={() => { setForm({...EMPTY_FORM}); setClientQuery(''); setLocationQuery(''); setNewOpen(true); loadClients(); }}
            className="gap-1.5 shrink-0 rounded-lg h-9 px-4">
            <Plus className="w-4 h-4" />
            Novo Evento
          </Button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
          {/* Eventos */}
          <div className="bg-white rounded-2xl border border-border px-5 py-4 flex flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">Eventos</p>
            <p className="text-2xl font-bold text-foreground leading-none">{filtered.length}</p>
          </div>

          {/* Convidados */}
          <div className="bg-white rounded-2xl border border-border px-5 py-4 flex flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">Convidados</p>
            <p className="text-2xl font-bold text-emerald-600 leading-none">{totalGuests.toLocaleString('pt-BR')}</p>
          </div>

          {/* Ticket médio */}
          <div className="bg-white rounded-2xl border border-border px-5 py-4 flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">Ticket médio</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Por convidado</span>
                <span className={`text-sm font-bold text-primary ${finBlur} transition-all`}>{fmtBRL(avgPerGuest)}</span>
              </div>
              <div className="h-px bg-border/60" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Por evento</span>
                <span className={`text-sm font-bold text-primary ${finBlur} transition-all`}>{fmtBRL(avgPerEvent)}</span>
              </div>
            </div>
          </div>

          {/* Valor confirmado */}
          <div className="bg-white rounded-2xl border border-border px-5 py-4 flex flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">Confirmado</p>
            <p className={`text-lg font-bold text-primary leading-none ${finBlur} transition-all`}>{fmtBRL(statsValue)}</p>
          </div>

          {/* A receber */}
          <div className="bg-white rounded-2xl border border-border px-5 py-4 flex flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">A receber</p>
            <p className={`text-lg font-bold text-amber-600 leading-none ${finBlur} transition-all`}>{fmtBRL(statsReceivable)}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left whitespace-nowrap">DATA</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left">NOME DO EVENTO</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left hidden lg:table-cell">LOCAL</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left hidden xl:table-cell">TIPO</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-right whitespace-nowrap">R$/PAX</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-right">PAX</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-center">STATUS</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-center hidden lg:table-cell">FECHAMENTO</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-center">PGTO</th>
                <th className="w-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading || searchLoading ? (
                Array.from({length:8}).map((_,i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[
                      'px-3 py-2.5','px-3 py-2.5','px-3 py-2.5 hidden lg:table-cell','px-3 py-2.5 hidden xl:table-cell',
                      'px-3 py-2.5','px-3 py-2.5','px-3 py-2.5','px-3 py-2.5 hidden lg:table-cell','px-3 py-2.5','px-3 py-2.5'
                    ].map((cls,j) => (
                      <td key={j} className={cls}>
                        <div className="h-3 bg-muted/40 rounded animate-pulse w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-20 text-center">
                  <CalendarX className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">
                    {search.trim().length >= 2
                      ? `Nenhum evento encontrado para "${search}"`
                      : 'Nenhum evento neste período'}
                  </p>
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
                      isToday_ ? 'bg-primary/5 hover:bg-primary/15'
                      : past ? 'opacity-55 hover:opacity-90 hover:bg-slate-100'
                      : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* DATA */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-xs ${isToday_ ? 'font-bold text-primary' : past ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>
                        {fmtDate(ev.event_date)}
                      </span>
                      {isToday_ && <span className="ml-1 text-[9px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded">Hoje</span>}
                    </td>
                    {/* NOME DO EVENTO */}
                    <td className="px-3 py-2 max-w-[160px]">
                      <span className={`text-xs font-medium truncate block ${past ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {ev.event_name ?? ev.clients?.name ?? '—'}
                      </span>
                    </td>
                    {/* LOCAL — oculto em telas pequenas */}
                    <td className="px-3 py-2 hidden lg:table-cell max-w-[110px]">
                      <span className="text-xs text-muted-foreground truncate block">{(ev.location_id ? locationMap.get(ev.location_id) : null) || ev.location_text || '—'}</span>
                    </td>
                    {/* TIPO — oculto abaixo de xl */}
                    <td className="px-3 py-2 hidden xl:table-cell">
                      <span className="text-xs text-muted-foreground">{ev.event_type || '—'}</span>
                    </td>
                    {/* PREÇO/PAX */}
                    <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap text-xs">
                      {fmtBRL(ev.price_per_person)}
                    </td>
                    {/* CONVIDADOS */}
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {ev.guest_count ?? '—'}
                    </td>
                    {/* STATUS */}
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CLASSES[ev.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {STATUS_LABELS[ev.status] ?? ev.status}
                      </span>
                    </td>
                    {/* FECHAMENTO — oculto em telas pequenas */}
                    <td className="px-3 py-2 text-center hidden lg:table-cell">
                      {contractShort
                        ? <span className="text-[11px] font-mono text-muted-foreground">{contractShort}</span>
                        : <span className="text-muted-foreground/30 text-xs">—</span>}
                    </td>
                    {/* PGTO % */}
                    <td className="px-3 py-2 text-center">
                      {(() => {
                        const total = ev.total_value ?? 0;
                        const paid = ev.paid_value ?? 0;
                        const rawPct = total > 0 ? Math.round((paid / total) * 100) : 0;
                        // Pagou a mais
                        if (rawPct > 100)
                          return (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="inline-flex items-center gap-1 text-[12px] font-bold text-violet-600">
                                <CheckCircle2 className="w-3 h-3"/>+{rawPct - 100}%
                              </span>
                              <span className="text-[10px] text-violet-400">a mais</span>
                            </div>
                          );
                        if (ev.is_paid_in_full || rawPct >= 100)
                          return <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600"><CheckCircle2 className="w-3 h-3"/>100%</span>;
                        if (rawPct === 0)
                          return <span className="text-[12px] font-semibold text-amber-600">0%</span>;
                        return (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[12px] font-semibold text-amber-600">{rawPct}%</span>
                            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${rawPct}%` }} />
                            </div>
                          </div>
                        );
                      })()}
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
          {renderFormPanel()}
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
                    <button onClick={() => setDeleteId(detailEvent.id)} className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors" title="Excluir">
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
                  <div className={finBlur}>
                    <InfoCard icon={DollarSign} label="Preço/pessoa" value={fmtBRL(detailEvent.price_per_person)} />
                  </div>
                  <div className={finBlur}>
                    <InfoCard icon={DollarSign} label="Valor Total" value={fmtBRL(detailEvent.total_value)} accent />
                  </div>
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
                {renderFormPanel()}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O evento e todos os dados vinculados serão removidos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
