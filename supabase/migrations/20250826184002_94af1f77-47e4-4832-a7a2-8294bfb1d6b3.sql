-- Create missing RPC functions for batch job counters
CREATE OR REPLACE FUNCTION increment_completed_tasks(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE batch_jobs 
  SET completed_tasks = completed_tasks + 1,
      updated_at = now()
  WHERE id = job_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_failed_tasks(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE batch_jobs 
  SET failed_tasks = failed_tasks + 1,
      updated_at = now()
  WHERE id = job_id;
END;
$$;

-- Create function to fix stuck batch jobs
CREATE OR REPLACE FUNCTION fix_stuck_batch_jobs()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_record RECORD;
  task_stats RECORD;
  fixed_count INTEGER := 0;
BEGIN
  -- Find batch jobs that are stuck in processing but have completed tasks
  FOR job_record IN
    SELECT bj.id, bj.total_tasks, bj.started_at
    FROM batch_jobs bj
    WHERE bj.status = 'processing'
      AND bj.started_at < now() - interval '5 minutes' -- Give jobs at least 5 minutes
  LOOP
    -- Get actual task completion statistics
    SELECT 
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) as total
    INTO task_stats
    FROM batch_tasks bt
    WHERE bt.batch_job_id = job_record.id;

    -- Update the batch job with correct counts and status
    IF task_stats.total > 0 AND (task_stats.completed + task_stats.failed = job_record.total_tasks) THEN
      -- All tasks are done, mark job as completed
      UPDATE batch_jobs 
      SET 
        completed_tasks = task_stats.completed,
        failed_tasks = task_stats.failed,
        status = 'completed',
        completed_at = now(),
        updated_at = now()
      WHERE id = job_record.id;
      
      fixed_count := fixed_count + 1;
      RAISE NOTICE 'Fixed batch job %: % completed, % failed', 
        job_record.id, task_stats.completed, task_stats.failed;
    ELSIF task_stats.total > 0 THEN
      -- Some tasks are done, update partial progress
      UPDATE batch_jobs 
      SET 
        completed_tasks = task_stats.completed,
        failed_tasks = task_stats.failed,
        updated_at = now()
      WHERE id = job_record.id;
    END IF;
  END LOOP;

  RETURN format('Fixed %s stuck batch jobs', fixed_count);
END;
$$;

-- Fix the current stuck jobs immediately
SELECT fix_stuck_batch_jobs();