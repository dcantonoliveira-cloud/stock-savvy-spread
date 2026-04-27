import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users } from 'lucide-react';
import { fetchEvento, fetchLocal } from '../api/bubble';
import { BubbleEvento } from '../types';
import { fmtCurrency, fmtDate } from '../lib/format';

// ── Field components ─────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '' || value === 0) return null;
  return (
    <div className="py-3.5 border-b border-gray-100 last:border-0">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-gray-900 font-semibold text-sm">{value}</p>
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl px-5 shadow-sm divide-y divide-gray-100">
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-black text-ron-800 uppercase tracking-widest mb-3 mt-1">
      {children}
    </p>
  );
}

// ── Tab content ──────────────────────────────────────────────────────────────

function FichaTecnica({ e, localNome }: { e: BubbleEvento; localNome?: string }) {
  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Evento</SectionTitle>
        <FieldGrid>
          <Field label="Nome do Evento"    value={e.NomeDoEvento} />
          <Field label="Tipo"              value={e.TipoDoEvento} />
          <Field label="Local"             value={localNome ?? e.LocalDoEvento} />
          <Field label="Data"              value={fmtDate(e.dataDoEvento)} />
          <Field label="Produto escolhido" value={e.ProdutoEscolhido} />
          <Field label="Horário cerimônia" value={e.HorarioDaCerimonia} />
          <Field label="Duração"           value={e.DuracaoDoEvento} />
          <Field label="Preço negociado"   value={e.Preco != null ? fmtCurrency(e.Preco) : null} />
        </FieldGrid>
      </div>

      <div>
        <SectionTitle>Convidados</SectionTitle>
        <FieldGrid>
          <Field label="Quantidade"        value={e.QuantidadeDeConvidados} />
          <Field label="Crianças 50%"      value={e.Criancas50} />
          <Field label="Não pagantes"      value={e.NaoPagantes} />
          <Field label="Horas adicionais"  value={e.HorasAdicionais} />
        </FieldGrid>
      </div>

      <div>
        <SectionTitle>Equipe & Profissionais</SectionTitle>
        <FieldGrid>
          <Field label="Qtd. profissionais"    value={e.QuantidadeDeProfissionais} />
          <Field label="Alimentação prof."     value={e.AlimentacaoProfissionais} />
          <Field label="Valor alim. prof."     value={e.ValorAlimentacaoProfissionais != null ? fmtCurrency(e.ValorAlimentacaoProfissionais) : null} />
          <Field label="Organizadora"          value={e.Organizadora} />
          <Field label="Decorador"             value={e.Decorador} />
          <Field label="Confeiteiro(a)"        value={e.Confeiteiro} />
          <Field label="Banda / DJ"            value={e.BandaDJ} />
          <Field label="Foto / Filmagem"       value={e.FotoFilmagem} />
          <Field label="Bartender"             value={e.Bartender} />
          <Field label="Outros profissionais"  value={e.OutrosProfissionais} />
          <Field label="Atrações à parte"      value={e.AtracoesAParte} />
        </FieldGrid>
      </div>

      <div>
        <SectionTitle>Setup</SectionTitle>
        <FieldGrid>
          <Field label="Coquetel boas-vindas"  value={e.CoqueteilBoasVindas} />
          <Field label="Vinho"                 value={e.Vinho} />
          <Field label="Whisky"                value={e.Whisky} />
          <Field label="Porta guardanapo"      value={e.PortaGuardanapo} />
          <Field label="Toalha"                value={e.Toalha} />
          <Field label="Rechaud"               value={e.Rechaud} />
          <Field label="Sousplát"              value={e.Sousplat} />
          <Field label="Aparador"              value={e.Aparador} />
          <Field label="Taça"                  value={e.Taca} />
          <Field label="Sala dos noivos"       value={e.SalaDosNoivos} />
          <Field label="Espaço kids"           value={e.EspacoKids} />
          <Field label="Qtd. mesas"            value={e.QuantidadeDeMesas} />
        </FieldGrid>
      </div>

      {e.Observacoes && (
        <div>
          <SectionTitle>Observações</SectionTitle>
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{e.Observacoes}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DadosCliente({ e }: { e: BubbleEvento }) {
  return (
    <FieldGrid>
      <Field label="Nome"        value={e.NomeDoContratante} />
      <Field label="Contato"     value={e.ContatoDoContratante} />
      <Field label="Telefone"    value={e.Telefone} />
      <Field label="Email"       value={e.Email} />
      <Field label="CPF / CNPJ"  value={e.CPF} />
      <Field label="Endereço"    value={e.Endereco} />
    </FieldGrid>
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
      <p className="text-5xl mb-3">🚧</p>
      <p className="font-bold text-gray-700">{name}</p>
      <p className="text-sm text-gray-400 mt-1">Em breve</p>
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────

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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<BubbleEvento | null>(null);
  const [localNome, setLocalNome] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchEvento(id)
      .then((r) => {
        const ev = r.response;
        setEvento(ev);
        if (ev.LocalDoEvento) {
          fetchLocal(ev.LocalDoEvento)
            .then((lr) => setLocalNome(lr.response.Nome ?? ''))
            .catch(() => {});
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const goToTab = (i: number) => {
    setActiveTab(i);
    const el = tabsRef.current?.querySelector(`[data-tab="${i}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  function renderTab() {
    if (!evento) return null;
    switch (activeTab) {
      case 0: return <FichaTecnica e={evento} localNome={localNome || undefined} />;
      case 1: return <DadosCliente e={evento} />;
      default: return <ComingSoon name={TABS[activeTab]} />;
    }
  }

  const date = evento?.dataDoEvento ? new Date(evento.dataDoEvento) : null;

  return (
    <div className="pb-36 max-w-lg mx-auto">

      {/* ── Hero header ────────────────────────────────────────────── */}
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
            <div className="h-7 w-48 bg-white/20 rounded-xl animate-pulse" />
            <div className="h-4 w-32 bg-white/10 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white leading-tight">
              {evento?.NomeDoEvento ?? evento?.NomeDoContratante ?? 'Evento'}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {date && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {fmtDate(evento?.dataDoEvento)}
                </span>
              )}
              {localNome && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  {localNome}
                </span>
              )}
              {evento?.QuantidadeDeConvidados != null && (
                <span className="flex items-center gap-1.5 text-gold-300 text-sm font-medium">
                  <Users className="w-3.5 h-3.5" />
                  {evento.QuantidadeDeConvidados} convidados
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#f2f2f2]/95 backdrop-blur-xl">
        <div
          ref={tabsRef}
          className="flex gap-0 overflow-x-auto scrollbar-none px-4 pt-3 pb-2"
        >
          {TABS.map((tab, i) => (
            <button
              key={tab}
              data-tab={i}
              onClick={() => goToTab(i)}
              className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all mr-1 ${
                activeTab === i
                  ? 'bg-ron-900 text-white shadow-lg shadow-ron-900/30'
                  : 'bg-white text-gray-400 shadow-sm'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map((i) => (
              <div key={i} className="h-14 bg-black/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-gray-500">Erro ao carregar o evento.</p>
          </div>
        ) : (
          renderTab()
        )}
      </div>
    </div>
  );
}
