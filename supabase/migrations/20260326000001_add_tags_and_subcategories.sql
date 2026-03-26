-- Tags table (independent)
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view tags" ON public.tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage tags" ON public.tags FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'supervisor'::app_role));

-- Subcategories table (tied to parent category)
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, category_id)
);
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view subcategories" ON public.subcategories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage subcategories" ON public.subcategories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'supervisor'::app_role));

-- Add subcategory to stock_items
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL;

-- Add tag to technical_sheet_items
ALTER TABLE public.technical_sheet_items ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES public.tags(id) ON DELETE SET NULL;
