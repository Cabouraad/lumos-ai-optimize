-- Unschedule all existing weekly cron jobs safely (no SQL Editor needed)
-- Idempotent: does nothing if pg_cron not installed or no matching jobs
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR r IN
      SELECT jobid, jobname
      FROM cron.job
      WHERE jobname ILIKE 'weekly%'
    LOOP
      PERFORM cron.unschedule(r.jobid);
    END LOOP;
  END IF;
END $$;