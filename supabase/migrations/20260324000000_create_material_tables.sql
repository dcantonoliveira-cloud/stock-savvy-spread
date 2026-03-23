CREATE TABLE IF NOT EXISTS material_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  description text,
  total_qty integer NOT NULL DEFAULT 0,
  available_qty integer NOT NULL DEFAULT 0,
  damaged_qty integer NOT NULL DEFAULT 0,
  min_qty integer NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'unid',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  responsible text,
  date_out date NOT NULL DEFAULT CURRENT_DATE,
  date_return date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_loan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES material_loans(id) ON DELETE CASCADE,
  material_item_id uuid REFERENCES material_items(id),
  qty_out integer NOT NULL,
  qty_returned integer DEFAULT 0,
  qty_damaged integer DEFAULT 0
);
