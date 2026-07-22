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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const body = await req.json();
    const { supplier_id, email, display_name, action, invite_code, password } = body;

    // ── Self-register via invite code (no supervisor auth needed — validated above) ──
    if (action === 'self_register') {
      if (!invite_code || !email || !password) {
        return new Response(JSON.stringify({ error: 'Código, e-mail e senha são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Validate invite code
      const { data: supplier } = await adminClient.from('suppliers').select('id, name, user_id').eq('invite_code', invite_code).is('user_id', null).maybeSingle() as any;
      if (!supplier) {
        return new Response(JSON.stringify({ error: 'Código inválido ou já utilizado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Create auth user
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: supplier.name },
      });
      if (createErr || !newUser.user) {
        return new Response(JSON.stringify({ error: createErr?.message || 'Erro ao criar usuário' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userId = newUser.user.id;
      // Set role
      const { error: roleErr } = await adminClient.from('user_roles').insert({ user_id: userId, role: 'assessor' });
      if (roleErr) { await adminClient.auth.admin.deleteUser(userId); return new Response(JSON.stringify({ error: 'Erro ao definir role' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
      // Link supplier and clear invite_code
      const { error: linkErr } = await adminClient.from('suppliers').update({ user_id: userId, email, invite_code: null, must_change_password: false }).eq('id', supplier.id) as any;
      if (linkErr) { await adminClient.auth.admin.deleteUser(userId); return new Response(JSON.stringify({ error: 'Erro ao vincular assessora' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Todas as outras actions requerem supervisor autenticado ───────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: callerRole } = await adminClient.from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'supervisor').maybeSingle();
    if (!callerRole) return new Response(JSON.stringify({ error: 'Apenas supervisores podem criar acessos' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ── Reset password for existing assessor ─────────────────────────────────
    if (action === 'reset_password') {
      if (!supplier_id) return new Response(JSON.stringify({ error: 'supplier_id obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: existing } = await adminClient.from('suppliers').select('user_id').eq('id', supplier_id).maybeSingle() as any;
      if (!existing?.user_id) return new Response(JSON.stringify({ error: 'Assessora sem acesso criado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const tempPassword = generatePassword();
      const { error: updErr } = await adminClient.auth.admin.updateUserById(existing.user_id, { password: tempPassword });
      if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      await adminClient.from('suppliers').update({ must_change_password: true }).eq('id', supplier_id) as any;
      return new Response(JSON.stringify({ success: true, temp_password: tempPassword }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Create new assessor account ───────────────────────────────────────────
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
