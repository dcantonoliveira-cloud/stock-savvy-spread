
-- Add image_url and barcode to stock_items
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS barcode text;

-- Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public) VALUES ('item-images', 'item-images', true) ON CONFLICT DO NOTHING;

-- RLS for storage: anyone authenticated can upload, anyone can view
CREATE POLICY "Anyone can view item images" ON storage.objects FOR SELECT USING (bucket_id = 'item-images');
CREATE POLICY "Authenticated can upload item images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'item-images' AND auth.role() = 'authenticated');
CREATE POLICY "Supervisors can delete item images" ON storage.objects FOR DELETE USING (bucket_id = 'item-images' AND public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can update item images" ON storage.objects FOR UPDATE USING (bucket_id = 'item-images' AND public.has_role(auth.uid(), 'supervisor'));
