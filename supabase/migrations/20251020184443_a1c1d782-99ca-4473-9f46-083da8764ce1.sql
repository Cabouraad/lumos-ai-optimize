-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

-- Clean up any existing weekly report cron jobs to avoid duplicates
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT jobid 
    FROM cron.job 
    WHERE jobname LIKE '%weekly%report%'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
END $$;

-- Create the unified weekly reports cron job
-- Runs every Monday at 8:05 AM UTC
SELECT cron.schedule(
  'weekly-reports-unified',
  '5 8 * * MON',
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := jsonb_build_object(
      'scheduled', true,
      'timestamp', now()
    )
  );
  $$
);