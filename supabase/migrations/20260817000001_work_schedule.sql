alter table public.employee_permissions
  add column if not exists work_schedule jsonb;
