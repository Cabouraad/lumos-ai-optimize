-- Reinstall missing daily scheduler cron jobs
-- Remove any existing jobs first to avoid conflicts
SELECT cron.unschedule('daily-batch-trigger-est');
SELECT cron.unschedule('daily-batch-trigger-edt');
SELECT cron.unschedule('batch-reconciler-every-10min');

-- Reinstall EST job (3:05 AM EST = 8:05 AM UTC in winter)
SELECT cron.schedule(
  'daily-batch-trigger-est',
  '5 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')
    ),
    body := '{"timezone": "America/New_York", "cron_source": "est"}'::jsonb
  ) as request_id;
  $$
);

-- Reinstall EDT job (3:05 AM EDT = 7:05 AM UTC in summer)
SELECT cron.schedule(
  'daily-batch-trigger-edt',
  '5 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')
    ),
    body := '{"timezone": "America/New_York", "cron_source": "edt"}'::jsonb
  ) as request_id;
  $$
);

-- Reinstall batch reconciler job (every 10 minutes)
SELECT cron.schedule(
  'batch-reconciler-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/batch-reconciler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Manual recovery: Trigger daily batch for today's date
SELECT net.http_post(
  url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')
  ),
  body := jsonb_build_object(
    'force', true,
    'manual_recovery', true,
    'recovery_date', CURRENT_DATE::text
  )
) as manual_recovery_result;