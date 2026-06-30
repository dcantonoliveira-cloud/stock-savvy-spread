-- ── Contas bancárias ──────────────────────────────────────────────────────
create table if not exists bank_accounts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null default my_company_id(),
  name         text not null,
  bank_name    text,
  account_type text not null default 'checking', -- checking | savings | cash
  balance      numeric(12,2) not null default 0,
  color        text default '#6366f1',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table bank_accounts enable row level security;
create policy "company isolation" on bank_accounts
  using (company_id = my_company_id()) with check (company_id = my_company_id());

-- ── Contas a pagar ────────────────────────────────────────────────────────
create table if not exists bills_payable (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null default my_company_id(),
  description     text not null,
  supplier        text,
  category        text not null default 'outros',
  amount          numeric(12,2) not null,
  due_date        date not null,
  paid_date       date,
  status          text not null default 'pending', -- pending | paid | overdue
  bank_account_id uuid references bank_accounts(id),
  recurring       boolean not null default false,
  recurrence      text,  -- monthly | weekly | yearly
  notes           text,
  created_at      timestamptz not null default now()
);
alter table bills_payable enable row level security;
create policy "company isolation" on bills_payable
  using (company_id = my_company_id()) with check (company_id = my_company_id());

-- ── Transferências entre contas ───────────────────────────────────────────
create table if not exists bank_transfers (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null default my_company_id(),
  from_account_id uuid references bank_accounts(id),
  to_account_id   uuid references bank_accounts(id),
  amount          numeric(12,2) not null,
  date            date not null,
  description     text,
  created_at      timestamptz not null default now()
);
alter table bank_transfers enable row level security;
create policy "company isolation" on bank_transfers
  using (company_id = my_company_id()) with check (company_id = my_company_id());

-- ── Cartões de crédito ────────────────────────────────────────────────────
create table if not exists credit_cards (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default my_company_id(),
  name          text not null,
  bank_name     text,
  last_four     text,
  limit_amount  numeric(12,2),
  due_day       int,
  closing_day   int,
  color         text default '#8b5cf6',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table credit_cards enable row level security;
create policy "company isolation" on credit_cards
  using (company_id = my_company_id()) with check (company_id = my_company_id());

create table if not exists credit_card_expenses (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null default my_company_id(),
  credit_card_id      uuid references credit_cards(id) on delete cascade,
  description         text not null,
  amount              numeric(12,2) not null,
  date                date not null,
  category            text not null default 'outros',
  installments        int not null default 1,
  installment_current int not null default 1,
  paid                boolean not null default false,
  created_at          timestamptz not null default now()
);
alter table credit_card_expenses enable row level security;
create policy "company isolation" on credit_card_expenses
  using (company_id = my_company_id()) with check (company_id = my_company_id());
