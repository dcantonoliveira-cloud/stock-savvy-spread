alter table public.profiles
  add column if not exists avatar_base64 text,
  add column if not exists phone text;
