import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: companyRows } = await supabase
    .from('companies')
    .select('id')
    .limit(1)

  const companyId = companyRows?.[0]?.id ?? 'c56c2ccd-2c35-4ebb-b868-e153727e5d89'

  const today   = new Date()
  const in15    = new Date(today); in15.setDate(today.getDate() + 15)
  const todayStr = today.toISOString().slice(0, 10)
  const in15Str  = in15.toISOString().slice(0, 10)

  // Alertas existentes não resolvidos (para não duplicar)
  const { data: existingAlerts } = await supabase
    .from('smart_alerts')
    .select('entity_id, type')
    .is('resolved_at', null)

  const existingKey = new Set((existingAlerts ?? []).map((a: any) => `${a.type}::${a.entity_id}`))

  const newAlerts: { type: string; severity: string; title: string; description: string; entity_type: string; entity_id: string }[] = []

  // ─── 1. Eventos < 15 dias com pagamento pendente ───────────────────────────
  const { data: eventsWithPayments } = await supabase
    .from('events')
    .select('id, event_name, event_date, total_value, paid_value, contract_value, is_paid_in_full')
    .gte('event_date', todayStr)
    .lte('event_date', in15Str)
    .in('status', ['confirmado', 'confirmed', 'ativo'])

  for (const ev of eventsWithPayments ?? []) {
    if (ev.is_paid_in_full) continue
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
      description: `R$ ${pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendente. Evento em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} (${ev.event_date}).`,
      entity_type: 'event',
      entity_id:   ev.id,
    })
  }

  // ─── 2. Alterações em cardápio/ficha técnica < 15 dias ───────────────────
  const { data: recentMenuChanges } = await supabase
    .from('event_history')
    .select('event_id, field_name, changed_at, events!inner(event_name, event_date, status)')
    .in('field_name', ['menu_text', 'menu_mode', 'product_id', 'guest_count', 'price_per_person'])
    .gte('changed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const menuEventIds = new Set<string>()
  for (const change of recentMenuChanges ?? []) {
    const ev = (change as any).events
    if (!ev) continue
    if (ev.event_date < todayStr || ev.event_date > in15Str) continue
    if (menuEventIds.has(change.event_id)) continue

    const key = `menu_change::${change.event_id}`
    if (existingKey.has(key)) continue

    menuEventIds.add(change.event_id)
    const daysLeft = Math.round((new Date(ev.event_date).getTime() - today.getTime()) / 86400000)
    newAlerts.push({
      type:        'menu_change',
      severity:    'urgent',
      title:       `Cardápio alterado — ${ev.event_name}`,
      description: `Campo "${change.field_name}" alterado. Evento em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} (${ev.event_date}). Produção pode já ter começado.`,
      entity_type: 'event',
      entity_id:   change.event_id,
    })
  }

  // ─── 3. Holerites publicados há mais de 2 dias sem assinatura ─────────────
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const { data: unsignedPayslips } = await supabase
    .from('payslips')
    .select('id, title, employee_id, published_at, profiles!inner(display_name)')
    .eq('status', 'published')
    .lte('published_at', twoDaysAgo)

  for (const ps of unsignedPayslips ?? []) {
    const key = `payslip_unsigned::${ps.id}`
    if (existingKey.has(key)) continue

    const employeeName = (ps as any).profiles?.display_name ?? 'Funcionário'
    const daysWaiting  = Math.round((today.getTime() - new Date(ps.published_at).getTime()) / 86400000)
    newAlerts.push({
      type:        'payslip_unsigned',
      severity:    'warning',
      title:       `Holerite não assinado — ${employeeName}`,
      description: `"${ps.title}" publicado há ${daysWaiting} dia${daysWaiting !== 1 ? 's' : ''} sem assinatura.`,
      entity_type: 'user',
      entity_id:   ps.employee_id,
    })
  }

  // ─── Inserir novos alertas ────────────────────────────────────────────────
  let inserted = 0
  for (const alert of newAlerts) {
    const { error } = await supabase.from('smart_alerts').insert({
      ...alert,
      company_id: companyId,
    })
    if (!error) inserted++
  }

  // ─── Notificar por WhatsApp os membros dos grupos relevantes ─────────────
  if (newAlerts.length > 0) {
    // Buscar config Zapi
    const { data: zapiRow } = await supabase
      .from('company_integrations')
      .select('api_key, enabled')
      .eq('provider', 'zapi')
      .single()

    let zapiConfig: { instance_id: string; token: string; client_token?: string } | null = null
    if (zapiRow?.enabled && zapiRow?.api_key) {
      try { zapiConfig = JSON.parse(zapiRow.api_key) } catch {}
    }

    const { data: groups } = await supabase
      .from('notification_groups')
      .select('type, notification_group_members(profiles(display_name, phone))')
      .eq('company_id', companyId)

    const groupMap: Record<string, string[]> = {}
    for (const g of groups ?? []) {
      const phones: string[] = []
      for (const m of (g as any).notification_group_members ?? []) {
        const phone = m.profiles?.phone
        if (phone) phones.push(phone)
      }
      groupMap[(g as any).type] = phones
    }

    for (const alert of newAlerts) {
      const groupType =
        alert.type === 'payment_pending' ? 'financeiro' :
        alert.type === 'menu_change'      ? 'eventos'    :
        alert.type === 'payslip_unsigned' ? 'holerites'  : null

      if (!groupType) continue
      const phones = groupMap[groupType] ?? []
      const msg    = `🚨 *${alert.title}*\n${alert.description}`
      for (const phone of phones) {
        await sendWhatsApp(phone, msg, zapiConfig)
      }
    }
  }

  return json({ ok: true, checked: newAlerts.length, inserted })
})
