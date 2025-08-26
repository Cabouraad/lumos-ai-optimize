-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to trigger daily batch processing at 12AM EST (5AM UTC)
SELECT cron.schedule(
  'daily-batch-trigger-12am-est',
  '0 5 * * *', -- 5AM UTC = 12AM EST
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "' || current_setting('app.settings.cron_secret', true) || '"}'::jsonb,
    body := '{"triggered_at": "' || now() || '"}'::jsonb
  ) as request_id;
  $$
);