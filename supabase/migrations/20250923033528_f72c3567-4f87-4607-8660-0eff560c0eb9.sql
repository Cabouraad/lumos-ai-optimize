-- Enable weekly reports feature flag
UPDATE feature_flags 
SET enabled = true, updated_at = now() 
WHERE flag_name = 'FEATURE_WEEKLY_REPORT';

-- Ensure CRON_SECRET exists in app_settings
INSERT INTO app_settings (key, value, description) 
VALUES ('cron_secret', gen_random_uuid()::text, 'Secret for authenticating scheduled cron jobs')
ON CONFLICT (key) DO NOTHING;

-- Create the weekly report cron job (runs every Monday at 8 AM UTC)
SELECT cron.schedule(
  'weekly-reports-pdf-csv',
  '0 8 * * 1', -- Every Monday at 8 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'cron_secret')
    ),
    body := '{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);