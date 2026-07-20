// ─────────────────────────────────────────────────────────────────────────────
//  backup-databases
//  Exporta as tabelas principais de CADA empresa (isolado por company_id) em
//  CSV e entrega de dois jeitos possíveis, configurável por empresa:
//   • 'drive' — envia pro Google Drive da empresa (OAuth), mantém só o mais
//     recente. Requer a empresa ter clicado em "Conectar Google Drive".
//   • 'email' — zipa os CSVs e manda anexado por e-mail via Resend. Zero
//     configuração externa — é o padrão para empresas novas.
//
//  Disparo:
//   • Automático — pg_cron chama TODO DIA; a função roda para TODAS as
//     empresas com backup ativo e decide, empresa por empresa, se hoje bate
//     com a frequência/dia configurados.
//   • Manual — botão "Fazer backup agora" (JWT de admin), roda só para a
//     empresa do usuário logado, com { force: true }.
//
//  Segredos (Supabase → Edge Functions → Secrets):
//   • GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET  → só para modo Drive
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

// Tabelas sem coluna company_id direta — filtradas via a tabela-mãe (que tem).
const CHILD_TABLES: Record<string, { parent: string; fk: string }> = {
  checklist_template_items: { parent: 'checklist_templates', fk: 'template_id' },
  event_additional_values:  { parent: 'events', fk: 'event_id' },
  event_field_values:       { parent: 'events', fk: 'event_id' },
  event_payments:           { parent: 'events', fk: 'event_id' },
  material_base_list:       { parent: 'material_items', fk: 'material_item_id' },
}

// Colunas de referência (IDs) que ganham uma coluna extra com o nome legível ao
// lado, para não precisar abrir outra planilha pra saber quem é quem. Se a
// coluna de exibição não existir na tabela-alvo, a busca falha silenciosamente
// e o backup segue normal (só aquela referência específica fica sem nome).
const LOOKUPS: Record<string, { fk: string; refTable: string; refColumn: string; newCol: string }[]> = {
  events: [
    { fk: 'client_id',    refTable: 'clients',         refColumn: 'name', newCol: 'cliente_nome' },
    { fk: 'decorator_id', refTable: 'suppliers',       refColumn: 'name', newCol: 'decorador_nome' },
    { fk: 'organizer_id', refTable: 'suppliers',       refColumn: 'name', newCol: 'assessor_nome' },
    { fk: 'product_id',   refTable: 'event_products',  refColumn: 'name', newCol: 'produto_nome' },
  ],
  event_payments:           [{ fk: 'event_id', refTable: 'events', refColumn: 'event_name', newCol: 'event_nome' }],
  event_additional_values:  [{ fk: 'event_id', refTable: 'events', refColumn: 'event_name', newCol: 'event_nome' }],
  cash_flow_entries:        [{ fk: 'event_id', refTable: 'events', refColumn: 'event_name', newCol: 'event_nome' }],
  event_field_values: [
    { fk: 'event_id', refTable: 'events', refColumn: 'event_name', newCol: 'event_nome' },
    { fk: 'field_id', refTable: 'event_field_definitions', refColumn: 'name', newCol: 'campo_nome' },
  ],
  event_menu_dishes: [
    { fk: 'menu_id',  refTable: 'event_menus',     refColumn: 'name', newCol: 'cardapio_nome' },
    { fk: 'sheet_id', refTable: 'technical_sheets', refColumn: 'name', newCol: 'prato_nome' },
  ],
  event_menu_dish_items: [{ fk: 'item_id', refTable: 'stock_items', refColumn: 'name', newCol: 'item_nome' }],
  technical_sheet_items: [
    { fk: 'item_id',  refTable: 'stock_items',      refColumn: 'name', newCol: 'item_nome' },
    { fk: 'sheet_id', refTable: 'technical_sheets', refColumn: 'name', newCol: 'ficha_nome' },
    { fk: 'tag_id',   refTable: 'tags',             refColumn: 'name', newCol: 'tag_nome' },
  ],
  stock_items:           [{ fk: 'subcategory_id', refTable: 'subcategories',   refColumn: 'name', newCol: 'subcategoria_nome' }],
  subcategories:         [{ fk: 'category_id',    refTable: 'categories',      refColumn: 'name', newCol: 'categoria_nome' }],
  stock_item_locations: [
    { fk: 'item_id',    refTable: 'stock_items', refColumn: 'name', newCol: 'item_nome' },
    { fk: 'kitchen_id', refTable: 'kitchens',    refColumn: 'name', newCol: 'cozinha_nome' },
  ],
  material_base_list:       [{ fk: 'material_item_id', refTable: 'material_items',      refColumn: 'name', newCol: 'item_nome' }],
  checklist_template_items: [{ fk: 'template_id',      refTable: 'checklist_templates', refColumn: 'name', newCol: 'template_nome' }],
  credit_card_expenses:     [{ fk: 'credit_card_id',   refTable: 'credit_cards',        refColumn: 'name', newCol: 'cartao_nome' }],
  bills_payable:            [{ fk: 'bank_account_id',  refTable: 'bank_accounts',       refColumn: 'name', newCol: 'conta_nome' }],
  bank_transfers: [
    { fk: 'from_account_id', refTable: 'bank_accounts', refColumn: 'name', newCol: 'conta_origem_nome' },
    { fk: 'to_account_id',   refTable: 'bank_accounts', refColumn: 'name', newCol: 'conta_destino_nome' },
  ],
}

