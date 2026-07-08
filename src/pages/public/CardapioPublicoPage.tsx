import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChefHat, Instagram, CalendarDays, BookOpen, ChevronRight, ChevronLeft } from 'lucide-react';

const STORAGE_KEY = 'rondello_cardapio_lead_v2';
const IG_URL = 'https://www.instagram.com/rondellobuffet/';

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
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const icon = size === 'lg' ? 'w-14 h-14 rounded-2xl' : size === 'md' ? 'w-11 h-11 rounded-xl' : 'w-8 h-8 rounded-lg';
  const title = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base';
  return (
    <div className="flex items-center gap-3">
      <div className={`${icon} bg-[#1B2A5C] flex items-center justify-center shrink-0`}>
        <ChefHat className={size === 'lg' ? 'w-7 h-7' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} color="#C9A84C" />
      </div>
      <div>
        <p className={`${title} font-black tracking-wider text-[#1B2A5C] leading-none`}>RONDELLO</p>
        <p className="text-[10px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase leading-none mt-0.5">Buffet</p>
      </div>
    </div>
  );
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
  const [name,       setName]       = useState('');
  const [whatsapp,   setWhatsapp]   = useState('');
  const [email,      setEmail]      = useState('');
  const [eventDate,  setEventDate]  = useState('');
  const [como,       setComo]       = useState('');
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');

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
      const lead: LeadData = { name: name.trim(), event_date: eventDate || null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lead));
      onDone(lead);
    } catch {
      setErr('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4">
        <Logo size="md" />
      </div>

      <div className="flex-1 px-5 py-8 flex flex-col gap-6 max-w-md mx-auto w-full">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-black text-[#1B2A5C] leading-tight">Bem-vindos à degustação! 👋</h1>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            Preencha uma vez e acesse o cardápio sempre que quiser — sem precisar repetir.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Nome *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Ana & Pedro"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1B2A5C]/20 focus:border-[#1B2A5C]/40" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">WhatsApp *</label>
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
              placeholder="(11) 99999-9999" type="tel"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1B2A5C]/20 focus:border-[#1B2A5C]/40" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="opcional" type="email"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#1B2A5C]/20 focus:border-[#1B2A5C]/40" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Data do evento</label>
            <input value={eventDate} onChange={e => setEventDate(e.target.value)}
              type="date"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#1B2A5C]/20 focus:border-[#1B2A5C]/40" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Como nos conheceu?</label>
            <select value={como} onChange={e => setComo(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#1B2A5C]/20 focus:border-[#1B2A5C]/40 bg-white appearance-none">
              <option value="">Selecione...</option>
              {COMO_CONHECEU.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {err && <p className="text-red-500 text-xs font-medium">{err}</p>}

          <button type="submit" disabled={saving}
            className="w-full bg-[#1B2A5C] disabled:opacity-60 text-white font-black rounded-2xl py-4 text-sm mt-1 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
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

type MenuTab = 'cardapio' | 'contagem';

function MenuPage({ lead, tasting }: { lead: LeadData; tasting: TastingToday }) {
  const [tab, setTab] = useState<MenuTab>('cardapio');
  const firstName = lead.name.split('&')[0]?.trim().split(' ')[0] ?? lead.name;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
        <Logo size="md" />
        <div className="text-right">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Olá,</p>
          <p className="text-sm font-black text-[#1B2A5C]">{firstName}</p>
        </div>
      </div>

      {/* Tasting badge */}
      <div className="bg-[#1B2A5C] px-5 py-3 flex items-center gap-2">
        <ChefHat className="w-4 h-4 text-[#C9A84C]" />
        <p className="text-white text-xs font-bold">
          Degustação{tasting.type ? ` de ${tasting.type}` : ''} · {
            new Date(tasting.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
          }
        </p>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 flex">
        {([['cardapio', 'Cardápio', BookOpen], ['contagem', 'Meu Evento', CalendarDays]] as const).map(([key, label, Icon]) => (
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
        {tab === 'cardapio' && (
          <>
            {tasting.menu_text ? (
              <div className="bg-white rounded-3xl p-6 shadow-sm">
                <p className="text-[10px] font-black text-[#C9A84C] uppercase tracking-widest mb-4">Cardápio de hoje</p>
                <div
                  className="prose prose-sm max-w-none text-gray-700 leading-relaxed [&_h1]:text-[#1B2A5C] [&_h2]:text-[#1B2A5C] [&_h3]:text-[#1B2A5C] [&_strong]:text-[#1B2A5C]"
                  dangerouslySetInnerHTML={{ __html: tasting.menu_text }}
                />
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
                <ChefHat className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="font-bold text-gray-500">Cardápio não publicado ainda</p>
                <p className="text-sm text-gray-400 mt-1">Em breve estará disponível</p>
              </div>
            )}

            {/* Instagram */}
            <a href={IG_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-4 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-3xl p-5 active:scale-[0.98] transition-transform shadow-md shadow-pink-200">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Instagram className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-black text-sm">Siga o @rondellobuffet</p>
                <p className="text-white/70 text-xs mt-0.5">Veja os eventos que realizamos e inspire-se ✨</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/60 shrink-0" />
            </a>
          </>
        )}

        {tab === 'contagem' && (
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
                <div className="bg-[#C9A84C]/10 rounded-3xl p-5">
                  <p className="text-sm text-[#1B2A5C] font-medium leading-relaxed text-center">
                    Estamos animados para fazer parte do dia mais especial de vocês! 🎉
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
                <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="font-bold text-gray-500">Sem data definida ainda</p>
                <p className="text-sm text-gray-400 mt-1">Quando tiver uma data, a contagem aparece aqui</p>
              </div>
            )}
          </>
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

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    ;(supabase as any)
      .from('tasting_sessions')
      .select('id, scheduled_date, type, menu_text')
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(1)
      .single()
      .then(({ data, error }: any) => {
        if (error || !data) setNoTasting(true);
        else setTasting(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Logo size="lg" />
          <div className="mt-8 w-8 h-8 rounded-full border-2 border-[#1B2A5C]/20 border-t-[#1B2A5C] animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (noTasting || !tasting) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 gap-6">
        <Logo size="lg" />
        <div className="bg-white rounded-3xl p-8 text-center shadow-sm w-full max-w-sm">
          <ChefHat className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-bold text-gray-700">Nenhuma degustação agendada</p>
          <p className="text-sm text-gray-400 mt-1">Em breve novas datas estarão disponíveis.</p>
        </div>
      </div>
    );
  }

  if (!lead) return <LeadForm tastingId={tasting.id} onDone={setLead} />;

  return <MenuPage lead={lead} tasting={tasting} />;
}
