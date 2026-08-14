alter table public.events
  add column if not exists lost_reason text;