interface BackupConfig {
  delivery: 'drive' | 'email'
  frequency: 'weekly' | 'monthly'
  day: number
  notify_email: string | null
  // modo drive
  refresh_token?: string | null
  connected_email?: string | null
  oauth_state?: string | null
  folder_id?: string | null
  // status
  last_run_at?: string | null
  last_status?: 'success' | 'partial' | 'error' | null
  last_summary?: string | null
  last_error?: string | null
}

type SupaClient = ReturnType<typeof createClient>

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  // Supabase migrou para novo formato de chaves (sb_secret_...).
  // SUPABASE_SECRET_KEY deve ser configurado nos Function Secrets com a nova chave.
  // Fallback para SUPABASE_SERVICE_ROLE_KEY (formato JWT legado).
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  // Aceita tanto a nova chave quanto a JWT legada como identificador de cron
  const LEGACY_CRON_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? SERVICE_ROLE
  const isCron = token === SERVICE_ROLE || token === LEGACY_CRON_KEY

  let body: { force?: boolean } = {}
  try { body = await req.json() } catch { /* corpo vazio (cron) */ }

  // ── Disparo automático: roda para TODAS as empresas com backup ativo ───────
  if (isCron) {
    const { data: integrations, error: integError } = await supabase
      .from('company_integrations')
      .select('id, company_id, api_key, enabled')
      .eq('provider', 'drive_backup')
      .eq('enabled', true)

    if (integError) return json({ ok: false, error: integError.message, code: integError.code }, 500)

    const results: any[] = []
    for (const integ of (integrations ?? []) as any[]) {
      try {
        const r = await runBackupForCompany(supabase, integ, false)
        results.push({ company_id: integ.company_id, ...r })
      } catch (e) {
        results.push({ company_id: integ.company_id, ok: false, error: String((e as Error).message) })
      }
    }
    return json({ ok: true, ran: results.length, results })
  }

  // ── Disparo manual: só para a empresa do admin logado ───────────────────────
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Não autorizado' }, 401)

  const { data: perm } = await supabase
    .from('employee_permissions').select('is_admin, company_id').eq('user_id', user.id).maybeSingle()
  if (!perm?.is_admin) return json({ error: 'Apenas administradores podem rodar o backup' }, 403)

  let companyId = (perm as any)?.company_id as string | undefined
  if (!companyId) {
    const { data: prof } = await supabase.from('profiles').select('company_id').eq('user_id', user.id).maybeSingle()
    companyId = (prof as any)?.company_id
  }
  if (!companyId) return json({ error: 'Empresa do usuário não encontrada' }, 400)

  const { data: integ } = await supabase
    .from('company_integrations')
    .select('id, company_id, api_key, enabled')
    .eq('provider', 'drive_backup')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!integ?.enabled) return json({ skipped: true, reason: 'Backup desativado' })

  try {
    const r = await runBackupForCompany(supabase, integ as any, body.force === true)
    return json({ ok: true, ...r })
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message) }, 500)
  }
})

