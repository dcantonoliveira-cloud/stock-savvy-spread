import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_TEMPLATES, TEMPLATE_LABELS, TEMPLATE_VARS,
  MessageTemplateKey, MessageTemplates, invalidateTemplateCache,
} from '@/lib/whatsapp';

const KEYS: MessageTemplateKey[] = ['payment', 'file', 'tasting', 'review', 'portal_invite', 'tasting_availability'];

async function loadSavedTemplates(): Promise<Partial<MessageTemplates>> {
  const { data } = await (supabase.from as any)('company_integrations')
    .select('api_key')
    .eq('provider', 'whatsapp_messages')
    .single();
  try { return data?.api_key ? JSON.parse(data.api_key) : {}; } catch { return {}; }
}

async function saveTemplates(templates: MessageTemplates) {
  const json = JSON.stringify(templates);
  const { data: existing } = await (supabase.from as any)('company_integrations')
    .select('id').eq('provider', 'whatsapp_messages').single();
  if (existing?.id) {
    await (supabase.from as any)('company_integrations')
      .update({ api_key: json, enabled: true, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await (supabase.from as any)('company_integrations')
      .insert({ provider: 'whatsapp_messages', api_key: json, enabled: true });
  }
  invalidateTemplateCache();
}

export default function MensagensPage() {
  const [templates, setTemplates] = useState<MessageTemplates | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    setLoaded(true);
    loadSavedTemplates().then(saved => {
      setTemplates({ ...DEFAULT_TEMPLATES, ...saved });
    });
  }

  const handleSave = async () => {
    if (!templates) return;
    setSaving(true);
    await saveTemplates(templates);
    toast.success('Modelos salvos');
    setSaving(false);
  };

  if (!templates) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Modelos de Mensagem WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure o texto enviado automaticamente em cada evento do sistema.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar modelos'}
        </button>
      </div>

      <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 text-xs text-muted-foreground leading-relaxed shrink-0">
        Use variáveis entre chaves duplas para personalizar a mensagem. As variáveis disponíveis para cada modelo estão indicadas ao lado do título.
      </div>

      {/* Templates — grade 2 colunas */}
      <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto pb-4">
        {KEYS.map(key => (
          <div key={key} className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#25D366' }}>
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-foreground">{TEMPLATE_LABELS[key]}</span>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {TEMPLATE_VARS[key].map(v => (
                  <span key={v} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{v}</span>
                ))}
              </div>
            </div>
            <textarea
              value={templates[key]}
              onChange={e => setTemplates(prev => prev ? { ...prev, [key]: e.target.value } : prev)}
              className="w-full flex-1 min-h-[160px] px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-mono leading-relaxed"
            />
            <button
              onClick={() => setTemplates(prev => prev ? { ...prev, [key]: DEFAULT_TEMPLATES[key] } : prev)}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline transition-colors self-start">
              Restaurar padrão
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
