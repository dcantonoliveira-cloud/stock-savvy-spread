import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar, Users } from 'lucide-react';
import {
  fetchAssessoria,
  fetchConvidadosDegForDeg,
  fetchDegustacao,
  fetchEvento,
} from '../api/bubble';
import { BubbleConvidadoDeg, BubbleDegustacao, BubbleEvento } from '../types';
import { fmtDate } from '../lib/format';

type Tab = 'convidados' | 'informacoes';

/** Strip Bubble rich-text tags like [highlight=rgb(...)], [b], etc. */
function stripRichText(text: string): string {
  return text.replace(/\[\/?\w[^\]]*\]/g, '').trim();
}

function situacao(evento: BubbleEvento): string {
  return evento.status === 'Fechado' ? 'Fechado / 2º deg.' : 'Cliente Novo';
}

function SituacaoBadge({ evento }: { evento: BubbleEvento }) {
  const isFechado = evento.status === 'Fechado';
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
      isFechado ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600'
    }`}>
      {isFechado ? 'Fechado / 2º deg.' : 'Cliente Novo'}
    </span>
  );
}

function StatPill({
  label, value, accent,
}: { label: string; value: string | number; accent?: string }) {
  return (
    <div className={`flex-1 rounded-2xl px-3 py-2.5 ${accent ?? 'bg-white/10'}`}>
      <p className="text-white/50 text-[9px] font-black uppercase tracking-widest">{label}</p>
      <p className="text-white font-black text-xl leading-none mt-0.5">{value}</p>
    </div>
  );
}

function EventoRow({
  evento, assessoriaMap, qtdConvidados,
}: {
  evento: BubbleEvento;
  assessoriaMap: Record<string, string>;
  qtdConvidados: number | null;
}) {
  const navigate     = useNavigate();
  const isFechado    = evento.status === 'Fechado';
  const assessorNome = evento.Assessoria ? (assessoriaMap[evento.Assessoria] ?? '—') : '—';

  return (
    <button
      onClick={() => navigate(`/eventos/${evento._id}`)}
      className="w-full flex items-center gap-3 bg-white rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform text-left"
    >
      <div className={`w-1 self-stretch rounded-full shrink-0 ${isFechado ? 'bg-emerald-400' : 'bg-blue-300'}`} />

      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 truncate text-sm">
          {evento.NomeDoEvento ?? evento.NomeDoContratante ?? '—'}
        </p>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <SituacaoBadge evento={evento} />
          {assessorNome !== '—' && (
            <span className="text-[10px] text-gray-400 font-medium">{assessorNome}</span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5">
          {evento.dataDoEvento && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Calendar className="w-3 h-3" />
              {fmtDate(evento.dataDoEvento)}
            </span>
          )}
          {qtdConvidados != null && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Users className="w-3 h-3" />
              {qtdConvidados} conv.
            </span>
          )}
        </div>
      </div>

      <ArrowRight className="w-4 h-4 text-gray-200 shrink-0" />
    </button>
  );
}

export default function DegustacaoDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [degu, setDegu]                   = useState<BubbleDegustacao | null>(null);
  const [eventos, setEventos]             = useState<BubbleEvento[]>([]);
  const [convidadosDeg, setConvidadosDeg] = useState<BubbleConvidadoDeg[]>([]);
  const [assessoriaMap, setAssessoriaMap] = useState<Record<string, string>>({});
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(false);
  const [activeTab, setActiveTab]         = useState<Tab>('convidados');

  useEffect(() => {
    if (!id) return;

    fetchDegustacao(id)
      .then(async (r) => {
        const d = r.response;
        setDegu(d);

        // Field is lowercase "eventos" in Bubble (Parent group's Degustação's eventos)
        const eventIds: string[] = [
          ...(d.eventos ?? []),
          ...(d.Eventos ?? []),
          ...(d.evento ? [d.evento] : []),
        ].filter((v, i, arr) => arr.indexOf(v) === i); // dedupe

        // Fetch events + ConvidadosDeg in parallel
        const [evtResults, convRes] = await Promise.all([
          Promise.allSettled(eventIds.map((eid) => fetchEvento(eid).then((res) => res.response))),
          fetchConvidadosDegForDeg(id).catch(() => ({ response: { results: [] } })),
        ]);

        const evts = evtResults
          .filter((r): r is PromiseFulfilledResult<BubbleEvento> => r.status === 'fulfilled')
          .map((r) => r.value);
        setEventos(evts);
        setConvidadosDeg((convRes as any).response.results ?? []);

        // Assessoria names
        const aIds = [...new Set(evts.map((e) => e.Assessoria).filter(Boolean) as string[])];
        const aResults = await Promise.allSettled(aIds.map((aid) => fetchAssessoria(aid)));
        const aMap: Record<string, string> = {};
        aResults.forEach((res, i) => {
          if (res.status === 'fulfilled') aMap[aIds[i]] = res.value.response.Nome ?? '';
        });
        setAssessoriaMap(aMap);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const fechados        = eventos.filter((e) => e.status === 'Fechado').length;
  const novos           = eventos.filter((e) => e.status !== 'Fechado').length;
  const totalConvidados = (convidadosDeg as BubbleConvidadoDeg[]).reduce(
    (sum, c) => sum + (c.qtd ?? 0), 0
  ) || (degu?.convidados ?? 0);

  const qtdMap: Record<string, number> = {};
  (convidadosDeg as BubbleConvidadoDeg[]).forEach((c) => {
    if (c.evento) qtdMap[c.evento] = c.qtd ?? 0;
  });

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
            <div className="h-14 bg-white/10 rounded-2xl animate-pulse mt-4" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white leading-tight">
              {dateLabel ? `Degustação dia ${dateLabel}` : 'Degustação'}
            </h1>
            {degu?.tipo_degust && (
              <p className="text-white/50 text-sm font-medium mt-0.5">{degu.tipo_degust}</p>
            )}

            <div className="flex gap-2 mt-4">
              <StatPill label="Fechados"   value={fechados}        accent="bg-emerald-600/30" />
              <StatPill label="Novos"      value={novos}           accent="bg-blue-500/20" />
              <StatPill label="Convidados" value={totalConvidados} />
            </div>
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
          loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-black/5 rounded-3xl animate-pulse" />
            ))
          ) : eventos.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow-sm">
              <p className="text-gray-400 text-sm">Nenhum evento vinculado.</p>
            </div>
          ) : (
            eventos.map((e) => (
              <EventoRow
                key={e._id}
                evento={e}
                assessoriaMap={assessoriaMap}
                qtdConvidados={qtdMap[e._id] ?? null}
              />
            ))
          )
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
                  {stripRichText(degu['Observações'])}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Sem observações.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
