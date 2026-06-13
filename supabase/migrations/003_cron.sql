-- Enable pg_cron and pg_net extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema pg_catalog;

-- Schedule process-turn once per day at midnight UTC
select cron.schedule(
  'process-turn',
  '0 0 * * *',
  $$
    select net.http_post(
      url:='https://rztijljihmdkxsdyqoob.supabase.co/functions/v1/process-turn',
      headers:='{"Content-Type": "application/json"}'::jsonb
    ) as request_id;
  $$
);

-- Unschedule if needed:
-- select cron.unschedule('process-turn');
