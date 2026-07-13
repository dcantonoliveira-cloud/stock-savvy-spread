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

    // ZapSign webhook payload:
    // event_type: 'sign' | 'doc_signed' | 'doc_refused'
    // document: { token, name, ... }
    // signer (only on 'sign'): { token, name, email, status }
    const eventType: string = payload.event_type ?? payload.type ?? '';
    const docToken: string  = payload.document?.token ?? payload.doc_token ?? '';

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

    // Update signer status in stored zapsign_data
    if (eventType === 'sign' && payload.signer) {
      const signer = payload.signer;
      const updatedSigners = (zapData.signers ?? []).map((s: any) =>
        s.token === signer.token ? { ...s, status: 'signed' } : s
      );
      const updatedZap = { ...zapData, signers: updatedSigners };

      await supabase.from('events').update({ zapsign_data: updatedZap }).eq('id', eventId);

      // Notification
      await supabase.from('smart_alerts').insert({
        company_id: COMPANY_ID,
        type: 'zapsign_signed',
        severity: 'warning',
        title: `${signer.name} assinou o contrato`,
        description: eventName,
        entity_type: 'event',
        entity_id: eventId,
      });
    }

    if (eventType === 'doc_signed') {
      // Mark all signers as signed
      const updatedSigners = (zapData.signers ?? []).map((s: any) => ({ ...s, status: 'signed' }));
      await supabase.from('events').update({
        zapsign_data: { ...zapData, signers: updatedSigners },
        contract_signed: true,
      }).eq('id', eventId);

      await supabase.from('smart_alerts').insert({
        company_id: COMPANY_ID,
        type: 'zapsign_signed',
        severity: 'info',
        title: 'Contrato totalmente assinado',
        description: eventName,
        entity_type: 'event',
        entity_id: eventId,
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
