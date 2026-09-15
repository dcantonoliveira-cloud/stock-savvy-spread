-- Vínculo de custo entre insumos: um item "derivado" (ex: Mignon em cubos) pode
-- ter seu preço amarrado ao de um item "mãe" (ex: Mignon inteiro) — só o preço é
-- compartilhado, cada um continua com seu próprio estoque, categoria, unidade etc.

ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS cost_source_item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL;

-- Sempre que um item com vínculo é inserido/atualizado, o preço dele (unit_cost) é
-- recalculado a partir do custo efetivo do item mãe (unit_cost / purchase_qty do mãe),
-- e purchase_qty é travado em 1 (o item filho passa a guardar preço "por unidade").
-- Isso vale mesmo se alguém tentar editar o preço manualmente — o vínculo sempre vence.
CREATE OR REPLACE FUNCTION public.sync_cost_from_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  src record;
BEGIN
  IF NEW.cost_source_item_id IS NOT NULL THEN
    IF NEW.cost_source_item_id = NEW.id THEN
      RAISE EXCEPTION 'Um item não pode ser sua própria referência de custo.';
    END IF;

    SELECT unit_cost, purchase_qty, cost_source_item_id
      INTO src
      FROM public.stock_items
      WHERE id = NEW.cost_source_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insumo mãe não encontrado.';
    END IF;

    IF src.cost_source_item_id IS NOT NULL THEN
      RAISE EXCEPTION 'Esse item já depende do preço de outro insumo — não é possível encadear vínculos de custo.';
    END IF;

    NEW.unit_cost := COALESCE(src.unit_cost, 0) / GREATEST(COALESCE(src.purchase_qty, 1), 0.0001);
    NEW.purchase_qty := 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cost_source_change ON public.stock_items;
CREATE TRIGGER on_cost_source_change
  BEFORE INSERT OR UPDATE ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cost_from_source();

-- Quando o preço (ou purchase_qty) do item mãe muda, propaga o novo custo efetivo
-- pra todo item filho que aponta pra ele.
CREATE OR REPLACE FUNCTION public.propagate_cost_to_derived_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  eff_cost numeric;
BEGIN
  IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost OR NEW.purchase_qty IS DISTINCT FROM OLD.purchase_qty THEN
    eff_cost := COALESCE(NEW.unit_cost, 0) / GREATEST(COALESCE(NEW.purchase_qty, 1), 0.0001);
    UPDATE public.stock_items
      SET unit_cost = eff_cost, purchase_qty = 1
      WHERE cost_source_item_id = NEW.id
        AND (unit_cost IS DISTINCT FROM eff_cost OR purchase_qty IS DISTINCT FROM 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cost_propagate ON public.stock_items;
CREATE TRIGGER on_cost_propagate
  AFTER UPDATE ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_cost_to_derived_items();
