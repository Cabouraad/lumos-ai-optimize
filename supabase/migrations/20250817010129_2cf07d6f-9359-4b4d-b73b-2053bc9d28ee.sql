-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily run at 3:00 AM America/New_York
-- We'll run at both 7 AM and 8 AM UTC to account for daylight saving time
-- The function itself will check if it should run based on NY timezone

-- Remove any existing scheduled jobs for this function first
SELECT cron.unschedule('daily-prompt-runs-7am');
SELECT cron.unschedule('daily-prompt-runs-8am');

-- Schedule for 7 AM UTC (3 AM EDT - Daylight Saving Time)
SELECT cron.schedule(
  'daily-prompt-runs-7am',
  '0 7 * * *', -- Every day at 7:00 AM UTC
  $$
  SELECT
    net.http_post(
        url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"}'::jsonb,
        body := '{"trigger": "7am-utc"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule for 8 AM UTC (3 AM EST - Standard Time)
SELECT cron.schedule(
  'daily-prompt-runs-8am',
  '0 8 * * *', -- Every day at 8:00 AM UTC
  $$
  SELECT
    net.http_post(
        url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"}'::jsonb,
        body := '{"trigger": "8am-utc"}'::jsonb
    ) as request_id;
  $$
);