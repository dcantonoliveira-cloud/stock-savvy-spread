import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotifyRequest {
  payslip_id: string
  employee_id: string
  payslip_title: string
  sign_url: string            // URL para o funcionário acessar e assinar
  channels: ('email' | 'whatsapp')[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Validate supervisor JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Não autorizado' }, 401)
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Sessão inválida' }, 401)

  const body: NotifyRequest = await req.json()
  const { payslip_id, employee_id, payslip_title, sign_url, channels } = body

  // Load employee profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, phone')
    .eq('user_id', employee_id)
    .single()

  if (!profile) return json({ error: 'Funcionário não encontrado' }, 404)

  const results: Record<string, { ok: boolean; error?: string }> = {}

  // ── E-mail via Resend ────────────────────────────────────────
  if (channels.includes('email') && profile.email) {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      results.email = { ok: false, error: 'RESEND_API_KEY não configurada' }
    } else {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Rondello Buffet <noreply@rondellobuffet.com.br>',
            to: profile.email,
            subject: `📄 ${payslip_title} disponível para assinatura`,
            html: buildEmailHtml(profile.display_name, payslip_title, sign_url),
          }),
        })
        results.email = res.ok
          ? { ok: true }
          : { ok: false, error: `Resend HTTP ${res.status}` }
      } catch (e: any) {
        results.email = { ok: false, error: e.message }
      }
    }
  }

  // ── WhatsApp via Z-API ────────────────────────────────────────
  if (channels.includes('whatsapp') && profile.phone) {
    const { data: zapiData } = await supabase
      .from('company_integrations')
      .select('api_key, enabled')
      .eq('provider', 'zapi')
      .single()

    if (!zapiData?.enabled || !zapiData?.api_key) {
      results.whatsapp = { ok: false, error: 'Z-API não configurado' }
    } else {
      try {
        const config = JSON.parse(zapiData.api_key)
        const phone = formatPhone(profile.phone)
        const message = buildWhatsAppMessage(profile.display_name, payslip_title, sign_url)

        const res = await fetch(
          `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(config.client_token ? { 'Client-Token': config.client_token } : {}),
            },
            body: JSON.stringify({ phone, message }),
          }
        )
        results.whatsapp = res.ok
          ? { ok: true }
          : { ok: false, error: `Z-API HTTP ${res.status}` }
      } catch (e: any) {
        results.whatsapp = { ok: false, error: e.message }
      }
    }
  }

  // Audit log
  await supabase.from('payslip_audit_logs').insert({
    payslip_id,
    company_id: (await supabase.from('profiles').select('company_id').eq('user_id', user.id).single()).data?.company_id,
    user_id: user.id,
    action: 'payslip_published',
    details: { notification_results: results, channels },
  })

  return json({ results })
})

function buildEmailHtml(name: string, title: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0f766e;padding:32px 40px;">
      <p style="margin:0;color:#ccfbf1;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Rondello Buffet</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Holerite disponível</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Olá, <strong style="color:#0f172a;">${name}</strong></p>
      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        Seu <strong>${title}</strong> está disponível para visualização e assinatura.
      </p>
      <a href="${url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;">
        Visualizar e assinar →
      </a>
      <p style="margin:28px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
        Se o botão não funcionar, copie e cole este link no navegador:<br>
        <span style="color:#0f766e;">${url}</span>
      </p>
    </div>
    <div style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:11px;">
        © Rondello Buffet · Você recebeu este e-mail porque tem um holerite pendente de assinatura.
      </p>
    </div>
  </div>
</body>
</html>`
}

function buildWhatsAppMessage(name: string, title: string, url: string): string {
  return `Olá, *${name}*! 👋\n\nSeu *${title}* está disponível para assinatura.\n\nAcesse o link abaixo para visualizar e assinar:\n${url}\n\n_Rondello Buffet_`
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
