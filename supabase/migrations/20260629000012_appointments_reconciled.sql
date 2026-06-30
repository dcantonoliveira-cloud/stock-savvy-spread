-- Tabela de compromissos do calendário
create table if not exists appointments (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null default my_company_id(),
  title          text not null,
  date           date not null,
  time           text,
  location       text,
  notes          text,
  invited_emails text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

alter table appointments enable row level security;

create policy "company isolation" on appointments
  using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- Campo reconciled no fluxo de caixa (para conferência com conta bancária)
alter table cash_flow_entries
  add column if not exists reconciled boolean not null default false;

alter table event_payments
  add column if not exists reconciled boolean not null default false;
