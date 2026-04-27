import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, MapPin } from 'lucide-react';
import { fetchAllDegustacoes, fetchAllEventos, fetchLocaisMap } from '../api/bubble';
import { BubbleDegustacao, BubbleEvento } from '../types';
import { fmtDate } from '../lib/format';
import { isFechado } from '../lib/eventFilters';
import { usePWAInstall } from '../hooks/usePWAInstall';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-black/5 rounded-2xl animate-pulse ${className}`} />;
}

function EventRow({ e, locaisMap }: { e: BubbleEvento; locaisMap: Record<string, string> }) {
  const date   = e.dataDoEvento ? new Date(e.dataDoEvento) : null;
  const day    = date?.toLocaleDateString('pt-BR', { day: '2-digit' });
  const mon    = date?.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  const local  = e.LocalDoEvento ? (locaisMap[e.LocalDoEvento] ?? '') : '';
  const isPast = date ? date < new Date() : false;

  return (
    <Link
      to={`/eventos/${e._id}`}
      className="flex items-center gap-4 bg-white rounded-3xl p-4 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 ${
        isPast ? 'bg-gray-50' : 'bg-ron-900'
      }`}>
        <span className={`text-[10px] font-bold ${isPast ? 'text-gray-400' : 'text-gold-300'}`}>{mon}</span>
        <span className={`text-2xl font-black leading-none ${isPast ? 'text-gray-500' : 'text-white'}`}>
          {day ?? '—'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 truncate">
          {e.NomeDoEvento ?? e.NomeDoContratante ?? '—'}
        </p>
        {local ? (
          <span className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{local}</span>
          </span>
        ) : (
          e.QtdConvidados != null && (
            <p className="text-xs text-gray-400 mt-0.5">{e.QtdConvidados} convidados</p>
          )
        )}
      </div>
      <ArrowRight className="w-4 h-4 text-gray-200 shrink-0" />
    </Link>
  );
}

