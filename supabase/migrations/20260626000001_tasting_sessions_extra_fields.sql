alter table tasting_sessions
  add column if not exists location text,
  add column if not exists responsible text,
  add column if not exists cost_per_couple numeric;
