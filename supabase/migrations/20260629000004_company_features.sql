-- Feature flags por empresa
alter table companies
  add column if not exists features jsonb not null default '{}';

-- Ativa a aba "2ª degustação" somente para o Rondello
-- Ajuste o company_id conforme necessário, ou rode manualmente:
-- update companies set features = features || '{"segunda_degustacao": true}' where name ilike '%rondello%';
