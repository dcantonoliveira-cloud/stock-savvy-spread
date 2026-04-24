import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { fetchEventos } from '../api/bubble';
import { BubbleEvento } from '../types';
import EventCard from '../components/EventCard';
import PageHeader from '../components/PageHeader';

const STATUS_TABS = ['Todos', 'Confirmado', 'Pendente', 'Realizado', 'Cancelado'];

function Skeleton() {
  return <div className="h-[88px] bg-stone-100 rounded-2xl animate-pulse" />;
}

export default function EventosPage() {
  const [events, setEvents] = useState<BubbleEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Todos');

  useEffect(() => {
    fetchEventos({ limit: 200 })
      .then((r) => setEvents(r.response.results))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = events;
    if (activeTab !== 'Todos') {
      list = list.filter((e) => e.Status?.toLowerCase() === activeTab.toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.NomeDoContratante?.toLowerCase().includes(q) ||
          e.NomeDoEvento?.toLowerCase().includes(q) ||
          e.Local?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, activeTab, search]);

  return (
    <div className="pb-28 max-w-lg mx-auto">
      <PageHeader
        title="Eventos"
        subtitle={loading ? undefined : `${events.length} no total`}
      />

      <div className="px-4 pt-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, local…"
            className="w-full pl-9 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-amber-800 text-white'
                  : 'bg-stone-100 text-stone-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3 pt-1">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} />)}
          </div>
        ) : error ? (
          <p className="text-center text-stone-400 py-12 text-sm">
            Erro ao carregar eventos. Verifique a conexão.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-stone-400 py-12 text-sm">
            Nenhum evento encontrado.
          </p>
        ) : (
          <div className="space-y-3 pt-1">
            {filtered.map((e) => (
              <EventCard key={e._id} event={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
