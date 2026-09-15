// Function isolada só pra validar que dá pra mandar Web Push a partir do runtime Deno
// (Passo 0 do plano de push notification). Não é chamada por nada do sistema —
// serve só pra teste manual antes de integrar no check-smart-alerts.
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
  if (!vapidPublic || !vapidPrivate) return json({ ok: false, error: 'VAPID keys não configuradas nos secrets' }, 500);

  let body: { subscription?: PushSubscriptionJSON; title?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Body inválido — mande { subscription, title, message }' }, 400);
  }

  if (!body.subscription) return json({ ok: false, error: 'Falta "subscription" no body' }, 400);

  webpush.setVapidDetails('mailto:douglas@rondellobuffet.com.br', vapidPublic, vapidPrivate);

  try {
    await webpush.sendNotification(
      body.subscription as any,
      JSON.stringify({ title: body.title ?? 'Teste de push', message: body.message ?? 'Se você está vendo isso, funcionou!' }),
    );
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err), stack: (err as Error)?.stack }, 500);
  }
});
