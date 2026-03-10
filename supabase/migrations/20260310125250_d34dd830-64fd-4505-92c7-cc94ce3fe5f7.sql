-- Add is_default column to kitchens to mark "Estoque Geral" as undeletable
ALTER TABLE public.kitchens ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Insert "Estoque Geral" if it doesn't exist
INSERT INTO public.kitchens (name, is_default)
SELECT 'Estoque Geral', true
WHERE NOT EXISTS (SELECT 1 FROM public.kitchens WHERE name = 'Estoque Geral');

-- Also add a categories table so custom categories persist
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  emoji text DEFAULT '📦',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view categories" ON public.categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supervisors can manage categories" ON public.categories
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Seed default categories
INSERT INTO public.categories (name, emoji) VALUES
  ('Carnes', '🥩'), ('Bebidas', '🥤'), ('Frios', '🧀'), ('Hortifruti', '🥬'),
  ('Secos', '🌾'), ('Descartáveis', '🥤'), ('Limpeza', '🧹'), ('Outros', '📦')
ON CONFLICT (name) DO NOTHING;