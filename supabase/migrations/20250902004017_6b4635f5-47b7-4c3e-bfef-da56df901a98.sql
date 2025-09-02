-- Add cron job to check subscriptions daily at 4 AM ET
SELECT cron.schedule(
  'daily-subscription-checker',
  '0 8 * * *', -- 4 AM ET = 8 AM UTC (assuming EST/EDT)
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-subscription-checker',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "' || (SELECT value FROM app_settings WHERE key = 'cron_secret') || '"}'::jsonb,
    body := '{"source": "daily_cron"}'::jsonb
  );
  $$
);