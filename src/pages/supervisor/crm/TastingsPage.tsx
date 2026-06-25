import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, X, ChevronDown, Search, ExternalLink, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Session {
  id: string;
  scheduled_date: string;
  type: string | null;
  max_couples: number | null;
  menu_text: string | null;
  notes: string | null;
  created_at: string;
}

interface SessionEvent {
  id: string;
  session_id: string;
  event_id: string | null;
  situation_snapshot: string | null; // 'new' | 'confirmed'
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

const SITUATION_LABEL: Record<string, { label: string; cls: string }> = {
  new:       { label: 'Cliente novo',    cls: 'text-sky-600' },
  confirmed: { label: 'Já confirmado',   cls: 'text-emerald-600' },
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${String(y).slice(2)}`;
};

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Stats helpers ──────────────────────────────────────────────────────────────
function sessionStats(evs: SessionEvent[]) {
  const total    = evs.length;
  const novos    = evs.filter(e => e.situation_snapshot === 'new').length;
  const segundas = evs.filter(e => e.is_second_tasting).length;
  const guests   = evs.reduce((s, e) => s + (e.guest_count ?? 0), 0);
  const emAberto = evs.filter(
    e => e.situation_snapshot === 'new' && e.events && PIPELINE.includes(e.events.status)
  ).length;
  const fechados = evs.filter(
    e => e.situation_snapshot === 'new' && e.events && CLOSED.includes(e.events.status)
  ).length;
  const conv = novos > 0 ? Math.round((fechados / novos) * 100) : null;
  return { total, novos, segundas, guests, emAberto, conv };
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TastingsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [sessionEvts, setSessionEvts]   = useState<Record<string, SessionEvent[]>>({});
  const [loading, setLoading]           = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
  const [selected, setSelected]         = useState<Session | null>(null);
  const [newOpen, setNewOpen]           = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: sess } = await supabase
      .from('tasting_sessions' as any)
      .select('*')
      .order('scheduled_date', { ascending: false });

    const { data: evts } = await supabase
      .from('tasting_session_events' as any)
      .select('*, events(id, event_name, event_date, status, organizer)');

    setSessions((sess ?? []) as Session[]);

    const map: Record<string, SessionEvent[]> = {};
    for (const e of (evts ?? []) as SessionEvent[]) {
      if (!map[e.session_id]) map[e.session_id] = [];
      map[e.session_id].push(e);
    }
    setSessionEvts(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const now = new Date().toISOString().split('T')[0];
  const future = sessions.filter(s => s.scheduled_date >= now);
  const past   = sessions.filter(s => s.scheduled_date < now);
  const visible = [...future, ...past].slice(0, visibleCount);
  const allSorted = [...future, ...past];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova degustação
          </button>
        </div>
      </div>

      {/* Tabela de sessões */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <Th>Data</Th>
              <Th>Tipo</Th>
              <Th center>Eventos</Th>
              <Th center>Novos</Th>
              <Th center>2ª Deg.</Th>
              <Th center>Convidados</Th>
              <Th center>Em aberto</Th>
              <Th center>Conversão</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-16 text-center text-muted-foreground text-sm">Carregando...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={9} className="py-16 text-center text-muted-foreground text-sm">Nenhuma degustação cadastrada.</td></tr>
            ) : visible.map((s, i) => {
              const evs  = sessionEvts[s.id] ?? [];
              const st   = sessionStats(evs);
              const past = s.scheduled_date < now;
              const cls  = past ? 'text-muted-foreground/50' : 'text-foreground';
              return (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`border-b border-border/50 hover:bg-slate-50 cursor-pointer transition-colors ${i === visible.length - 1 ? 'border-0' : ''}`}
                >
                  <Td className={`font-medium ${cls}`}>{fmtDate(s.scheduled_date)}</Td>
                  <Td className={cls}>{s.type ?? '—'}</Td>
                  <Td center className={`font-semibold ${cls}`}>{st.total || ''}</Td>
                  <Td center className={cls}>{st.novos || ''}</Td>
                  <Td center className={cls}>{st.segundas || ''}</Td>
                  <Td center className={cls}>{st.guests || ''}</Td>
                  <Td center className={st.emAberto > 0 ? 'text-red-500 font-semibold' : cls}>
                    {st.emAberto}
                  </Td>
                  <Td center className={cls}>
                    {st.conv !== null ? `${st.conv}%` : '—'}
                  </Td>
                  <Td>
                    <span className="text-muted-foreground/30 text-lg">☰</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mostrar mais / menos */}
      {allSorted.length > 10 && (
        <div className="flex items-center gap-3 mt-3 justify-center">
          {visibleCount < allSorted.length && (
            <button
              onClick={() => setVisibleCount(v => v + 10)}
              className="px-4 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Mostrar mais
            </button>
          )}
          {visibleCount > 10 && (
            <button
              onClick={() => setVisibleCount(10)}
              className="px-4 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Mostrar menos
            </button>
          )}
        </div>
      )}

      {/* Sheet de detalhe */}
      {selected && (
        <SessionSheet
          session={selected}
          events={sessionEvts[selected.id] ?? []}
          onClose={() => setSelected(null)}
          onRefresh={load}
          navigate={navigate}
        />
      )}

      {/* Modal nova degustação */}
      {newOpen && (
        <NewSessionModal
          onClose={() => setNewOpen(false)}
          onCreated={(s) => { setSessions(prev => [s, ...prev]); setNewOpen(false); setSelected(s); }}
        />
      )}
    </div>
  );
}

// ── SessionSheet ───────────────────────────────────────────────────────────────
function SessionSheet({ session, events, onClose, onRefresh, navigate }: {
  session: Session;
  events: SessionEvent[];
  onClose: () => void;
  onRefresh: () => void;
  navigate: (p: string) => void;
}) {
  const [tab, setTab]         = useState<'guests' | 'menu' | 'info'>('guests');
  const [rows, setRows]       = useState<SessionEvent[]>(events);
  const [allocOpen, setAllocOpen] = useState(false);
  const [menuText, setMenuText]   = useState(session.menu_text ?? '');
  const [notes, setNotes]         = useState(session.notes ?? '');

  useEffect(() => { setRows(events); }, [events]);

  const updateRow = async (id: string, patch: Partial<SessionEvent>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    await supabase.from('tasting_session_events' as any).update(patch).eq('id', id);
  };

  const removeRow = async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    await supabase.from('tasting_session_events' as any).delete().eq('id', id);
  };

  const savePayment = async (row: SessionEvent, amount: number) => {
    if (!row.event_id || !amount) return;
    await supabase.from('event_payments' as any).upsert({
      event_id: row.event_id,
      value: amount,
      notes: 'Pagamento de degustação',
      source: 'degustacao',
      payment_date: session.scheduled_date,
      is_confirmed: true,
    });
    toast.success('Valor registrado no evento');
  };

  const saveMenu = async () => {
    await supabase.from('tasting_sessions' as any).update({ menu_text: menuText, notes }).eq('id', session.id);
    toast.success('Salvo');
  };

  const stats = sessionStats(rows);

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-5xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-start justify-between gap-4 shrink-0">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Calendário › {fmtDate(session.scheduled_date)}</p>
            <h2 className="text-xl font-bold text-foreground">Degustação dia {fmtDate(session.scheduled_date)}</h2>
            {session.type && <p className="text-sm text-muted-foreground mt-0.5">{session.type}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAllocOpen(true)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Alocar clientes
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-6 py-3 border-b border-border bg-muted/20 flex items-center gap-6 text-sm shrink-0 flex-wrap">
          <Stat label="Eventos" value={stats.total} />
          <Stat label="Novos"   value={stats.novos} />
          <Stat label="2ª deg." value={stats.segundas} />
          <Stat label="Convidados" value={stats.guests} />
          <Stat label="Em aberto" value={stats.emAberto} danger={stats.emAberto > 0} />
          {stats.conv !== null && <Stat label="Conversão" value={`${stats.conv}%`} />}
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-0 border-b border-border shrink-0">
          {(['guests','menu','info'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t === 'guests' ? 'Lista de convidados' : t === 'menu' ? 'Cardápio' : 'Informações'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'guests' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
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
                  <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">Nenhum evento alocado.</td></tr>
                ) : rows.map(row => (
                  <GuestRow
                    key={row.id}
                    row={row}
                    onUpdate={patch => updateRow(row.id, patch)}
                    onRemove={() => removeRow(row.id)}
                    onSavePayment={amount => savePayment(row, amount)}
                    onNavigate={() => navigate(`/events/${row.event_id}`)}
                  />
                ))}
              </tbody>
            </table>
          )}

          {tab === 'menu' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Cardápio</label>
                <textarea
                  value={menuText}
                  onChange={e => setMenuText(e.target.value)}
                  rows={14}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  placeholder="Descreva o cardápio da degustação..."
                />
              </div>
              <button onClick={saveMenu} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                Salvar
              </button>
            </div>
          )}

          {tab === 'info' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Observações importantes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  placeholder="Alergias, restrições, observações por casal..."
                />
              </div>
              <button onClick={saveMenu} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                Salvar
              </button>
            </div>
          )}
        </div>
      </div>

      {allocOpen && (
        <AllocModal
          sessionId={session.id}
          existingEventIds={rows.map(r => r.event_id ?? '')}
          onClose={() => setAllocOpen(false)}
          onAdded={() => { setAllocOpen(false); onRefresh(); }}
        />
      )}
    </div>,
    document.body
  );
}

// ── GuestRow ───────────────────────────────────────────────────────────────────
function GuestRow({ row, onUpdate, onRemove, onSavePayment, onNavigate }: {
  row: SessionEvent;
  onUpdate: (p: Partial<SessionEvent>) => void;
  onRemove: () => void;
  onSavePayment: (v: number) => void;
  onNavigate: () => void;
}) {
  const [paidInput, setPaidInput] = useState(row.paid_amount != null ? String(row.paid_amount) : '');
  const ev = row.events;

  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    lead:              { label: '1° Contato', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    negotiating:       { label: 'Negociando', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    tasting_scheduled: { label: 'Degustação', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    confirmed:         { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    completed:         { label: 'Concluído',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    cancelled:         { label: 'Cancelado',  cls: 'bg-red-50 text-red-600 border-red-200' },
  };
  const st = ev ? STATUS_LABEL[ev.status] : null;
  const sit = SITUATION_LABEL[row.situation_snapshot ?? ''];

  const handlePaidBlur = () => {
    const v = parseFloat(paidInput.replace(',', '.'));
    if (!isNaN(v) && v !== (row.paid_amount ?? 0)) {
      onUpdate({ paid_amount: v });
      onSavePayment(v);
    }
  };

  return (
    <tr className="border-b border-border/50 hover:bg-slate-50 transition-colors">
      <Td>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">{ev?.event_name ?? '—'}</span>
          <button onClick={onNavigate} className="text-muted-foreground/40 hover:text-primary transition-colors">
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </Td>
      <Td className="text-muted-foreground">{ev?.organizer || '—'}</Td>
      <Td className="text-muted-foreground tabular-nums">{fmtDate(ev?.event_date ?? null)}</Td>
      <Td>
        {sit ? <span className={`text-xs font-medium ${sit.cls}`}>{sit.label}</span> : '—'}
      </Td>
      <Td>
        {st ? (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
        ) : '—'}
      </Td>
      <Td center>
        <input
          type="number"
          value={row.guest_count ?? ''}
          onChange={e => onUpdate({ guest_count: e.target.value ? parseInt(e.target.value) : null })}
          className="w-14 text-center text-sm border border-border rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
          min={0}
        />
      </Td>
      <Td>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">R$</span>
          <input
            type="text"
            value={paidInput}
            onChange={e => setPaidInput(e.target.value)}
            onBlur={handlePaidBlur}
            className="w-24 text-sm border border-border rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="0"
          />
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

// ── AllocModal — busca e aloca evento na sessão ────────────────────────────────
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
      const { data } = await supabase
        .from('events')
        .select('id, event_name, event_date, status, organizer')
        .not('event_name', 'is', null)
        .neq('event_name', '')
        .ilike('event_name', `%${search}%`)
        .limit(10);
      setResults((data ?? []).filter((e: any) => !existingEventIds.includes(e.id)));
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const alloc = async (ev: any) => {
    const snapshot = PIPELINE.includes(ev.status) ? 'new' : 'confirmed';
    await supabase.from('tasting_session_events' as any).insert({
      session_id: sessionId,
      event_id: ev.id,
      situation_snapshot: snapshot,
    });
    toast.success(`${ev.event_name} alocado`);
    onAdded();
  };

  const STATUS_CLS: Record<string, string> = {
    lead: 'text-sky-600', negotiating: 'text-amber-600', tasting_scheduled: 'text-purple-600',
    confirmed: 'text-emerald-600', completed: 'text-blue-600', cancelled: 'text-red-500',
  };
  const STATUS_LBL: Record<string, string> = {
    lead: '1° Contato', negotiating: 'Negociando', tasting_scheduled: 'Degustação',
    confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado',
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Alocar evento</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl bg-muted/30 mb-3">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              className="bg-transparent outline-none flex-1 text-sm"
              placeholder="Buscar evento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {loading && <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>}
            {!loading && search && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento encontrado.</p>
            )}
            {results.map(ev => (
              <button
                key={ev.id}
                onClick={() => alloc(ev)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{ev.event_name}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(ev.event_date)}</p>
                </div>
                <span className={`text-xs font-medium ${STATUS_CLS[ev.status] ?? 'text-muted-foreground'}`}>
                  {STATUS_LBL[ev.status] ?? ev.status}
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

// ── NewSessionModal ────────────────────────────────────────────────────────────
function NewSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Session) => void }) {
  const [date, setDate]         = useState('');
  const [type, setType]         = useState('Jantar');
  const [maxCouples, setMax]    = useState('4');
  const [saving, setSaving]     = useState(false);

  const save = async () => {
    if (!date) { toast.error('Informe a data'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('tasting_sessions' as any)
      .insert({ scheduled_date: date, type, max_couples: parseInt(maxCouples) || 4 })
      .select()
      .single();
    if (error) { toast.error('Erro ao criar degustação'); setSaving(false); return; }
    toast.success('Degustação criada');
    onCreated(data as Session);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Nova degustação</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Tipo</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option>Jantar</option>
              <option>Almoço</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Limite de casais</label>
            <input type="number" value={maxCouples} onChange={e => setMax(e.target.value)} min={1}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? 'Criando...' : 'Criar degustação'}
          </button>
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
  return (
    <td className={`px-4 py-3 text-sm ${center ? 'text-center' : ''} ${className}`}>{children}</td>
  );
}

function Stat({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${danger ? 'text-red-500' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
