import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Plus, Trash2, ExternalLink, Search, Loader2, AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';
import RichTextEditor from '@/components/RichTextEditor';
import WhatsAppConfirmModal, { WhatsAppTrigger } from '@/components/WhatsAppConfirmModal';
import { buildMessage } from '@/lib/whatsapp';
import { EVENT_STATUS, ALL_STATUS_KEYS } from '@/lib/eventStatus';

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
    location_text: string | null;
    status: string;
    organizer: string | null;
  } | null;
}

const PIPELINE = ['lead', 'negotiating', 'tasting_scheduled'];
const CLOSED   = ['confirmed', 'completed'];

const STATUS_CFG: Record<string, { label: string; cls: string }> = Object.fromEntries(
  ALL_STATUS_KEYS.map(k => [k, { label: EVENT_STATUS[k].label, cls: EVENT_STATUS[k].cls }])
);

const SITUATION_CFG: Record<string, { label: string; cls: string }> = {
  new:       { label: 'Cliente novo',   cls: 'text-muted-foreground' },
  confirmed: { label: 'Já confirmado',  cls: 'text-emerald-600 font-semibold' },
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${String(y).slice(2)}`;
};

function parseBubbleContent(text: string): string {
  if (!text || !text.includes('[')) return text;
  return text
    .replace(/\[ml\]/gi, '').replace(/\[\/ml\]/gi, '')
    .replace(/\[h2\]\[b\]/gi, '<h2><strong>').replace(/\[\/b\]\[\/h2\]/gi, '</strong></h2>')
    .replace(/\[h1\]\[b\]/gi, '<h1><strong>').replace(/\[\/b\]\[\/h1\]/gi, '</strong></h1>')
    .replace(/\[h2\]/gi, '<h2>').replace(/\[\/h2\]/gi, '</h2>')
    .replace(/\[h1\]/gi, '<h1>').replace(/\[\/h1\]/gi, '</h1>')
    .replace(/\[b\]/gi, '<strong>').replace(/\[\/b\]/gi, '</strong>')
    .replace(/\[i\]/gi, '<em>').replace(/\[\/i\]/gi, '</em>')
    .replace(/\[ul\]/gi, '<ul>').replace(/\[\/ul\]/gi, '</ul>')
    .replace(/\[ol\]/gi, '<ol>').replace(/\[\/ol\]/gi, '</ol>')
    .replace(/\[li[^\]]*\]/gi, '<li>').replace(/\[\/li\]/gi, '</li>')
    .replace(/\[highlight=([^\]]+)\]/gi, '<mark style="background:$1">').replace(/\[\/highlight\]/gi, '</mark>')
    .replace(/\n/g, '<br>');
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TastingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const stateFrom  = (location.state as any)?.from  ?? '/tastings';
  const stateLabel = (location.state as any)?.fromLabel ?? 'Degustações';

  const [session,      setSession]      = useState<Session | null>(null);
  const [rows,         setRows]         = useState<SessionEvent[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState<'guests' | 'menu' | 'info'>('guests');
  const [allocOpen,    setAllocOpen]    = useState(false);
  const [menuText,     setMenuText]     = useState('');
  const [notes,        setNotes]        = useState('');
  const [maxCouples,   setMaxCouples]   = useState<number | null>(null);
  const [venue,        setVenue]        = useState('');
  const [responsible,  setResponsible]  = useState('');
  const [costPerCouple,setCostPerCouple]= useState<number | null>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fields = useRef({
    menu_text: '', notes: '',
    max_couples: null as number | null,
    location: '', responsible: '',
    cost_per_couple: null as number | null,
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: sess }, { data: evts }] = await Promise.all([
      supabase.from('tasting_sessions' as any).select('*').eq('id', id).single(),
      supabase.from('tasting_session_events' as any)
        .select('*, events(id, event_name, event_date, location_text, location_id, status, organizer)')
        .eq('session_id', id),
    ]);

    if (!sess) { navigate('/tastings'); return; }
    const s = sess as Session;

    const rawMenu  = s.menu_text ?? '';
    const rawNotes = s.notes ?? '';
    const parsedMenu  = parseBubbleContent(rawMenu);
    const parsedNotes = parseBubbleContent(rawNotes);
    if (parsedMenu !== rawMenu || parsedNotes !== rawNotes) {
      await supabase.from('tasting_sessions' as any)
        .update({ menu_text: parsedMenu, notes: parsedNotes }).eq('id', id);
    }

    setSession(s);
    setMenuText(parsedMenu);
    setNotes(parsedNotes);
    setMaxCouples(s.max_couples ?? null);
    setVenue(s.location ?? '');
    setResponsible(s.responsible ?? '');
    setCostPerCouple(s.cost_per_couple ?? null);
    fields.current = {
      menu_text: parsedMenu, notes: parsedNotes,
      max_couples: s.max_couples ?? null,
      location: s.location ?? '', responsible: s.responsible ?? '',
      cost_per_couple: s.cost_per_couple ?? null,
    };

    // Resolve location name for events that use location_id without location_text
    const rows = (evts ?? []) as SessionEvent[];
    const missingLocationIds = rows
      .map(r => (r as any).events?.location_id)
      .filter((locId, i) => locId && !(rows[i] as any).events?.location_text);

    if (missingLocationIds.length > 0) {
      const { data: locs } = await supabase
        .from('event_locations' as any)
        .select('id, name')
        .in('id', missingLocationIds);
      const locMap = Object.fromEntries((locs ?? []).map((l: any) => [l.id, l.name]));
      rows.forEach(r => {
        const ev = (r as any).events;
        if (ev && !ev.location_text && ev.location_id && locMap[ev.location_id]) {
          ev.location_text = locMap[ev.location_id];
        }
      });
    }

    setRows(rows);
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const saveSession = useCallback(async (patch: Partial<Session>) => {
    if (!id) return;
    const { error } = await supabase.from('tasting_sessions' as any).update(patch).eq('id', id);
    if (error) toast.error('Erro ao salvar');
  }, [id]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveSession(fields.current as Partial<Session>), 1200);
  }, [saveSession]);

  const updateRow = async (rowId: string, patch: Partial<SessionEvent>) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
    const { events: _, ...dbPatch } = patch as any;
    if (Object.keys(dbPatch).length > 0) {
      const { error } = await supabase.from('tasting_session_events' as any).update(dbPatch).eq('id', rowId);
      if (error) toast.error('Erro ao salvar');
    }
  };

  const removeRow = async (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
    const { error } = await supabase.from('tasting_session_events' as any).delete().eq('id', rowId);
    if (error) toast.error('Erro ao remover');
  };

  // Stats (computed from local rows, mirroring the VIEW logic)
  const total    = rows.length;
  const novos    = rows.filter(r => r.situation_snapshot === 'new').length;
  const velhos   = rows.filter(r => r.situation_snapshot === 'confirmed').length;
  const emAberto = rows.filter(r => r.situation_snapshot === 'new' && r.events && PIPELINE.includes(r.events.status)).length;
  const fechados = rows.filter(r => r.situation_snapshot === 'new' && r.events && CLOSED.includes(r.events.status)).length;
  const guests   = rows.reduce((s, r) => s + (r.guest_count ?? 0), 0);
  const totalPago= rows.reduce((s, r) => s + (r.paid_amount ?? 0), 0);
  const conv     = novos > 0 ? Math.round((fechados / novos) * 100) : null;
  const fmtMoney = (v: number) => v === 0 ? 'R$ 0' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

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
              <Link to={stateFrom} className="hover:text-foreground transition-colors">{stateLabel}</Link>
              <span>›</span>
              <span className="text-foreground">{fmtDate(session.scheduled_date)}</span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h1 className="text-xl font-bold text-foreground leading-tight">
                Degustação — {fmtDate(session.scheduled_date)}
              </h1>
              {session.type && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                  session.type.toLowerCase() === 'jantar'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {session.type}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setAllocOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />
              Alocar clientes
            </button>
            <button onClick={() => navigate(stateFrom)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-8 py-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
          <StatChip label="Eventos"       value={total} />
          <StatDivider />
          <StatChip label="Novos"         value={novos} />
          <StatChip label="Velhos"        value={velhos} />
          <StatChip label="Fechados"      value={fechados} />
          <StatChip label="Em aberto"     value={emAberto} danger={emAberto > 0} />
          <StatDivider />
          <StatChip label="Convidados"    value={guests} muted />
          <StatChip label="Conversão"     value={conv !== null ? `${conv}%` : null}
            accent={conv !== null && conv >= 50}
            warn={conv !== null && conv > 0 && conv < 50} />
          <StatChip label="Total pago"    value={totalPago > 0 ? fmtMoney(totalPago) : null} muted />
        </div>

        {/* Tabs */}
        <div className="px-8 flex gap-0">
          {(['guests', 'menu', 'info'] as const).map(t => (
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
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <Th>Evento</Th>
                    <Th>Assessor(a)</Th>
                    <Th>Data do evento</Th>
                    <Th>Local</Th>
                    <Th>Situação</Th>
                    <Th>Status atual</Th>
                    <Th center>Qtd pessoas</Th>
                    <Th>Valor pago</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
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
                      onNavigate={() => navigate(`/events/${row.event_id}`, {
                        state: { from: `/tastings/${session.id}`, fromLabel: `Degustação ${fmtDate(session.scheduled_date)}` }
                      })}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-border rounded-2xl p-6">
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                Observações importantes
              </label>
              <RichTextEditor
                content={notes}
                onChange={html => { setNotes(html); fields.current.notes = html; scheduleAutoSave(); }}
                placeholder="Alergias, restrições, observações por casal..."
              />
            </div>
          </div>
        )}

        {tab === 'menu' && (
          <div className="bg-white border border-border rounded-2xl p-6">
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Cardápio</label>
            <RichTextEditor
              content={menuText}
              onChange={html => { setMenuText(html); fields.current.menu_text = html; scheduleAutoSave(); }}
              placeholder="Descreva o cardápio..."
            />
          </div>
        )}

        {tab === 'info' && (
          <div className="space-y-4 max-w-3xl">
            <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Sessão</p>
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Máx. casais">
                  <input type="number" min={1} value={maxCouples ?? ''}
                    onChange={e => { const v = e.target.value ? parseInt(e.target.value) : null; setMaxCouples(v); fields.current.max_couples = v; scheduleAutoSave(); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="—" />
                </InfoField>
                <InfoField label="Local / salão">
                  <input value={venue}
                    onChange={e => { setVenue(e.target.value); fields.current.location = e.target.value; scheduleAutoSave(); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ex: Salão Jardim" />
                </InfoField>
                <InfoField label="Responsável">
                  <input value={responsible}
                    onChange={e => { setResponsible(e.target.value); fields.current.responsible = e.target.value; scheduleAutoSave(); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Nome da assessora" />
                </InfoField>
                <InfoField label="Custo por casal (R$)">
                  <input type="number" min={0} step={0.01} value={costPerCouple ?? ''}
                    onChange={e => { const v = e.target.value ? parseFloat(e.target.value) : null; setCostPerCouple(v); fields.current.cost_per_couple = v; scheduleAutoSave(); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0,00" />
                </InfoField>
              </div>
              <InfoField label="Observações">
                <RichTextEditor
                  content={notes}
                  onChange={html => { setNotes(html); fields.current.notes = html; scheduleAutoSave(); }}
                  placeholder="Observações gerais da sessão..."
                />
              </InfoField>
            </div>
          </div>
        )}
      </div>

      {allocOpen && (
        <AllocModal
          sessionId={session.id}
          sessionDate={session.scheduled_date}
          existingEventIds={rows.map(r => r.event_id ?? '')}
          maxCouples={maxCouples}
          currentCount={total}
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
  const [paid,       setPaid]       = useState(row.paid_amount != null ? String(row.paid_amount) : '');
  const [guestCount, setGuestCount] = useState(row.guest_count != null ? String(row.guest_count) : '');
  const guestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ev  = row.events;
  const sit = SITUATION_CFG[row.situation_snapshot ?? ''];

  const handlePaidBlur = () => {
    const v = parseFloat(paid.replace(',', '.'));
    if (!isNaN(v)) onUpdate({ paid_amount: v });
  };

  const toggleSnapshot = async () => {
    const next = row.situation_snapshot === 'new' ? 'confirmed' : 'new';
    onUpdate({ situation_snapshot: next });
    await supabase.from('tasting_session_events' as any)
      .update({ situation_snapshot: next })
      .eq('session_id', row.session_id)
      .eq('event_id', row.event_id);
  };

  return (
    <tr className={`hover:bg-slate-50 transition-colors ${isLast ? '' : 'border-b border-border/50'}`}>
      <Td>
        <div className="flex items-center gap-1 max-w-[160px]">
          <span className="font-medium text-foreground truncate">{ev?.event_name ?? '—'}</span>
          <button onClick={onNavigate} className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0">
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </Td>
      <Td className="text-muted-foreground max-w-[100px] truncate">{ev?.organizer || '—'}</Td>
      <Td className="text-muted-foreground tabular-nums whitespace-nowrap">{fmtDate(ev?.event_date ?? null)}</Td>
      <Td className="text-muted-foreground max-w-[110px] truncate">{ev?.location_text || '—'}</Td>
      <Td>
        <button
          title="Automático pela data do contrato — clique para corrigir"
          onClick={toggleSnapshot}
          className="flex items-center gap-1 group"
        >
          {sit
            ? <span className={`text-xs ${sit.cls} group-hover:underline`}>{sit.label}</span>
            : <span className="text-xs text-muted-foreground">—</span>}
        </button>
      </Td>
      <Td>
        <StatusSelect
          value={ev?.status ?? ''}
          onChange={async (next) => {
            onUpdate({ events: ev ? { ...ev, status: next } : ev });
            if (ev?.id) {
              const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
              if (error) toast.error('Erro ao atualizar status');
            }
          }}
        />
      </Td>
      <Td center>
        <input type="number" min={0} value={guestCount}
          onChange={e => {
            setGuestCount(e.target.value);
            if (guestTimer.current) clearTimeout(guestTimer.current);
            guestTimer.current = setTimeout(() => {
              onUpdate({ guest_count: e.target.value ? parseInt(e.target.value) : null });
            }, 800);
          }}
          className="w-12 text-center text-xs border border-border rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </Td>
      <Td>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">R$</span>
          <input type="text" value={paid}
            onChange={e => setPaid(e.target.value)}
            onBlur={handlePaidBlur}
            className="w-20 text-xs border border-border rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
function AllocModal({ sessionId, sessionDate, existingEventIds, maxCouples, currentCount, onClose, onAdded }: {
  sessionId: string;
  sessionDate: string;
  existingEventIds: string[];
  maxCouples: number | null;
  currentCount: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search,    setSearch]    = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [results,   setResults]   = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirmEv, setConfirmEv] = useState<any | null>(null);
  const [waTrigger, setWaTrigger] = useState<WhatsAppTrigger | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const terms = search.trim().split(/\s+/).filter(Boolean);
      let q = supabase.from('events')
        .select('id, event_name, event_date, status, organizer, location_text, guest_count, clients(name)')
        .not('event_name', 'is', null).neq('event_name', '')
        .or(terms.map(t => `event_name.ilike.%${t}%,organizer.ilike.%${t}%,location_text.ilike.%${t}%`).join(','))
        .or(`event_date.gt.${todayStr},event_date.is.null`)
        .limit(40);

      if (statusFilter !== 'all') {
        q = q.eq('status', statusFilter);
      } else {
        q = q.in('status', ['lead', 'negotiating', 'tasting_scheduled', 'confirmed']);
      }

      const { data } = await q;

      const OPEN = ['lead', 'negotiating', 'tasting_scheduled'];
      const filtered = (data ?? [])
        .filter((e: any) => !existingEventIds.includes(e.id))
        .sort((a: any, b: any) => {
          const aOpen = OPEN.includes(a.status) ? 0 : 1;
          const bOpen = OPEN.includes(b.status) ? 0 : 1;
          if (aOpen !== bOpen) return aOpen - bOpen;
          return (a.event_date ?? '').localeCompare(b.event_date ?? '');
        });
      setResults(filtered);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  const alloc = async (ev: any) => {
    const { data: evDetail } = await supabase.from('events').select('contract_signed_date').eq('id', ev.id).single();
    const signedDate = (evDetail as any)?.contract_signed_date ?? null;
    const snapshot = signedDate && signedDate < sessionDate ? 'confirmed' : 'new';

    const { error } = await supabase.from('tasting_session_events' as any).insert({
      session_id: sessionId, event_id: ev.id, situation_snapshot: snapshot,
    });
    if (error) { toast.error('Erro ao alocar evento'); return; }
    toast.success(`${ev.event_name} alocado`);

    const [{ data: evData }, { data: companyData }] = await Promise.all([
      supabase.from('events').select('clients(name, phone)').eq('id', ev.id).single(),
      supabase.from('companies' as any).select('endereco').single(),
    ]);
    const client = (evData as any)?.clients;
    if (client?.phone) {
      const [y, m, d] = sessionDate.split('-');
      const dateFmt = `${d}/${m}/${y}`;
      const address = (companyData as any)?.endereco ?? '';
      buildMessage('tasting', { clientName: client.name ?? '', date: dateFmt, address })
        .then(text => setWaTrigger({ phone: client.phone, clientName: client.name ?? 'Cliente', message: text }));
    } else {
      onAdded();
    }
  };

  const handleClick = (ev: any) => {
    if (maxCouples !== null && currentCount >= maxCouples) {
      setConfirmEv(ev);
    } else {
      alloc(ev);
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Alocar evento</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl bg-muted/30 mb-3">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input autoFocus className="bg-transparent outline-none flex-1 text-sm"
                placeholder="Buscar por nome, local ou assessora..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'lead', label: STATUS_CFG['lead']?.label ?? 'Lead' },
                { key: 'negotiating', label: STATUS_CFG['negotiating']?.label ?? 'Negociando' },
                { key: 'tasting_scheduled', label: STATUS_CFG['tasting_scheduled']?.label ?? 'Degustação' },
                { key: 'confirmed', label: STATUS_CFG['confirmed']?.label ?? 'Confirmado' },
              ].map(opt => (
                <button key={opt.key} onClick={() => setStatusFilter(opt.key)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    statusFilter === opt.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 text-muted-foreground border-border hover:border-primary/40'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {maxCouples !== null && currentCount >= maxCouples && (
              <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Limite de {maxCouples} casais atingido. Você ainda pode adicionar mais.
              </div>
            )}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {searching && <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>}
              {!searching && search && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento encontrado.</p>
              )}
              {results.map(ev => (
                <button key={ev.id} onClick={() => handleClick(ev)}
                  className="w-full flex items-start justify-between px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ev.event_name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <p className="text-xs text-muted-foreground">{fmtDate(ev.event_date)}</p>
                      {ev.location_text && <p className="text-xs text-muted-foreground truncate max-w-[140px]">📍 {ev.location_text}</p>}
                      {ev.organizer && <p className="text-xs text-muted-foreground truncate max-w-[120px]">👤 {ev.organizer}</p>}
                      {ev.guest_count != null && <p className="text-xs text-muted-foreground">{ev.guest_count} conv.</p>}
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${STATUS_CFG[ev.status]?.cls ?? 'bg-muted border-border text-muted-foreground'}`}>
                    {STATUS_CFG[ev.status]?.label ?? ev.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {confirmEv && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmEv(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-50 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Limite atingido</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Esta sessão já tem {maxCouples} casais definidos como limite. Deseja adicionar <strong>{confirmEv.event_name}</strong> mesmo assim?
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmEv(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={() => { alloc(confirmEv); setConfirmEv(null); }}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                Adicionar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {waTrigger && (
        <WhatsAppConfirmModal
          trigger={waTrigger}
          onClose={() => { setWaTrigger(null); onAdded(); }}
        />
      )}
    </>,
    document.body
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Th({ children, center }: { children?: React.ReactNode; center?: boolean }) {
  return (
    <th className={`px-2 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap ${center ? 'text-center' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '', center }: { children?: React.ReactNode; className?: string; center?: boolean }) {
  return <td className={`px-2 py-2.5 text-xs ${center ? 'text-center' : ''} ${className}`}>{children}</td>;
}

const STATUS_OPTIONS = Object.entries(STATUS_CFG).map(([value, { label }]) => ({ value, label }));

function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const cfg = STATUS_CFG[value];
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 ${cfg?.cls ?? 'bg-muted text-muted-foreground border-border'}`}
    >
      {STATUS_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function StatChip({ label, value, danger, accent, warn, muted }: {
  label: string; value: string | number | null; danger?: boolean; accent?: boolean; warn?: boolean; muted?: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-muted/40 min-w-[64px]">
      <span className={`text-base font-bold leading-none mb-0.5 ${danger ? 'text-red-500' : accent ? 'text-emerald-600' : warn ? 'text-amber-500' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value ?? '—'}
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