// ─── Roda o backup de UMA empresa ──────────────────────────────────────────────
async function runBackupForCompany(
  supabase: SupaClient,
  integ: { id: string; company_id: string; api_key: string },
  force: boolean,
) {
  let config: BackupConfig
  try { config = JSON.parse(integ.api_key) } catch { throw new Error('Configuração de backup inválida') }
  if (!config.delivery) config.delivery = config.refresh_token ? 'drive' : 'email'

  if (config.delivery === 'drive' && !config.refresh_token) {
    return { skipped: true, reason: 'Google Drive não conectado' }
  }

  if (!force) {
    const nowBR = new Date(Date.now() - 3 * 3600 * 1000)  // horário de Brasília
    const matches = config.frequency === 'weekly'
      ? nowBR.getUTCDay() === Number(config.day)
      : nowBR.getUTCDate() === Number(config.day)
    if (!matches) return { skipped: true, reason: 'Hoje não é dia de backup' }
  }

  const startedAt = new Date().toISOString()
  try {
    // ── Exporta cada tabela em CSV, já filtrada pela empresa ─────────────────
    const parentIdCache: Record<string, string[]> = {}
    const lookupCache: Record<string, Record<string, string>> = {}
    const csvFiles: { name: string; content: string }[] = []
    const report: { table: string; rows: number; ok: boolean; error?: string }[] = []

    for (const table of ALL_TABLES) {
      try {
        const rows = await fetchScoped(supabase, table, integ.company_id, parentIdCache)
        await enrichRows(supabase, table, rows, lookupCache)
        csvFiles.push({ name: `${table}.csv`, content: toCSV(rows) })
        report.push({ table, rows: rows.length, ok: true })
      } catch (e) {
        report.push({ table, rows: 0, ok: false, error: String((e as Error).message) })
      }
    }

    const okCount = report.filter(r => r.ok).length
    const totalRows = report.reduce((s, r) => s + r.rows, 0)
    const stamp = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')

    let deleted = 0
    let emailError: string | null = null

    if (config.delivery === 'drive') {
      const accessToken = await getAccessToken(config.refresh_token!)
      const rootFolder = await ensureRootFolder(accessToken, config.folder_id ?? null)
      const backupFolderId = await createFolder(accessToken, `backup_${stamp}`, rootFolder)
      for (const f of csvFiles) {
        await uploadCsv(accessToken, f.name, f.content, backupFolderId).catch(() => {})
      }
      deleted = await cleanOldBackups(accessToken, rootFolder, backupFolderId)
      config.folder_id = rootFolder

      if (config.notify_email) {
        try {
          await sendReportEmail(config.notify_email, { okCount, total: ALL_TABLES.length, totalRows, deleted, report, stamp })
        } catch (e) {
          emailError = `E-mail não enviado: ${String((e as Error).message)}`
        }
      }
    } else {
      // modo e-mail: zipa tudo e manda como anexo
      if (!config.notify_email) throw new Error('E-mail de destino não configurado')
      const zipBytes = buildZip(csvFiles.map(f => ({ name: f.name, data: new TextEncoder().encode(f.content) })))
      try {
        await sendZipEmail(config.notify_email, zipBytes, { okCount, total: ALL_TABLES.length, totalRows, report, stamp })
      } catch (e) {
        emailError = `E-mail não enviado: ${String((e as Error).message)}`
      }
    }

    const finishedAt = new Date().toISOString()
    await supabase.from('company_integrations').update({
      api_key: JSON.stringify({
        ...config,
        last_run_at: finishedAt,
        last_status: okCount === ALL_TABLES.length ? (emailError ? 'partial' : 'success') : 'partial',
        last_summary: `${okCount}/${ALL_TABLES.length} tabelas · ${totalRows} registros`,
        last_error: emailError,
      }),
      updated_at: finishedAt,
    }).eq('id', integ.id)

    return { started_at: startedAt, finished_at: finishedAt, okCount, totalRows, report, emailError }
  } catch (e) {
    const msg = String((e as Error).message)
    await supabase.from('company_integrations').update({
      api_key: JSON.stringify({ ...config, last_run_at: new Date().toISOString(), last_status: 'error', last_error: msg }),
      updated_at: new Date().toISOString(),
    }).eq('id', integ.id)
    throw e
  }
}

