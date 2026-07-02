import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Upload, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle,
  User, Building2, Plug, Camera, Lock, MessageCircle, Save, ChevronDown, ChevronUp,
  HardDrive, RefreshCw, CalendarClock, Mail,
} from 'lucide-react';
import {
  DEFAULT_TEMPLATES, TEMPLATE_LABELS, TEMPLATE_VARS,
  MessageTemplateKey, MessageTemplates, invalidateTemplateCache,
} from '@/lib/whatsapp';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  witness_1_name: string | null;
  witness_1_cpf: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_base64: string | null;
  phone: string | null;
}

interface Integration {
  id?: string;
  provider: string;
  api_key: string | null;
  enabled: boolean;
}

type Tab = 'empresa' | 'conectores';

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputCls = 'w-full h-10 px-3 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5';

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 whitespace-nowrap">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

// ─── Zapi Logo ────────────────────────────────────────────────────────────────
function ZapiLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#25D366' }}>
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.138.564 4.14 1.547 5.872L0 24l6.302-1.53A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.938 0-3.752-.517-5.31-1.42l-.379-.225-3.742.908.95-3.627-.247-.393A9.957 9.957 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-foreground leading-none">Z-API</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">WhatsApp Business API</p>
      </div>
    </div>
  );
}

// ─── ZapSign Logo ─────────────────────────────────────────────────────────────
function ZapSignLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ background: '#00C566' }}>
        <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
          <path d="M8 24l7-8H9l8-12h8l-7 8h6L8 24z" fill="white" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-foreground leading-none">ZapSign</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">zapsign.com.br</p>
      </div>
    </div>
  );
}

