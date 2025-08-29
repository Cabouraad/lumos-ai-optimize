-- Step 1: Safely drop existing cron jobs (ignore if they don't exist)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('daily-batch-trigger-every-5min');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore error if job doesn't exist
  END;
  
  BEGIN
    PERFORM cron.unschedule('batch-reconciler-every-10min');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore error if job doesn't exist
  END;
END $$;

-- Step 2: Sync cron secret to database 
SELECT net.http_post(
  url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/sync-cron-secret',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"}'::jsonb,
  body := '{"sync_request": true}'::jsonb
);

-- Step 3: Create function to get cron secret if it doesn't exist
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

-- Step 4: Create new cron jobs with proper headers  
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