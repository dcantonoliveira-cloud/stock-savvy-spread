-- Add purchase_qty to stock_items (quantidade por embalagem de compra)
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS purchase_qty NUMERIC;
