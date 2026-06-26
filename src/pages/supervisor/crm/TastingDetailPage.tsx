import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Plus, Trash2, ExternalLink, Search, Loader2, Check } from 'lucide-react';
import { createPortal } from 'react-dom';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Session {
  id: string;
  scheduled_date: string;
  type: string | null;
  max_couples: number | null;
  menu_text: string | null;
  notes: string | null;
  location: string | null;
  responsible: string | null;
  cost_per_couple: number | null;
}

interface SessionEvent {
  id: string;
  session_id: string;
  event_id: string | null;
  situation_snapshot: string | null;
  guest_count: number | null;
  paid_amount: number | null;
  is_second_tasting: boolean | null;
  events: {
    id: string;
    event_name: string | null;
    event_date: string | null;
    status: string;
    organizer: string | null;
  } | null;
}

const PIPELINE = ['lead', 'negotiating', 'tasting_scheduled'];
const CLOSED   = ['confirmed', 'completed'];

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  lead:              { label: '1° Contato', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  negotiating:       { label: 'Negociando', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  tasting_scheduled: { label: 'Degustação', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  confirmed:         { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed:         { label: 'Concluído',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  cancelled:         { label: 'Cancelado',  cls: 'bg-red-50 text-red-500 border-red-200' },
};

const SITUATION_CFG: Record<string, { label: string; cls: string }> = {
  new:       { label: 'Cliente novo',    cls: 'text-muted-foreground' },
  confirmed: { label: 'Evento fechado',  cls: 'text-emerald-600 font-semibold' },
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${String(y).slice(2)}`;
};

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TastingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession]   = useState<Session | null>(null);
  const [rows, setRows]         = useState<SessionEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'guests' | 'menu' | 'info'>('guests');
  const [allocOpen, setAllocOpen] = useState(false);
  const [menuText, setMenuText]       = useState('');
  const [notes, setNotes]             = useState('');
  const [maxCouples, setMaxCouples]   = useState<number | null>(null);
  const [location, setLocation]       = useState('');
  const [responsible, setResponsible] = useState('');
  const [costPerCouple, setCostPerCouple] = useState<number | null>(null);
  const [saving, setSaving]           = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ref to always have latest field values when auto-save fires
  const fields = useRef({ menu_text: '', notes: '', max_couples: null as number | null, location: '', responsible: '', cost_per_couple: null as number | null });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: sess } = await supabase
      .from('tasting_sessions' as any).select('*').eq('id', id).single();
    const { data: evts } = await supabase
      .from('tasting_session_events' as any)
      .select('*, events(id, event_name, event_date, status, organizer)')
      .eq('session_id', id);

    if (!sess) { navigate('/tastings'); return; }
    const s = sess as Session;
    setSession(s);
    setMenuText(s.menu_text ?? '');
    setNotes(s.notes ?? '');
    setMaxCouples(s.max_couples ?? null);
    setLocation(s.location ?? '');
    setResponsible(s.responsible ?? '');
    setCostPerCouple(s.cost_per_couple ?? null);
    fields.current = {
      menu_text: s.menu_text ?? '',
      notes: s.notes ?? '',
      max_couples: s.max_couples ?? null,
      location: s.location ?? '',
      responsible: s.responsible ?? '',
      cost_per_couple: s.cost_per_couple ?? null,
    };
    setRows((evts ?? []) as SessionEvent[]);
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const updateRow = async (rowId: string, patch: Partial<SessionEvent>) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
    await supabase.from('tasting_session_events' as any).update(patch).eq('id', rowId);
  };

  const removeRow = async (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
    await supabase.from('tasting_session_events' as any).delete().eq('id', rowId);
  };

  const saveSession = useCallback(async (patch: Partial<Session>) => {
    if (!id) return;
    setSaving(true);
    await supabase.from('tasting_sessions' as any).update(patch).eq('id', id);
    setSaving(false);
    toast.success('Salvo', { duration: 1500 });
  }, [id]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveSession(fields.current as Partial<Session>), 1200);
  }, [saveSession]);

  // Stats
  const total    = rows.length;
  const novos    = rows.filter(r => r.situation_snapshot === 'new').length;
  const segundas = rows.filter(r => r.is_second_tasting).length;
  const guests   = rows.reduce((s, r) => s + (r.guest_count ?? 0), 0);
  const emAberto = rows.filter(r => r.situation_snapshot === 'new' && r.events && PIPELINE.includes(r.events.status)).length;
  const fechados = rows.filter(r => r.situation_snapshot === 'new' && r.events && CLOSED.includes(r.events.status)).length;
  const conv     = novos > 0 ? Math.round((fechados / novos) * 100) : null;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
  if (!session) return null;

  return (
    <div className="-m-8">
      {/* TOP BAR */}
      <div className="sticky top-14 z-30 bg-white border-b border-border shadow-sm">
        <div className="px-8 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
              <Link to="/tastings" className="hover:text-foreground transition-colors">Degustações</Link>
              <span>›</span>
              <span className="text-foreground">{fmtDate(session.scheduled_date)}</span>
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">
              Degustação — {fmtDate(session.scheduled_date)}
            </h1>
            {session.type && <p className="text-sm text-muted-foreground mt-0.5">{session.type}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setAllocOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Alocar clientes
            </button>
            <button onClick={() => navigate('/tastings')}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-8 py-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
          <StatCard label="Eventos"    value={total} />
          <StatDivider />
          <StatCard label="Clientes novos" value={novos} />
          <StatCard label="Em aberto"  value={emAberto} danger={emAberto > 0} />
          {conv !== null && <StatCard label="Conversão" value={`${conv}%`} accent />}
          <StatDivider />
          <StatCard label="2ª deg."    value={segundas} muted />
          <StatCard label="Convidados" value={guests}   muted />
        </div>

        {/* Tabs */}
        <div className="px-8 flex gap-0">
          {(['guests','menu','info'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t === 'guests' ? 'Lista de convidados' : t === 'menu' ? 'Cardápio' : 'Informações'}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-8 py-6">
        {tab === 'guests' && (
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <Th>Evento</Th>
                  <Th>Assessor(a)</Th>
                  <Th>Data do evento</Th>
                  <Th>Situação</Th>
                  <Th>Status atual</Th>
                  <Th center>Qtd pessoas</Th>
                  <Th>Valor pago</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                    Nenhum evento alocado. Clique em "Alocar clientes" para adicionar.
                  </td></tr>
                ) : rows.map((row, i) => (
                  <GuestRow
                    key={row.id}
                    row={row}
                    isLast={i === rows.length - 1}
                    sessionDate={session.scheduled_date}
                    onUpdate={patch => updateRow(row.id, patch)}
                    onRemove={() => removeRow(row.id)}
                    onNavigate={() => navigate(`/events/${row.event_id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'menu' && (
          <div className="bg-white border border-border rounded-2xl p-6 space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Cardápio</label>
              <textarea value={menuText} onChange={e => { setMenuText(e.target.value); fields.current.menu_text = e.target.value; scheduleAutoSave(); }} rows={16}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="Descreva o cardápio..." />
            </div>
          </div>
        )}

        {tab === 'info' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Sessão</p>
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Local / salão">
                  <input value={location} onChange={e => { setLocation(e.target.value); fields.current.location = e.target.value; scheduleAutoSave(); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Salão Jardim" />
                </InfoField>
                <InfoField label="Assessora responsável">
                  <input value={responsible} onChange={e => { setResponsible(e.target.value); fields.current.responsible = e.target.value; scheduleAutoSave(); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Nome da assessora" />
                </InfoField>
                <InfoField label="Máx. de casais">
                  <input type="number" min={1} value={maxCouples ?? ''}
                    onChange={e => { const v = e.target.value ? parseInt(e.target.value) : null; setMaxCouples(v); fields.current.max_couples = v; scheduleAutoSave(); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="—" />
                </InfoField>
                <InfoField label="Custo por casal (R$)">
                  <input type="number" min={0} step={0.01} value={costPerCouple ?? ''}
                    onChange={e => { const v = e.target.value ? parseFloat(e.target.value) : null; setCostPerCouple(v); fields.current.cost_per_couple = v; scheduleAutoSave(); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="0,00" />
                </InfoField>
              </div>
            </div>
            <div className="bg-white border border-border rounded-2xl p-6">
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Observações importantes</label>
              <textarea value={notes} onChange={e => { setNotes(e.target.value); fields.current.notes = e.target.value; scheduleAutoSave(); }} rows={10}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="Alergias, restrições, observações por casal..." />
            </div>
          </div>
        )}
      </div>

      {allocOpen && (
        <AllocModal
          sessionId={session.id}
          existingEventIds={rows.map(r => r.event_id ?? '')}
          onClose={() => setAllocOpen(false)}
          onAdded={() => { setAllocOpen(false); load(); }}
        />
      )}
    </div>
  );
}

// ── GuestRow ───────────────────────────────────────────────────────────────────
function GuestRow({ row, isLast, sessionDate, onUpdate, onRemove, onNavigate }: {
  row: SessionEvent;
  isLast: boolean;
  sessionDate: string;
  onUpdate: (p: Partial<SessionEvent>) => void;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  const [paid, setPaid]           = useState(row.paid_amount != null ? String(row.paid_amount) : '');
  const [guestCount, setGuestCount] = useState<string>(row.guest_count != null ? String(row.guest_count) : '');
  const guestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ev  = row.events;
  const st  = ev ? STATUS_CFG[ev.status] : null;
  const sit = SITUATION_CFG[row.situation_snapshot ?? ''];

  const handlePaidBlur = async () => {
    const v = parseFloat(paid.replace(',', '.'));
    if (isNaN(v)) return;
    onUpdate({ paid_amount: v });
    if (ev?.id && v > 0) {
      await supabase.from('event_payments' as any).upsert({
        event_id: ev.id,
        value: v,
        notes: 'Pagamento de degustação',
        source: 'degustacao',
        payment_date: sessionDate,
        is_confirmed: true,
      });
      toast.success('Valor registrado no evento');
    }
  };

  return (
    <tr className={`hover:bg-slate-50 transition-colors ${isLast ? '' : 'border-b border-border/50'}`}>
      <Td>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">{ev?.event_name ?? '—'}</span>
          <button onClick={onNavigate} className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0">
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </Td>
      <Td className="text-muted-foreground">{ev?.organizer || '—'}</Td>
      <Td className="text-muted-foreground tabular-nums">{fmtDate(ev?.event_date ?? null)}</Td>
      <Td>
        {sit ? <span className={`text-xs ${sit.cls}`}>{sit.label}</span> : '—'}
      </Td>
      <Td>
        <StatusSelect
          value={ev?.status ?? ''}
          onChange={async (next) => {
            onUpdate({ events: ev ? { ...ev, status: next } : ev });
            if (ev?.id) {
              await supabase.from('events').update({ status: next }).eq('id', ev.id);
            }
          }}
        />
      </Td>
      <Td center>
        <input type="number" min={0}
          value={guestCount}
          onChange={e => {
            setGuestCount(e.target.value);
            if (guestTimer.current) clearTimeout(guestTimer.current);
            guestTimer.current = setTimeout(() => {
              onUpdate({ guest_count: e.target.value ? parseInt(e.target.value) : null });
            }, 800);
          }}
          className="w-14 text-center text-sm border border-border rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </Td>
      <Td>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">R$</span>
          <input type="text"
            value={paid}
            onChange={e => setPaid(e.target.value)}
            onBlur={handlePaidBlur}
            className="w-24 text-sm border border-border rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="0" />
        </div>
      </Td>
      <Td>
        <button onClick={onRemove} className="p-1 rounded-lg text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </Td>
    </tr>
  );
}

// ── AllocModal ─────────────────────────────────────────────────────────────────
function AllocModal({ sessionId, existingEventIds, onClose, onAdded }: {
  sessionId: string;
  existingEventIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.from('events')
        .select('id, event_name, event_date, status, organizer')
        .not('event_name', 'is', null).neq('event_name', '')
        .ilike('event_name', `%${search}%`).limit(10);
      setResults((data ?? []).filter((e: any) => !existingEventIds.includes(e.id)));
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const alloc = async (ev: any) => {
    const snapshot = PIPELINE.includes(ev.status) ? 'new' : 'confirmed';
    await supabase.from('tasting_session_events' as any).insert({
      session_id: sessionId, event_id: ev.id, situation_snapshot: snapshot,
    });
    toast.success(`${ev.event_name} alocado`);
    onAdded();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Alocar evento</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl bg-muted/30 mb-3">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input autoFocus className="bg-transparent outline-none flex-1 text-sm"
              placeholder="Buscar evento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {loading && <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>}
            {!loading && search && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento encontrado.</p>
            )}
            {results.map(ev => (
              <button key={ev.id} onClick={() => alloc(ev)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left">
                <div>
                  <p className="text-sm font-medium text-foreground">{ev.event_name}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(ev.event_date)}</p>
                </div>
                <span className={`text-xs font-medium ${STATUS_CFG[ev.status]?.cls ?? ''}`}>
                  {STATUS_CFG[ev.status]?.label ?? ev.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Th({ children, center }: { children?: React.ReactNode; center?: boolean }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap ${center ? 'text-center' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '', center }: { children?: React.ReactNode; className?: string; center?: boolean }) {
  return <td className={`px-4 py-3 text-sm ${center ? 'text-center' : ''} ${className}`}>{children}</td>;
}

const STATUS_OPTIONS = Object.entries(STATUS_CFG).map(([value, { label }]) => ({ value, label }));

function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const cfg = STATUS_CFG[value];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none text-[11px] font-medium px-2.5 py-0.5 pr-6 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 ${cfg?.cls ?? 'bg-muted text-muted-foreground border-border'}`}
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] opacity-50">▾</span>
    </div>
  );
}

function StatCard({ label, value, danger, accent, muted }: {
  label: string; value: string | number; danger?: boolean; accent?: boolean; muted?: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-muted/40 min-w-[64px]">
      <span className={`text-base font-bold leading-none mb-0.5 ${danger ? 'text-red-500' : accent ? 'text-primary' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">{label}</span>
    </div>
  );
}

function StatDivider() {
  return <div className="w-px h-8 bg-border mx-1" />;
}

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

