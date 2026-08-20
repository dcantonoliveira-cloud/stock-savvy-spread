alter table public.material_loans
  add column if not exists production_order_id uuid references public.production_orders(id) on delete set null,
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

-- preenche company_id para registros existentes (via join com production_orders ou default)
update public.material_loans ml
set company_id = po.company_id
from public.production_orders po
where ml.production_order_id = po.id
  and ml.company_id is null;
