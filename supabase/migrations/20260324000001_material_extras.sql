-- Add image and price to material items
ALTER TABLE material_items ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE material_items ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;

-- Material categories table
CREATE TABLE IF NOT EXISTS material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Access control for employees
ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS access_stock boolean DEFAULT true;
ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS access_materials boolean DEFAULT false;
