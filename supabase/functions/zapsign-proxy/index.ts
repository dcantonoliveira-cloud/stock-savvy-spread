import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zapsign-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const token = req.headers.get('x-zapsign-token');
    if (!token) return new Response(JSON.stringify({ error: 'Missing ZapSign token' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });

    const url = new URL(req.url);
    // path after /zapsign-proxy → e.g. /docs/ or /docs/{doc_token}/
    const zapPath = url.searchParams.get('path') ?? '/api/v1/docs/';
    const zapUrl = `https://api.zapsign.com.br${zapPath}`;

    const upstream = await fetch(zapUrl, {
      method: req.method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: req.method !== 'GET' ? await req.text() : undefined,
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
