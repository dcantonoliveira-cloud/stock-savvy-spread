import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, Calendar, CalendarDays,
  CircleDot, MapPin, UtensilsCrossed, Users,
} from 'lucide-react';
import { fetchAssessoria, fetchDegustacao, fetchEvento, fetchLocal } from '../api/bubble';
import { BubbleDegustacao } from '../types';
import { fmtDate } from '../lib/format';

interface EventoCard {
  id: string;
  nomeDoEvento?: string;
  status?: string;
  dataDoEvento?: string;
  localNome?: string;
  assessoriaNome?: string;
}

const STATUS_STYLE: Record<string, string> = {
  'fechado':      'bg-emerald-50 text-emerald-700 border-emerald-200',
  'negociando':   'bg-blue-50    text-blue-700    border-blue-200',
  '1º contato':   'bg-violet-50  text-violet-700  border-violet-200',
  'cancelado':    'bg-red-50     text-red-700      border-red-200',
  'não fechou':   'bg-gray-100   text-gray-600     border-gray-200',
};

function statusStyle(status?: string) {
  if (!status) return 'bg-gray-100 text-gray-500 border-gray-200';
  return STATUS_STYLE[status.toLowerCase()] ?? 'bg-gray-100 text-gray-500 border-gray-200';
}

export default function DegustacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [degu, setDegu]           = useState<BubbleDegustacao | null>(null);
  const [eventos, setEventos]     = useState<EventoCard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);

  useEffect(() => {
    if (!id) return;

    fetchDegustacao(id)
      .then(async (r) => {
        const d = r.response;
        setDegu(d);

        // Collect all linked event IDs (deduplicated)
        const ids = Array.from(new Set([
          ...(d.Eventos ?? []),
          ...(d.evento ? [d.evento] : []),
        ]));

        if (ids.length === 0) return;

        // Fetch all events in parallel
        const eventoResults = await Promise.allSettled(
          ids.map((eid) => fetchEvento(eid))
        );

        const cards: EventoCard[] = await Promise.all(
          eventoResults.map(async (res, i) => {
            if (res.status === 'rejected') return { id: ids[i] };
            const ev = res.value.response;
            const card: EventoCard = {
              id: ev._id,
              nomeDoEvento: ev.NomeDoEvento,
              status: ev.status,
              dataDoEvento: ev.dataDoEvento,
            };
            await Promise.allSettled([
              ev.LocalDoEvento
                ? fetchLocal(ev.LocalDoEvento).then((lr) => { card.localNome = lr.response.Nome; }).catch(() => {})
                : Promise.resolve(),
              ev.Assessoria
                ? fetchAssessoria(ev.Assessoria).then((ar) => { card.assessoriaNome = ar.response.Nome; }).catch(() => {})
                : Promise.resolve(),
            ]);
            return card;
          })
        );

        setEventos(cards);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const isPast = degu?.data ? new Date(degu.data) < new Date() : false;

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-gold-400 animate-pulse" />
      )}

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-safe pt-12 pb-6 relative overflow-hidden">
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
              {degu?.data && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {fmtDate(degu.data)}
                </span>
              )}
              {degu?.convidados != null && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  <Users className="w-3.5 h-3.5" />
                  {degu.convidados} convidados
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-black/5 rounded-3xl animate-pulse" />
            ))}
          </>
        ) : error || !degu ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500">Erro ao carregar degustação.</p>
          </div>
        ) : eventos.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
            <UtensilsCrossed className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum evento vinculado</p>
          </div>
        ) : (
          eventos.map((ev) => (
            <div key={ev.id} className="bg-white rounded-3xl p-4 shadow-sm space-y-3">

              {/* Nome do casal + status */}
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-gray-900 text-base leading-tight flex-1">
                  {ev.nomeDoEvento ?? '—'}
                </p>
                {ev.status && (
                  <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusStyle(ev.status)}`}>
                    {ev.status}
                  </span>
                )}
              </div>

              {/* Detalhes */}
              <div className="space-y-1.5">
                {ev.dataDoEvento && (
                  <span className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <CalendarDays className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                    {fmtDate(ev.dataDoEvento)}
                  </span>
                )}
                {ev.localNome && (
                  <span className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                    {ev.localNome}
                  </span>
                )}
                {ev.assessoriaNome && (
                  <span className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                    {ev.assessoriaNome}
                  </span>
                )}
                {!ev.dataDoEvento && !ev.localNome && !ev.assessoriaNome && (
                  <span className="flex items-center gap-2 text-xs text-gray-400">
                    <CircleDot className="w-3.5 h-3.5 shrink-0" />
                    Sem detalhes adicionais
                  </span>
                )}
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
}
