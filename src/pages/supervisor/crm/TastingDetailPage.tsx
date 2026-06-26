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
  new:       { label: 'Cliente novo',  cls: 'text-sky-600' },
  confirmed: { label: 'Já confirmado', cls: 'text-emerald-600' },
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
  const [menuText, setMenuText] = useState('');
  const [notes, setNotes]       = useState('');
  const [maxCouples, setMaxCouples] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const scheduleAutoSave = useCallback((patch: Partial<Session>) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveSession(patch), 1200);
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
        <div className="px-8 py-2.5 border-t border-border/50 bg-muted/10 flex items-center gap-6 flex-wrap">
          <Stat label="Eventos"   value={total} />
          <Stat label="Novos"     value={novos} />
          <Stat label="2ª deg."   value={segundas} />
          <Stat label="Convidados" value={guests} />
          <Stat label="Em aberto" value={emAberto} danger={emAberto > 0} />
          {conv !== null && <Stat label="Conversão" value={`${conv}%`} />}
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
                  <Th center>2ª deg.</Th>
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
              <textarea value={menuText} onChange={e => { setMenuText(e.target.value); scheduleAutoSave({ menu_text: e.target.value, notes }); }} rows={16}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="Descreva o cardápio..." />
            </div>
          </div>
        )}

        {tab === 'info' && (
          <div className="bg-white border border-border rounded-2xl p-6 space-y-5 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Máx. de casais</label>
              <input type="number" min={1} value={maxCouples ?? ''}
                onChange={e => {
                  const v = e.target.value ? parseInt(e.target.value) : null;
                  setMaxCouples(v);
                  scheduleAutoSave({ max_couples: v, notes, menu_text: menuText });
                }}
                className="w-28 px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="—" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Observações importantes</label>
              <textarea value={notes} onChange={e => { setNotes(e.target.value); scheduleAutoSave({ notes: e.target.value, menu_text: menuText, max_couples: maxCouples }); }} rows={10}
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
        {sit ? (
          <button
            onClick={() => onUpdate({ situation_snapshot: row.situation_snapshot === 'new' ? 'confirmed' : 'new' })}
            className={`text-xs font-medium ${sit.cls} hover:opacity-70 transition-opacity`}
            title="Clique para alternar"
          >
            {sit.label}
          </button>
        ) : '—'}
      </Td>
      <Td center>
        <button
          onClick={() => onUpdate({ is_second_tasting: !row.is_second_tasting })}
          className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${row.is_second_tasting ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-transparent hover:border-primary/50'}`}
        >
          <Check className="w-3 h-3" />
        </button>
      </Td>
      <Td>
        {st ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span> : '—'}
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

function Stat({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${danger ? 'text-red-500' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
