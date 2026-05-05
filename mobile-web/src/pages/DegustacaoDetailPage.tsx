import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar, MapPin, Users } from 'lucide-react';
import { fetchAssessoria, fetchDegustacao, fetchEvento } from '../api/bubble';
import { BubbleDegustacao, BubbleEvento } from '../types';
import { fmtDate } from '../lib/format';

type Tab = 'convidados' | 'informacoes';

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    'Fechado':     'bg-emerald-100 text-emerald-700',
    'Cancelado':   'bg-red-100 text-red-600',
    'Não fechou':  'bg-gray-100 text-gray-500',
    'Negociando':  'bg-amber-100 text-amber-700',
    '1º Contato':  'bg-blue-100 text-blue-600',
  };
  const cls = colors[status] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}>
      {status}
    </span>
  );
}

function EventoRow({ evento, assessoriaMap }: {
  evento: BubbleEvento;
  assessoriaMap: Record<string, string>;
}) {
  const navigate = useNavigate();
  const date = evento.dataDoEvento ? new Date(evento.dataDoEvento) : null;
  const day  = date?.toLocaleDateString('pt-BR', { day: '2-digit' });
  const mon  = date?.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  const isPast = date ? date < new Date() : false;
  const assessorNome = evento.Assessoria ? (assessoriaMap[evento.Assessoria] ?? '—') : '—';

  return (
    <button
      onClick={() => navigate(`/eventos/${evento._id}`)}
      className="w-full flex items-center gap-3 bg-white rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform text-left"
    >
      <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 ${
        isPast ? 'bg-gray-50' : 'bg-ron-900'
      }`}>
        <span className={`text-[9px] font-bold ${isPast ? 'text-gray-400' : 'text-gold-300'}`}>{mon}</span>
        <span className={`text-xl font-black leading-none ${isPast ? 'text-gray-500' : 'text-white'}`}>
          {day ?? '—'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 truncate text-sm">
          {evento.NomeDoEvento ?? evento.NomeDoContratante ?? '—'}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <StatusBadge status={evento.status} />
          {assessorNome !== '—' && (
            <span className="text-[10px] text-gray-400 font-medium">{assessorNome}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {evento.QtdConvidados != null && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Users className="w-3 h-3" />{evento.QtdConvidados} conv.
            </span>
          )}
          {date && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Calendar className="w-3 h-3" />{fmtDate(evento.dataDoEvento)}
            </span>
          )}
        </div>
      </div>

      <ArrowRight className="w-4 h-4 text-gray-200 shrink-0" />
    </button>
  );
}

export default function DegustacaoDetailPage() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const [degu, setDegu]             = useState<BubbleDegustacao | null>(null);
  const [eventos, setEventos]       = useState<BubbleEvento[]>([]);
  const [assessoriaMap, setAssessoriaMap] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [error, setError]           = useState(false);
  const [activeTab, setActiveTab]   = useState<Tab>('convidados');

  useEffect(() => {
    if (!id) return;
    fetchDegustacao(id)
      .then(async (r) => {
        const d = r.response;
        setDegu(d);

        const eventIds: string[] = [
          ...(d.Eventos ?? []),
          ...(d.evento ? [d.evento] : []),
        ];

        if (eventIds.length > 0) {
          setLoadingEventos(true);
          const evtResults = await Promise.allSettled(
            eventIds.map((eid) => fetchEvento(eid).then((res) => res.response))
          );
          const evts = evtResults
            .filter((r): r is PromiseFulfilledResult<BubbleEvento> => r.status === 'fulfilled')
            .map((r) => r.value);
          setEventos(evts);

          // fetch assessoria names
          const aIds = [...new Set(evts.map((e) => e.Assessoria).filter(Boolean) as string[])];
          const aResults = await Promise.allSettled(aIds.map((aid) => fetchAssessoria(aid)));
          const aMap: Record<string, string> = {};
          aResults.forEach((r, i) => {
            if (r.status === 'fulfilled') aMap[aIds[i]] = r.value.response.Nome ?? '';
          });
          setAssessoriaMap(aMap);
          setLoadingEventos(false);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const dateLabel = degu?.data
    ? new Date(degu.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'convidados',  label: 'Convidados'  },
    { key: 'informacoes', label: 'Informações' },
  ];

  return (
    <div className="pb-36 max-w-lg mx-auto">
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-gold-400 animate-pulse" />
      )}

      {/* ── Hero ──────────────────────────────────────────────────────── */}
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
            <div className="h-7 w-48 bg-white/20 rounded-xl animate-pulse" />
            <div className="h-4 w-28 bg-white/10 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white leading-tight">
              {dateLabel ? `Degustação dia ${dateLabel}` : 'Degustação'}
            </h1>
            {degu?.tipo_degust && (
              <p className="text-white/50 text-sm font-medium mt-1">{degu.tipo_degust}</p>
            )}
            {degu?.data && (
              <span className="flex items-center gap-1.5 text-gold-300/80 text-xs font-medium mt-2">
                <MapPin className="w-3 h-3" />
                {fmtDate(degu.data)}
              </span>
            )}
          </>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex bg-white border-b border-gray-100 sticky top-0 z-30">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
              activeTab === t.key
                ? 'text-ron-900 border-b-2 border-ron-900'
                : 'text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 space-y-3">

        {error || (!loading && !degu) ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500">Erro ao carregar degustação.</p>
          </div>
        ) : activeTab === 'convidados' ? (
          <>
            {loadingEventos ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-black/5 rounded-3xl animate-pulse" />
              ))
            ) : eventos.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center shadow-sm">
                <p className="text-gray-400 text-sm">Nenhum evento vinculado.</p>
              </div>
            ) : (
              eventos.map((e) => (
                <EventoRow key={e._id} evento={e} assessoriaMap={assessoriaMap} />
              ))
            )}
          </>
        ) : (
          /* ── Informações ── */
          <>
            {degu?.['Cardápio'] && (
              <div className="bg-white rounded-3xl p-5 shadow-sm">
                <p className="text-[11px] font-black text-ron-800 uppercase tracking-widest mb-2">Cardápio</p>
                <p className="text-sm text-gray-700 leading-relaxed">{degu['Cardápio']}</p>
              </div>
            )}

            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <p className="text-[11px] font-black text-ron-800 uppercase tracking-widest mb-3">
                Informações importantes
              </p>
              {degu?.['Observações'] ? (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {degu['Observações']}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Sem observações.</p>
              )}
            </div>

            {degu?.convidados != null && (
              <div className="bg-white rounded-3xl p-5 shadow-sm flex items-center gap-3">
                <Users className="w-5 h-5 text-gold-400" />
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total de convidados</p>
                  <p className="text-2xl font-black text-ron-900 leading-none mt-0.5">{degu.convidados}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
