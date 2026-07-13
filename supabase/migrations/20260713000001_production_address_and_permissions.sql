-- Add delivery_address to production_orders
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS delivery_address text;

-- Add access_producao to employee_permissions
ALTER TABLE employee_permissions
  ADD COLUMN IF NOT EXISTS access_producao boolean NOT NULL DEFAULT false;
