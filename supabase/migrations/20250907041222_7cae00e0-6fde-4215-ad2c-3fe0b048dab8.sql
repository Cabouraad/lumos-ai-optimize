-- Address security warnings from hardening implementation

-- The extensions in public schema warning can be ignored as these are Supabase-managed
-- The leaked password protection can be enabled via the auth settings

-- For completeness, let's verify the cron schedules are working
SELECT 
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname IN ('daily-batch-primary', 'daily-batch-secondary', 'daily-postcheck', 'batch-reconciler')
ORDER BY jobname;