// ─────────────────────────────────────────────────────────────────────────────
//  backup-databases
//  Exporta as tabelas principais em CSV, envia para o Google Drive da empresa
//  (via OAuth — a empresa conecta com 1 clique), mantém só o backup mais recente
//  e avisa por e-mail.
//
//  Disparo:
//   • Automático — via pg_cron (roda todo dia; a função decide se hoje "bate" com
//     a frequência/dia configurados). Chamado com o SERVICE_ROLE_KEY no Authorization.
//   • Manual     — botão "Fazer backup agora" (JWT de admin), com { force: true }.
//
//  Segredos (Supabase → Edge Functions → Secrets):
//   • GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET  → credenciais OAuth (1x pro sistema)
//   • RESEND_API_KEY                                       → envio de e-mail
//   • SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY (padrão)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Tabelas incluídas no backup (apenas estado atual — sem logs de histórico) ──
const TABLE_GROUPS: Record<string, string[]> = {
  eventos: [
    'events', 'clients', 'event_payments', 'event_additional_values',
    'event_menus', 'event_menu_dishes', 'event_menu_dish_items',
    'event_locations', 'event_products',
    'event_field_definitions', 'event_field_values',
  ],
  financeiro: [
    'cash_flow_entries', 'bills_payable', 'bank_accounts', 'bank_transfers',
    'credit_cards', 'credit_card_expenses',
  ],
  cadastros: [
    'categories', 'subcategories', 'tags', 'kitchens', 'suppliers',
    'contract_templates', 'annex_models',
    'checklist_templates', 'checklist_template_items',
  ],
  estoque: ['stock_items', 'stock_item_locations'],
  materiais: ['material_categories', 'material_items', 'material_base_list'],
  fichas_tecnicas: ['technical_sheets', 'technical_sheet_items', 'sheet_categories'],
}
const ALL_TABLES = Object.values(TABLE_GROUPS).flat()

interface BackupConfig {
  frequency: 'weekly' | 'monthly'
  day: number
  notify_email: string | null
  refresh_token?: string | null
  connected_email?: string | null
  folder_id?: string | null       // pasta raiz de backup criada pelo app (cacheada)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // ── Autorização: cron (service role) OU admin logado ──────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const isCron = token === SERVICE_ROLE

  let body: { force?: boolean } = {}
  try { body = await req.json() } catch { /* corpo vazio (cron) */ }

