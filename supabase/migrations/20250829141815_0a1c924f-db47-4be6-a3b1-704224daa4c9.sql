
DO $$
DECLARE
  v_suffix text := to_char(now(), 'YYYYMMDDHH24MISS');

  v_ts1 timestamp := now() + interval '2 minutes';
  v_ts2 timestamp := now() + interval '4 minutes';
  v_ts3 timestamp := now() + interval '30 minutes';
  v_ts4 timestamp := now() + interval '32 minutes';

  v_sched1 text := format('%s %s * * *', to_char(v_ts1, 'MI'), to_char(v_ts1, 'HH24'));
  v_sched2 text := format('%s %s * * *', to_char(v_ts2, 'MI'), to_char(v_ts2, 'HH24'));
  v_sched3 text := format('%s %s * * *', to_char(v_ts3, 'MI'), to_char(v_ts3, 'HH24'));
  v_sched4 text := format('%s %s * * *', to_char(v_ts4, 'MI'), to_char(v_ts4, 'HH24'));

  v_job1 name := ('daily-batch-trigger-test-once-1-' || v_suffix)::name;
  v_job2 name := ('daily-batch-trigger-test-once-2-' || v_suffix)::name;
  v_uns1 name := ('unschedule-' || v_job1)::name;
  v_uns2 name := ('unschedule-' || v_job2)::name;

  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk';
BEGIN
  -- Safety: unschedule if these names already exist (no-op if not found)
  PERFORM cron.unschedule(v_job1);
  PERFORM cron.unschedule(v_job2);
  PERFORM cron.unschedule(v_uns1);
  PERFORM cron.unschedule(v_uns2);

  -- One-off test run #1 (fires ~2 minutes from now)
  PERFORM cron.schedule(
    v_job1,
    v_sched1,
    $sql$
    SELECT net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', get_cron_secret(),
        'x-manual-call', 'true',
        'Authorization', 'Bearer ' || $token$
    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk
    $token$
      ),
      body := jsonb_build_object(
        'triggered_by', 'cron-test',
        'manual', true,
        'timestamp', now()
      )
    );
    $sql$
  );

  -- One-off test run #2 (fires ~4 minutes from now) - should be skipped by idempotency
  PERFORM cron.schedule(
    v_job2,
    v_sched2,
    $sql$
    SELECT net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', get_cron_secret(),
        'x-manual-call', 'true',
        'Authorization', 'Bearer ' || $token$
    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk
    $token$
      ),
      body := jsonb_build_object(
        'triggered_by', 'cron-test',
        'manual', true,
        'timestamp', now()
      )
    );
    $sql$
  );

  -- Auto cleanup: unschedule job1 after ~30 minutes
  PERFORM cron.schedule(
    v_uns1,
    v_sched3,
    format($sql$
      SELECT cron.unschedule(%L);
    $sql$, v_job1)
  );

  -- Auto cleanup: unschedule job2 after ~32 minutes
  PERFORM cron.schedule(
    v_uns2,
    v_sched4,
    format($sql$
      SELECT cron.unschedule(%L);
    $sql$, v_job2)
  );

  RAISE NOTICE 'Scheduled one-off daily-batch-trigger test runs: % at %, % at % (cleanup at %, %)',
    v_job1, v_sched1, v_job2, v_sched2, v_sched3, v_sched4;
END;
$$;
