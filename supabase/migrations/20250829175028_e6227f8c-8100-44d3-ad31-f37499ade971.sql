-- Immediate scheduler test: Trigger daily-batch-trigger twice to test functionality and idempotency

-- Test Run #1: Should trigger batch processing and mark today's run
SELECT net.http_post(
  url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', get_cron_secret(),
    'x-manual-call', 'true',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'
  ),
  body := jsonb_build_object(
    'triggered_by', 'immediate-test-run-1',
    'manual', true,
    'timestamp', now()
  )
) as test_run_1_request_id;

-- Brief pause before idempotency test
SELECT pg_sleep(3);

-- Test Run #2: Should be skipped due to idempotency (daily run already marked)
SELECT net.http_post(
  url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', get_cron_secret(),
    'x-manual-call', 'true',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk'
  ),
  body := jsonb_build_object(
    'triggered_by', 'immediate-test-run-2-idempotency',
    'manual', true,
    'timestamp', now()
  )
) as test_run_2_request_id;