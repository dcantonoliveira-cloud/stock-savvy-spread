import { supabase } from '@/integrations/supabase/client';

export type ZapiConfig = { instance_id: string; token: string; client_token?: string };

export type MessageTemplateKey = 'payment' | 'file' | 'tasting' | 'review' | 'portal_invite';

export type MessageTemplates = Record<MessageTemplateKey, string>;

// Defaults — substituídos pelos templates salvos em Configurações
export const DEFAULT_TEMPLATES: MessageTemplates = {
  payment:       `Olá, {{clientName}}! 😊\n\nRegistramos seu pagamento de *{{value}}* referente ao evento *{{eventName}}*.\n\nQualquer dúvida, estamos à disposição! 🎉\n\n— Rondello Buffet`,
  file:          `Olá, {{clientName}}! 📎\n\nUm novo arquivo foi adicionado ao seu evento *{{eventName}}*:\n\n*{{fileName}}*\n\nAcesse o portal do cliente para visualizar.\n\n— Rondello Buffet`,
  tasting:       `Olá, {{clientName}}! 🍽️\n\nSua degustação foi agendada para o dia *{{date}}*.\n\nAguardamos vocês com muito carinho para essa experiência especial!\n\n— Rondello Buffet`,
  review:        `Olá, {{clientName}}! ⭐\n\nFoi uma honra realizar o *{{eventName}}*!\n\nGostaríamos muito de saber sua opinião sobre nossos serviços. Sua avaliação é muito importante para nós!\n\nObrigado pela confiança!\n— Rondello Buffet`,
  portal_invite: `Olá, {{clientName}}! 🎉\n\nSeu portal do cliente está pronto! Por lá você acompanha tudo sobre o seu evento *{{eventName}}*: financeiro, arquivos e informações da festa.\n\n*Como acessar:*\n1. Acesse: {{portalUrl}}\n2. Crie sua conta\n3. Use o código: *{{accessCode}}*\n\n— Rondello Buffet`,
};

export const TEMPLATE_LABELS: Record<MessageTemplateKey, string> = {
  payment:       'Pagamento adicionado',
  file:          'Arquivo incluído',
  tasting:       'Degustação agendada',
  review:        'Pedido de avaliação',
  portal_invite: 'Convite ao portal do cliente',
};

export const TEMPLATE_VARS: Record<MessageTemplateKey, string[]> = {
  payment:       ['{{clientName}}', '{{value}}', '{{eventName}}'],
  file:          ['{{clientName}}', '{{eventName}}', '{{fileName}}'],
  tasting:       ['{{clientName}}', '{{date}}', '{{address}}'],
  review:        ['{{clientName}}', '{{eventName}}'],
  portal_invite: ['{{clientName}}', '{{eventName}}', '{{accessCode}}', '{{portalUrl}}'],
};

// Busca templates salvos no banco (provider = 'whatsapp_messages')
let _cachedTemplates: MessageTemplates | null = null;

export async function getMessageTemplates(): Promise<MessageTemplates> {
  if (_cachedTemplates) return _cachedTemplates;
  const { data } = await (supabase.from as any)('company_integrations')
    .select('api_key')
    .eq('provider', 'whatsapp_messages')
    .single();
  if (data?.api_key) {
    try {
      _cachedTemplates = { ...DEFAULT_TEMPLATES, ...JSON.parse(data.api_key) };
      return _cachedTemplates!;
    } catch { /* fallthrough */ }
  }
  return DEFAULT_TEMPLATES;
}

export function invalidateTemplateCache() {
  _cachedTemplates = null;
}

// Constrói a mensagem final com variáveis substituídas
export async function buildMessage(
  key: MessageTemplateKey,
  vars: Partial<Record<string, string>>
): Promise<string> {
  const templates = await getMessageTemplates();
  let text = templates[key];
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replaceAll(`{{${k}}}`, v ?? '');
  });
  return text;
}

export async function getZapiConfig(): Promise<ZapiConfig | null> {
  const { data } = await (supabase.from as any)('company_integrations')
    .select('api_key, enabled')
    .eq('provider', 'zapi')
    .single();
  if (!data?.enabled || !data?.api_key) return null;
  try { return JSON.parse(data.api_key); } catch { return null; }
}

// Formata número brasileiro para o formato Z-API (55 + DDD + número, sem símbolos)
export function formatPhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export async function sendWhatsApp(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const config = await getZapiConfig();
  if (!config) return { ok: false, error: 'Z-API não configurado' };

  const formatted = formatPhoneBR(phone);
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.client_token ? { 'Client-Token': config.client_token } : {}),
        },
        body: JSON.stringify({ phone: formatted, message }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = (body as any)?.message ?? (body as any)?.error ?? (body as any)?.reason ?? JSON.stringify(body);
      console.error('[Z-API] erro', res.status, body);
      return { ok: false, error: `HTTP ${res.status}: ${detail}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Erro de rede' };
  }
}

// Abre wa.me como fallback quando Z-API não está configurado
export function openWhatsAppLink(phone: string, message: string) {
  const formatted = formatPhoneBR(phone);
  window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(message)}`, '_blank');
}
