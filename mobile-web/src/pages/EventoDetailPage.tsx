import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  FileText,
  MapPin,
  Phone,
  UtensilsCrossed,
  Users,
} from 'lucide-react';
import { fetchEvento } from '../api/bubble';
import { BubbleEvento } from '../types';
import StatusBadge from '../components/StatusBadge';
import { fmtCurrency, fmtDate } from '../lib/format';

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-stone-100 last:border-0">
      <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-amber-700" />
      </div>
      <div>
        <p className="text-xs text-stone-400 font-medium">{label}</p>
        <p className="text-stone-800 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<BubbleEvento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchEvento(id)
      .then((r) => setEvento(r.response))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-stone-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-stone-800 truncate">
            {loading ? 'Carregando…' : (evento?.NomeDoContratante ?? 'Evento')}
          </h1>
          {evento?.NomeDoEvento && (
            <p className="text-xs text-stone-400 truncate">{evento.NomeDoEvento}</p>
          )}
        </div>
        {evento?.Status && <StatusBadge status={evento.Status} />}
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-center text-stone-400 py-16 text-sm">
          Erro ao carregar o evento.
        </p>
      ) : evento ? (
        <div className="px-4 pt-4 space-y-4">
          {/* Date card */}
          {evento.dataDoEvento && (
            <div className="bg-amber-800 rounded-2xl px-4 py-4 flex items-center gap-3 text-white">
              <Calendar className="w-6 h-6 text-amber-300 shrink-0" />
              <div>
                <p className="text-xs text-amber-300">Data do Evento</p>
                <p className="font-bold text-lg">{fmtDate(evento.dataDoEvento)}</p>
              </div>
            </div>
          )}

          {/* Details card */}
          <div className="bg-white rounded-2xl border border-stone-200 px-4 divide-y divide-stone-100">
            <Row icon={Users}          label="Contratante"     value={evento.NomeDoContratante} />
            <Row icon={FileText}       label="Nome do Evento"  value={evento.NomeDoEvento} />
            <Row icon={MapPin}         label="Local"           value={evento.Local} />
            <Row icon={Users}          label="Convidados"      value={evento.NumeroDeConvidados != null ? `${evento.NumeroDeConvidados} pessoas` : null} />
            <Row icon={DollarSign}     label="Valor"           value={evento.Valor != null ? fmtCurrency(evento.Valor) : null} />
            <Row icon={Phone}          label="Contato"         value={evento.ContatoDoContratante ?? evento.Telefone} />
            <Row icon={Calendar}       label="Degustação"      value={fmtDate(evento.DataDaDegustacao)} />
            <Row icon={UtensilsCrossed} label="Cardápio"       value={evento.Cardapio} />
          </div>

          {/* Description */}
          {evento.Descricao && (
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <p className="text-xs text-stone-400 font-medium mb-2">Observações</p>
              <p className="text-sm text-stone-700 leading-relaxed">{evento.Descricao}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
