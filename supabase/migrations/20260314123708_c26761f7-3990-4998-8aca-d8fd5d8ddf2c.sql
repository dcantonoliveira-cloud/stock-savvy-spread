
-- Invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT,
  series TEXT,
  supplier_name TEXT,
  supplier_cnpj TEXT,
  issue_date DATE,
  total_value NUMERIC DEFAULT 0,
  file_url TEXT,
  file_type TEXT,
  status TEXT DEFAULT 'confirmed',
  registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoice items table
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  nf_description TEXT,
  nf_unit TEXT,
  nf_quantity NUMERIC DEFAULT 0,
  nf_unit_price NUMERIC DEFAULT 0,
  previous_unit_cost NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App notifications table
CREATE TABLE public.app_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for invoices
CREATE POLICY "Authenticated users can read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);

-- Policies for invoice_items
CREATE POLICY "Authenticated users can read invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoice_items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (true);

-- Policies for app_notifications
CREATE POLICY "Authenticated users can read notifications" ON public.app_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert notifications" ON public.app_notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update notifications" ON public.app_notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