// ─── Busca linhas de uma tabela filtradas pela empresa (direto ou via tabela-mãe) ──
async function fetchScoped(
  supabase: SupaClient, table: string, companyId: string, parentIdCache: Record<string, string[]>,
) {
  const child = CHILD_TABLES[table]
  if (!child) return fetchAll(supabase, table, { companyId })

  if (!parentIdCache[child.parent]) {
    const parentRows = await fetchAll(supabase, child.parent, { companyId, columns: 'id' })
    parentIdCache[child.parent] = (parentRows as any[]).map(r => r.id)
  }
  const ids = parentIdCache[child.parent]
  if (ids.length === 0) return []

  // Envia o filtro .in() em lotes — muitos IDs de uma vez estouram o limite
  // de tamanho da URL da requisição (912 UUIDs ≈ 33 mil caracteres).
  const CHUNK = 150
  const all: Record<string, unknown>[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const rows = await fetchAll(supabase, table, { inColumn: child.fk, inValues: slice })
    all.push(...rows)
  }
  return all
}

// ─── Adiciona colunas com o nome legível ao lado de cada ID referenciado ──────
// (ex: client_id vira também cliente_nome). Falhas são ignoradas silenciosamente
// por mapeamento — se a coluna de exibição não existir, só aquela referência
// fica sem nome; o resto do backup não é afetado.
async function enrichRows(
  supabase: SupaClient, table: string, rows: Record<string, unknown>[],
  lookupCache: Record<string, Record<string, string>>,
) {
  const mappings = LOOKUPS[table]
  if (!mappings || rows.length === 0) return

  for (const m of mappings) {
    const cacheKey = `${m.refTable}:${m.refColumn}`
    if (!lookupCache[cacheKey]) lookupCache[cacheKey] = {}
    const cache = lookupCache[cacheKey]

    const idsNeeded = Array.from(new Set(
      rows.map(r => r[m.fk] as string | null).filter((v): v is string => !!v && !(v in cache))
    ))

    if (idsNeeded.length > 0) {
      try {
        const CHUNK = 150
        for (let i = 0; i < idsNeeded.length; i += CHUNK) {
          const slice = idsNeeded.slice(i, i + CHUNK)
          const { data, error } = await supabase.from(m.refTable).select(`id, ${m.refColumn}`).in('id', slice)
          if (error) throw error
          for (const row of (data ?? []) as any[]) cache[row.id] = row[m.refColumn]
        }
      } catch {
        continue // mapeamento indisponível para essa referência — segue sem quebrar
      }
    }

    for (const row of rows) {
      const fkVal = row[m.fk] as string | null
      row[m.newCol] = fkVal ? (cache[fkVal] ?? null) : null
    }
  }
}

// ─── Supabase: busca paginada (contorna limite de 1000 linhas) ───────────────
async function fetchAll(
  supabase: SupaClient, table: string,
  opts?: { companyId?: string; columns?: string; inColumn?: string; inValues?: string[] },
) {
  const PAGE = 1000
  let from = 0
  const all: Record<string, unknown>[] = []
  while (true) {
    let q = supabase.from(table).select(opts?.columns ?? '*').range(from, from + PAGE - 1)
    if (opts?.companyId) q = q.eq('company_id', opts.companyId)
    if (opts?.inColumn) q = q.in(opts.inColumn, opts.inValues!)
    const { data, error } = await q
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

// ─── ZIP (formato STORED, sem compressão — leve e sem dependências) ──────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const f of files) {
    const nameBytes = encoder.encode(f.name)
    const crc = crc32(f.data)
    const size = f.data.length

    const local = new Uint8Array(30 + nameBytes.length)
    const ldv = new DataView(local.buffer)
    ldv.setUint32(0, 0x04034b50, true)
    ldv.setUint16(4, 20, true); ldv.setUint16(6, 0, true); ldv.setUint16(8, 0, true)
    ldv.setUint16(10, 0, true); ldv.setUint16(12, 0, true)
    ldv.setUint32(14, crc, true); ldv.setUint32(18, size, true); ldv.setUint32(22, size, true)
    ldv.setUint16(26, nameBytes.length, true); ldv.setUint16(28, 0, true)
    local.set(nameBytes, 30)
    localParts.push(local, f.data)

    const central = new Uint8Array(46 + nameBytes.length)
    const cdv = new DataView(central.buffer)
    cdv.setUint32(0, 0x02014b50, true)
    cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true); cdv.setUint16(8, 0, true)
    cdv.setUint16(10, 0, true); cdv.setUint16(12, 0, true); cdv.setUint16(14, 0, true)
    cdv.setUint32(16, crc, true); cdv.setUint32(20, size, true); cdv.setUint32(24, size, true)
    cdv.setUint16(28, nameBytes.length, true); cdv.setUint16(30, 0, true); cdv.setUint16(32, 0, true)
    cdv.setUint16(34, 0, true); cdv.setUint16(36, 0, true); cdv.setUint32(38, 0, true)
    cdv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centralParts.push(central)

    offset += local.length + f.data.length
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0)
  const centralOffset = offset
  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true)
  edv.setUint16(4, 0, true); edv.setUint16(6, 0, true)
  edv.setUint16(8, files.length, true); edv.setUint16(10, files.length, true)
  edv.setUint32(12, centralSize, true); edv.setUint32(16, centralOffset, true)
  edv.setUint16(20, 0, true)

  const total = offset + centralSize + eocd.length
  const result = new Uint8Array(total)
  let pos = 0
  for (const p of localParts) { result.set(p, pos); pos += p.length }
  for (const p of centralParts) { result.set(p, pos); pos += p.length }
  result.set(eocd, pos)
  return result
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// ─── Google: access token via refresh token (OAuth) ───────────────────────────
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
// TODO: trocar para um domínio próprio do Stock Savvy quando disponível.
// Por ora usa o domínio já verificado no Resend (rondellobuffet.com.br).
const FROM_ADDRESS = 'Stock Savvy <backup@rondellobuffet.com.br>'

