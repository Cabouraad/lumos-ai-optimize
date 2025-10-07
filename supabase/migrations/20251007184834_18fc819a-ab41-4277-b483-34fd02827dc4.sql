-- Add trigger_source column to scheduler_runs for execution tracking
ALTER TABLE scheduler_runs 
ADD COLUMN IF NOT EXISTS trigger_source TEXT DEFAULT 'unknown';

COMMENT ON COLUMN scheduler_runs.trigger_source IS 
'Tracks execution trigger: scheduled_primary, scheduled_backup_530, scheduled_backup_600, guardian_recovery, monitor_recovery, manual_force, cron_recovery';

-- Delete all pg_cron jobs that use pg_net to eliminate silent failure point
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT jobid, jobname FROM cron.job 
    WHERE command LIKE '%net.http_post%'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
    RAISE NOTICE 'Deleted cron job: % (ID: %)', job_record.jobname, job_record.jobid;
  END LOOP;
END $$;