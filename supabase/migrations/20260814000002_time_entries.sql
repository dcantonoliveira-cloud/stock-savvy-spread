create table if not exists public.time_entries (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  employee_id  uuid not null references auth.users(id) on delete cascade,
  type         text not null check (type in ('entry', 'exit')),
  recorded_at  timestamptz not null default now(),
  note         text,
  created_at   timestamptz not null default now()
);

alter table public.time_entries enable row level security;

-- Funcionário vê/insere os próprios registros
create policy "employee_own" on public.time_entries
  for all
  using (employee_id = auth.uid() and company_id = public.my_company_id())
  with check (employee_id = auth.uid() and company_id = public.my_company_id());

-- Supervisor/admin vê e edita todos da empresa
create policy "supervisor_all" on public.time_entries
  for all
  using (company_id = public.my_company_id() and public.has_permission('access_administracao'))
  with check (company_id = public.my_company_id() and public.has_permission('access_administracao'));

create index if not exists time_entries_employee_idx on public.time_entries(employee_id, recorded_at desc);

alter table public.time_entries
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;