// ─── Zapi Connector Card ──────────────────────────────────────────────────────
function ZapiConnectorCard({ integration, onSave }: {
  integration: Integration | null;
  onSave: (key: string, enabled: boolean) => Promise<void>;
}) {
  const parsed = (() => {
    try { return integration?.api_key ? JSON.parse(integration.api_key) : {}; } catch { return {}; }
  })();
  const [instanceId,   setInstanceId]   = useState<string>(parsed.instance_id ?? '');
  const [token,        setToken]        = useState<string>(parsed.token ?? '');
  const [clientToken,  setClientToken]  = useState<string>(parsed.client_token ?? '');
  const [enabled,      setEnabled]      = useState(integration?.enabled ?? false);
  const [showToken,    setShowToken]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [editing,      setEditing]      = useState(!integration?.api_key);

  const isConfigured = !!integration?.api_key;

  const handleSave = async () => {
    if (!instanceId.trim() || !token.trim()) { toast.error('Preencha Instance ID e Token'); return; }
    setSaving(true);
    await onSave(JSON.stringify({ instance_id: instanceId.trim(), token: token.trim(), client_token: clientToken.trim() || undefined }), enabled);
    setSaving(false);
    setEditing(false);
  };

  const handleRemove = async () => {
    setSaving(true);
    await onSave('', false);
    setSaving(false);
    setInstanceId(''); setToken(''); setClientToken(''); setEditing(true); setEnabled(false);
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <ZapiLogo />
          <p className="text-xs text-muted-foreground max-w-sm">
            Envie mensagens de WhatsApp diretamente do sistema — confirmações, lembretes de evento e contratos.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isConfigured && (
            <button
              onClick={async () => {
                const next = !enabled; setEnabled(next); setSaving(true);
                await onSave(integration!.api_key!, next); setSaving(false);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-muted border border-border'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          )}
          <span className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
            isConfigured ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-muted-foreground bg-muted border-border'
          }`}>
            {isConfigured ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {isConfigured ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <Field label="Instance ID">
            <input type="text" value={instanceId} onChange={e => setInstanceId(e.target.value)}
              placeholder="Ex: 3EB09A6FA3D8..." className={inputCls} />
          </Field>
          <Field label="Token da instância (Security Token)">
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} value={token} onChange={e => setToken(e.target.value)}
                placeholder="Cole aqui o Security Token da instância…" className={`${inputCls} pr-10`} />
              <button type="button" onClick={() => setShowToken(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Painel Z-API → sua instância → Security Token.</p>
          </Field>
          <Field label="Client-Token (conta Z-API)">
            <input type="password" value={clientToken} onChange={e => setClientToken(e.target.value)}
              placeholder="Cole aqui o Client-Token da sua conta…" className={inputCls} />
            <p className="text-xs text-muted-foreground mt-1.5">Painel Z-API → sua conta → Client-Token (canto superior direito).</p>
          </Field>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !instanceId.trim() || !token.trim()}
              className="px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors disabled:opacity-40">
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            {isConfigured && (
              <button onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Instance: <span className="font-mono">{instanceId.slice(0, 8)}…</span></p>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
              Editar
            </button>
            <button onClick={handleRemove} disabled={saving}
              className="px-3 py-1.5 rounded-lg border border-red-200 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
              Remover
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ZapSign Connector Card ───────────────────────────────────────────────────
function ZapSignConnectorCard({ integration, onSave }: {
  integration: Integration | null;
  onSave: (key: string, enabled: boolean) => Promise<void>;
}) {
  const parsed = (() => { try { return integration?.api_key ? JSON.parse(integration.api_key) : {}; } catch { return {}; } })();
  const [token,   setToken]   = useState<string>(parsed.token ?? '');
  const [enabled, setEnabled] = useState(integration?.enabled ?? false);
  const [showTok, setShowTok] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(!integration?.api_key);

  const isConfigured = !!integration?.api_key;

  const handleSave = async () => {
    if (!token.trim()) { toast.error('Preencha o Token de acesso'); return; }
    setSaving(true);
    await onSave(JSON.stringify({ token: token.trim() }), enabled);
    setSaving(false);
    setEditing(false);
  };
  const handleRemove = async () => {
    setSaving(true);
    await onSave('', false);
    setSaving(false);
    setToken('');
    setEditing(true);
    setEnabled(false);
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <ZapSignLogo />
          <p className="text-xs text-muted-foreground max-w-sm">Assinatura eletrônica com validade jurídica. Envie contratos para assinatura diretamente da ficha do evento, sem sair do sistema.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <div onClick={() => setEnabled(e => !e)} className={`w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'} relative`}>
            <div className={`w-3.5 h-3.5 rounded-full bg-white shadow absolute top-0.75 transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} style={{top:'3px'}} />
          </div>
        </label>
      </div>
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Token de acesso</label>
            <div className="relative">
              <input type={showTok ? 'text' : 'password'} value={token} onChange={e => setToken(e.target.value)}
                placeholder="e8a5e7d4-435b-497e-..."
                className="w-full h-9 px-3 pr-10 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-mono" />
              <button type="button" onClick={() => setShowTok(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showTok ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">ZapSign → Configurações → Integrações → API ZapSign → Token de acesso.</p>
          </div>
          <div className="flex justify-end gap-2">
            {isConfigured && <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>}
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Token: <span className="font-mono">{token.slice(0, 8)}…</span></p>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">Editar</button>
            <button onClick={handleRemove} disabled={saving} className="px-3 py-1.5 rounded-lg border border-red-200 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">Remover</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Connector Card ───────────────────────────────────────────────────────────
function ConnectorCard({ provider, description, logo, integration, onSave }: {
  provider: string;
  description: string;
  logo: React.ReactNode;
  integration: Integration | null;
  onSave: (key: string, enabled: boolean) => Promise<void>;
}) {
  const [apiKey,  setApiKey]  = useState(integration?.api_key ?? '');
  const [enabled, setEnabled] = useState(integration?.enabled ?? false);
  const [showKey, setShowKey] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(!integration?.api_key);

  const isConfigured = !!integration?.api_key;

  const handleSave = async () => {
    setSaving(true);
    await onSave(apiKey.trim(), enabled);
    setSaving(false);
    setEditing(false);
  };

  const handleRemove = async () => {
    setSaving(true);
    await onSave('', false);
    setSaving(false);
    setApiKey('');
    setEditing(true);
    setEnabled(false);
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {logo}
          <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isConfigured && (
            <button
              onClick={async () => {
                const next = !enabled;
                setEnabled(next);
                setSaving(true);
                await onSave(apiKey, next);
                setSaving(false);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-muted border border-border'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          )}
          <span className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
            isConfigured
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-muted-foreground bg-muted border-border'
          }`}>
            {isConfigured ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {isConfigured ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <Field label="Chave da API">
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
            <p className="text-xs text-muted-foreground mt-1.5">A chave fica armazenada de forma segura e nunca é exibida integralmente.</p>
          </Field>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !apiKey.trim()}
              className="px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors disabled:opacity-40">
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            {isConfigured && (
              <button onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-10 px-3 flex items-center bg-muted/40 border border-border rounded-xl">
            <span className="text-sm text-muted-foreground font-mono tracking-[0.2em]">••••••••••••••••</span>
          </div>
          <button onClick={() => setEditing(true)}
            className="px-3 h-10 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors whitespace-nowrap">
            Alterar
          </button>
          <button onClick={handleRemove}
            className="px-3 h-10 rounded-xl border border-border text-xs text-red-500 hover:bg-red-50 transition-colors whitespace-nowrap">
            Remover
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function AvatarBlock({ profile, onUpload, onRemove, uploading }: {
  profile: Profile;
  onUpload: (file: File) => void;
  onRemove: () => void;
  uploading: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const initials = profile.display_name
    .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?';

  return (
    <div className="flex items-center gap-5">
      <div className="relative group cursor-pointer" onClick={() => ref.current?.click()}>
        {profile.avatar_base64 ? (
          <img src={profile.avatar_base64} alt="" className="w-20 h-20 rounded-2xl object-cover border border-border" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary border border-border select-none">
            {initials}
          </div>
        )}
        <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading
            ? <Loader2 className="w-5 h-5 text-white animate-spin" />
            : <Camera className="w-5 h-5 text-white" />}
        </div>
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
      </div>
      <div>
        <p className="font-semibold text-foreground">{profile.display_name}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={() => ref.current?.click()} className="text-xs text-primary hover:underline">
            Trocar foto
          </button>
          {profile.avatar_base64 && (
            <button onClick={onRemove} className="text-xs text-muted-foreground hover:text-destructive">
              Remover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp Templates Card ──────────────────────────────────────────────────
function WhatsAppTemplatesCard({ savedJson, onSave }: {
  savedJson: string | null;
  onSave: (json: string) => Promise<void>;
}) {
  const parsed: Partial<MessageTemplates> = (() => {
    try { return savedJson ? JSON.parse(savedJson) : {}; } catch { return {}; }
  })();

  const [templates, setTemplates] = useState<MessageTemplates>({
    ...DEFAULT_TEMPLATES,
    ...parsed,
  });
  const [saving, setSaving]       = useState(false);
  const [open, setOpen]           = useState(false);

  const KEYS: MessageTemplateKey[] = ['payment', 'file', 'tasting', 'review'];

  const handleSave = async () => {
    setSaving(true);
    await onSave(JSON.stringify(templates));
    setSaving(false);
    toast.success('Modelos salvos');
  };

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#25D366' }}>
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-foreground leading-none">Modelos de Mensagem WhatsApp</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Configure o texto enviado em cada gatilho automático</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-5 py-5 space-y-5">
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 leading-relaxed">
            Use variáveis entre chaves duplas para personalizar. Cada modelo tem as variáveis disponíveis indicadas abaixo.
          </div>

          {KEYS.map(key => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {TEMPLATE_LABELS[key]}
                </label>
                <div className="flex gap-1 flex-wrap justify-end">
                  {TEMPLATE_VARS[key].map(v => (
                    <span key={v} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{v}</span>
                  ))}
                </div>
              </div>
              <textarea
                value={templates[key]}
                onChange={e => setTemplates(prev => ({ ...prev, [key]: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-mono leading-relaxed"
              />
              <button
                onClick={() => setTemplates(prev => ({ ...prev, [key]: DEFAULT_TEMPLATES[key] }))}
                className="text-[11px] text-muted-foreground hover:text-foreground mt-1 hover:underline">
                Restaurar padrão
              </button>
            </div>
          ))}

          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar modelos'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Backup automático (Google Drive · OAuth) ─────────────────────────────────
interface BackupCfg {
  frequency: 'weekly' | 'monthly';
  day: number;
  notify_email: string;
  refresh_token?: string | null;
  connected_email?: string | null;
  oauth_state?: string | null;
  folder_id?: string | null;
  last_run_at?: string | null;
  last_status?: 'success' | 'partial' | 'error' | null;
  last_summary?: string | null;
  last_error?: string | null;
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DEFAULT_BACKUP: BackupCfg = { frequency: 'weekly', day: 1, notify_email: '', last_status: null };

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const OAUTH_REDIRECT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-callback`;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email openid';

function DriveBackupCard({ integration, onSave }: {
  integration: Integration | null;
  onSave: (key: string, enabled: boolean) => Promise<void>;
}) {
  const parsed: BackupCfg = (() => {
    try { return integration?.api_key ? { ...DEFAULT_BACKUP, ...JSON.parse(integration.api_key) } : DEFAULT_BACKUP; }
    catch { return DEFAULT_BACKUP; }
  })();

  const [cfg, setCfg] = useState<BackupCfg>(parsed);
  const [enabled, setEnabled] = useState(integration?.enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const connected = !!cfg.refresh_token;
  const upd = (patch: Partial<BackupCfg>) => setCfg(prev => ({ ...prev, ...patch }));

  // Toast de retorno do fluxo OAuth (?drive=connected|error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const drive = params.get('drive');
    if (drive === 'connected') toast.success('Google Drive conectado!');
    else if (drive === 'error') toast.error('Não foi possível conectar o Google Drive');
    if (drive) {
      params.delete('drive');
      const clean = window.location.pathname + (params.toString() ? `?${params}` : '');
      window.history.replaceState({}, '', clean);
    }
  }, []);

  const buildStore = (patch: Partial<BackupCfg> = {}): BackupCfg => ({
    frequency: cfg.frequency,
    day: Number(cfg.day),
    notify_email: cfg.notify_email.trim(),
    refresh_token: cfg.refresh_token ?? null,
    connected_email: cfg.connected_email ?? null,
    oauth_state: cfg.oauth_state ?? null,
    folder_id: cfg.folder_id ?? null,
    last_run_at: cfg.last_run_at ?? null,
    last_status: cfg.last_status ?? null,
    last_summary: cfg.last_summary ?? null,
    last_error: cfg.last_error ?? null,
    ...patch,
  });

  const persist = async (nextEnabled = enabled) => {
    setSaving(true);
    await onSave(JSON.stringify(buildStore()), nextEnabled);
    setSaving(false);
    return true;
  };

  const connectDrive = async () => {
    if (!GOOGLE_CLIENT_ID) { toast.error('VITE_GOOGLE_CLIENT_ID não configurado'); return; }
    const state = crypto.randomUUID();
    // Salva o nonce (state) e a config atual antes de redirecionar
    await onSave(JSON.stringify(buildStore({ oauth_state: state })), enabled);
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: OAUTH_REDIRECT,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    }).toString();
    window.location.href = url;
  };

  const disconnectDrive = async () => {
    upd({ refresh_token: null, connected_email: null });
    setEnabled(false);
    await onSave(JSON.stringify(buildStore({ refresh_token: null, connected_email: null })), false);
    toast.success('Google Drive desconectado');
  };

  const runNow = async () => {
    await persist();
    setRunning(true);
    try {
      const { data, error } = await (supabase.functions as any).invoke('backup-databases', { body: { force: true } });
      if (error) throw error;
      if (data?.ok) toast.success(`Backup concluído · ${data.totalRows?.toLocaleString('pt-BR') ?? 0} registros`);
      else if (data?.skipped) toast.info(`Backup não rodou: ${data.reason ?? 'sem configuração'}`);
      else throw new Error(data?.error || 'Falha no backup');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao rodar backup');
    } finally {
      setRunning(false);
    }
  };

  const statusBadge = () => {
    const st = cfg.last_status;
    if (!st) return null;
    const map = {
      success: { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Último: sucesso' },
      partial: { cls: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Último: parcial' },
      error:   { cls: 'text-red-600 bg-red-50 border-red-200', label: 'Último: erro' },
    }[st];
    return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${map.cls}`}>{map.label}</span>;
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#1a73e8' }}>
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">Backup automático · Google Drive</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Exporta as tabelas em CSV e mantém só o backup mais recente</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Envia eventos, financeiro, cadastros, estoque, materiais e fichas técnicas para o seu Google Drive, no dia escolhido, e avisa por e-mail.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {statusBadge()}
          {connected && (
            <button
              onClick={async () => { const next = !enabled; setEnabled(next); await persist(next); }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-muted border border-border'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          )}
        </div>
      </div>

      {/* Conexão com o Drive */}
      {!connected ? (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-dashed border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">Conecte sua conta do Google para o sistema enviar os backups automaticamente.</p>
          <button onClick={connectDrive}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm shrink-0">
            <svg viewBox="0 0 48 48" className="w-4 h-4"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
            Conectar Google Drive
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-800 truncate">
              Conectado{cfg.connected_email ? ` como ${cfg.connected_email}` : ''}
            </p>
          </div>
          <button onClick={disconnectDrive} className="text-xs text-emerald-700 hover:text-red-600 transition-colors shrink-0">
            Desconectar
          </button>
        </div>
      )}

      {/* Configuração (só faz sentido depois de conectar) */}
      <div className={`grid grid-cols-2 gap-4 pt-1 ${!connected ? 'opacity-40 pointer-events-none' : ''}`}>
        <div>
          <label className={labelCls}><CalendarClock className="w-3 h-3 inline mr-1 -mt-0.5" />Frequência</label>
          <select className={inputCls} value={cfg.frequency}
            onChange={e => upd({ frequency: e.target.value as 'weekly' | 'monthly', day: 1 })}>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>{cfg.frequency === 'weekly' ? 'Dia da semana' : 'Dia do mês'}</label>
          {cfg.frequency === 'weekly' ? (
            <select className={inputCls} value={cfg.day} onChange={e => upd({ day: Number(e.target.value) })}>
              {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          ) : (
            <select className={inputCls} value={cfg.day} onChange={e => upd({ day: Number(e.target.value) })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Dia {d}</option>)}
            </select>
          )}
        </div>

        <div className="col-span-2">
          <label className={labelCls}><Mail className="w-3 h-3 inline mr-1 -mt-0.5" />E-mail para aviso</label>
          <input className={inputCls} type="email" value={cfg.notify_email} onChange={e => upd({ notify_email: e.target.value })}
            placeholder="douglas@rondellobuffet.com.br" />
        </div>
      </div>

      {cfg.last_run_at && (
        <p className="text-[11px] text-muted-foreground">
          Último backup: {new Date(cfg.last_run_at).toLocaleString('pt-BR')}
          {cfg.last_summary ? ` · ${cfg.last_summary}` : ''}
          {cfg.last_status === 'error' && cfg.last_error ? ` · ${cfg.last_error}` : ''}
        </p>
      )}

      {connected && (
        <div className="flex items-center gap-2 pt-1">
          <button onClick={() => persist().then(ok => ok && toast.success('Configuração salva'))} disabled={saving}
            className="px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors disabled:opacity-40">
            {saving ? 'Salvando…' : 'Salvar configuração'}
          </button>
          <button onClick={runNow} disabled={running || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Fazendo backup…' : 'Fazer backup agora'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>('empresa');
  const [company,         setCompany]       = useState<Company | null>(null);
  const [profile,         setProfile]       = useState<Profile | null>(null);
  const [integrations,    setIntegrations]  = useState<Integration[]>([]);
  const [logoUploading,   setLogoUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [newPassword,     setNewPassword]   = useState('');
  const [showPwd,         setShowPwd]       = useState(false);
  const [pwdSaving,       setPwdSaving]     = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const timers  = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    Promise.all([
      supabase.from('companies').select('*').limit(1).single(),
      supabase.from('profiles').select('*').limit(1).single(),
      supabase.from('company_integrations' as any).select('*'),
    ]).then(([co, pr, intg]) => {
      if (co.data)   setCompany(co.data as any);
      if (pr.data)   setProfile(pr.data as any);
      if (intg.data) setIntegrations(intg.data as Integration[]);
    });
  }, []);

  const saveCompany = (field: string, value: string | null) => {
    if (!company) return;
    setCompany(prev => prev ? { ...prev, [field]: value } : prev);
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(async () => {
      const { error } = await supabase.from('companies').update({ [field]: value }).eq('id', company.id);
      if (error) toast.error('Erro ao salvar'); else toast.success('Salvo');
    }, 1000);
  };

  const saveProfile = (field: string, value: string | null) => {
    if (!profile) return;
    setProfile(prev => prev ? { ...prev, [field]: value } : prev);
    clearTimeout(timers.current['p_' + field]);
    timers.current['p_' + field] = setTimeout(async () => {
      const { error } = await supabase.from('profiles').update({ [field]: value } as any).eq('id', profile.id);
      if (error) toast.error('Erro ao salvar'); else toast.success('Salvo');
    }, 1000);
  };

  const handleLogoUpload = async (file: File) => {
    if (!company) return;
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await supabase.from('companies').update({ logo_base64: base64 }).eq('id', company.id);
      setCompany(prev => prev ? { ...prev, logo_base64: base64 } : prev);
      toast.success('Logo salva');
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!profile) return;
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await supabase.from('profiles').update({ avatar_base64: base64 } as any).eq('id', profile.id);
      setProfile(prev => prev ? { ...prev, avatar_base64: base64 } : prev);
      toast.success('Foto atualizada');
      setAvatarUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarRemove = async () => {
    if (!profile) return;
    await supabase.from('profiles').update({ avatar_base64: null } as any).eq('id', profile.id);
    setProfile(prev => prev ? { ...prev, avatar_base64: null } : prev);
    toast.success('Foto removida');
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error('Erro ao alterar senha');
    else { toast.success('Senha alterada'); setNewPassword(''); }
    setPwdSaving(false);
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

  if (!company || !profile) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'empresa',    label: 'Empresa',    icon: <Building2 className="w-4 h-4" /> },
    { key: 'conectores', label: 'Conectores', icon: <Plug className="w-4 h-4" /> },
  ];

  return (
    <div className="flex gap-6 items-start">

      {/* Sidebar */}
      <div className="w-48 shrink-0 bg-white border border-border rounded-2xl p-2 sticky top-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              tab === t.key
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* ── Empresa ───────────────────────────────────────────────── */}
        {tab === 'empresa' && (
          <>
            <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
              <Section title="Identidade" />
              <Field label="Logo (usada nos PDFs)">
                {company.logo_base64 ? (
                  <div className="flex items-center gap-4">
                    <img src={company.logo_base64} alt="Logo"
                      className="h-14 w-auto object-contain border border-border rounded-xl p-2 bg-muted/20" />
                    <div className="space-y-1.5">
                      <button onClick={() => logoRef.current?.click()}
                        className="text-xs text-primary hover:underline block">Trocar logo</button>
                      <button onClick={async () => {
                        await supabase.from('companies').update({ logo_base64: null }).eq('id', company.id);
                        setCompany(p => p ? { ...p, logo_base64: null } : p);
                        toast.success('Logo removida');
                      }} className="text-xs text-muted-foreground hover:text-destructive block">Remover</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => logoRef.current?.click()}
                    className="flex flex-col items-center gap-2 p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-muted/10 transition-colors">
                    {logoUploading
                      ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      : <Upload className="w-5 h-5 text-muted-foreground/40" />}
                    <p className="text-sm text-muted-foreground">{logoUploading ? 'Enviando…' : 'Clique para subir a logo'}</p>
                    <p className="text-xs text-muted-foreground/50">PNG ou JPG, fundo transparente</p>
                  </div>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Nome da empresa">
                    <input className={inputCls} value={company.name ?? ''} onChange={e => saveCompany('name', e.target.value)} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Razão Social">
                    <input className={inputCls} value={company.razao_social ?? ''} onChange={e => saveCompany('razao_social', e.target.value)} />
                  </Field>
                </div>
                <div>
                  <Field label="CNPJ">
                    <input className={inputCls} value={company.cnpj ?? ''} onChange={e => saveCompany('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
                  </Field>
                </div>
                <div>
                  <Field label="Telefone">
                    <input className={inputCls} value={company.telefone ?? ''} onChange={e => saveCompany('telefone', e.target.value)} placeholder="(15) 3327-2853" />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Endereço completo">
                    <input className={inputCls} value={company.endereco ?? ''} onChange={e => saveCompany('endereco', e.target.value)} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Website">
                    <input className={inputCls} value={company.website ?? ''} onChange={e => saveCompany('website', e.target.value)} placeholder="rondellobuffet.com.br" />
                  </Field>
                </div>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
              <Section title="Dados bancários (exibidos nos PDFs)" />
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Banco">
                    <input className={inputCls} value={company.banco ?? ''} onChange={e => saveCompany('banco', e.target.value)} placeholder="Itaú 341" />
                  </Field>
                </div>
                <div>
                  <Field label="Agência">
                    <input className={inputCls} value={company.agencia ?? ''} onChange={e => saveCompany('agencia', e.target.value)} placeholder="4877" />
                  </Field>
                </div>
                <div>
                  <Field label="Conta">
                    <input className={inputCls} value={company.conta ?? ''} onChange={e => saveCompany('conta', e.target.value)} placeholder="00004-4" />
                  </Field>
                </div>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
              <Section title="Assinante da empresa (ZapSign)" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Field label="Nome">
                    <input className={inputCls} value={(company as any).signer_name ?? ''} onChange={e => saveCompany('signer_name', e.target.value)} placeholder="Nome do responsável" />
                  </Field>
                </div>
                <div>
                  <Field label="E-mail">
                    <input className={inputCls} type="email" value={(company as any).signer_email ?? ''} onChange={e => saveCompany('signer_email', e.target.value)} placeholder="email@empresa.com" />
                  </Field>
                </div>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
              <Section title="Testemunha da empresa (nos contratos)" />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Field label="Nome">
                    <input className={inputCls} value={(company as any).witness_1_name ?? ''} onChange={e => saveCompany('witness_1_name', e.target.value)} placeholder="Nome completo" />
                  </Field>
                </div>
                <div>
                  <Field label="CPF">
                    <input className={inputCls} value={(company as any).witness_1_cpf ?? ''} onChange={e => saveCompany('witness_1_cpf', e.target.value)} placeholder="000.000.000-00" />
                  </Field>
                </div>
                <div>
                  <Field label="E-mail (ZapSign)">
                    <input className={inputCls} type="email" value={(company as any).witness_1_email ?? ''} onChange={e => saveCompany('witness_1_email', e.target.value)} placeholder="testemunha@empresa.com" />
                  </Field>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/60">
                Tags nos modelos: <code className="bg-muted px-1 rounded">[NOME DA TESTEMUNHA 1]</code> e <code className="bg-muted px-1 rounded">[CPF DA TESTEMUNHA 1]</code>
              </p>
            </div>

            <p className="text-xs text-muted-foreground px-1">
              Modelos de contrato e anexo em <strong>Cadastros → Contratos</strong>.
            </p>
          </>
        )}

        {/* ── Conectores ────────────────────────────────────────────── */}
        {tab === 'conectores' && (
          <>
            <p className="text-sm text-muted-foreground">
              Conecte serviços externos ao sistema. Cada empresa configura sua própria chave — seus dados nunca são compartilhados.
            </p>

            <ZapSignConnectorCard
              integration={integrations.find(i => i.provider === 'zapsign') ?? null}
              onSave={(key, enabled) => saveIntegration('zapsign', key, enabled)}
            />

            <ZapiConnectorCard
              integration={integrations.find(i => i.provider === 'zapi') ?? null}
              onSave={(key, enabled) => saveIntegration('zapi', key, enabled)}
            />

            <DriveBackupCard
              integration={integrations.find(i => i.provider === 'drive_backup') ?? null}
              onSave={(key, enabled) => saveIntegration('drive_backup', key, enabled)}
            />

            <div className="border border-border rounded-2xl p-5 bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Mais integrações em breve — Autentique, Google Calendar.
              </p>
            </div>
          </>
        )}


      </div>
    </div>
  );
}
