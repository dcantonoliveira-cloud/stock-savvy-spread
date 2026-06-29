import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, X, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';

interface Company {
  id: string;
  name: string | null;
  logo_base64: string | null;
  razao_social: string | null;
  cnpj: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  endereco: string | null;
  telefone: string | null;
  website: string | null;
  contract_template: string | null;
  witness_1_name: string | null;
  witness_1_cpf: string | null;
}

interface Integration {
  id?: string;
  provider: string;
  api_key: string | null;
  enabled: boolean;
}

const inputCls = 'w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1';

type Tab = 'geral' | 'conectores';

// ── ZapSign SVG logo ──────────────────────────────────────────────────────
function ZapSignLogo({ className = 'h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#00C566"/>
      <path d="M8 22L14 10h4l-4 7h6l-6 5H8z" fill="white"/>
      <text x="38" y="22" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="14" fill="#1a1a1a">ZapSign</text>
    </svg>
  );
}

// ── Conector card ─────────────────────────────────────────────────────────
const CONNECTORS = [
  {
    provider: 'zapsign',
    name: 'ZapSign',
    description: 'Assinatura eletrônica com validade jurídica. Envie contratos para assinatura diretamente do sistema.',
    docsUrl: 'https://docs.zapsign.com.br',
    logo: <ZapSignLogo />,
  },
];

