import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'rondello_cardapio_lead';
const IG_URL = 'https://www.instagram.com/rondellobuffet/';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Countdown ─────────────────────────────────────────────────────────────────

function useCountdown(targetDate: string | null) {
  const [diff, setDiff] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const ms = new Date(targetDate).getTime() - Date.now();
      if (ms <= 0) { setDiff({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setDiff({
        days:    Math.floor(ms / 86400000),
        hours:   Math.floor((ms % 86400000) / 3600000),
        minutes: Math.floor((ms % 3600000) / 60000),
        seconds: Math.floor((ms % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return diff;
}

function CountdownCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-white/10 rounded-2xl px-4 py-3 min-w-[64px]">
      <span className="text-3xl font-black text-white tabular-nums leading-none">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

// ── Lead Form ─────────────────────────────────────────────────────────────────

function LeadForm({ tastingId, onDone }: { tastingId: string; onDone: (lead: LeadData) => void }) {
  const [name,      setName]      = useState('');
  const [whatsapp,  setWhatsapp]  = useState('');
  const [email,     setEmail]     = useState('');
  const [eventDate, setEventDate] = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

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
    <div className="min-h-screen bg-gradient-to-br from-[#0F1830] via-[#1B2A5C] to-[#253775] flex flex-col items-center justify-center px-6 py-12">
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
          {[
            { label: 'Nome do casal *', value: name,      set: setName,      type: 'text',  ph: 'Ex: Ana & Pedro' },
            { label: 'WhatsApp *',      value: whatsapp,  set: setWhatsapp,  type: 'tel',   ph: '(11) 99999-9999' },
            { label: 'E-mail',          value: email,     set: setEmail,     type: 'email', ph: 'opcional' },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">{f.label}</label>
              <input value={f.value} onChange={e => f.set(e.target.value)} type={f.type} placeholder={f.ph}
                className="w-full bg-white/15 text-white placeholder-white/30 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30" />
            </div>
          ))}
          <div>
            <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">Data estimada do evento</label>
            <input value={eventDate} onChange={e => setEventDate(e.target.value)} type="date"
              className="w-full bg-white/15 text-white placeholder-white/30 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30" />
          </div>
          {err && <p className="text-red-300 text-xs font-medium">{err}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-yellow-400 disabled:opacity-60 text-[#1B2A5C] font-black rounded-2xl py-3.5 text-sm mt-2">
            {saving ? 'Salvando…' : 'Ver o cardápio →'}
          </button>
        </form>
      </div>
      <p className="text-white/20 text-[10px] mt-6 text-center">
        Seus dados são usados apenas pelo Rondello Buffet.
      </p>
    </div>
  );
}

// ── Menu Page ─────────────────────────────────────────────────────────────────

function MenuPage({ lead, tasting }: { lead: LeadData; tasting: TastingToday }) {
  const cd = useCountdown(lead.event_date);
  const firstName = lead.name.split('&')[0]?.trim().split(' ')[0] ?? lead.name;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1830] via-[#1B2A5C] to-[#253775] pb-16">
      <div className="px-6 pt-14 pb-8 text-center">
        <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">🍽</span>
        </div>
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Rondello Buffet</p>
        <h1 className="text-3xl font-black text-white leading-tight">Olá, {firstName}! 💍</h1>
        <p className="text-white/40 text-sm mt-2">
          {tasting.type ? `Degustação de ${tasting.type.toLowerCase()}` : 'Degustação'}
        </p>
      </div>

      {cd && lead.event_date && (
        <div className="px-6 mb-8">
          <p className="text-center text-white/50 text-[11px] font-bold uppercase tracking-widest mb-3">
            Contagem para o seu evento
          </p>
          <div className="flex justify-center gap-3">
            <CountdownCard label="dias"  value={cd.days} />
            <CountdownCard label="horas" value={cd.hours} />
            <CountdownCard label="min"   value={cd.minutes} />
            <CountdownCard label="seg"   value={cd.seconds} />
          </div>
        </div>
      )}

      {!lead.event_date && (
        <p className="text-white/30 text-sm text-center px-6 mb-8">Ainda sem data definida — sem pressa! 😊</p>
      )}

      <div className="px-4 mb-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6">
          <p className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-4">Cardápio de hoje</p>
          {tasting.menu_text ? (
            <div
              className="prose prose-invert prose-sm max-w-none text-white/80 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: tasting.menu_text }}
            />
          ) : (
            <p className="text-white/30 text-sm text-center py-4">Cardápio ainda não publicado 🍴</p>
          )}
        </div>
      </div>

      <div className="px-4">
        <a href={IG_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-4 bg-white/10 rounded-3xl p-5 active:scale-[0.98] transition-transform">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">@rondellobuffet</p>
            <p className="text-white/40 text-xs">Veja nossos eventos no Instagram</p>
          </div>
        </a>
      </div>

      <p className="text-center text-white/20 text-[10px] mt-10">Rondello Buffet · Desde 1998</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CardapioPublicoPage() {
  const [tasting,  setTasting]  = useState<TastingToday | null>(null);
  const [lead,     setLead]     = useState<LeadData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [noTasting, setNoTasting] = useState(false);

  // Recupera lead do localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) { try { setLead(JSON.parse(stored)); } catch { /* ignore */ } }
  }, []);

  // Busca a degustação de hoje (ou a próxima futura)
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
        if (error || !data) { setNoTasting(true); }
        else { setTasting(data); }
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F1830] via-[#1B2A5C] to-[#253775] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
      </div>
    );
  }

  if (noTasting || !tasting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F1830] via-[#1B2A5C] to-[#253775] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-6xl mb-4">🍽</p>
          <h1 className="text-white font-black text-2xl mb-2">Rondello Buffet</h1>
          <p className="text-white/40 text-sm">Nenhuma degustação agendada no momento.</p>
        </div>
      </div>
    );
  }

  if (!lead) return <LeadForm tastingId={tasting.id} onDone={setLead} />;

  return <MenuPage lead={lead} tasting={tasting} />;
}
