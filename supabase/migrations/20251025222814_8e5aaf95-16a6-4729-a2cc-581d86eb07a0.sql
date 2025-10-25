
-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily Llumos score computation for all active orgs at 2 AM UTC
-- This ensures all users get updated scores automatically
SELECT cron.schedule(
  'compute-daily-llumos-scores',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/compute-llumos-score',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk", "x-cron-secret": "CRON_SECRET_PLACEHOLDER"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify the cron job was created
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'compute-daily-llumos-scores';

COMMENT ON EXTENSION pg_cron IS 'Enables scheduled jobs for automated Llumos score computation';
