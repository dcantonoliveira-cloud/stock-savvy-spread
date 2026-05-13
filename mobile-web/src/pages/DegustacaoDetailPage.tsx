import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, UtensilsCrossed } from 'lucide-react';
import { fetchAssessoria, fetchDegustacao, fetchEvento, fetchLocal } from '../api/bubble';
import { BubbleDegustacao, BubbleEvento } from '../types';
import { fmtDate } from '../lib/format';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-black text-ron-800 uppercase tracking-widest mb-3 mt-1">
      {children}
    </p>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="py-3.5 border-b border-gray-100 last:border-0">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-gray-900 font-semibold text-sm">{value}</p>
    </div>
  );
}

export default function DegustacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [degu, setDegu]               = useState<BubbleDegustacao | null>(null);
  const [evento, setEvento]           = useState<BubbleEvento | null>(null);
  const [localNome, setLocalNome]     = useState('');
  const [assessoriaNome, setAssessoriaNome] = useState('');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchDegustacao(id)
      .then((r) => {
        const d = r.response;
        setDegu(d);
        if (d.evento) {
          return fetchEvento(d.evento).then((er) => {
            const ev = er.response;
            setEvento(ev);
            if (ev.LocalDoEvento) {
              fetchLocal(ev.LocalDoEvento)
                .then((lr) => setLocalNome(lr.response.Nome ?? ''))
                .catch(() => {});
            }
            if (ev.Assessoria) {
              fetchAssessoria(ev.Assessoria)
                .then((ar) => setAssessoriaNome(ar.response.Nome ?? ''))
                .catch(() => {});
            }
          });
        }
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
            <h1 className="text-2xl font-black text-white leading-tight">
              {evento?.NomeDoEvento ?? 'Degustação'}
            </h1>
            {degu?.data && (
              <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium mt-2">
                <Calendar className="w-3.5 h-3.5" />
                {fmtDate(degu.data)}
              </span>
            )}
          </>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-black/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : error || !degu ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500">Erro ao carregar degustação.</p>
          </div>
        ) : (
          <>
            <div>
              <SectionTitle>Informações do Evento</SectionTitle>
              <div className="bg-white rounded-3xl px-5 shadow-sm divide-y divide-gray-100">
                <Field label="Casal / Contratante" value={evento?.NomeDoEvento} />
                <Field label="Local da festa"       value={localNome || evento?.['Local Do Evento_TXT']} />
                <Field label="Assessoria"           value={assessoriaNome} />
                <Field label="Status do evento"     value={evento?.status} />
                <Field label="Tipo de degustação"   value={degu.tipo_degust} />
                <Field label="Convidados"           value={degu.convidados != null ? `${degu.convidados}` : null} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
