-- Adiciona 'adjustment' ao check constraint de type
alter table public.time_entries
  drop constraint if exists time_entries_type_check;

alter table public.time_entries
  add constraint time_entries_type_check check (type in ('entry', 'exit', 'adjustment'));
