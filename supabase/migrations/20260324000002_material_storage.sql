-- Bucket público para fotos de materiais
INSERT INTO storage.buckets (id, name, public)
VALUES ('material-images', 'material-images', true)
ON CONFLICT DO NOTHING;

-- Permitir upload para usuários autenticados
CREATE POLICY IF NOT EXISTS "material_images_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'material-images');

-- Leitura pública
CREATE POLICY IF NOT EXISTS "material_images_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'material-images');

-- Deletar próprios arquivos
CREATE POLICY IF NOT EXISTS "material_images_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'material-images');
