import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const payload = await req.json();
    const eventType: string = payload.event_type ?? payload.type ?? '';
    const docToken: string  = payload.document?.token ?? payload.token ?? payload.doc_token ?? '';

    if (!docToken) return new Response('Missing doc_token', { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Find the event that owns this ZapSign document
    const { data: events } = await supabase
      .from('events')
      .select('id, event_name, zapsign_data')
      .not('zapsign_data', 'is', null);

    const match = (events ?? []).find((e: any) => e.zapsign_data?.doc_token === docToken);
    if (!match) return new Response('Event not found', { status: 404 });

    const eventId: string   = match.id;
    const eventName: string = match.event_name ?? 'Evento';
    const zapData: any      = match.zapsign_data ?? {};

    if (eventType === 'doc_signed') {
      // Fetch fresh status directly from ZapSign API (more reliable than parsing payload)
      const { data: integration } = await supabase
        .from('company_integrations')
        .select('api_key')
        .eq('provider', 'zapsign')
        .eq('company_id', COMPANY_ID)
        .maybeSingle();

      let freshSigners: any[] | null = null;
      let freshDocStatus: string | null = null;

      if (integration?.api_key) {
        let apiKey: string | null = null;
        try { apiKey = JSON.parse(integration.api_key)?.token ?? integration.api_key; } catch { apiKey = integration.api_key; }

        if (apiKey) {
          const zapRes = await fetch(`https://api.zapsign.com.br/api/v1/docs/${docToken}/`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          if (zapRes.ok) {
            const zapDoc = await zapRes.json();
            freshSigners   = zapDoc.signers ?? null;
            freshDocStatus = zapDoc.status ?? null;
          }
        }
      }

      // Fallback: parse from webhook payload if ZapSign API call failed
      const payloadSigners: any[] = freshSigners
        ?? payload.document?.signers
        ?? payload.signers
        ?? [];

      const allSigned = freshDocStatus === 'signed'
        || (payload.document?.status ?? payload.status) === 'signed';

      const prevSigners: any[] = zapData.signers ?? [];

      const updatedSigners = prevSigners.map((s: any) => {
        const fresh = payloadSigners.find((p: any) => p.token === s.token);
        return fresh ? { ...s, status: fresh.status ?? s.status } : s;
      });

      const dbUpdate: any = { zapsign_data: { ...zapData, signers: updatedSigners } };
      if (allSigned) dbUpdate.contract_signed = true;

      await supabase.from('events').update(dbUpdate).eq('id', eventId);

      // Detect who just signed
      const newlySigned = updatedSigners.filter((u: any) => {
        const prev = prevSigners.find((s: any) => s.token === u.token);
        return u.status === 'signed' && prev?.status !== 'signed';
      });

      const notifTitle = allSigned
        ? 'Contrato totalmente assinado'
        : newlySigned.length > 0
          ? `${newlySigned[0].name} assinou o contrato`
          : 'Assinatura atualizada';

      await supabase.from('app_notifications').insert({
        company_id: COMPANY_ID,
        type: 'zapsign_assinatura',
        title: notifTitle,
        message: eventName,
        actor_name: newlySigned[0]?.name ?? null,
        data: { link: `/events/${eventId}` },
        read: false,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
