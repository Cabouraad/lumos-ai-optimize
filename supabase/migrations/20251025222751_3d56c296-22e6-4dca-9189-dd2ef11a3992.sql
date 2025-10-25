
-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule any existing llumos score jobs (if any)
SELECT cron.unschedule('compute-daily-llumos-scores')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'compute-daily-llumos-scores'
);

-- Schedule daily Llumos score computation at 2 AM UTC
-- This will automatically compute scores for all active organizations
SELECT cron.schedule(
  'compute-daily-llumos-scores',  -- Job name
  '0 2 * * *',                     -- Run at 2 AM UTC daily
  $$
  SELECT
    net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/compute-llumos-score',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', current_setting('app.settings.cron_secret', true)
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify the job was created successfully
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'compute-daily-llumos-scores';
