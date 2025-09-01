-- Create atomic task claiming function
CREATE OR REPLACE FUNCTION public.claim_batch_tasks(
  p_job_id uuid,
  p_limit integer DEFAULT 5,
  p_max_attempts integer DEFAULT 3
) RETURNS TABLE(
  id uuid,
  prompt_id uuid,
  provider text,
  attempts integer
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Atomically claim tasks that are either pending or stuck in processing
  RETURN QUERY
  UPDATE batch_tasks bt
  SET 
    status = 'processing',
    started_at = now(),
    attempts = COALESCE(bt.attempts, 0) + 1
  FROM (
    SELECT task.id
    FROM batch_tasks task
    WHERE task.batch_job_id = p_job_id
      AND (
        task.status = 'pending'
        OR (task.status = 'processing' AND task.started_at < now() - interval '3 minutes')
      )
      AND COALESCE(task.attempts, 0) < p_max_attempts
    ORDER BY task.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) claimable
  WHERE bt.id = claimable.id
  RETURNING bt.id, bt.prompt_id, bt.provider, bt.attempts;
END;
$function$

-- Update resume_stuck_batch_job to use 3-minute threshold
CREATE OR REPLACE FUNCTION public.resume_stuck_batch_job(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- Reset any stuck processing tasks back to pending (using 3-minute threshold)
    UPDATE batch_tasks 
    SET 
      status = 'pending',
      started_at = NULL,
      attempts = COALESCE(attempts, 0)
    WHERE batch_job_id = p_job_id 
      AND status = 'processing'
      AND started_at < now() - interval '3 minutes';
    
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
$function$

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_batch_tasks_job_status_started 
ON batch_tasks(batch_job_id, status, started_at);

CREATE INDEX IF NOT EXISTS idx_batch_tasks_processing_timeout 
ON batch_tasks(batch_job_id, status, started_at) 
WHERE status = 'processing';