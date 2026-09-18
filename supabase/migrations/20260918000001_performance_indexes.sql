-- Índices nas colunas que o app mais filtra. Hoje as tabelas são pequenas e o
-- Postgres varre tudo rápido, mas esses índices são baratos e evitam a degradação
-- conforme o histórico cresce (event_history já passa de 9 mil linhas).
-- CONCURRENTLY não é usado porque cada CREATE roda em milissegundos nesse volume.

-- Movimentações de estoque: sempre consultadas por item e ordenadas por data
CREATE INDEX IF NOT EXISTS idx_stock_entries_item_id      ON public.stock_entries(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_created_at   ON public.stock_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_entries_date         ON public.stock_entries(date);
CREATE INDEX IF NOT EXISTS idx_stock_outputs_item_id      ON public.stock_outputs(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_outputs_created_at   ON public.stock_outputs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_outputs_date         ON public.stock_outputs(date);

-- Histórico e pagamentos de evento (as duas maiores tabelas do banco)
CREATE INDEX IF NOT EXISTS idx_event_history_event_id     ON public.event_history(event_id);
CREATE INDEX IF NOT EXISTS idx_event_history_changed_at   ON public.event_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_payments_event_id    ON public.event_payments(event_id);

-- Eventos: filtrados por data e status em praticamente toda tela comercial
CREATE INDEX IF NOT EXISTS idx_events_event_date          ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status              ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_client_id           ON public.events(client_id);

-- Inventário
CREATE INDEX IF NOT EXISTS idx_inv_count_items_count_id   ON public.inventory_count_items(count_id);
CREATE INDEX IF NOT EXISTS idx_inv_count_items_item_id    ON public.inventory_count_items(item_id);

-- Relações de item
CREATE INDEX IF NOT EXISTS idx_item_suppliers_item_id     ON public.item_suppliers(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_item_locations_item  ON public.stock_item_locations(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_price_history_item   ON public.stock_price_history(item_id);
CREATE INDEX IF NOT EXISTS idx_tech_sheet_items_sheet_id  ON public.technical_sheet_items(sheet_id);
CREATE INDEX IF NOT EXISTS idx_tech_sheet_items_item_id   ON public.technical_sheet_items(item_id);

-- Permissões: consultadas em TODO carregamento de página (useAuth)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id         ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_user  ON public.employee_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id           ON public.profiles(user_id);

-- Notificações: o sininho lista por "não lidas" e ordena por data
CREATE INDEX IF NOT EXISTS idx_app_notifications_read_at  ON public.app_notifications(read, created_at DESC);

ANALYZE;
