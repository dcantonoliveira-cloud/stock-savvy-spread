-- Add section column to technical_sheet_items (defaults to 'receita' for existing rows)
ALTER TABLE public.technical_sheet_items
  ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'receita';
