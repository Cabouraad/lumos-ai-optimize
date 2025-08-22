-- Clean up duplicate cron jobs and add proper security headers
-- Remove old duplicate jobs
SELECT cron.unschedule('daily-scheduler-edt');
SELECT cron.unschedule('daily-scheduler-est');

-- Update the remaining jobs with proper security headers including CRON_SECRET
SELECT cron.unschedule('daily-scheduler-3am-edt');
SELECT cron.unschedule('daily-scheduler-3am-est');

-- Create new secure scheduler jobs with CRON_SECRET header
SELECT cron.schedule(
  'daily-scheduler-3am-est',
  '0 8 * * *', -- 8 AM UTC = 3 AM EST (winter time)
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk", "x-cron-secret": "' || current_setting('app.cron_secret', true) || '"}'::jsonb,
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
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk", "x-cron-secret": "' || current_setting('app.cron_secret', true) || '"}'::jsonb,
    body := '{"trigger": "cron-edt", "timezone": "EDT"}'::jsonb
  );
  $$
);