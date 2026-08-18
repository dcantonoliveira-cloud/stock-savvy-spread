alter table public.events add column if not exists deleted_at timestamptz;
