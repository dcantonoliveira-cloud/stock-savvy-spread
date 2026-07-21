import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const userClient  = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: callerRole } = await adminClient.from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'supervisor').maybeSingle();
    if (!callerRole) return new Response(JSON.stringify({ error: 'Apenas supervisores podem criar acessos' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { supplier_id, email, display_name } = await req.json();
    if (!supplier_id || !email || !display_name?.trim()) return new Response(JSON.stringify({ error: 'supplier_id, email e nome são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Check if already has account
    const { data: existing } = await adminClient.from('suppliers').select('user_id').eq('id', supplier_id).maybeSingle() as any;
    if (existing?.user_id) return new Response(JSON.stringify({ error: 'Esta assessora já possui acesso criado' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const tempPassword = generatePassword();

    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { display_name: display_name.trim() },
    });

    if (createErr || !newUser.user) return new Response(JSON.stringify({ error: createErr?.message || 'Erro ao criar usuário' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userId = newUser.user.id;

    const { error: roleErr } = await adminClient.from('user_roles').insert({ user_id: userId, role: 'assessor' });
    if (roleErr) { await adminClient.auth.admin.deleteUser(userId); return new Response(JSON.stringify({ error: 'Erro ao definir role' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    const { error: linkErr } = await adminClient.from('suppliers').update({ user_id: userId, email, must_change_password: true }).eq('id', supplier_id) as any;
    if (linkErr) { await adminClient.auth.admin.deleteUser(userId); return new Response(JSON.stringify({ error: 'Erro ao vincular assessora' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    return new Response(JSON.stringify({ success: true, user_id: userId, temp_password: tempPassword }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
