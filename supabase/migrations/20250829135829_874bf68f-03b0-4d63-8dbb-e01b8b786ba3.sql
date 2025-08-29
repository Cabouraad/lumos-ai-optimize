-- Step 1: First drop existing cron jobs  
SELECT cron.unschedule('daily-batch-trigger-every-5min');
SELECT cron.unschedule('batch-reconciler-every-10min');

-- Step 2: Sync cron secret to database via HTTP call
SELECT net.http_post(
  url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/sync-cron-secret',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"}'::jsonb,
  body := '{"sync_request": true}'::jsonb
) as sync_result;

-- Step 3: Create function to get cron secret
CREATE OR REPLACE FUNCTION get_cron_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT value INTO secret_value FROM app_settings WHERE key = 'cron_secret';
  RETURN secret_value;
END;
$$;

-- Step 4: Create cron jobs with proper syntax
-- Daily batch trigger - every 5 minutes
SELECT cron.schedule(
  'daily-batch-trigger-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', get_cron_secret(),
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'
    ),
    body := jsonb_build_object(
      'triggered_by', 'cron',
      'timestamp', now()
    )
  );
  $$
);

-- Batch reconciler - every 10 minutes
SELECT cron.schedule(
  'batch-reconciler-every-10min', 
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/batch-reconciler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', get_cron_secret(), 
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'
    ),
    body := jsonb_build_object(
      'triggered_by', 'cron',
      'timestamp', now()
    )
  );
  $$
);

-- Verify cron jobs are scheduled
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%batch%';