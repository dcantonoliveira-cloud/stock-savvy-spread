create table if not exists public.contract_clauses (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.contract_clauses enable row level security;

create policy "company_clauses" on public.contract_clauses
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());
