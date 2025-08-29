-- Step 1: Call sync-cron-secret to ensure CRON_SECRET is in database
-- This will sync the environment CRON_SECRET to app_settings table

-- Step 2: Drop existing cron jobs and recreate with proper headers
SELECT cron.unschedule('daily-batch-trigger-every-5min');
SELECT cron.unschedule('batch-reconciler-every-10min');

-- Step 3: Create new cron jobs with proper authentication headers
-- Daily batch trigger - every 5 minutes, function handles de-duplication
SELECT cron.schedule(
  'daily-batch-trigger-every-5min',
  '*/5 * * * *', -- Every 5 minutes
  $$
  DO $$
  DECLARE
    cron_secret_value text;
  BEGIN
    -- Get the cron secret from app_settings
    SELECT value INTO cron_secret_value FROM app_settings WHERE key = 'cron_secret';
    
    IF cron_secret_value IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', cron_secret_value,
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'
        ),
        body := jsonb_build_object(
          'triggered_by', 'cron',
          'timestamp', now()
        )
      );
    END IF;
  END $$;
  $$
);

-- Batch reconciler - every 10 minutes 
SELECT cron.schedule(
  'batch-reconciler-every-10min', 
  '*/10 * * * *', -- Every 10 minutes
  $$
  DO $$
  DECLARE
    cron_secret_value text;
  BEGIN
    -- Get the cron secret from app_settings
    SELECT value INTO cron_secret_value FROM app_settings WHERE key = 'cron_secret';
    
    IF cron_secret_value IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/batch-reconciler',
        headers := jsonb_build_object(
          'Content-Type', 'application/json', 
          'x-cron-secret', cron_secret_value,
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXloba2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'
        ),
        body := jsonb_build_object(
          'triggered_by', 'cron',
          'timestamp', now()
        )
      );
    END IF;
  END $$;
  $$
);

-- Verify cron jobs are scheduled
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%batch%';