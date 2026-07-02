-- ─────────────────────────────────────────────────────────────────────────────
--  RLS por permissão — protege os dados financeiros no banco (não só no front)
--
--  Cria a função has_permission() e tranca as tabelas PURAMENTE financeiras
--  (fluxo de caixa, contas bancárias, contas a pagar, cartões) atrás da
--  permissão `access_financeiro`. Assim, mesmo que alguém chame a API direto,
--  o Postgres bloqueia quem não tem acesso.
--
--  Observação: `event_payments` e `events` NÃO entram aqui de propósito — o
--  módulo Comercial precisa delas (o valor do evento continua visível; os
--  consolidados financeiros é que ficam escondidos, via front + rota).
--
--  Regra de acesso (has_permission):
--   • is_admin = true                → vê tudo
--   • tem linha em employee_permissions → usa o valor da coluna daquela permissão
--   • não tem linha, mas é supervisor   → acesso liberado (padrão do sistema)
--   • caso contrário                    → bloqueado
--
--  O service_role (usado pelas Edge Functions, ex.: backup) ignora RLS — os
--  backups continuam pegando tudo normalmente.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Função central de permissão ───────────────────────────────────────────────
create or replace function public.has_permission(_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- admin vê tudo
    exists (select 1 from public.employee_permissions ep
            where ep.user_id = auth.uid() and ep.is_admin)
    or
    coalesce(
      -- tem linha de permissões → usa a coluna correspondente
      (select
        case _perm
          when 'access_financeiro'    then ep.access_financeiro
          when 'access_estatisticas'  then ep.access_estatisticas
          when 'access_comercial'     then ep.access_comercial
          when 'access_estoque'       then ep.access_estoque
          when 'access_materials'     then ep.access_materials
          when 'access_cadastros'     then ep.access_cadastros
          when 'access_administracao' then ep.access_administracao
          else false
        end
       from public.employee_permissions ep
       where ep.user_id = auth.uid()),
      -- sem linha: supervisores têm acesso total por padrão
      public.has_role(auth.uid(), 'supervisor')
    );
$$;

-- ── Aplica RLS por permissão nas tabelas puramente financeiras ────────────────
-- Para cada tabela: liga RLS, remove políticas antigas e cria uma política única
-- baseada em has_permission('access_financeiro').
do $$
declare
  t   text;
  pol record;
  fin_tables text[] := array[
    'cash_flow_entries',
    'bank_accounts',
    'bank_transfers',
    'bills_payable',
    'credit_cards',
    'credit_card_expenses'
  ];
begin
  foreach t in array fin_tables loop
    -- pula tabelas que não existirem neste ambiente
    if not exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = t) then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- remove políticas existentes para não conflitar
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;

    -- política única: só quem tem access_financeiro (ou admin/supervisor padrão)
    execute format($f$
      create policy "Financeiro por permissao" on public.%I
        for all to authenticated
        using (public.has_permission('access_financeiro'))
        with check (public.has_permission('access_financeiro'))
    $f$, t);
  end loop;
end $$;

-- Conferir depois:
--   select tablename, policyname from pg_policies
--   where tablename in ('cash_flow_entries','bank_accounts','bank_transfers',
--                       'bills_payable','credit_cards','credit_card_expenses');
