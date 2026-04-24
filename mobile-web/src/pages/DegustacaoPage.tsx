import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { fetchDegustacoes } from '../api/bubble';
import { BubbleDegustacao } from '../types';
import StatusBadge from '../components/StatusBadge';
import PageHeader from '../components/PageHeader';
import { fmtDate, fmtTime } from '../lib/format';

const STATUS_TABS = ['Todas', 'Agendada', 'Realizada', 'Cancelada'];

function Skeleton() {
  return <div className="h-24 bg-stone-100 rounded-2xl animate-pulse" />;
}

export default function DegustacaoPage() {
  const [items, setItems] = useState<BubbleDegustacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('Todas');

  useEffect(() => {
    fetchDegustacoes()
      .then((r) => setItems(r.response.results))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'Todas') return items;
    return items.filter((d) => d.Status?.toLowerCase() === tab.toLowerCase());
  }, [items, tab]);

  const upcoming = items.filter(
    (d) => d.DataDaDegustacao && new Date(d.DataDaDegustacao) >= new Date()
  ).length;

  return (
    <div className="pb-28 max-w-lg mx-auto">
      <PageHeader
        title="Degustações"
        subtitle={loading ? undefined : `${upcoming} próximas`}
      />

      <div className="px-4 pt-3 space-y-3">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3 pt-1">
            {[1, 2, 3].map((i) => <Skeleton key={i} />)}
          </div>
        ) : error ? (
          <p className="text-center text-stone-400 py-12 text-sm">
            Erro ao carregar degustações.
          </p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
            <p className="text-sm">Nenhuma degustação encontrada</p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {filtered.map((d) => (
              <div
                key={d._id}
                className="bg-white rounded-2xl border border-stone-200 p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-bold text-stone-800 flex-1 min-w-0 truncate">
                    {d.NomeDoContratante ?? 'Contratante não informado'}
                  </p>
                  <StatusBadge status={d.Status} />
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">
                  {d.DataDaDegustacao && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {fmtDate(d.DataDaDegustacao)}
                    </span>
                  )}
                  {d.HorarioDaDegustacao && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {fmtTime(d.HorarioDaDegustacao)}
                    </span>
                  )}
                </div>

                {d.Observacoes && (
                  <p className="mt-2 text-xs text-stone-500 leading-relaxed line-clamp-2">
                    {d.Observacoes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
