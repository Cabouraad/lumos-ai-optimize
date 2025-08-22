-- Fix cron jobs with correct CRON_SECRET and ensure scheduler_state exists
-- Remove current jobs
SELECT cron.unschedule('daily-scheduler-3am-est');
SELECT cron.unschedule('daily-scheduler-3am-edt');

-- Ensure scheduler_state has the global row
INSERT INTO scheduler_state (id, last_daily_run_key, last_daily_run_at)
VALUES ('global', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Recreate cron jobs with proper CRON_SECRET reference
SELECT cron.schedule(
  'daily-scheduler-3am-est',
  '0 8 * * *', -- 8 AM UTC = 3 AM EST (winter time)
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler',
    headers := format('{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk", "x-cron-secret": "%s"}', current_setting('app.cron_secret', true))::jsonb,
    body := '{"trigger": "cron-est", "timezone": "EST"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'daily-scheduler-3am-edt', 
  '0 7 * * *', -- 7 AM UTC = 3 AM EDT (summer time)
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler',
    headers := format('{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk", "x-cron-secret": "%s"}', current_setting('app.cron_secret', true))::jsonb,
    body := '{"trigger": "cron-edt", "timezone": "EDT"}'::jsonb
  );
  $$
);