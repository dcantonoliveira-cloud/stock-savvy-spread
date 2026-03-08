
-- Inventory counts table
CREATE TABLE public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  counted_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Individual item counts
CREATE TABLE public.inventory_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  system_stock numeric NOT NULL DEFAULT 0,
  counted_stock numeric,
  difference numeric GENERATED ALWAYS AS (COALESCE(counted_stock, 0) - system_stock) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for inventory_counts - allow public inserts for guest mode
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;

-- Anyone can create and update inventory counts (guest mode)
CREATE POLICY "Anyone can insert counts" ON public.inventory_counts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update counts" ON public.inventory_counts FOR UPDATE USING (true);
CREATE POLICY "Authenticated can view counts" ON public.inventory_counts FOR SELECT USING (true);
CREATE POLICY "Supervisors can delete counts" ON public.inventory_counts FOR DELETE USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Anyone can insert count items" ON public.inventory_count_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update count items" ON public.inventory_count_items FOR UPDATE USING (true);
CREATE POLICY "Authenticated can view count items" ON public.inventory_count_items FOR SELECT USING (true);
CREATE POLICY "Supervisors can delete count items" ON public.inventory_count_items FOR DELETE USING (public.has_role(auth.uid(), 'supervisor'));
