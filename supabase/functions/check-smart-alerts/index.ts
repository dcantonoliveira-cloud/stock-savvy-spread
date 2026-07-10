const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function sql(query: string): Promise<any[]> {
  const mgmtToken  = Deno.env.get('MGMT_TOKEN')!
  const projectRef = Deno.env.get('PROJECT_REF')!
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

async function sqlInsert(query: string): Promise<boolean> {
  const mgmtToken  = Deno.env.get('MGMT_TOKEN')!
  const projectRef = Deno.env.get('PROJECT_REF')!
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return res.ok
}

async function sendWhatsApp(phone: string, message: string, zapiConfig: { instance_id: string; token: string; client_token?: string } | null) {
  if (!zapiConfig) return
  const url = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(zapiConfig.client_token ? { 'Client-Token': zapiConfig.client_token } : {}),
    },
    body: JSON.stringify({ phone: phone.replace(/\D/g, ''), message }),
  }).catch(() => {})
}

function esc(s: string) { return s.replace(/'/g, "''") }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const today    = new Date()
  const in7      = new Date(today); in7.setDate(today.getDate() + 7)
  const todayStr = today.toISOString().slice(0, 10)
  const in7Str   = in7.toISOString().slice(0, 10)

  const companyId = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89'

  // Alertas existentes não resolvidos (para não duplicar)
  const existingRows = await sql(`SELECT entity_id, type FROM smart_alerts WHERE resolved_at IS NULL`)
  const existingKey  = new Set(existingRows.map((a: any) => `${a.type}::${a.entity_id}`))

  const newAlerts: { type: string; severity: string; title: string; description: string; entity_type: string; entity_id: string }[] = []

  // ─── 1. Eventos < 15 dias com pagamento pendente ────────────────────────────
  const eventsWithPayments = await sql(`
    SELECT id, event_name, event_date, contract_value, total_value, paid_value, is_paid_in_full
    FROM events
    WHERE event_date >= '${todayStr}'
      AND event_date <= '${in7Str}'
      AND status IN ('confirmado','confirmed','ativo')
      AND is_paid_in_full IS NOT TRUE
  `)

  for (const ev of eventsWithPayments) {
    const total    = Number(ev.contract_value ?? ev.total_value ?? 0)
    const pago     = Number(ev.paid_value ?? 0)
    const pendente = total - pago
    if (pendente <= 0) continue

    const key = `payment_pending::${ev.id}`
    if (existingKey.has(key)) continue

    const daysLeft = Math.round((new Date(ev.event_date).getTime() - today.getTime()) / 86400000)
    newAlerts.push({
      type:        'payment_pending',
      severity:    daysLeft <= 7 ? 'urgent' : 'warning',
      title:       `Pagamento pendente — ${ev.event_name}`,
      description: `R$ ${Number(pendente).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendente. Evento em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} (${ev.event_date}).`,
      entity_type: 'event',
      entity_id:   ev.id,
    })
  }

  // ─── 2. Alterações em cardápio/ficha técnica em eventos < 15 dias ───────────
  const recentMenuChanges = await sql(`
    SELECT DISTINCT ON (eh.event_id) eh.event_id, eh.field_name, e.event_name, e.event_date
    FROM event_history eh
    JOIN events e ON e.id = eh.event_id
    WHERE eh.field_name IN ('menu_text','menu_mode','product_id','guest_count','price_per_person')
      AND eh.changed_at >= NOW() - INTERVAL '24 hours'
      AND e.event_date >= '${todayStr}'
      AND e.event_date <= '${in7Str}'
    ORDER BY eh.event_id, eh.changed_at DESC
  `)

  for (const row of recentMenuChanges) {
    const key = `menu_change::${row.event_id}`
    if (existingKey.has(key)) continue

    const daysLeft = Math.round((new Date(row.event_date).getTime() - today.getTime()) / 86400000)
    newAlerts.push({
      type:        'menu_change',
      severity:    'urgent',
      title:       `Cardápio alterado — ${row.event_name}`,
      description: `Campo "${row.field_name}" alterado. Evento em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} (${row.event_date}). Produção pode já ter começado.`,
      entity_type: 'event',
      entity_id:   row.event_id,
    })
  }

  // ─── 3. Holerites publicados há mais de 2 dias sem assinatura ───────────────
  const unsignedPayslips = await sql(`
    SELECT p.id, p.title, p.employee_id, p.published_at, pr.display_name
    FROM payslips p
    JOIN profiles pr ON pr.user_id = p.employee_id
    WHERE p.status = 'published'
      AND p.published_at <= NOW() - INTERVAL '2 days'
  `)

  for (const ps of unsignedPayslips) {
    const key = `payslip_unsigned::${ps.id}`
    if (existingKey.has(key)) continue

    const daysWaiting = Math.round((today.getTime() - new Date(ps.published_at).getTime()) / 86400000)
    newAlerts.push({
      type:        'payslip_unsigned',
      severity:    'warning',
      title:       `Holerite não assinado — ${ps.display_name ?? 'Funcionário'}`,
      description: `"${ps.title}" publicado há ${daysWaiting} dia${daysWaiting !== 1 ? 's' : ''} sem assinatura.`,
      entity_type: 'user',
      entity_id:   ps.id,
    })
  }

  // ─── Inserir novos alertas ──────────────────────────────────────────────────
  let inserted = 0
  for (const alert of newAlerts) {
    const ok = await sqlInsert(`
      INSERT INTO smart_alerts (company_id, type, severity, title, description, entity_type, entity_id)
      VALUES (
        '${companyId}',
        '${esc(alert.type)}',
        '${esc(alert.severity)}',
        '${esc(alert.title)}',
        '${esc(alert.description)}',
        '${esc(alert.entity_type)}',
        '${esc(alert.entity_id)}'
      )
    `)
    if (ok) inserted++
  }

  // ─── WhatsApp via Zapi ──────────────────────────────────────────────────────
  if (newAlerts.length > 0) {
    const zapiRows = await sql(`SELECT api_key, enabled FROM company_integrations WHERE provider = 'zapi' LIMIT 1`)
    let zapiConfig: { instance_id: string; token: string; client_token?: string } | null = null
    if (zapiRows[0]?.enabled && zapiRows[0]?.api_key) {
      try { zapiConfig = JSON.parse(zapiRows[0].api_key) } catch {}
    }

    const groupRows = await sql(`
      SELECT ng.type, pr.phone
      FROM notification_groups ng
      JOIN notification_group_members ngm ON ngm.group_id = ng.id
      JOIN profiles pr ON pr.user_id = ngm.user_id
      WHERE ng.company_id = '${companyId}' AND pr.phone IS NOT NULL
    `)

    const groupMap: Record<string, string[]> = {}
    for (const row of groupRows) {
      if (!groupMap[row.type]) groupMap[row.type] = []
      groupMap[row.type].push(row.phone)
    }

    for (const alert of newAlerts) {
      const groupType =
        alert.type === 'payment_pending' ? 'financeiro' :
        alert.type === 'menu_change'      ? 'eventos'    :
        alert.type === 'payslip_unsigned' ? 'holerites'  : null

      if (!groupType) continue
      const emoji =
        alert.type === 'payment_pending' ? '💸' :
        alert.type === 'menu_change'      ? '🍽️' :
        alert.type === 'payslip_unsigned' ? '📄' : '🚨'
      const msg = `${emoji} *${alert.title}*\n${alert.description}`
      for (const phone of groupMap[groupType] ?? []) {
        await sendWhatsApp(phone, msg, zapiConfig)
      }
    }
  }

  return json({ ok: true, checked: newAlerts.length, inserted })
})
