-- Fix the scheduler state date format issue
UPDATE scheduler_state 
SET last_daily_run_key = '2025-08-19' 
WHERE id = 'global' AND last_daily_run_key = '2025-20-08';

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the daily scheduler to run at 3:00 AM EDT (7:00 UTC) and EST (8:00 UTC)
-- Using ON CONFLICT to handle existing jobs
DO $$
BEGIN
  -- Try to schedule EDT job (7:00 UTC = 3:00 AM EDT)
  PERFORM cron.schedule(
    'daily-scheduler-3am-edt',
    '0 7 * * *',
    'SELECT net.http_post(
      url := ''https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler'',
      headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"}''::jsonb,
      body := ''{"trigger": "cron-edt"}''::jsonb
    );'
  );
EXCEPTION WHEN OTHERS THEN
  -- Job might already exist, continue
  NULL;
END;
$$;

DO $$
BEGIN
  -- Try to schedule EST job (8:00 UTC = 3:00 AM EST)
  PERFORM cron.schedule(
    'daily-scheduler-3am-est',
    '0 8 * * *',
    'SELECT net.http_post(
      url := ''https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler'',
      headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"}''::jsonb,
      body := ''{"trigger": "cron-est"}''::jsonb
    );'
  );
EXCEPTION WHEN OTHERS THEN
  -- Job might already exist, continue
  NULL;
END;
$$;