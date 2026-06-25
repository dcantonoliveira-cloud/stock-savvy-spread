-- Portal do cliente: acesso por evento
create table if not exists client_portal_access (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null unique,
  enabled boolean not null default false,
  access_code text not null default upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  email text,
  whatsapp text,
  first_accessed_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table client_portal_access enable row level security;

create policy "supervisor_all" on client_portal_access
  for all using (true) with check (true);
