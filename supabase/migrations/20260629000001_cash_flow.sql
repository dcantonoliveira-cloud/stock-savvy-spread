create table if not exists cash_flow_entries (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default my_company_id(),
  date          date not null,
  description   text not null,
  amount        numeric not null,          -- positive = entrada, negative = saída
  category      text not null default 'manual', -- 'event_payment' | 'manual' | 'expense'
  event_id      uuid references events(id) on delete set null,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

alter table cash_flow_entries enable row level security;

create policy "company isolation" on cash_flow_entries
  using (company_id = my_company_id())
  with check (company_id = my_company_id());