  if (!isCron) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Não autorizado' }, 401)
    const { data: perm } = await supabase
      .from('employee_permissions').select('is_admin').eq('user_id', user.id).maybeSingle()
    if (!perm?.is_admin) return json({ error: 'Apenas administradores podem rodar o backup' }, 403)
  }

  // ── Carrega configuração ──────────────────────────────────────────────────
  const { data: integ } = await supabase
    .from('company_integrations')
    .select('id, api_key, enabled')
    .eq('provider', 'drive_backup')
    .maybeSingle()

  if (!integ?.enabled) return json({ skipped: true, reason: 'Backup desativado' })

  let config: BackupConfig
  try { config = JSON.parse(integ.api_key) } catch {
    return json({ error: 'Configuração de backup inválida' }, 400)
  }
  if (!config.refresh_token) return json({ skipped: true, reason: 'Google Drive não conectado' })

  // ── Decide se roda hoje (quando disparado pelo cron) ──────────────────────
  const force = body.force === true
  if (!force) {
    const nowBR = new Date(Date.now() - 3 * 3600 * 1000)  // horário de Brasília
    const matches = config.frequency === 'weekly'
      ? nowBR.getUTCDay() === Number(config.day)
      : nowBR.getUTCDate() === Number(config.day)
    if (!matches) return json({ skipped: true, reason: 'Hoje não é dia de backup' })
  }

  const startedAt = new Date().toISOString()
  try {
    // ── Renova access token via OAuth ──────────────────────────────────────
    const accessToken = await getAccessToken(config.refresh_token)

    // ── Garante a pasta raiz de backup no Drive da empresa ─────────────────
    const rootFolder = await ensureRootFolder(accessToken, config.folder_id ?? null)

    // ── Subpasta datada deste backup ───────────────────────────────────────
    const stamp = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
    const backupFolderId = await createFolder(accessToken, `backup_${stamp}`, rootFolder)

    // ── Exporta cada tabela em CSV e envia ─────────────────────────────────
    const report: { table: string; rows: number; ok: boolean; error?: string }[] = []
    for (const table of ALL_TABLES) {
      try {
        const rows = await fetchAll(supabase, table)
        await uploadCsv(accessToken, `${table}.csv`, toCSV(rows), backupFolderId)
        report.push({ table, rows: rows.length, ok: true })
      } catch (e) {
        report.push({ table, rows: 0, ok: false, error: String((e as Error).message) })
      }
    }

    // ── Remove backups antigos (mantém só o atual) ─────────────────────────
    const deleted = await cleanOldBackups(accessToken, rootFolder, backupFolderId)

    const okCount = report.filter(r => r.ok).length
    const totalRows = report.reduce((s, r) => s + r.rows, 0)
    const finishedAt = new Date().toISOString()

    let emailError: string | null = null
    if (config.notify_email) {
      try {
        await sendEmail(config.notify_email, { okCount, total: ALL_TABLES.length, totalRows, deleted, report, stamp })
      } catch (e) {
        emailError = `E-mail não enviado: ${String((e as Error).message)}`
        console.error(emailError)
      }
    }

    await supabase.from('company_integrations').update({
      api_key: JSON.stringify({
        ...config,
        folder_id: rootFolder,
        last_run_at: finishedAt,
        last_status: okCount === ALL_TABLES.length ? (emailError ? 'partial' : 'success') : 'partial',
        last_summary: `${okCount}/${ALL_TABLES.length} tabelas · ${totalRows} registros`,
        last_error: emailError,
      }),
      updated_at: finishedAt,
    }).eq('id', integ.id)

    return json({ ok: true, started_at: startedAt, finished_at: finishedAt, okCount, totalRows, report, emailError })
  } catch (e) {
    const msg = String((e as Error).message)
    await supabase.from('company_integrations').update({
      api_key: JSON.stringify({ ...config, last_run_at: new Date().toISOString(), last_status: 'error', last_error: msg }),
      updated_at: new Date().toISOString(),
    }).eq('id', integ.id)
    if (config.notify_email) await sendEmailError(config.notify_email, msg).catch(() => {})
    return json({ ok: false, error: msg }, 500)
  }
})

// ─── OAuth: access token a partir do refresh token ───────────────────────────
async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Falha ao renovar token Google (reconecte o Drive): ${JSON.stringify(data)}`)
  return data.access_token as string
}

// ─── Supabase: busca paginada (contorna limite de 1000 linhas) ───────────────
async function fetchAll(supabase: ReturnType<typeof createClient>, table: string) {
  const PAGE = 1000
  let from = 0
  const all: Record<string, unknown>[] = []
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all.push(...data as Record<string, unknown>[])
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

// ─── CSV ─────────────────────────────────────────────────────────────────────
function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const cols = Array.from(rows.reduce((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set }, new Set<string>()))
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = cols.join(',')
  const lines = rows.map(r => cols.map(c => esc(r[c])).join(','))
  return '﻿' + head + '\n' + lines.join('\n')  // BOM p/ acentos no Excel
}

// ─── Google Drive: pastas, upload e limpeza ──────────────────────────────────
async function ensureRootFolder(token: string, cachedId: string | null): Promise<string> {
  if (cachedId) {
    const check = await fetch(`https://www.googleapis.com/drive/v3/files/${cachedId}?fields=id,trashed`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (check.ok) {
      const d = await check.json()
      if (!d.trashed) return cachedId
    }
  }
  return await createFolder(token, 'Backups - Stock Savvy', 'root')
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  if (!res.ok) throw new Error(`Drive createFolder ${res.status}: ${await res.text()}`)
  return (await res.json()).id as string
}