function ConnectorCard({ provider, name, description, logo, integration, onSave }: {
  provider: string;
  name: string;
  description: string;
  logo: React.ReactNode;
  integration: Integration | null;
  onSave: (key: string, enabled: boolean) => Promise<void>;
}) {
  const [apiKey,   setApiKey]   = useState(integration?.api_key ?? '');
  const [enabled,  setEnabled]  = useState(integration?.enabled ?? false);
  const [showKey,  setShowKey]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [editing,  setEditing]  = useState(!integration?.api_key);

  const handleSave = async () => {
    setSaving(true);
    await onSave(apiKey.trim(), enabled);
    setSaving(false);
    setEditing(false);
  };

  const isConfigured = !!integration?.api_key;

  return (
    <div className="bg-white border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {logo}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{name}</p>
              {isConfigured
                ? <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Configurado
                  </span>
                : <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Não configurado
                  </span>
              }
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">{description}</p>
          </div>
        </div>

        {/* Toggle enabled */}
        {isConfigured && (
          <button
            onClick={() => { setEnabled(e => !e); }}
            className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted border border-border'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        )}
      </div>

      {/* API Key field */}
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Chave da API</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Cole aqui sua chave de API..."
                className={`${inputCls} pr-10`}
              />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              A chave fica salva de forma segura e nunca é exibida integralmente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving || !apiKey.trim()}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar chave'}
            </button>
            {isConfigured && (
              <button onClick={() => { setEditing(false); setApiKey(integration?.api_key ?? ''); }}
                className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-9 px-3 flex items-center bg-muted/40 border border-border rounded-lg">
            <span className="text-sm text-muted-foreground font-mono tracking-wider">••••••••••••••••</span>
          </div>
          <button onClick={() => setEditing(true)}
            className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
            Alterar chave
          </button>
          <button onClick={async () => { setSaving(true); await onSave('', false); setSaving(false); setApiKey(''); setEditing(true); setEnabled(false); }}
            className="px-3 py-2 rounded-xl border border-border text-xs text-red-500 hover:bg-red-50 transition-colors">
            Remover
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const [tab,          setTab]          = useState<Tab>('geral');
  const [company,      setCompany]      = useState<Company | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [uploading,    setUploading]    = useState(false);
  const fileRef  = useRef<HTMLInputElement>(null);
  const timers   = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    supabase.from('companies').select('*').limit(1).single().then(({ data }) => {
      if (data) setCompany(data as any);
    });
    supabase.from('company_integrations' as any).select('*').then(({ data }) => {
      if (data) setIntegrations(data as Integration[]);
    });
  }, []);

  const save = (field: string, value: string | null) => {
    if (!company) return;
    setCompany(prev => prev ? { ...prev, [field]: value } : prev);
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(async () => {
      const { error } = await supabase.from('companies').update({ [field]: value }).eq('id', company.id);
      if (error) toast.error('Erro ao salvar');
      else toast.success('Salvo');
    }, 1200);
  };

  const handleLogoUpload = async (file: File) => {
    if (!company) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const { error } = await supabase.from('companies').update({ logo_base64: base64 }).eq('id', company.id);
      if (error) { toast.error('Erro ao salvar logo'); setUploading(false); return; }
      setCompany(prev => prev ? { ...prev, logo_base64: base64 } : prev);
      toast.success('Logo salva');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = async () => {
    if (!company) return;
    await supabase.from('companies').update({ logo_base64: null }).eq('id', company.id);
    setCompany(prev => prev ? { ...prev, logo_base64: null } : prev);
    toast.success('Logo removida');
  };

  const saveIntegration = async (provider: string, apiKey: string, enabled: boolean) => {
    const existing = integrations.find(i => i.provider === provider);
    if (existing?.id) {
      await supabase.from('company_integrations' as any)
        .update({ api_key: apiKey || null, enabled, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      setIntegrations(prev => prev.map(i => i.provider === provider ? { ...i, api_key: apiKey || null, enabled } : i));
    } else {
      const { data } = await supabase.from('company_integrations' as any)
        .insert({ provider, api_key: apiKey || null, enabled })
        .select().single();
      if (data) setIntegrations(prev => [...prev, data as Integration]);
    }
    toast.success(apiKey ? 'Integração salva' : 'Integração removida');
  };

  if (!company) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  const Section = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 border border-border rounded-xl p-1 w-fit">
        {([['geral', 'Geral'], ['conectores', 'Conectores']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Aba Geral ─────────────────────────────────────────────────── */}
      {tab === 'geral' && (
        <>
          <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
            <Section title="Identidade da empresa" />

            <div>
              <p className={labelCls}>Logo (usada nos PDFs)</p>
              {company.logo_base64 ? (
                <div className="flex items-center gap-4">
                  <img src={company.logo_base64} alt="Logo" className="h-14 object-contain border border-border rounded-lg p-2" />
                  <button onClick={removeLogo} className="flex items-center gap-1.5 text-xs text-destructive hover:underline">
                    <X className="w-3.5 h-3.5" />Remover
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
                  {uploading
                    ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    : <Upload className="w-5 h-5 text-muted-foreground/50" />}
                  <p className="text-sm text-muted-foreground">{uploading ? 'Enviando...' : 'Clique para subir a logo'}</p>
                  <p className="text-xs text-muted-foreground/60">PNG ou JPG, preferencialmente fundo transparente</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Nome da empresa</label>
                <input className={inputCls} value={company.name ?? ''} onChange={e => save('name', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Razão Social</label>
                <input className={inputCls} value={company.razao_social ?? ''} onChange={e => save('razao_social', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>CNPJ</label>
                <input className={inputCls} value={company.cnpj ?? ''} onChange={e => save('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label className={labelCls}>Telefone</label>
                <input className={inputCls} value={company.telefone ?? ''} onChange={e => save('telefone', e.target.value)} placeholder="(15) 3327.2853" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Endereço completo</label>
                <input className={inputCls} value={company.endereco ?? ''} onChange={e => save('endereco', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Website</label>
                <input className={inputCls} value={company.website ?? ''} onChange={e => save('website', e.target.value)} placeholder="rondellobuffet.com.br" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
            <Section title="Dados bancários (exibidos nos PDFs)" />
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Banco</label>
                <input className={inputCls} value={company.banco ?? ''} onChange={e => save('banco', e.target.value)} placeholder="Itaú 341" />
              </div>
              <div>
                <label className={labelCls}>Agência</label>
                <input className={inputCls} value={company.agencia ?? ''} onChange={e => save('agencia', e.target.value)} placeholder="4877" />
              </div>
              <div>
                <label className={labelCls}>Conta</label>
                <input className={inputCls} value={company.conta ?? ''} onChange={e => save('conta', e.target.value)} placeholder="00004-4" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
            <Section title="Testemunha da empresa (Testemunha 1 nos contratos)" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nome</label>
                <input className={inputCls} value={(company as any).witness_1_name ?? ''} onChange={e => save('witness_1_name', e.target.value)} placeholder="Nome completo" />
              </div>
              <div>
                <label className={labelCls}>CPF</label>
                <input className={inputCls} value={(company as any).witness_1_cpf ?? ''} onChange={e => save('witness_1_cpf', e.target.value)} placeholder="000.000.000-00" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground/60">
              Substituída automaticamente nas tags <code className="bg-muted px-1 rounded">[NOME DA TESTEMUNHA 1]</code> e <code className="bg-muted px-1 rounded">[CPF DA TESTEMUNHA 1]</code>.
            </p>
          </div>

          <div className="bg-muted/30 border border-border rounded-2xl p-5 text-sm text-muted-foreground">
            Os modelos de contrato e de anexo são gerenciados em <strong>Cadastros → Contratos</strong>.
          </div>
        </>
      )}

      {/* ── Aba Conectores ────────────────────────────────────────────── */}
      {tab === 'conectores' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Conecte serviços externos ao sistema. Cada empresa configura sua própria chave — seus dados nunca são compartilhados.
          </p>

          {CONNECTORS.map(c => (
            <ConnectorCard
              key={c.provider}
              provider={c.provider}
              name={c.name}
              description={c.description}
              logo={c.logo}
              integration={integrations.find(i => i.provider === c.provider) ?? null}
              onSave={(key, enabled) => saveIntegration(c.provider, key, enabled)}
            />
          ))}

          <div className="bg-muted/30 border border-border rounded-2xl p-5 text-sm text-muted-foreground">
            Mais integrações em breve — Autentique, Google Calendar, WhatsApp Business.
          </div>
        </div>
      )}
    </div>
  );
}
