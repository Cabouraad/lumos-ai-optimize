-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Sync the CRON_SECRET to app_settings for cron job authentication
-- First, ensure we have the sync-cron-secret function invocation
SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/sync-cron-secret',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA0MjUwOSwiZXhwIjoyMDcwNjE4NTA5fQ.Y8vBpBHT_s6UZPZ2LNv1DgGSHKiWMlQLi6rXZ1rLdBs"}'::jsonb
) as request_id;

-- Create the daily batch trigger cron job that runs every 15 minutes
-- The function has built-in window checking (3-6 AM ET) and duplicate prevention
SELECT cron.schedule(
    'daily-batch-trigger-resilient',
    '*/15 * * * *', -- Every 15 minutes
    $$
    SELECT net.http_post(
        url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', COALESCE(
                (SELECT value FROM app_settings WHERE key = 'cron_secret'),
                'fallback-secret'
            )
        ),
        body := jsonb_build_object(
            'time', now(),
            'trigger', 'pg_cron'
        )
    );
    $$
);

-- Also create a batch reconciler job that runs every 30 minutes to clean up stuck jobs
SELECT cron.schedule(
    'batch-reconciler-cleanup',
    '*/30 * * * *', -- Every 30 minutes  
    $$
    SELECT net.http_post(
        url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/batch-reconciler',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', COALESCE(
                (SELECT value FROM app_settings WHERE key = 'cron_secret'),
                'fallback-secret'
            )
        ),
        body := jsonb_build_object(
            'time', now(),
            'trigger', 'pg_cron_reconciler'
        )
    );
    $$
);