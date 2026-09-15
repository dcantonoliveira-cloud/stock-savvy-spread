import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const uid = 'c84fef3f-adf0-4908-94b3-e785999b52fd';
  const { data, error } = await supabase.auth.admin.getUserById(uid);
  return new Response(JSON.stringify({
    user_metadata: data?.user?.user_metadata,
    app_metadata: data?.user?.app_metadata,
    error,
  }, null, 2), { headers: { ...CORS, 'Content-Type': 'application/json' } });
});
