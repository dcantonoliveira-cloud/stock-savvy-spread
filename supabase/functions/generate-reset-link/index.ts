import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verifica que o chamador é supervisor
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerRole } = await adminClient
      .from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'supervisor').maybeSingle();
    if (!callerRole) {
      return new Response(JSON.stringify({ error: 'Apenas supervisores podem redefinir senhas' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, phone, name, redirectTo } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gera link de redefinição
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: redirectTo ?? `${supabaseUrl}/reset-password` },
    });

    if (error || !data?.properties?.action_link) {
      return new Response(JSON.stringify({ error: error?.message ?? 'Erro ao gerar link' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const link = data.properties.action_link;
    const firstName = (name ?? 'você').split(' ')[0];

    // Busca config ZApi
    const { data: zapiRow } = await adminClient
      .from('company_integrations' as any)
      .select('api_key, enabled')
      .eq('provider', 'zapi')
      .maybeSingle();

    if (!zapiRow?.enabled || !zapiRow?.api_key || !phone) {
      // Sem ZApi ou sem telefone — retorna o link para o supervisor copiar
      return new Response(JSON.stringify({ ok: true, link, sent_whatsapp: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let zapiConfig: { instance_id: string; token: string; client_token?: string };
    try { zapiConfig = JSON.parse(zapiRow.api_key); } catch {
      return new Response(JSON.stringify({ ok: true, link, sent_whatsapp: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message = `Olá, ${firstName}! 👋\n\nAqui está o seu link para redefinir a senha do sistema Rondello:\n\n${link}\n\n_Este link expira em 24 horas._\n\n— Rondello Buffet`;

    const digits = phone.replace(/\D/g, '');
    const formatted = digits.startsWith('55') ? digits : `55${digits}`;

    const zapiRes = await fetch(
      `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(zapiConfig.client_token ? { 'Client-Token': zapiConfig.client_token } : {}),
        },
        body: JSON.stringify({ phone: formatted, message }),
      }
    );

    const sent = zapiRes.ok;

    return new Response(JSON.stringify({ ok: true, sent_whatsapp: sent, link: sent ? undefined : link }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
