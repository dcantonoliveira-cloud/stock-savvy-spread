// Envia push pra um conjunto de usuários (por user_id) ou por role — usado por ações do
// próprio app (ex: fechar um evento) que precisam avisar outras pessoas na hora, sem
// esperar o check-smart-alerts periódico. Roda com service role pra poder ler a inscrição
// de QUALQUER usuário (não só a de quem chamou), mas a chamada em si exige um JWT válido
// (a função não foi publicada com --no-verify-jwt), então só usuários logados no app acionam.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidPublic || !vapidPrivate) return json({ ok: false, error: 'VAPID keys não configuradas' }, 500);

  let body: { user_ids?: string[]; roles?: string[]; message?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Body inválido' }, 400);
  }
  if (!body.message) return json({ ok: false, error: 'Falta "message"' }, 400);
  if ((!body.user_ids || !body.user_ids.length) && (!body.roles || !body.roles.length)) {
    return json({ ok: false, error: 'Informe "user_ids" ou "roles"' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let userIds = new Set(body.user_ids ?? []);
  if (body.roles?.length) {
    const { data: roleRows } = await supabase.from('user_roles').select('user_id').in('role', body.roles);
    for (const r of (roleRows ?? []) as { user_id: string }[]) userIds.add(r.user_id);
  }
  if (userIds.size === 0) return json({ ok: true, sent: 0 });

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', [...userIds]);

  if (!subs?.length) return json({ ok: true, sent: 0 });

  webpush.setVapidDetails('mailto:douglas@rondellobuffet.com.br', vapidPublic, vapidPrivate);

  let sent = 0;
  for (const sub of subs as { endpoint: string; p256dh: string; auth: string }[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } } as any,
        JSON.stringify({ message: body.message, url: body.url }),
      );
      sent++;
    } catch (err) {
      // Inscrição expirada/inválida (410/404) — remove pra parar de tentar.
      const status = (err as any)?.statusCode;
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }

  return json({ ok: true, sent, total: subs.length });
});
