import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Plus, CalendarDays, Copy, Check, QrCode, X as XIcon, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { getMessageTemplates } from '@/lib/whatsapp';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { EVENT_STATUS } from '@/lib/eventStatus';

const TIPOS = ['Jantar', 'Almoço'];
const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

type ActiveTab = 'degustacoes' | 'aberto';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Session {
  id: string;
  scheduled_date: string;
  type: string | null;
  max_couples: number | null;
  notes: string | null;
  created_at: string;
}

interface SessionStats {
  session_id: string;
  total: number;
  novos: number;
  velhos: number;
  em_aberto: number;
  fechados: number;
  total_confirmados: number;
  guests: number;
  total_pago: number;
}

interface AbertoRow {
  event_id: string;
  event_name: string;
  event_date: string;
  status: string;
  assessor_name: string | null;
  venue_name: string | null;
  guest_count: number | null;
  last_tasting_date: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${String(y).slice(2)}`;
};

const fmtMoney = (v: number) =>
  v === 0 ? null : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function getStatusCfg(value: string) {
  const s = EVENT_STATUS[value as keyof typeof EVENT_STATUS];
  if (s) return { label: s.label, cls: s.cls };
  return { label: value, cls: 'bg-muted text-muted-foreground border-border' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TastingsPage() {
  const navigate = useNavigate();
  const [tab,           setTab]          = useState<ActiveTab>('degustacoes');
  const [sessions,      setSessions]     = useState<Session[]>([]);
  const [statsMap,      setStatsMap]     = useState<Record<string, SessionStats>>({});
  const [loading,       setLoading]      = useState(true);
  const [visibleCount,  setVisibleCount] = useState(15);
  const [newOpen,       setNewOpen]      = useState(false);
  const [copied,        setCopied]       = useState(false);
  const [qrOpen,        setQrOpen]       = useState(false);
  const [qrCopied,      setQrCopied]     = useState(false);
  const [abertoRows,    setAbertoRows]   = useState<AbertoRow[]>([]);
  const [abertoLoading, setAbertoLoading]= useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: sess }, { data: stats }] = await Promise.all([
      supabase.from('tasting_sessions' as any).select('id, scheduled_date, type, max_couples, created_at').order('scheduled_date', { ascending: false }),
      supabase.from('tasting_session_stats' as any).select('*'),
    ]);
    setSessions((sess ?? []) as Session[]);
    const map: Record<string, SessionStats> = {};
    for (const r of (stats ?? []) as SessionStats[]) map[r.session_id] = r;
    setStatsMap(map);
    setLoading(false);
  };

  const loadAberto = async () => {
    setAbertoLoading(true);

    const today = new Date().toISOString().split('T')[0];

    // 1. Busca eventos nos status "em aberto" (lead, negociando, degustação agendada)
    const { data: evts, error } = await supabase
      .from('events')
      .select('id, event_name, event_date, status, guest_count, organizer, location_text')
      .in('status', ['lead', 'negotiating', 'tasting_scheduled'])
      .order('event_date', { ascending: true });

    if (error) { console.error('[aberto] evts error', error); setAbertoLoading(false); return; }
    if (!evts || evts.length === 0) { setAbertoRows([]); setAbertoLoading(false); return; }

    // 2. Busca quais desses eventos têm degustação com data < hoje
    const allIds = evts.map((e: any) => e.id);
    const { data: tse } = await supabase
      .from('tasting_session_events' as any)
      .select('event_id, tasting_sessions(scheduled_date)')
      .in('event_id', allIds);

    // Monta mapa event_id → última data de degustação passada
    const tastingDateMap: Record<string, string> = {};
    for (const row of (tse ?? []) as any[]) {
      const d = row.tasting_sessions?.scheduled_date;
      if (!d || d >= today) continue;
      if (!tastingDateMap[row.event_id] || d > tastingDateMap[row.event_id])
        tastingDateMap[row.event_id] = d;
    }

    // 3. Filtra apenas eventos que tiveram degustação passada
    const rows = evts
      .filter((e: any) => tastingDateMap[e.id])
      .map((e: any) => ({
        event_id:          e.id,
        event_name:        e.event_name,
        event_date:        e.event_date,
        status:            e.status,
        assessor_name:     e.organizer ?? null,
        venue_name:        e.location_text ?? null,
        guest_count:       e.guest_count ?? null,
        last_tasting_date: tastingDateMap[e.id],
      }));

    setAbertoRows(rows);
    setAbertoLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'aberto') loadAberto(); }, [tab]);

  const now       = new Date().toISOString().split('T')[0];
  const allSorted = [...sessions].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  const copyAvailableDates = async () => {
    const available = allSorted.filter(s => {
      if (s.scheduled_date < now) return false;
      const total = statsMap[s.id]?.total ?? 0;
      const max   = s.max_couples ?? Infinity;
      return total < max;
    }).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

    if (available.length === 0) {
      toast.error('Nenhuma data disponível com vagas');
      return;
    }

    const fmtDateLong = (d: string) => {
      const [y, m, day] = d.split('T')[0].split('-');
      return `${day}/${m}/${y}`;
    };

    const lines = available.map(s => {
      const total  = statsMap[s.id]?.total ?? 0;
      const max    = s.max_couples ?? 0;
      const vagas  = max > 0 ? max - total : null;
      const tipo   = s.type ?? '';
      return `• ${fmtDateLong(s.scheduled_date)} (${tipo})${vagas !== null ? ` — ${vagas} vaga${vagas !== 1 ? 's' : ''}` : ''}`;
    }).join('\n');

    const templates = await getMessageTemplates();
    const text = templates.tasting_availability.replace('{{dates}}', lines);

    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Texto copiado!');
    setTimeout(() => setCopied(false), 2500);
  };
  const upcoming  = allSorted.filter(s => s.scheduled_date >= now);
  const past      = allSorted.filter(s => s.scheduled_date < now);
  const visiblePast = past.slice(0, visibleCount);

  const cols = 'grid-cols-[140px_90px_1fr_1fr_1fr_1fr_1fr_1fr_1fr]';

  const TableHeader = () => (
    <div className={`px-5 py-2.5 grid ${cols} gap-3 bg-muted/30`}>
      {['Data','Tipo','Total','Novos','Velhos','Em aberto','Convidados','Conversão','Total pago'].map((h, i) => (
        <span key={h} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 text-center ${i <= 1 ? 'text-left' : ''} ${i === 7 ? 'border-l border-border pl-3' : ''}`}>{h}</span>
      ))}
    </div>
  );

  const SessionRow = ({ s, isPast }: { s: Session; isPast?: boolean }) => {
    const st      = statsMap[s.id];
    const total   = st?.total    ?? 0;
    const novos   = st?.novos    ?? 0;
    const velhos  = st?.velhos   ?? 0;
    const fechados= st?.fechados ?? 0;
    const emAberto= st?.em_aberto ?? 0;
    const guests  = st?.guests   ?? 0;
    const totalPago = st?.total_pago ?? 0;
    const conv    = novos > 0 ? Math.round((fechados / novos) * 100) : null;
    const money   = fmtMoney(totalPago);
    return (
      <div onClick={() => navigate(`/tastings/${s.id}`)}
        className={`px-5 ${isPast ? 'py-2' : 'py-2.5'} grid ${cols} gap-3 items-center hover:bg-slate-50 cursor-pointer transition-colors`}>
        <span className={`text-sm tabular-nums ${isPast ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>{fmtDate(s.scheduled_date)}</span>
        <span className={`text-sm ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>{s.type ?? '—'}</span>
        <Cell v={total}    bold  muted={isPast} />
        <Cell v={novos}          muted={isPast} />
        <Cell v={velhos}         muted={isPast} />
        <Cell v={emAberto > 0 ? emAberto : null} danger={emAberto > 0} />
        <Cell v={guests > 0 ? guests : null} muted={isPast} />
        <div className="text-center border-l border-border/50 pl-3">
          {isPast && conv !== null
            ? <span className={`text-sm font-medium ${conv >= 50 ? 'text-emerald-600' : conv > 0 ? 'text-amber-500' : 'text-muted-foreground/60'}`}>{conv}%</span>
            : <span className="text-muted-foreground/25 text-sm">—</span>}
        </div>
        <div className="text-center">
          {money
            ? <span className={`text-sm tabular-nums ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>{money}</span>
            : <span className="text-muted-foreground/25 text-sm">—</span>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-1 border-b border-border">
          <TabBtn active={tab === 'degustacoes'} onClick={() => setTab('degustacoes')}>Degustações</TabBtn>
          <TabBtn active={tab === 'aberto'}      onClick={() => setTab('aberto')}>Lista em aberto</TabBtn>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={copyAvailableDates}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-white text-sm font-medium text-foreground hover:bg-muted/40 transition-colors">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar datas disponíveis'}
          </button>
          <button onClick={() => setQrOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-white text-sm font-medium text-foreground hover:bg-muted/40 transition-colors">
            <QrCode className="w-4 h-4" />
            QR Code cardápio
          </button>
          <button onClick={() => setNewOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Nova degustação
          </button>
        </div>
      </div>

      {tab === 'degustacoes' && (
        <>
          <p className="text-sm text-muted-foreground mb-5">
            Sessões de degustação são o principal canal de conversão do Rondello. Acompanhe quantos casais novos participam, quantos fecham contrato e quanto já foi pago em cada sessão.
          </p>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-5">
            <CalendarDays className="w-4 h-4" />
            <span>{allSorted.length} sessões · {upcoming.length} agendadas</span>
          </div>

          {loading ? (
            <div className="bg-white border border-border rounded-2xl py-16 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : allSorted.length === 0 ? (
            <div className="bg-white border border-border rounded-2xl py-16 text-center text-muted-foreground text-sm">Nenhuma degustação cadastrada.</div>
          ) : (
            <div className="space-y-4">
              {upcoming.length > 0 && (
                <div className="bg-white border-2 border-primary/20 rounded-2xl overflow-hidden">
                  <div className="px-5 py-2 bg-primary/5 border-b border-primary/15 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary/70">Próximas sessões</span>
                    <span className="ml-auto text-xs text-primary/50">{upcoming.length} agendada{upcoming.length > 1 ? 's' : ''}</span>
                  </div>
                  <TableHeader />
                  <div className="divide-y divide-border/50">
                    {upcoming.map(s => <SessionRow key={s.id} s={s} />)}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div className="bg-white border border-border rounded-2xl overflow-hidden mt-8">
                  <div className="px-5 py-2 bg-muted/20 border-b border-border/60 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">Histórico</span>
                    <span className="ml-auto text-xs text-muted-foreground/40">{past.length} sessão{past.length > 1 ? 'ões' : ''}</span>
                  </div>
                  <TableHeader />
                  <div className="divide-y divide-border/40">
                    {visiblePast.map(s => <SessionRow key={s.id} s={s} isPast />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {past.length > 15 && (
            <div className="flex items-center gap-3 mt-3 justify-center">
              {visibleCount < past.length && (
                <button onClick={() => setVisibleCount(v => v + 15)}
                  className="px-4 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                  Mostrar mais sessões
                </button>
              )}
              {visibleCount > 15 && (
                <button onClick={() => setVisibleCount(15)}
                  className="px-4 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                  Mostrar menos
                </button>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'aberto' && (
        <ListaAbertoTab
          rows={abertoRows}
          loading={abertoLoading}
          onNavigate={id => navigate(`/events/${id}`)}
        />
      )}

      {newOpen && (
        <NewSessionModal
          onClose={() => setNewOpen(false)}
          onCreated={(s) => { setSessions(prev => [s, ...prev]); setNewOpen(false); navigate(`/tastings/${s.id}`); }}
        />
      )}

      {qrOpen && createPortal(
        <QrModal onClose={() => setQrOpen(false)} qrCopied={qrCopied} setQrCopied={setQrCopied} />,
        document.body
      )}
    </div>
  );
}

// ── QR Modal ──────────────────────────────────────────────────────────────────
function QrModal({ onClose, qrCopied, setQrCopied }: {
  onClose: () => void;
  qrCopied: boolean;
  setQrCopied: (v: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const MENU_URL = 'https://rondellobuffet-app.com.br/menu';

  const copyLink = () => {
    navigator.clipboard.writeText(MENU_URL).then(() => {
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2500);
    });
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qrcode-cardapio-rondello.png';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center gap-5" onClick={e => e.stopPropagation()}>
        <div className="w-full flex items-center justify-between">
          <p className="text-base font-bold text-foreground">QR Code — Cardápio</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <XIcon className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-3 border border-border rounded-2xl bg-white">
          <QRCodeCanvas
            ref={canvasRef}
            value={MENU_URL}
            size={220}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
          />
        </div>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          QR code fixo — sempre o mesmo. Imprime e coloca na mesa. A página detecta automaticamente o cardápio do dia.
        </p>

        <div className="w-full flex gap-2">
          <button onClick={download}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/40 transition-colors">
            <Download className="w-4 h-4" />
            Baixar PNG
          </button>
          <button onClick={copyLink}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${qrCopied ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-border text-foreground hover:bg-muted/40'}`}>
            {qrCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {qrCopied ? 'Copiado!' : 'Copiar link'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}>
      {children}
    </button>
  );
}

// ─── Cell ─────────────────────────────────────────────────────────────────────
function Cell({ v, bold, muted, danger }: { v: number | string | null | undefined; bold?: boolean; muted?: boolean; danger?: boolean }) {
  if (v == null || v === 0 || v === '') return <span className="text-center block text-muted-foreground/25 text-sm">—</span>;
  return (
    <span className={`text-center block text-sm tabular-nums ${bold ? 'font-semibold' : ''} ${danger ? 'text-red-500 font-semibold' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>
      {v}
    </span>
  );
}

// ─── Lista em aberto tab ──────────────────────────────────────────────────────
function ListaAbertoTab({ rows, loading, onNavigate }: {
  rows: AbertoRow[];
  loading: boolean;
  onNavigate: (id: string) => void;
}) {
  if (loading) return <div className="bg-white border border-border rounded-2xl py-16 text-center text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Lista de todos os casais que fizeram degustação e ainda estão com o status em aberto.
      </p>
      {rows.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl py-16 text-center text-muted-foreground text-sm">
          Nenhum evento em aberto com degustação realizada.
        </div>
      ) : (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_160px_160px_90px_120px_120px] gap-3 px-5 py-2.5 bg-muted/30 border-b border-border">
            {['Evento', 'Assessora', 'Local', 'Conv.', 'Data do evento', 'Última degustação'].map(h => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-border/50">
            {rows.map(row => {
              const sc = getStatusCfg(row.status);
              return (
                <div key={row.event_id}
                  className="grid grid-cols-[1fr_160px_160px_90px_120px_120px] gap-3 px-5 py-3 items-center hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onNavigate(row.event_id)}>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">{row.event_name ?? '—'}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold mt-0.5 ${sc.cls}`}>{sc.label}</span>
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{row.assessor_name ?? '—'}</span>
                  <span className="text-sm text-muted-foreground truncate">{row.venue_name ?? '—'}</span>
                  <span className="text-sm tabular-nums text-foreground">{row.guest_count ?? '—'}</span>
                  <span className="text-sm tabular-nums text-foreground">{fmtDate(row.event_date)}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{fmtDate(row.last_tasting_date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Session Modal ────────────────────────────────────────────────────────
function NewSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Session) => void }) {
  const [date,   setDate]   = useState('');
  const [type,   setType]   = useState('Jantar');
  const [maxC,   setMaxC]   = useState('4');
  const [local,  setLocal]  = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!date)  { toast.error('Informe a data'); return; }
    if (!local) { toast.error('Informe o local'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('tasting_sessions' as any)
      .insert({ scheduled_date: date, type, max_couples: parseInt(maxC) || 4, location: local })
      .select().single();
    if (error) { console.error('[TastingsPage] criar degustação:', error); toast.error('Erro ao criar: ' + error.message); setSaving(false); return; }
    toast.success('Degustação criada');
    onCreated(data as Session);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Nova degustação</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <ModalField label="Data">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </ModalField>
          <ModalField label="Tipo">
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20">
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </ModalField>
          <ModalField label="Local">
            <input value={local} onChange={e => setLocal(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Ex: Salão Jardim" />
          </ModalField>
          <ModalField label="Máx. casais">
            <input type="number" value={maxC} onChange={e => setMaxC(e.target.value)} min={1}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </ModalField>
          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? 'Criando...' : 'Criar degustação'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
