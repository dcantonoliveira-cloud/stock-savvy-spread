
-- Add recipe fields to technical_sheets
ALTER TABLE public.technical_sheets
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS category text DEFAULT 'Prato Principal',
ADD COLUMN IF NOT EXISTS prep_time integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS yield_quantity numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS yield_unit text DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS instructions text;

-- Add correction_factor and gross_quantity to technical_sheet_items
ALTER TABLE public.technical_sheet_items
ADD COLUMN IF NOT EXISTS gross_quantity numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS correction_factor numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0;

-- Create event_menus table
CREATE TABLE IF NOT EXISTS public.event_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  guest_count integer NOT NULL DEFAULT 100,
  staff_count integer DEFAULT 0,
  event_date date,
  status text DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view event menus" ON public.event_menus
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supervisors can manage event menus" ON public.event_menus
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'supervisor'));

-- Create event_menu_dishes (linking menus to technical sheets/recipes)
CREATE TABLE IF NOT EXISTS public.event_menu_dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.event_menus(id) ON DELETE CASCADE,
  sheet_id uuid NOT NULL REFERENCES public.technical_sheets(id) ON DELETE CASCADE,
  planned_quantity numeric NOT NULL DEFAULT 0,
  planned_unit text DEFAULT 'kg',
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_menu_dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view event menu dishes" ON public.event_menu_dishes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supervisors can manage event menu dishes" ON public.event_menu_dishes
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'supervisor'));

-- Create event_menu_dish_items (overridable ingredient breakdown per dish)
CREATE TABLE IF NOT EXISTS public.event_menu_dish_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_dish_id uuid NOT NULL REFERENCES public.event_menu_dishes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  calculated_quantity numeric NOT NULL DEFAULT 0,
  override_quantity numeric,
  unit text DEFAULT 'kg',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_menu_dish_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dish items" ON public.event_menu_dish_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Supervisors can manage dish items" ON public.event_menu_dish_items
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'supervisor'));

-- Enable realtime for event menus
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_menus;

-- Updated_at trigger for event_menus
CREATE TRIGGER update_event_menus_updated_at
  BEFORE UPDATE ON public.event_menus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
