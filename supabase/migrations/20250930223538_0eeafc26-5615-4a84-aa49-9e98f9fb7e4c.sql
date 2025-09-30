-- Add cron job for weekly CSV report generation
-- This will trigger the weekly-report-scheduler edge function every Monday at 08:00 UTC

SELECT cron.schedule(
  'weekly-csv-reports',
  '0 8 * * 1', -- Every Monday at 08:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret')
    )
  ) as request_id;
  $$
);