function KpiCard({
  label, value, sub, accent = false, color = 'ron',
}: {
  label: string; value: string | number; sub?: string;
  accent?: boolean; color?: 'ron' | 'gold' | 'violet';
}) {
  const bg = accent
    ? color === 'gold'   ? 'bg-gold-400 shadow-gold-400/30'
    : color === 'violet' ? 'bg-violet-700 shadow-violet-700/30'
    : 'bg-ron-900 shadow-ron-900/30'
    : 'bg-white';

  return (
    <div className={`rounded-3xl p-5 shadow-xl flex flex-col justify-between min-h-[110px] ${bg}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest ${accent ? 'text-white/60' : 'text-gray-400'}`}>
        {label}
      </p>
      <div>
        <p className={`text-4xl font-black leading-none ${accent ? 'text-white' : 'text-ron-900'}`}>
          {value}
        </p>
        {sub && (
          <p className={`text-[10px] font-bold mt-0.5 uppercase tracking-wide ${accent ? 'text-white/50' : 'text-gray-400'}`}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [events, setEvents]         = useState<BubbleEvento[]>([]);
  const [degustacoes, setDegustacoes] = useState<BubbleDegustacao[]>([]);
  const [locaisMap, setLocaisMap]   = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const { canInstall, install, showIOSGuide, setShowIOSGuide } = usePWAInstall();

  useEffect(() => {
    Promise.all([
      fetchAllEventos({ sortOrder: 'desc' }),
      fetchAllDegustacoes(),
    ]).then(([evts, degus]) => {
      setEvents(evts);
      setDegustacoes(degus);
      fetchLocaisMap(evts).then(setLocaisMap);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const now        = new Date();
  const thisMonth  = now.getMonth();
  const thisYear   = now.getFullYear();

  const fechados = events.filter(isFechado);

  // ── KPI 1: Eventos do mês (fechados)
  const eventosMes = fechados.filter((e) => {
    if (!e.dataDoEvento) return false;
    const d = new Date(e.dataDoEvento);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  }).length;

  // ── KPI 2: Degustações do mês
  const degustacoesMes = degustacoes.filter((d) => {
    if (!d.data) return false;
    const dt = new Date(d.data);
    return dt.getFullYear() === thisYear && dt.getMonth() === thisMonth;
  }).length;

  // ── KPI 3: Orçamentos abertos pós degustação
  // Status NOT IN [Fechado, Cancelado, Não fechou] AND tem Degustações vinculadas
  const orcamentosAbertos = events.filter((e) => {
    const EXCLUIDOS = new Set(['Fechado', 'Cancelado', 'Não fechou']);
    if (EXCLUIDOS.has(e.status ?? '')) return false;
    return (e['Degustações']?.length ?? 0) > 0;
  }).length;

  // ── Destaque e lista
  const upcoming       = fechados
    .filter((e) => e.dataDoEvento && new Date(e.dataDoEvento) >= now)
    .sort((a, b) => new Date(a.dataDoEvento!).getTime() - new Date(b.dataDoEvento!).getTime());

  const hasUpcoming    = upcoming.length > 0;
  const highlightEvent = hasUpcoming ? upcoming[0] : fechados[0];
  const displayEvents  = hasUpcoming ? upcoming.slice(0, 5) : fechados.slice(0, 5);
  const sectionTitle   = hasUpcoming ? 'Próximos Eventos' : 'Eventos Recentes';

  const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {/* ── Top loading bar ──────────────────────────────────────────── */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-gold-400 animate-pulse" />
      )}

      {/* ── iOS Install guide ─────────────────────────────────────────── */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[9998] flex items-end"
          onClick={() => setShowIOSGuide(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full bg-white rounded-t-3xl px-6 pb-10 pt-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="text-lg font-black text-gray-900 mb-1">Instalar no iPhone</p>
            <p className="text-sm text-gray-400 mb-6">
              Adicione o Rondello à tela de início para acesso rápido.
            </p>
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl bg-ron-900 text-white flex items-center justify-center shrink-0 text-sm font-black">1</div>
                <p className="text-sm text-gray-700 pt-1">
                  Toque no botão <span className="font-bold">Compartilhar</span>{' '}
                  <span className="text-base">⬆</span> na barra do Safari
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl bg-ron-900 text-white flex items-center justify-center shrink-0 text-sm font-black">2</div>
                <p className="text-sm text-gray-700 pt-1">
                  Role e toque em{' '}
                  <span className="font-bold">"Adicionar à Tela de Início"</span>
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl bg-ron-900 text-white flex items-center justify-center shrink-0 text-sm font-black">3</div>
                <p className="text-sm text-gray-700 pt-1">
                  Toque em <span className="font-bold">Adicionar</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-3.5 bg-ron-900 text-white font-bold rounded-2xl"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-ron-950 via-ron-900 to-ron-800 px-5 pt-safe pt-8 pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/5 rounded-full" />
        <div className="absolute top-6 right-8 w-2 h-2 bg-gold-400/50 rounded-full" />
        <div className="absolute top-11 right-16 w-1 h-1 bg-gold-400/30 rounded-full" />

        <div className="relative flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight leading-none">
              Rondello
            </h1>
            <p className="text-white/35 text-xs font-bold mt-1.5 uppercase tracking-[0.2em]">
              Buffet · Gestão de Eventos
            </p>
          </div>

          {/* PWA Install button */}
          {canInstall && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 active:scale-95 transition-all rounded-2xl px-3 py-2 mt-1"
            >
              <Download className="w-4 h-4 text-gold-300" />
              <span className="text-xs font-bold text-white">Instalar</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 space-y-4 pt-4">

        {/* ── KPI cards ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <KpiCard
              label="Eventos"
              value={eventosMes}
              sub={mesLabel}
              accent
              color="ron"
            />
            <KpiCard
              label="Degust."
              value={degustacoesMes}
              sub={mesLabel}
              accent
              color="gold"
            />
            <KpiCard
              label="Orçam."
              value={orcamentosAbertos}
              sub="em aberto"
              accent
              color="violet"
            />
          </div>
        )}

        {/* ── Evento destaque ─────────────────────────────────────────── */}
        {!loading && highlightEvent && (
          <Link
            to={`/eventos/${highlightEvent._id}`}
            className="block rounded-3xl p-5 shadow-xl shadow-ron-900/25 overflow-hidden relative bg-gradient-to-br from-ron-900 to-ron-800"
          >
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/5 rounded-full" />
            <div className="absolute -bottom-10 -left-6 w-28 h-28 bg-black/10 rounded-full" />

            <div className="relative">
              <p className="text-gold-400 text-[11px] font-black uppercase tracking-widest mb-3">
                {hasUpcoming ? '● Próximo evento' : '◆ Último evento'}
              </p>
              <p className="text-white font-black text-xl leading-tight">
                {highlightEvent.NomeDoEvento ?? highlightEvent.NomeDoContratante ?? '—'}
              </p>

              {highlightEvent.LocalDoEvento && locaisMap[highlightEvent.LocalDoEvento] && (
                <p className="text-gold-300/70 text-sm mt-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {locaisMap[highlightEvent.LocalDoEvento]}
                </p>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                <p className="text-white/50 text-sm font-semibold">
                  {fmtDate(highlightEvent.dataDoEvento)}
                  {highlightEvent.QtdConvidados != null &&
                    ` · ${highlightEvent.QtdConvidados} conv.`}
                </p>
                <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* ── Lista ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-black text-gray-900 text-lg">{sectionTitle}</p>
            <Link
              to="/eventos"
              className="flex items-center gap-1 text-sm font-semibold text-ron-800"
            >
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : (
            <div className="space-y-3">
              {displayEvents.map((e) => (
                <EventRow key={e._id} e={e} locaisMap={locaisMap} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
