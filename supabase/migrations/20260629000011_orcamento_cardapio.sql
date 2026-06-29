-- Coluna de categoria do gerador de orçamentos nas fichas técnicas
alter table technical_sheets
  add column if not exists orcamento_category text;

-- Tabela para persistir o masterCardapio do gerador por empresa
create table if not exists orcamento_cardapio_master (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default my_company_id(),
  dados_json text not null default '[]',
  updated_at timestamptz not null default now(),
  unique (company_id)
);

alter table orcamento_cardapio_master enable row level security;

create policy "company isolation" on orcamento_cardapio_master
  using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- Trigger para atualizar updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end;
$$;

drop trigger if exists trg_orcamento_cardapio_updated_at on orcamento_cardapio_master;
create trigger trg_orcamento_cardapio_updated_at
  before update on orcamento_cardapio_master
  for each row execute function set_updated_at();
