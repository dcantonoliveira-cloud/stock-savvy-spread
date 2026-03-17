-- Add per-item assignment columns to event_separation_items
alter table event_separation_items
  add column if not exists assigned_to uuid references auth.users(id),
  add column if not exists category text;

-- RLS policies (table had RLS enabled but no policies)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'event_separation_items' and policyname = 'Authenticated can view separation items') then
    execute 'CREATE POLICY "Authenticated can view separation items" ON public.event_separation_items FOR SELECT USING (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'event_separation_items' and policyname = 'Supervisors can manage separation items') then
    execute 'CREATE POLICY "Supervisors can manage separation items" ON public.event_separation_items FOR ALL USING (has_role(auth.uid(), ''supervisor''::app_role))';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'event_separation_items' and policyname = 'Employees can update own separation items') then
    execute 'CREATE POLICY "Employees can update own separation items" ON public.event_separation_items FOR UPDATE USING (assigned_to = auth.uid())';
  end if;
end $$;
