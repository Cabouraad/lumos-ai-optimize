-- Create single consolidated weekly reports cron job
-- Runs every Monday at 08:00 UTC
-- Triggers the weekly-report edge function which generates both CSV and PDF

SELECT cron.schedule(
  'weekly-reports-unified',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'a978931713ce1c30123378480cbf38a3fc3ea7b9d299c6c848c463c3ca6e983'
    ),
    body := jsonb_build_object(
      'scheduled', true,
      'timestamp', now()
    )
  ) as request_id;
  $$
);