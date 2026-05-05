import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, UtensilsCrossed } from 'lucide-react';
import { fetchAllDegustacoes, fetchAllEventos } from '../api/bubble';
import { BubbleDegustacao, BubbleEvento } from '../types';
import { fmtDate } from '../lib/format';

const FILTERS = ['Todas', 'Próximas', 'Realizadas'];

function Skeleton() {
  return <div className="h-28 bg-black/5 rounded-3xl animate-pulse" />;
}

function DegCard({
  d,
  eventos,
  onClick,
}: {
  d: BubbleDegustacao;
  eventos: BubbleEvento[];
  onClick: () => void;
}) {
  const now    = new Date();
  const isPast = d.data ? new Date(d.data) < now : false;

  // events linked to this degustação
  const linked   = eventos.filter((e) => e['Degustações']?.includes(d._id));
  const fechados  = linked.filter((e) => e.status === 'Fechado').length;
  const novos     = linked.filter((e) => e.status !== 'Fechado').length;
  const convidados = d.convidados ?? 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 bg-white rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform ${isPast ? 'opacity-70' : ''}`}
    >
      {/* color bar */}
      <div className={`w-1 self-stretch rounded-full shrink-0 ${isPast ? 'bg-gray-300' : 'bg-violet-400'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-gray-900 text-sm flex-1">
            {d.data
              ? new Date(d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
              : 'Degustação'}
          </p>
          {!isPast && (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200">
              Agendada
            </span>
          )}
        </div>

        {d.data && (
          <span className="flex items-center gap-1 text-xs text-gray-400 font-medium mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-gold-400" />
            {fmtDate(d.data)}
          </span>
        )}

        {/* ── Stats row ── */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {fechados > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black">
              {fechados} fechado{fechados !== 1 ? 's' : ''}
            </span>
          )}
          {novos > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black">
              {novos} novo{novos !== 1 ? 's' : ''}
            </span>
          )}
          {convidados > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-black">
              {convidados} conv.
            </span>
          )}
          {linked.length === 0 && !d.convidados && (
            <span className="text-[10px] text-gray-300 font-medium">sem eventos vinculados</span>
          )}
        </div>

        {d['Observações'] && (
          <p className="mt-2 text-xs text-gray-500 leading-relaxed line-clamp-2 border-t border-gray-50 pt-2">
            {d['Observações']}
          </p>
        )}
      </div>

      <ArrowRight className="w-4 h-4 text-gray-200 shrink-0 mt-0.5" />
    </button>
  );
}

export default function DegustacaoPage() {
  const navigate = useNavigate();
  const [items, setItems]     = useState<BubbleDegustacao[]>([]);
  const [eventos, setEventos] = useState<BubbleEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [filter, setFilter]   = useState('Todas');

  useEffect(() => {
    Promise.all([fetchAllDegustacoes(), fetchAllEventos()])
      .then(([degs, evts]) => {
        setItems(degs);
        setEventos(evts);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();

  const filtered = useMemo(() => {
    switch (filter) {
      case 'Próximas':  return items.filter((d) => d.data && new Date(d.data) >= now);
      case 'Realizadas': return items.filter((d) => d.data && new Date(d.data) < now);
      default:          return items;
    }
  }, [items, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = a.data ? new Date(a.data).getTime() : 0;
      const db = b.data ? new Date(b.data).getTime() : 0;
      const aFuture = a.data ? new Date(a.data) >= now : false;
      const bFuture = b.data ? new Date(b.data) >= now : false;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      return aFuture ? da - db : db - da;
    });
  }, [filtered]);

  // ── Header stats (upcoming degustações) ──────────────────────────────────
  const upcoming     = items.filter((d) => d.data && new Date(d.data) >= now);
  const upcomingEvts = eventos.filter((e) =>
    upcoming.some((d) => e['Degustações']?.includes(d._id))
  );
  const totalFechados   = upcomingEvts.filter((e) => e.status === 'Fechado').length;
  const totalNovos      = upcomingEvts.filter((e) => e.status !== 'Fechado').length;
  const totalConvidados = upcoming.reduce((s, d) => s + (d.convidados ?? 0), 0);

  return (
    <div className="pb-36 max-w-lg mx-auto">
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-gold-400 animate-pulse" />
      )}

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-hero pb-8 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full" />
        <div className="relative">
          <p className="text-gold-400/70 text-xs font-bold uppercase tracking-widest">Menu de prova</p>
          <h1 className="text-4xl font-black text-white tracking-tight mt-1 leading-none">Degustações</h1>
          <p className="text-white/35 text-xs font-bold mt-1.5 uppercase tracking-[0.15em]">
            {loading ? '…' : `${upcoming.length} próxima${upcoming.length !== 1 ? 's' : ''} · ${items.length} total`}
          </p>

          {/* ── Stats pills ── */}
          {!loading && (
            <div className="flex gap-2 mt-4">
              <div className="flex-1 bg-emerald-600/30 rounded-2xl px-3 py-2.5">
                <p className="text-white/50 text-[9px] font-black uppercase tracking-widest">Fechados</p>
                <p className="text-white font-black text-xl leading-none mt-0.5">{totalFechados}</p>
              </div>
              <div className="flex-1 bg-blue-500/20 rounded-2xl px-3 py-2.5">
                <p className="text-white/50 text-[9px] font-black uppercase tracking-widest">Novos</p>
                <p className="text-white font-black text-xl leading-none mt-0.5">{totalNovos}</p>
              </div>
              <div className="flex-1 bg-white/10 rounded-2xl px-3 py-2.5">
                <p className="text-white/50 text-[9px] font-black uppercase tracking-widest">Convidados</p>
                <p className="text-white font-black text-xl leading-none mt-0.5">{totalConvidados}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 space-y-4 pt-4">
        {/* ── Filter tabs ── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm ${
                filter === f
                  ? 'bg-ron-900 text-white shadow-lg shadow-ron-900/30'
                  : 'bg-white text-gray-500'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="space-y-3"><Skeleton /><Skeleton /><Skeleton /></div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500 text-sm">Erro ao carregar degustações</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <UtensilsCrossed className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-700">Nenhuma degustação</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter === 'Todas' ? 'Ainda não há degustações cadastradas' : `Nenhuma degustação ${filter.toLowerCase()}`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((d) => (
              <DegCard
                key={d._id}
                d={d}
                eventos={eventos}
                onClick={() => navigate(`/degustacoes/${d._id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
