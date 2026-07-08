import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchTastingForMenu, saveTastingLead } from '../api/supabase';

const STORAGE_KEY = 'rondello_menu_lead';
const IG_URL = 'https://www.instagram.com/rondellobuffet/';

// ── Countdown ─────────────────────────────────────────────────────────────────

function useCountdown(targetDate: string | null) {
  const [diff, setDiff] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const ms = new Date(targetDate).getTime() - Date.now();
      if (ms <= 0) { setDiff({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      const days    = Math.floor(ms / 86400000);
      const hours   = Math.floor((ms % 86400000) / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      setDiff({ days, hours, minutes, seconds });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return diff;
}

function CountdownCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 min-w-[64px]">
      <span className="text-3xl font-black text-white tabular-nums leading-none">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

// ── Lead form ─────────────────────────────────────────────────────────────────

interface LeadData { id: string; name: string; event_date: string | null }

function LeadForm({ tastingId, onDone }: { tastingId: string; onDone: (lead: LeadData) => void }) {
  const [name,       setName]       = useState('');
  const [whatsapp,   setWhatsapp]   = useState('');
  const [email,      setEmail]      = useState('');
  const [eventDate,  setEventDate]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) { setErr('Nome e WhatsApp são obrigatórios.'); return; }
    setSaving(true);
    setErr('');
    try {
      const saved = await saveTastingLead({
        tasting_session_id: tastingId,
        name: name.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim() || null,
        event_date: eventDate || null,
      });
      const lead: LeadData = { id: saved.id!, name: saved.name, event_date: saved.event_date ?? null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lead));
      onDone(lead);
    } catch {
      setErr('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1830] via-[#1B2A5C] to-[#253775] flex flex-col items-center justify-center px-6 py-12">
      {/* Logo / título */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">🍽</span>
        </div>
        <h1 className="text-3xl font-black text-white leading-tight">Rondello Buffet</h1>
        <p className="text-white/50 text-sm mt-1 font-medium">Bem-vindos à nossa degustação</p>
      </div>

      <div className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-3xl p-6 shadow-2xl">
        <h2 className="text-white font-black text-lg mb-1">Quem são vocês? 💍</h2>
        <p className="text-white/50 text-xs mb-5 leading-relaxed">
          Preencha uma vez e acesse o cardápio sempre que quiser — sem precisar repetir.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">Nome do casal *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Ana & Pedro"
              className="w-full bg-white/15 text-white placeholder-white/30 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">WhatsApp *</label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(11) 99999-9999"
              type="tel"
              className="w-full bg-white/15 text-white placeholder-white/30 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="opcional"
              type="email"
              className="w-full bg-white/15 text-white placeholder-white/30 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">Data estimada do evento</label>
            <input
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              type="date"
              className="w-full bg-white/15 text-white placeholder-white/30 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>

          {err && <p className="text-red-300 text-xs font-medium">{err}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gold-400 disabled:opacity-60 text-[#1B2A5C] font-black rounded-2xl py-3.5 text-sm mt-2 transition-opacity"
          >
            {saving ? 'Salvando…' : 'Ver o cardápio →'}
          </button>
        </form>
      </div>

      <p className="text-white/20 text-[10px] mt-6 text-center">
        Seus dados são usados apenas pelo Rondello Buffet para entrar em contato com você.
      </p>
    </div>
  );
}

// ── Menu page ─────────────────────────────────────────────────────────────────

function MenuPage({
  lead,
  menu,
}: {
  lead: LeadData;
  menu: { scheduled_date: string; type: string | null; menu_text: string | null };
}) {
  const cd = useCountdown(lead.event_date);
  const firstName = lead.name.split('&')[0]?.trim().split(' ')[0] ?? lead.name;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1830] via-[#1B2A5C] to-[#253775] pb-16">
      {/* Hero */}
      <div className="px-6 pt-14 pb-8 text-center">
        <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">🍽</span>
        </div>
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Rondello Buffet</p>
        <h1 className="text-3xl font-black text-white leading-tight">
          Olá, {firstName}! 💍
        </h1>
        <p className="text-white/40 text-sm mt-2">
          {menu.type ? `Degustação de ${menu.type.toLowerCase()}` : 'Degustação'}
        </p>
      </div>

      {/* Countdown */}
      {cd && lead.event_date && (
        <div className="px-6 mb-8">
          <p className="text-center text-white/50 text-[11px] font-bold uppercase tracking-widest mb-3">
            Contagem para o seu evento
          </p>
          <div className="flex justify-center gap-3">
            <CountdownCard label="dias"    value={cd.days} />
            <CountdownCard label="horas"   value={cd.hours} />
            <CountdownCard label="min"     value={cd.minutes} />
            <CountdownCard label="seg"     value={cd.seconds} />
          </div>
        </div>
      )}

      {!lead.event_date && (
        <div className="px-6 mb-8 text-center">
          <p className="text-white/30 text-sm">
            Ainda sem data definida — sem pressa! 😊
          </p>
        </div>
      )}

      {/* Cardápio */}
      <div className="px-4 mb-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6">
          <p className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-4">
            Cardápio de hoje
          </p>
          {menu.menu_text ? (
            <div
              className="prose prose-invert prose-sm max-w-none text-white/80 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: menu.menu_text }}
            />
          ) : (
            <p className="text-white/30 text-sm text-center py-4">
              Cardápio ainda não publicado 🍴
            </p>
          )}
        </div>
      </div>

      {/* Instagram */}
      <div className="px-4">
        <a
          href={IG_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-3xl p-5 active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">@rondellobuffet</p>
            <p className="text-white/40 text-xs">Veja nossos eventos no Instagram</p>
          </div>
          <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Footer */}
      <p className="text-center text-white/20 text-[10px] mt-10">
        Rondello Buffet · Desde 1998
      </p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MenuPublicoPage() {
  const { id } = useParams<{ id: string }>();
  const [lead,    setLead]    = useState<LeadData | null>(null);
  const [menu,    setMenu]    = useState<{ scheduled_date: string; type: string | null; menu_text: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Recover lead from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setLead(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  // Fetch tasting menu
  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    fetchTastingForMenu(id)
      .then(setMenu)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F1830] via-[#1B2A5C] to-[#253775] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white/80 animate-spin mx-auto mb-4" />
          <p className="text-white/40 text-sm">Carregando…</p>
        </div>
      </div>
    );
  }

  if (notFound || !menu) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F1830] via-[#1B2A5C] to-[#253775] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-6xl mb-4">🍽</p>
          <h1 className="text-white font-black text-2xl mb-2">Rondello Buffet</h1>
          <p className="text-white/40 text-sm">Este link não está disponível.</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return <LeadForm tastingId={id!} onDone={setLead} />;
  }

  return <MenuPage lead={lead} menu={menu} />;
}
