
-- Price history table
CREATE TABLE public.stock_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  old_price numeric NOT NULL DEFAULT 0,
  new_price numeric NOT NULL DEFAULT 0,
  changed_by uuid,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view price history" ON public.stock_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage price history" ON public.stock_price_history FOR ALL TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Trigger to auto-log price changes
CREATE OR REPLACE FUNCTION public.log_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.unit_cost IS DISTINCT FROM NEW.unit_cost THEN
    INSERT INTO public.stock_price_history (item_id, old_price, new_price, source)
    VALUES (NEW.id, COALESCE(OLD.unit_cost, 0), NEW.unit_cost, 'manual');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_price_change
  AFTER UPDATE ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_price_change();
