import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, BookOpen, ChevronRight, Instagram } from 'lucide-react';
import logoRondello from '@/assets/logo-rondello.png';

const STORAGE_KEY = 'rondello_cardapio_lead_v2';
const IG_URL = 'https://www.instagram.com/buffetrondello/';

const COMO_CONHECEU = [
  'Instagram',
  'Indicação de amigo',
  'Google',
  'Cerimonialista / Assessora',
  'Facebook',
  'Outro',
];

interface TastingToday {
  id: string;
  scheduled_date: string;
  type: string | null;
  menu_text: string | null;
}

interface LeadData {
  name: string;
  event_date: string | null;
  registered_at: string; // ISO timestamp — determina almoço vs jantar
}

// ── Days Countdown ────────────────────────────────────────────────────────────

function DaysCountdown({ eventDate }: { eventDate: string }) {
  const days = Math.max(0, Math.ceil((new Date(eventDate).getTime() - Date.now()) / 86400000));
  return (
    <div className="bg-[#1B2A5C] rounded-3xl p-6 text-center">
      <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">Faltam para o seu evento</p>
      <p className="text-7xl font-black text-white leading-none tabular-nums">{days}</p>
      <p className="text-white/50 font-bold mt-2">{days === 1 ? 'dia' : 'dias'}</p>
    </div>
  );
}

// ── Lead Form ─────────────────────────────────────────────────────────────────

