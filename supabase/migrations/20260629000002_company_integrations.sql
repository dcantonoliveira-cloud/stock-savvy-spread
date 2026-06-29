create table if not exists company_integrations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default my_company_id(),
  provider    text not null,   -- 'zapsign' | 'autentique' | ...
  api_key     text,
  enabled     boolean not null default false,
  settings    jsonb default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, provider)
);

alter table company_integrations enable row level security;

create policy "company isolation" on company_integrations
  using (company_id = my_company_id())
  with check (company_id = my_company_id());
