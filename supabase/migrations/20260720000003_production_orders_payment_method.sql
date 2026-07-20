-- Adiciona forma de pagamento nas ordens de produção
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS payment_method text
  CHECK (payment_method IN ('dinheiro','cartao','pix','evento'));
