-- ─────────────────────────────────────────────────────────────────────────────
--  Agendamento do backup automático para o Google Drive
--
--  A função edge `backup-databases` roda TODO DIA às 03:00 (horário do servidor)
--  e ela mesma decide se hoje bate com a frequência/dia configurados na tela de
--  Conectores. Assim, mudar a frequência na interface NÃO exige mexer no cron.
--
--  Antes de rodar, substitua:
--    <PROJECT_REF>        → ref do projeto (ex: abcdefghijklmno) — veja na URL do Supabase
--    <SERVICE_ROLE_KEY>   → a Service Role Key (Project Settings → API)
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensões necessárias
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior (idempotente)
select cron.unschedule('daily-drive-backup')
where exists (select 1 from cron.job where jobname = 'daily-drive-backup');

-- Agenda: todo dia às 03:00
select cron.schedule(
  'daily-drive-backup',
  '0 3 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/backup-databases',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Para conferir os agendamentos:  select * from cron.job;
-- Para ver execuções:             select * from cron.job_run_details order by start_time desc limit 20;
