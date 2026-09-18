-- Política de retenção — reduz o inchaço do banco apagando registros que já não
-- têm uso operacional.
--
-- REGRAS COMBINADAS:
--   1. event_history  → apaga o histórico de alterações de eventos cuja DATA DO EVENTO
--                       já passou há mais de 60 dias. O critério é a data do evento,
--                       não a data da alteração. Eventos sem data definida são mantidos.
--   2. app_notifications → apaga tudo criado há mais de 60 dias, lido ou não.
--
-- ATENÇÃO: exclusão definitiva, não tem como desfazer.
-- ATENÇÃO 2: DELETE sozinho NÃO devolve espaço em disco — só marca as linhas como
--            mortas. É obrigatório rodar o VACUUM depois (última seção do arquivo).

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 1 — CONFERÊNCIA (rode sozinho primeiro pra ver o tamanho do estrago)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT
--   (SELECT count(*) FROM public.event_history eh
--      JOIN public.events e ON e.id = eh.event_id
--     WHERE e.event_date IS NOT NULL
--       AND e.event_date < CURRENT_DATE - INTERVAL '60 days')            AS historico_a_apagar,
--   (SELECT count(*) FROM public.event_history)                          AS historico_total,
--   (SELECT count(*) FROM public.app_notifications
--     WHERE created_at < NOW() - INTERVAL '60 days')                     AS notificacoes_a_apagar,
--   (SELECT count(*) FROM public.app_notifications)                      AS notificacoes_total;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 2 — LIMPEZA
-- ─────────────────────────────────────────────────────────────────────────────

-- Histórico de alterações de eventos já realizados há mais de 60 dias
DELETE FROM public.event_history eh
USING public.events e
WHERE eh.event_id = e.id
  AND e.event_date IS NOT NULL
  AND e.event_date < CURRENT_DATE - INTERVAL '60 days';

-- Notificações com mais de 60 dias de criação (lidas ou não)
DELETE FROM public.app_notifications
WHERE created_at < NOW() - INTERVAL '60 days';

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 3 — DEVOLVER O ESPAÇO AO DISCO
-- ─────────────────────────────────────────────────────────────────────────────
-- VACUUM não roda dentro de transação/migration, então rode estes dois comandos
-- SEPARADAMENTE no SQL Editor depois que os DELETEs acima terminarem:
--
--   VACUUM (ANALYZE, VERBOSE) public.event_history;
--   VACUUM (ANALYZE, VERBOSE) public.app_notifications;
--
-- O VACUUM comum é seguro e roda com a aplicação no ar (não trava as tabelas).
-- Ele libera o espaço para reuso interno do Postgres. Se quiser devolver o espaço
-- ao sistema de arquivos de verdade, seria VACUUM FULL — esse TRAVA a tabela e
-- exige o dobro do tamanho livre em disco; só vale a pena se o inchaço for grande.
