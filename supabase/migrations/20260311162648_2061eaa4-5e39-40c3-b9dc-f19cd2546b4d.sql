
CREATE TABLE public.sheet_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sheet_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sheet categories" ON public.sheet_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage sheet categories" ON public.sheet_categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));

INSERT INTO public.sheet_categories (name, sort_order) VALUES
  ('Welcome drink', 1),
  ('Finger foods', 2),
  ('Mini pratos', 3),
  ('Ilha gourmet', 4),
  ('Jantar - massas', 5),
  ('Jantar - proteínas', 6),
  ('Jantar - guarnições', 7),
  ('Jantar - saladas', 8),
  ('Sobremesas', 9),
  ('Lanchinho da Madrugada', 10),
  ('Café', 11);
