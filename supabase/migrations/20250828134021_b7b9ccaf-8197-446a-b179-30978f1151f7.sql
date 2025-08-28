-- Add protective indexes for batch processing performance (non-concurrent)
CREATE INDEX IF NOT EXISTS idx_batch_tasks_job_status 
ON batch_tasks(batch_job_id, status);

CREATE INDEX IF NOT EXISTS idx_batch_tasks_pending 
ON batch_tasks(status) WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_batch_jobs_org_status 
ON batch_jobs(org_id, status);

-- Add a database function to safely resume stuck jobs
CREATE OR REPLACE FUNCTION resume_stuck_batch_job(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_record RECORD;
  task_stats RECORD;
  result jsonb;
BEGIN
  -- Get the batch job details
  SELECT * INTO job_record
  FROM batch_jobs 
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;
  
  -- Get current task completion statistics
  SELECT 
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'processing') as processing,
    COUNT(*) as total
  INTO task_stats
  FROM batch_tasks bt
  WHERE bt.batch_job_id = p_job_id;

  -- Update the batch job with correct counts and status
  IF task_stats.completed + task_stats.failed = job_record.total_tasks THEN
    -- All tasks are done, mark job as completed
    UPDATE batch_jobs 
    SET 
      completed_tasks = task_stats.completed,
      failed_tasks = task_stats.failed,
      status = 'completed',
      completed_at = CASE WHEN completed_at IS NULL THEN now() ELSE completed_at END
    WHERE id = p_job_id;
    
    result := jsonb_build_object(
      'success', true,
      'action', 'finalized',
      'completed_tasks', task_stats.completed,
      'failed_tasks', task_stats.failed,
      'message', 'Job marked as completed'
    );
  ELSIF task_stats.pending > 0 OR task_stats.processing > 0 THEN
    -- Reset any stuck processing tasks back to pending
    UPDATE batch_tasks 
    SET 
      status = 'pending',
      started_at = NULL,
      attempts = COALESCE(attempts, 0)
    WHERE batch_job_id = p_job_id 
      AND status = 'processing'
      AND started_at < now() - interval '10 minutes';
    
    -- Update job status and counts
    UPDATE batch_jobs 
    SET 
      completed_tasks = task_stats.completed,
      failed_tasks = task_stats.failed,
      status = 'processing'
    WHERE id = p_job_id;
    
    result := jsonb_build_object(
      'success', true,
      'action', 'resumed',
      'pending_tasks', task_stats.pending + task_stats.processing,
      'completed_tasks', task_stats.completed,
      'failed_tasks', task_stats.failed,
      'message', 'Job ready for resumption'
    );
  ELSE
    -- Job has no pending tasks, mark as completed
    UPDATE batch_jobs 
    SET 
      completed_tasks = task_stats.completed,
      failed_tasks = task_stats.failed,
      status = 'completed',
      completed_at = CASE WHEN completed_at IS NULL THEN now() ELSE completed_at END
    WHERE id = p_job_id;
    
    result := jsonb_build_object(
      'success', true,
      'action', 'finalized',
      'completed_tasks', task_stats.completed,
      'failed_tasks', task_stats.failed,
      'message', 'Job finalized'
    );
  END IF;
  
  RETURN result;
END;
$$;