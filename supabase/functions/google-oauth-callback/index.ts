// ─────────────────────────────────────────────────────────────────────────────
//  google-oauth-callback
//  Recebe o retorno do Google após a empresa clicar em "Conectar Google Drive".
//  Troca o `code` por tokens, guarda o refresh_token na config de backup e volta
//  para a tela de Conectores.
//
//  Segredos: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / APP_URL
//  Redirect URI a cadastrar no Google:
//    https://<PROJECT_REF>.supabase.co/functions/v1/google-oauth-callback
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  const APP_URL = Deno.env.get('APP_URL') ?? url.origin
  const back = (status: string) => Response.redirect(`${APP_URL}/configuracoes?drive=${status}`, 302)

  if (oauthError || !code || !state) return back('error')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Valida o state contra o nonce salvo ao iniciar o fluxo (anti-CSRF)
  const { data: integ } = await supabase
    .from('company_integrations')
    .select('id, api_key, enabled')
    .eq('provider', 'drive_backup')
    .maybeSingle()

  const cfg = (() => { try { return integ?.api_key ? JSON.parse(integ.api_key) : {} } catch { return {} } })()
  if (!cfg.oauth_state || cfg.oauth_state !== state) return back('error')

  // Troca o code por tokens
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth-callback`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()
  if (!tokens.refresh_token) return back('error')  // sem refresh_token (faltou prompt=consent/offline)

  // Descobre o e-mail da conta conectada (opcional, só p/ exibir)
  let email: string | null = null
  try {
    const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    })
    if (ui.ok) email = (await ui.json()).email ?? null
  } catch { /* ignora */ }

  const newCfg = {
    ...cfg,
    refresh_token: tokens.refresh_token,
    connected_email: email,
    oauth_state: null,
  }

  if (integ?.id) {
    await supabase.from('company_integrations')
      .update({ api_key: JSON.stringify(newCfg), updated_at: new Date().toISOString() })
      .eq('id', integ.id)
  } else {
    await supabase.from('company_integrations')
      .insert({ provider: 'drive_backup', api_key: JSON.stringify(newCfg), enabled: false })
  }

  return back('connected')
})
