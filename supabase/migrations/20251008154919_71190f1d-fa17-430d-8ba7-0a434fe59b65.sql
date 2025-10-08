-- Ensure daily-batch-trigger-est cron job exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-batch-trigger-est') THEN
    PERFORM public.cron_schedule(
      'daily-batch-trigger-est',
      '5 8 * * *',
      $cmd$
      SELECT net.http_post(
        url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-secret', public.get_cron_secret()
        ),
        body := jsonb_build_object(
          'trigger_source','pg_cron',
          'tz','America/New_York',
          'schedule','EST'
        )
      );
      $cmd$
    );
  END IF;
END
$$;