-- Hardening plan implementation: Add dual cron schedules for reliability (fixed)

-- First, let's add postcheck functionality
CREATE OR REPLACE FUNCTION public.get_today_key_ny(d timestamp with time zone DEFAULT now())
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  ny_date date;
BEGIN
  -- Convert to New York timezone and extract date
  ny_date := (d AT TIME ZONE 'America/New_York')::date;
  RETURN ny_date::text;
END;
$function$;

-- Create dual cron schedules for daily-batch-trigger (redundancy within 3-6 AM ET window)
-- Only unschedule if they exist
DO $$
BEGIN
  PERFORM cron.unschedule('daily-batch-trigger-edt') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-batch-trigger-edt');
  PERFORM cron.unschedule('daily-batch-trigger-est') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-batch-trigger-est');
  PERFORM cron.unschedule('daily-batch-trigger') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-batch-trigger');
  PERFORM cron.unschedule('daily-batch-primary') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-batch-primary');
  PERFORM cron.unschedule('daily-batch-secondary') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-batch-secondary');
  PERFORM cron.unschedule('daily-postcheck') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-postcheck');
  PERFORM cron.unschedule('batch-reconciler') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'batch-reconciler');
END $$;

-- Primary schedule at 3:15 AM ET (covers both EDT and EST)
SELECT cron.schedule(
  'daily-batch-primary',
  '15 7 * * *', -- 07:15 UTC = 3:15 AM EDT (summer) / 2:15 AM EST (winter)
  $$
  select
    net.http_post(
        url:='https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
        headers:='{"Content-Type": "application/json", "x-cron-secret": "' || (SELECT value FROM app_settings WHERE key = 'cron_secret') || '"}'::jsonb,
        body:=concat('{"scheduled_run": true, "run_id": "', gen_random_uuid(), '", "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Secondary schedule at 5:45 AM ET for redundancy 
SELECT cron.schedule(
  'daily-batch-secondary', 
  '45 9 * * *', -- 09:45 UTC = 5:45 AM EDT (summer) / 4:45 AM EST (winter)
  $$
  select
    net.http_post(
        url:='https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
        headers:='{"Content-Type": "application/json", "x-cron-secret": "' || (SELECT value FROM app_settings WHERE key = 'cron_secret') || '"}'::jsonb,
        body:=concat('{"scheduled_run": true, "run_id": "', gen_random_uuid(), '", "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Postcheck schedule at 6:30 AM ET (after processing window)
SELECT cron.schedule(
  'daily-postcheck',
  '30 10 * * *', -- 10:30 UTC = 6:30 AM EDT (summer) / 5:30 AM EST (winter)
  $$
  select
    net.http_post(
        url:='https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/scheduler-postcheck',
        headers:='{"Content-Type": "application/json", "x-cron-secret": "' || (SELECT value FROM app_settings WHERE key = 'cron_secret') || '"}'::jsonb,
        body:=concat('{"scheduled_run": true, "run_id": "', gen_random_uuid(), '", "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Ensure batch-reconciler runs every 5 minutes  
SELECT cron.schedule(
  'batch-reconciler',
  '*/5 * * * *', -- Every 5 minutes
  $$
  select
    net.http_post(
        url:='https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/batch-reconciler',
        headers:='{"Content-Type": "application/json", "x-cron-secret": "' || (SELECT value FROM app_settings WHERE key = 'cron_secret') || '"}'::jsonb,
        body:=concat('{"scheduled_run": true, "run_id": "', gen_random_uuid(), '", "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);