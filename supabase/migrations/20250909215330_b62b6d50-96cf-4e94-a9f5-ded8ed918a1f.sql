-- Add weekly report scheduler cron job (Mondays at 08:10 UTC)
-- First, remove any existing weekly-report-scheduler job
SELECT cron.unschedule('weekly-report-scheduler') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-report-scheduler'
);

-- Create weekly report scheduler cron job (Mondays at 08:10 UTC)
SELECT cron.schedule(
  'weekly-report-scheduler',
  '10 8 * * 1',  -- Every Monday at 08:10 UTC
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT get_cron_secret())
    ),
    body := jsonb_build_object('scheduled', true, 'timestamp', now())
  );
  $$
);

-- Also create the weekly-report PDF generation job (Mondays at 08:00 UTC)
SELECT cron.unschedule('weekly-report-pdf') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-report-pdf'
);

SELECT cron.schedule(
  'weekly-report-pdf',
  '0 8 * * 1',  -- Every Monday at 08:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT get_cron_secret())
    ),
    body := jsonb_build_object('scheduled', true, 'timestamp', now())
  );
  $$
);