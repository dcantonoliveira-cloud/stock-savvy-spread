import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Calendar, CalendarDays,
  CircleDot, Copy, Link2, MapPin, QrCode, UtensilsCrossed,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchTasting } from '../api/supabase';
import type { Event, TastingSession } from '../types';
import { fmtDate } from '../lib/format';
import { eventDisplayName, eventLocationName, statusLabel, statusBadgeClass } from '../lib/eventFilters';

const TABS = ['Eventos', 'QR Code'] as const;
type Tab = typeof TABS[number];

function useMenuUrl(id: string | undefined) {
  if (!id) return '';
  return `${window.location.origin}/menu/${id}`;
}

export default function DegustacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [degu, setDegu]         = useState<TastingSession | null>(null);
  const [eventos, setEventos]   = useState<Event[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [tab, setTab]           = useState<Tab>('Eventos');
  const [copied, setCopied]     = useState(false);

  const menuUrl = useMenuUrl(id);

  useEffect(() => {
    if (!id) return;
    fetchTasting(id)
      .then(({ linkedEvents, ...session }) => {
        setDegu(session as TastingSession);
        setEventos(linkedEvents);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  function copyLink() {
    navigator.clipboard.writeText(menuUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isPast = degu ? new Date(degu.scheduled_date) < new Date() : false;

  return (
    <div className="pb-36 max-w-lg mx-auto">
      {loading && <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-gold-400 animate-pulse" />}

      {/* Hero */}
      <div className="bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-hero pb-6 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-36 h-36 bg-white/5 rounded-full" />
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center mb-4"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        {loading ? (
          <div className="space-y-2">
            <div className="h-7 w-36 bg-white/20 rounded-xl animate-pulse" />
            <div className="h-4 w-24 bg-white/10 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <UtensilsCrossed className="w-4 h-4 text-gold-400" />
              <p className="text-gold-400 text-xs font-black uppercase tracking-widest">
                {isPast ? 'Realizada' : 'Agendada'}
              </p>
            </div>
            <h1 className="text-2xl font-black text-white leading-tight">Degustação</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {degu?.scheduled_date && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {fmtDate(degu.scheduled_date)}
                </span>
              )}
              {degu?.max_couples != null && (
                <span className="text-gold-300 text-sm font-medium">
                  {degu.max_couples} casais
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-40 bg-[#f2f2f2]/95 backdrop-blur-xl px-4 pt-3 pb-2 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-sm ${
              tab === t ? 'bg-ron-800 text-white shadow-lg shadow-ron-800/30' : 'bg-white text-gray-400'
            }`}
          >
            {t === 'QR Code' && <QrCode className="w-3.5 h-3.5" />}
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          <>{[1,2,3].map((i) => <div key={i} className="h-28 bg-black/5 rounded-3xl animate-pulse" />)}</>
        ) : error || !degu ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500">Erro ao carregar degustação.</p>
          </div>

        ) : tab === 'Eventos' ? (
          eventos.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
              <UtensilsCrossed className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum evento vinculado</p>
            </div>
          ) : (
            eventos.map((ev) => (
              <button
                key={ev.id}
                onClick={() => navigate(`/eventos/${ev.id}`)}
                className="w-full text-left bg-white rounded-3xl p-4 shadow-sm space-y-3 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-gray-900 text-base leading-tight flex-1">
                    {eventDisplayName(ev)}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusBadgeClass(ev.status)}`}>
                      {statusLabel(ev.status)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-200" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  {ev.event_date && (
                    <span className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                      <CalendarDays className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                      {fmtDate(ev.event_date)}
                    </span>
                  )}
                  {eventLocationName(ev) && (
                    <span className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                      {eventLocationName(ev)}
                    </span>
                  )}
                  {!ev.event_date && !eventLocationName(ev) && (
                    <span className="flex items-center gap-2 text-xs text-gray-400">
                      <CircleDot className="w-3.5 h-3.5 shrink-0" />
                      Sem detalhes adicionais
                    </span>
                  )}
                </div>
              </button>
            ))
          )

        ) : (
          /* QR Code tab */
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center gap-5">
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                <QRCodeSVG
                  value={menuUrl}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#1E3A8A"
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="text-center">
                <p className="font-black text-gray-900 text-sm">Cardápio desta degustação</p>
                <p className="text-xs text-gray-400 mt-1">
                  O casal escaneia e acessa o cardápio e a contagem regressiva do evento deles.
                </p>
              </div>
            </div>

            {/* URL + copy */}
            <div className="bg-white rounded-3xl px-4 py-3.5 shadow-sm flex items-center gap-3">
              <Link2 className="w-4 h-4 text-gray-300 shrink-0" />
              <p className="flex-1 text-xs text-gray-400 font-medium truncate">{menuUrl}</p>
              <button
                onClick={copyLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  copied ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Copy className="w-3 h-3" />
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <div className="bg-blue-50 rounded-2xl px-4 py-3">
              <p className="text-xs text-ron-800 font-medium leading-relaxed">
                💡 Imprima ou exiba este QR code na mesa do casal. Eles preenchem nome e WhatsApp na primeira vez — nas próximas abertas, vão direto ao cardápio.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