async function uploadCsv(token: string, name: string, content: string, parentId: string): Promise<void> {
  const boundary = '----backup' + crypto.randomUUID()
  const metadata = { name, parents: [parentId], mimeType: 'text/csv' }
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n${content}\r\n` +
    `--${boundary}--`
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  })
  if (!res.ok) throw new Error(`Drive upload ${name} ${res.status}: ${await res.text()}`)
}

async function cleanOldBackups(token: string, parentId: string, keepId: string): Promise<number> {
  const q = encodeURIComponent(`'${parentId}' in parents and name contains 'backup_' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) return 0
  const files = (await res.json()).files as { id: string; name: string }[]
  let deleted = 0
  for (const f of files) {
    if (f.id === keepId) continue
    const del = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
    })
    if (del.ok) deleted++
  }
  return deleted
}

// ─── E-mail (Resend) ─────────────────────────────────────────────────────────
async function sendEmail(to: string, s: {
  okCount: number; total: number; totalRows: number; deleted: number
  report: { table: string; rows: number; ok: boolean; error?: string }[]; stamp: string
}) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) throw new Error('RESEND_API_KEY não configurada')
  const failed = s.report.filter(r => !r.ok)
  const rowsHtml = s.report.map(r =>
    `<tr><td style="padding:4px 12px;border-bottom:1px solid #f1f5f9;">${r.table}</td>
     <td style="padding:4px 12px;border-bottom:1px solid #f1f5f9;text-align:right;">${r.ok ? r.rows.toLocaleString('pt-BR') : '—'}</td>
     <td style="padding:4px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">${r.ok ? '✅' : '⚠️'}</td></tr>`
  ).join('')
  const html = `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,sans-serif;">
    <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:#0f766e;padding:28px 40px;">
        <p style="margin:0;color:#ccfbf1;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Rondello Buffet · Backup automático</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Backup concluído ${failed.length ? '(com avisos)' : ''}</h1>
      </div>
      <div style="padding:28px 40px;">
        <p style="margin:0 0 16px;color:#475569;font-size:15px;">
          Backup de <strong>${s.stamp.replace('_', ' às ')}</strong> enviado ao Google Drive.
          <br>${s.okCount}/${s.total} tabelas · ${s.totalRows.toLocaleString('pt-BR')} registros · ${s.deleted} backup(s) antigo(s) removido(s).
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#334155;">
          <thead><tr>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Tabela</th>
            <th style="padding:6px 12px;text-align:right;border-bottom:2px solid #e2e8f0;">Registros</th>
            <th style="padding:6px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">OK</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        ${failed.length ? `<p style="margin:16px 0 0;color:#b45309;font-size:12px;">⚠️ Tabelas com aviso: ${failed.map(f => f.table).join(', ')}</p>` : ''}
      </div>
      <div style="padding:16px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#94a3b8;font-size:11px;">Somente o backup mais recente é mantido no Drive. © Rondello Buffet</p>
      </div>
    </div></body></html>`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Rondello Buffet <noreply@rondellobuffet.com.br>',
      to, subject: `💾 Backup ${failed.length ? 'parcial' : 'concluído'} — ${s.totalRows.toLocaleString('pt-BR')} registros`, html,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend HTTP ${res.status}: ${body}`)
  }
}

async function sendEmailError(to: string, error: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Rondello Buffet <noreply@rondellobuffet.com.br>',
      to, subject: '❌ Falha no backup automático',
      html: `<div style="font-family:sans-serif;padding:24px;"><h2 style="color:#dc2626;">Falha no backup</h2><p>O backup automático não foi concluído.</p><pre style="background:#f8fafc;padding:12px;border-radius:8px;color:#334155;white-space:pre-wrap;">${error}</pre></div>`,
    }),
  })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
