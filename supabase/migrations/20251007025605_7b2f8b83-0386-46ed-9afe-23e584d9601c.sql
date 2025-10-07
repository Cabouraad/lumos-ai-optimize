-- Store CRON_SECRET in app_settings for SQL access
-- Note: Replace 'YOUR_CRON_SECRET_HERE' with the actual CRON_SECRET value from your Supabase Edge Functions settings
INSERT INTO public.app_settings (key, value, description)
VALUES ('cron_secret', 'YOUR_CRON_SECRET_HERE', 'Secret for authenticating cron job requests to edge functions')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();

-- Drop any existing weekly report cron jobs to avoid duplicates
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname ILIKE '%weekly%';

-- Create unified weekly report cron job that runs every Monday at 1:05 AM UTC
-- This calls the weekly-report edge function with proper authentication headers
SELECT cron.schedule(
  'weekly-reports-unified',
  '5 1 * * 1', -- Every Monday at 1:05 AM UTC
  $$
    SELECT net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
      ),
      body := jsonb_build_object(
        'trigger', 'cron',
        'scheduled_at', now()
      )
    ) AS request_id;
  $$
);