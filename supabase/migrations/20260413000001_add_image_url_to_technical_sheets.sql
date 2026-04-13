ALTER TABLE public.technical_sheets
  ADD COLUMN IF NOT EXISTS image_url text;