function LeadForm({ tastingId, onDone }: { tastingId: string; onDone: (lead: LeadData) => void }) {
  const [name,         setName]         = useState('');
  const [whatsapp,     setWhatsapp]     = useState('');
  const [email,        setEmail]        = useState('');
  const [eventDate,    setEventDate]    = useState('');
  const [como,         setComo]         = useState('');
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) { setErr('Nome e WhatsApp são obrigatórios.'); return; }
    setSaving(true); setErr('');
    try {
      await (supabase as any).from('tasting_leads').insert({
        tasting_session_id: tastingId,
        name:       name.trim(),
        whatsapp:   whatsapp.trim(),
        email:      email.trim() || null,
        event_date: eventDate || null,
        source:     como || null,
      });
      const lead: LeadData = { name: name.trim(), event_date: eventDate || null, registered_at: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lead));
      onDone(lead);
    } catch {
      setErr('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base text-gray-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1B2A5C]/20 focus:border-[#1B2A5C]/40 bg-white";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-5 py-4">
        <img src={logoRondello} alt="Rondello Buffet" className="h-8" />
      </div>

      <div className="flex-1 px-5 py-8 flex flex-col gap-6 max-w-md mx-auto w-full">
        <div>
          <h1 className="text-2xl font-black text-[#1B2A5C] leading-tight">Bem-vindos à degustação! 👋</h1>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            Preencha uma vez e acesse o cardápio sempre que quiser — sem precisar repetir.
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Nome *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Maria"
              className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">WhatsApp *</label>
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
              placeholder="(11) 99999-9999" type="tel"
              className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="opcional" type="email"
              className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Data do evento</label>
            <input value={eventDate} onChange={e => setEventDate(e.target.value)}
              type="date"
              className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Como nos conheceu?</label>
            <select value={como} onChange={e => setComo(e.target.value)}
              className={`${inputCls} appearance-none`}>
              <option value="">Selecione...</option>
              {COMO_CONHECEU.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {err && <p className="text-red-500 text-xs font-medium">{err}</p>}

          <button type="submit" disabled={saving}
            className="w-full bg-[#1B2A5C] disabled:opacity-60 text-white font-black rounded-2xl py-4 text-base mt-1 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            {saving ? 'Salvando…' : <>Ver o cardápio <ChevronRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p className="text-center text-gray-300 text-[11px]">
          Seus dados são usados apenas pelo Rondello Buffet.
        </p>
      </div>
    </div>
  );
}

// ── Menu Page ─────────────────────────────────────────────────────────────────

type MenuTab = 'evento' | 'cardapio';

function MenuPage({ lead, tasting }: { lead: LeadData; tasting: TastingToday }) {
  const [tab, setTab] = useState<MenuTab>('evento');
  const firstName = lead.name.split('&')[0]?.trim().split(' ')[0] ?? lead.name;

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
        <img src={logoRondello} alt="Rondello Buffet" className="h-7" />
        <div className="text-right">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Olá,</p>
          <p className="text-sm font-black text-[#1B2A5C]">{firstName}</p>
        </div>
      </div>

      {/* Tasting badge */}
      <div className="bg-[#1B2A5C] px-5 py-3 flex items-center gap-2">
        <p className="text-white text-xs font-bold">
          Degustação{tasting.type ? ` de ${tasting.type}` : ''} · {
            new Date(tasting.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
          }
        </p>
      </div>

      {/* Tab bar — Meu Evento primeiro */}
      <div className="bg-white border-b border-gray-100 flex">
        {([['evento', 'Meu Evento', CalendarDays], ['cardapio', 'Cardápio', BookOpen]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key as MenuTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold transition-colors border-b-2 ${
              tab === key ? 'border-[#1B2A5C] text-[#1B2A5C]' : 'border-transparent text-gray-400'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 max-w-md mx-auto w-full space-y-4">

        {tab === 'evento' && (
          <>
            {lead.event_date ? (
              <>
                <DaysCountdown eventDate={lead.event_date} />
                <div className="bg-white rounded-3xl p-5 shadow-sm flex items-center gap-3">
                  <CalendarDays className="w-5 h-5 text-[#C9A84C] shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Data do seu evento</p>
                    <p className="text-base font-black text-[#1B2A5C] mt-0.5">
                      {new Date(lead.event_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-3xl p-8 text-center shadow-sm">
                <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="font-bold text-gray-500">Sem data definida ainda</p>
                <p className="text-sm text-gray-400 mt-1">Quando tiver uma data, a contagem aparece aqui</p>
              </div>
            )}

            {/* Instagram */}
            <a href={IG_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-4 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-3xl p-5 active:scale-[0.98] transition-transform shadow-md shadow-pink-200">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Instagram className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-black text-sm">Siga o @buffetrondello</p>
                <p className="text-white/70 text-xs mt-0.5">Veja os eventos que realizamos e inspire-se ✨</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/60 shrink-0" />
            </a>
          </>
        )}

        {tab === 'cardapio' && (
          tasting.menu_text ? (
            <div className="bg-white rounded-3xl p-6 shadow-sm">
              <p className="text-[10px] font-black text-[#C9A84C] uppercase tracking-widest mb-4">Cardápio de hoje</p>
              <div
                className="text-sm leading-relaxed text-gray-700
                  [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-[#1B2A5C] [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:first:mt-0
                  [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-[#1B2A5C] [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:first:mt-0
                  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[#1B2A5C] [&_h3]:mt-3 [&_h3]:mb-1
                  [&_p]:mb-2 [&_p]:leading-relaxed
                  [&_strong]:font-bold [&_strong]:text-[#1B2A5C]
                  [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-3 [&_ul]:mt-1
                  [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-3
                  [&_li]:mb-0.5
                  [&_br]:block"
                dangerouslySetInnerHTML={{ __html: tasting.menu_text }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
              <p className="text-2xl mb-3">🍽</p>
              <p className="font-bold text-gray-500">Cardápio não publicado ainda</p>
              <p className="text-sm text-gray-400 mt-1">Em breve estará disponível</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CardapioPublicoPage() {
  const [tasting,   setTasting]   = useState<TastingToday | null>(null);
  const [lead,      setLead]      = useState<LeadData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [noTasting, setNoTasting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) { try { setLead(JSON.parse(stored)); } catch { /* ignore */ } }
  }, []);

  useEffect(() => { void (async () => {
    const today = new Date().toISOString().split('T')[0];

    // Hora de referência = quando a pessoa se registrou (não hora atual)
    const stored = localStorage.getItem(STORAGE_KEY);
    let refHour = new Date().getHours();
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.registered_at) refHour = new Date(parsed.registered_at).getHours();
      } catch { /* usa hora atual como fallback */ }
    }
    const hour = refHour;

    const { data, error } = await (supabase as any)
      .from('tasting_sessions')
      .select('id, scheduled_date, type, menu_text')
      .eq('scheduled_date', today)
      .order('type', { ascending: true }); // 'almoco' < 'jantar'

    if (error || !data || data.length === 0) {
      // Sem degustação hoje — busca próxima futura
      const { data: next } = await (supabase as any)
        .from('tasting_sessions')
        .select('id, scheduled_date, type, menu_text')
        .gt('scheduled_date', today)
        .order('scheduled_date', { ascending: true })
        .limit(1).single();
      if (next) setTasting(next); else setNoTasting(true);
      setLoading(false); return;
    }

    if (data.length === 1) { setTasting(data[0]); setLoading(false); return; }

    // Antes das 18h → almoço; a partir das 18h → jantar
    // Usa includes() para tolerar acentos, maiúsculas e variações ("Almoço", "almoco", etc.)
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const lunch  = data.find((d: any) => norm(d.type ?? '').includes('almo')) ?? data[0];
    const dinner = data.find((d: any) => norm(d.type ?? '').includes('jantar')) ?? data[data.length - 1];
    setTasting(hour < 18 ? lunch : dinner);
    setLoading(false);
  })(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <img src={logoRondello} alt="Rondello Buffet" className="h-10 mx-auto mb-8" />
          <div className="w-8 h-8 rounded-full border-2 border-[#1B2A5C]/20 border-t-[#1B2A5C] animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (noTasting || !tasting) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 gap-6">
        <img src={logoRondello} alt="Rondello Buffet" className="h-10" />
        <div className="bg-white rounded-3xl p-8 text-center shadow-sm w-full max-w-sm">
          <p className="text-2xl mb-3">🍽</p>
          <p className="font-bold text-gray-700">Nenhuma degustação agendada</p>
          <p className="text-sm text-gray-400 mt-1">Em breve novas datas estarão disponíveis.</p>
        </div>
      </div>
    );
  }

  if (!lead) return <LeadForm tastingId={tasting.id} onDone={setLead} />;

  return <MenuPage lead={lead} tasting={tasting} />;
}
