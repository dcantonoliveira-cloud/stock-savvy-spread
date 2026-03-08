
-- Kitchens table
CREATE TABLE public.kitchens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.kitchens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view kitchens" ON public.kitchens FOR SELECT USING (true);
CREATE POLICY "Supervisors can manage kitchens" ON public.kitchens FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));

-- Stock per kitchen location
CREATE TABLE public.stock_item_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  kitchen_id uuid NOT NULL REFERENCES public.kitchens(id) ON DELETE CASCADE,
  current_stock numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(item_id, kitchen_id)
);

ALTER TABLE public.stock_item_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view locations" ON public.stock_item_locations FOR SELECT USING (true);
CREATE POLICY "Supervisors can manage locations" ON public.stock_item_locations FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Employees can update locations" ON public.stock_item_locations FOR UPDATE USING (true);

-- Transfers between kitchens
CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  from_kitchen_id uuid NOT NULL REFERENCES public.kitchens(id),
  to_kitchen_id uuid NOT NULL REFERENCES public.kitchens(id),
  quantity numeric NOT NULL,
  transferred_by text NOT NULL,
  notes text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view transfers" ON public.stock_transfers FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert transfers" ON public.stock_transfers FOR INSERT WITH CHECK (true);
CREATE POLICY "Supervisors can delete transfers" ON public.stock_transfers FOR DELETE USING (public.has_role(auth.uid(), 'supervisor'));

-- Inventory tokens for public access
CREATE TABLE public.inventory_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  count_id uuid REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  kitchen_id uuid REFERENCES public.kitchens(id),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors can manage tokens" ON public.inventory_tokens FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Anyone can view tokens" ON public.inventory_tokens FOR SELECT USING (true);

-- Add kitchen_id to inventory_counts
ALTER TABLE public.inventory_counts ADD COLUMN kitchen_id uuid REFERENCES public.kitchens(id);

-- Add kitchen_id to stock_entries and stock_outputs
ALTER TABLE public.stock_entries ADD COLUMN kitchen_id uuid REFERENCES public.kitchens(id);
ALTER TABLE public.stock_outputs ADD COLUMN kitchen_id uuid REFERENCES public.kitchens(id);
