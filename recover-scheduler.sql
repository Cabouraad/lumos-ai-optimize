-- ===================================================================
-- SCHEDULER RECOVERY SCRIPT
-- Run this in Supabase SQL Editor to reinstall missing cron jobs
-- ===================================================================

-- Step 1: Verify extensions are enabled
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net');

-- Step 2: Check current cron jobs (should be empty or very few)
SELECT jobid, jobname, schedule, active 
FROM cron.job 
ORDER BY jobname;

-- Step 3: Reinstall cron jobs via HTTP call to cron-manager
SELECT net.http_post(
  url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/cron-manager?action=setup',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')
  ),
  body := '{}'::jsonb
) as setup_result;

-- Wait a few seconds, then verify installation
SELECT jobid, jobname, schedule, active 
FROM cron.job 
ORDER BY jobname;

-- Step 4: Trigger immediate manual run (optional - tests the system)
SELECT net.http_post(
  url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')
  ),
  body := jsonb_build_object(
    'force', true,
    'manual_trigger', true,
    'triggered_by', 'manual_recovery',
    'timestamp', now()::text
  )
) as manual_trigger_result;

-- Step 5: Monitor the recovery
-- Check scheduler_runs table for new entries
SELECT 
  function_name,
  status,
  started_at,
  completed_at,
  result
FROM scheduler_runs 
ORDER BY started_at DESC 
LIMIT 5;

-- ===================================================================
-- EXPECTED CRON JOBS AFTER SETUP:
-- 1. daily-batch-trigger-est  : 5 8 * * * (3:05 AM EST)
-- 2. daily-batch-trigger-edt  : 5 7 * * * (3:05 AM EDT)  
-- 3. batch-reconciler-every-10min : */10 * * * *
-- ===================================================================
