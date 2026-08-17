alter table public.time_entries
  add column if not exists adjustment_minutes integer;