function reportHtml(s: {
  okCount: number; total: number; totalRows: number; report: { table: string; rows: number; ok: boolean }[]; stamp: string
}, opts: { hasAttachment: boolean; deleted?: number }) {
  const failed = s.report.filter(r => !r.ok)
  const rowsHtml = s.report.map(r =>
    `<tr><td style="padding:4px 12px;border-bottom:1px solid #f1f5f9;">${r.table}</td>
     <td style="padding:4px 12px;border-bottom:1px solid #f1f5f9;text-align:right;">${r.ok ? r.rows.toLocaleString('pt-BR') : '—'}</td>
     <td style="padding:4px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">${r.ok ? '✅' : '⚠️'}</td></tr>`
  ).join('')
  const destino = opts.hasAttachment
    ? 'O arquivo .zip com os CSVs de cada tabela está anexado neste e-mail.'
    : `Backup enviado ao Google Drive.${opts.deleted ? ` ${opts.deleted} backup(s) antigo(s) removido(s).` : ''}`
  return `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,sans-serif;">
    <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:#0f766e;padding:28px 40px;">
        <p style="margin:0;color:#ccfbf1;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Stock Savvy · Backup automático</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Backup concluído ${failed.length ? '(com avisos)' : ''}</h1>
      </div>
      <div style="padding:28px 40px;">
        <p style="margin:0 0 16px;color:#475569;font-size:15px;">
          Backup de <strong>${s.stamp.replace('_', ' às ')}</strong>. ${destino}
          <br>${s.okCount}/${s.total} tabelas · ${s.totalRows.toLocaleString('pt-BR')} registros.
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
        <p style="margin:0;color:#94a3b8;font-size:11px;">© Stock Savvy</p>
      </div>
    </div></body></html>`
}

async function sendReportEmail(to: string, s: {
  okCount: number; total: number; totalRows: number; deleted: number
  report: { table: string; rows: number; ok: boolean }[]; stamp: string
}) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) throw new Error('RESEND_API_KEY não configurada')
  const failed = s.report.filter(r => !r.ok)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_ADDRESS, to,
      subject: `💾 Backup ${failed.length ? 'parcial' : 'concluído'} — ${s.totalRows.toLocaleString('pt-BR')} registros`,
      html: reportHtml(s, { hasAttachment: false, deleted: s.deleted }),
    }),
  })
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`)
}

async function sendZipEmail(to: string, zip: Uint8Array, s: {
  okCount: number; total: number; totalRows: number; report: { table: string; rows: number; ok: boolean }[]; stamp: string
}) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) throw new Error('RESEND_API_KEY não configurada')
  const failed = s.report.filter(r => !r.ok)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_ADDRESS, to,
      subject: `💾 Backup ${failed.length ? 'parcial' : 'concluído'} — ${s.totalRows.toLocaleString('pt-BR')} registros`,
      html: reportHtml(s, { hasAttachment: true }),
      attachments: [{ filename: `backup_${s.stamp}.zip`, content: toBase64(zip) }],
    }),
  })
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
