import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchEvento } from '../api/bubble';
import { BubbleEvento } from '../types';
import StatusBadge from '../components/StatusBadge';
import { fmtCurrency, fmtDate } from '../lib/format';

// ── helpers ──────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '' || value === '0' || value === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">{label}</p>
      <p className="text-stone-800 text-sm mt-0.5 leading-snug">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-3">{title}</p>
      <div className="bg-white rounded-2xl border border-stone-200 p-4 grid grid-cols-2 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  );
}

function FullField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="col-span-2">
      <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">{label}</p>
      <p className="text-stone-800 text-sm mt-1 leading-relaxed whitespace-pre-line">{value}</p>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  'Ficha Técnica',
  'Dados do Cliente',
  'Cardápio',
  'Checklist',
  'Cronograma',
  'Financeiro',
  'Arquivos',
  'Equipe',
  'Outros',
];

function TabFichaTecnica({ e }: { e: BubbleEvento }) {
  return (
    <div className="space-y-5">
      <Section title="Evento">
        <Field label="Nome do Evento"   value={e.NomeDoEvento} />
        <Field label="Tipo do Evento"   value={e.TipoDoEvento} />
        <Field label="Local"            value={e.LocalDoEvento} />
        <Field label="Data"             value={fmtDate(e.dataDoEvento)} />
        <Field label="Produto"          value={e.ProdutoEscolhido} />
        <Field label="Horário cerimônia" value={e.HorarioDaCerimonia} />
        <Field label="Duração"          value={e.DuracaoDoEvento} />
        <Field label="Preço negociado"  value={e.Preco != null ? fmtCurrency(e.Preco) : null} />
      </Section>

      <Section title="Convidados">
        <Field label="Convidados"       value={e.QuantidadeDeConvidados} />
        <Field label="Crianças 50%"     value={e.Criancas50} />
        <Field label="Não pagantes"     value={e.NaoPagantes} />
        <Field label="Horas adicionais" value={e.HorasAdicionais} />
      </Section>

      <Section title="Profissionais">
        <Field label="Qtd. profissionais"   value={e.QuantidadeDeProfissionais} />
        <Field label="Alim. profissionais"  value={e.AlimentacaoProfissionais} />
        <Field label="Valor alim. prof."    value={e.ValorAlimentacaoProfissionais != null ? fmtCurrency(e.ValorAlimentacaoProfissionais) : null} />
        <Field label="Organizadora"         value={e.Organizadora} />
        <Field label="Decorador"            value={e.Decorador} />
        <Field label="Confeiteiro(a)"       value={e.Confeiteiro} />
        <Field label="Banda / DJ"           value={e.BandaDJ} />
        <Field label="Foto / Filmagem"      value={e.FotoFilmagem} />
        <Field label="Bartender"            value={e.Bartender} />
        <Field label="Outros profissionais" value={e.OutrosProfissionais} />
        <Field label="Atrações à parte"     value={e.AtracoesAParte} />
      </Section>

      <Section title="Setup & Equipamentos">
        <Field label="Coquetel boas-vindas" value={e.CoqueteilBoasVindas} />
        <Field label="Vinho"                value={e.Vinho} />
        <Field label="Whisky"               value={e.Whisky} />
        <Field label="Porta guardanapo"     value={e.PortaGuardanapo} />
        <Field label="Toalha"               value={e.Toalha} />
        <Field label="Rechaud"              value={e.Rechaud} />
        <Field label="Sousplát"             value={e.Sousplat} />
        <Field label="Aparador"             value={e.Aparador} />
        <Field label="Taça"                 value={e.Taca} />
        <Field label="Sala dos noivos"      value={e.SalaDosNoivos} />
        <Field label="Espaço kids"          value={e.EspacoKids} />
        <Field label="Qtd. mesas"           value={e.QuantidadeDeMesas} />
      </Section>

      {e.Observacoes && (
        <div>
          <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-3">Observações</p>
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{e.Observacoes}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TabDadosCliente({ e }: { e: BubbleEvento }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 grid grid-cols-2 gap-x-6 gap-y-4">
      <Field label="Contratante"  value={e.NomeDoContratante} />
      <Field label="Contato"      value={e.ContatoDoContratante} />
      <Field label="Telefone"     value={e.Telefone} />
      <Field label="Email"        value={e.Email} />
      <Field label="CPF / CNPJ"   value={e.CPF} />
      <FullField label="Endereço" value={e.Endereco} />
    </div>
  );
}

function TabEmBreve({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-stone-400">
      <p className="text-4xl mb-3">🚧</p>
      <p className="font-medium">{name}</p>
      <p className="text-sm mt-1">Em breve</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<BubbleEvento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchEvento(id)
      .then((r) => setEvento(r.response))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const scrollTabIntoView = (idx: number) => {
    setActiveTab(idx);
    const el = tabsRef.current?.querySelector(`[data-tab="${idx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  function renderTab() {
    if (!evento) return null;
    switch (activeTab) {
      case 0: return <TabFichaTecnica e={evento} />;
      case 1: return <TabDadosCliente e={evento} />;
      default: return <TabEmBreve name={TABS[activeTab]} />;
    }
  }

  return (
    <div className="pb-28 max-w-lg mx-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-white border-b border-stone-200">
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-stone-600" />
          </button>
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-4 w-40 bg-stone-100 rounded animate-pulse" />
            ) : (
              <>
                <p className="font-bold text-stone-800 truncate text-[15px]">
                  {evento?.NomeDoContratante ?? 'Evento'}
                </p>
                <p className="text-xs text-stone-400 truncate">
                  {evento?.NomeDoEvento} · {fmtDate(evento?.dataDoEvento)}
                </p>
              </>
            )}
          </div>
          {evento?.Status && <StatusBadge status={evento.Status} />}
        </div>

        {/* Tab bar */}
        <div
          ref={tabsRef}
          className="flex gap-0 overflow-x-auto scrollbar-none border-t border-stone-100"
        >
          {TABS.map((tab, i) => (
            <button
              key={tab}
              data-tab={i}
              onClick={() => scrollTabIntoView(i)}
              className={`shrink-0 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === i
                  ? 'border-amber-700 text-amber-800'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 text-stone-400">
            <p className="text-4xl mb-3">⚠️</p>
            <p>Erro ao carregar o evento.</p>
          </div>
        ) : (
          renderTab()
        )}
      </div>
    </div>
  );
}
