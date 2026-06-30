import { supabase } from '@/integrations/supabase/client';

export type ZapiConfig = { instance_id: string; token: string };

export async function getZapiConfig(): Promise<ZapiConfig | null> {
  const { data } = await (supabase.from as any)('integrations')
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatted, message }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: (body as any)?.message ?? `HTTP ${res.status}` };
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
