import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SignRequest {
  payslip_id: string
  payslip_version_id: string
  document_hash: string       // SHA-256 do PDF original (hex)
  sig_method: 'drawn' | 'typed'
  sig_data: string            // base64 do canvas ou nome digitado
  signed_pdf_path: string     // caminho no Storage onde o PDF assinado foi enviado
  timezone: string
  signed_at_local: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Validate JWT ────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Não autorizado' }, 401)

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
  if (authErr || !user) return json({ error: 'Sessão inválida' }, 401)

  // ── Parse body ──────────────────────────────────────────────
  let body: SignRequest
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  const { payslip_id, payslip_version_id, document_hash, sig_method, sig_data, signed_pdf_path, timezone, signed_at_local } = body
  if (!payslip_id || !payslip_version_id || !document_hash || !sig_method || !sig_data) {
    return json({ error: 'Campos obrigatórios faltando' }, 400)
  }

  // ── Validate payslip belongs to this employee ───────────────
  const { data: payslip, error: psErr } = await supabaseAdmin
    .from('payslips')
    .select('id, employee_id, company_id, status, current_version, title')
    .eq('id', payslip_id)
    .eq('employee_id', user.id)
    .single()

  if (psErr || !payslip) return json({ error: 'Holerite não encontrado' }, 404)
  if (payslip.status === 'signed') return json({ error: 'Holerite já assinado' }, 409)
  if (payslip.status !== 'published') return json({ error: 'Holerite não publicado' }, 400)

  // ── Validate version and document hash ──────────────────────
  const { data: version } = await supabaseAdmin
    .from('payslip_versions')
    .select('id, sha256_hash, version_number')
    .eq('id', payslip_version_id)
    .eq('payslip_id', payslip_id)
    .eq('is_current', true)
    .single()

  if (!version) return json({ error: 'Versão não encontrada' }, 404)
  if (version.sha256_hash !== document_hash) {
    return json({ error: 'Hash do documento não corresponde — documento pode ter sido alterado' }, 422)
  }

  // ── Collect device metadata from headers ────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'
  const { browser, os, device } = parseUserAgent(userAgent)

  // ── Fetch profile for full name ─────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .single()
  const employeeName = profile?.display_name ?? user.email ?? 'Funcionário'

  const signedAt = new Date().toISOString()
  const declarationText = 'Declaro que visualizei e recebi este holerite.'

  // ── Compute signature hash ──────────────────────────────────
  const hashInput = [
    user.id, payslip_id, document_hash, signedAt, ip, userAgent, sig_method,
  ].join('|')
  const signatureHash = await sha256(hashInput)

  // ── Insert signature (service role — bypasses RLS) ──────────
  const { data: sig, error: sigErr } = await supabaseAdmin
    .from('electronic_signatures')
    .insert({
      payslip_id,
      payslip_version_id,
      employee_id: user.id,
      company_id: payslip.company_id,
      employee_name: employeeName,
      declaration_text: declarationText,
      signed_at_utc: signedAt,
      timezone: timezone ?? 'America/Sao_Paulo',
      signed_at_local: signed_at_local ?? signedAt,
      ip_address: ip,
      user_agent: userAgent,
      browser,
      os,
      device_type: device,
      auth_method: 'email/password',
      session_id: null,
      document_hash,
      signature_hash: signatureHash,
      document_version: version.version_number,
      sig_method,
      sig_data,
      signed_pdf_path: signed_pdf_path ?? null,
      status: 'signed',
    })
    .select('id')
    .single()

  if (sigErr) {
    console.error('Signature insert error:', sigErr)
    return json({ error: 'Erro ao registrar assinatura' }, 500)
  }

  // ── Update payslip status ───────────────────────────────────
  await supabaseAdmin
    .from('payslips')
    .update({ status: 'signed' })
    .eq('id', payslip_id)

  // ── Insert audit log ────────────────────────────────────────
  await supabaseAdmin
    .from('payslip_audit_logs')
    .insert({
      payslip_id,
      company_id: payslip.company_id,
      user_id: user.id,
      action: 'signature_completed',
      ip_address: ip,
      user_agent: userAgent,
      details: {
        signature_id: sig.id,
        signature_hash: signatureHash,
        document_hash,
        sig_method,
        employee_name: employeeName,
        payslip_title: payslip.title,
      },
    })

  return json({
    signature_id: sig.id,
    signature_hash: signatureHash,
    signed_at: signedAt,
    employee_name: employeeName,
    document_hash,
  })
})

// ── Helpers ─────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  const browser =
    /Edg\//.test(ua) ? 'Microsoft Edge' :
    /Chrome\//.test(ua) ? 'Google Chrome' :
    /Firefox\//.test(ua) ? 'Mozilla Firefox' :
    /Safari\//.test(ua) ? 'Apple Safari' :
    /OPR\//.test(ua) ? 'Opera' : 'Desconhecido'

  const os =
    /Windows NT 10/.test(ua) ? 'Windows 10' :
    /Windows NT 6/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Linux/.test(ua) ? 'Linux' : 'Desconhecido'

  const device = /Mobile|Android|iPhone|iPad/.test(ua) ? 'mobile' : 'desktop'

  return { browser, os, device }
}
