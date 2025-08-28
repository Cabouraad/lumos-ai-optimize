
-- 1) Add cancellation and heartbeat columns
ALTER TABLE public.batch_jobs
  ADD COLUMN IF NOT EXISTS cancellation_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS runner_id text,
  ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz;

-- 2) Enforce single active job per org at the database level
-- Only one job with status pending/processing per org_id
CREATE UNIQUE INDEX IF NOT EXISTS ux_batch_jobs_one_active_per_org
  ON public.batch_jobs(org_id)
  WHERE status IN ('pending','processing');

-- 3) Helpful indexes for reconciliation
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status_heartbeat
  ON public.batch_jobs(status, last_heartbeat);

-- (these may already exist, but re-ensure)
CREATE INDEX IF NOT EXISTS idx_batch_tasks_job_status
  ON public.batch_tasks(batch_job_id, status);

-- 4) Function to cancel any currently running jobs for an org
CREATE OR REPLACE FUNCTION public.cancel_active_batch_jobs(p_org_id uuid, p_reason text DEFAULT 'preempted')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  job_rec RECORD;
  stats RECORD;
  cancelled_jobs int := 0;
  cancelled_tasks int := 0;
BEGIN
  FOR job_rec IN
    SELECT id
    FROM batch_jobs
    WHERE org_id = p_org_id
      AND status IN ('pending','processing')
  LOOP
    -- Cancel remaining active tasks for this job
    WITH updated AS (
      UPDATE batch_tasks
      SET
        status = 'cancelled',
        completed_at = now(),
        error_message = COALESCE(error_message, '') || CASE WHEN COALESCE(error_message,'') = '' THEN '' ELSE ' ' END
          || format('Cancelled: %s', p_reason)
      WHERE batch_job_id = job_rec.id
        AND status IN ('pending','processing')
      RETURNING 1
    )
    SELECT COUNT(*) INTO stats FROM updated;
    cancelled_tasks := cancelled_tasks + COALESCE(stats.count, 0);

    -- Recompute counts and finalize the job as cancelled
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE status IN ('failed','cancelled')) AS failed
    INTO stats
    FROM batch_tasks
    WHERE batch_job_id = job_rec.id;

    UPDATE batch_jobs
    SET
      completed_tasks = COALESCE(stats.completed, 0),
      failed_tasks = COALESCE(stats.failed, 0),
      status = 'cancelled',
      cancellation_requested = true,
      completed_at = now()
    WHERE id = job_rec.id;

    cancelled_jobs := cancelled_jobs + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_jobs', cancelled_jobs,
    'cancelled_tasks', cancelled_tasks
  );
END;
$$;

-- 5) Harden resume_stuck_batch_job to honor cancellation and finalize deterministically
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
  SELECT * INTO job_record
  FROM batch_jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- If cancellation was requested, cancel any remaining active tasks and finalize
  IF job_record.cancellation_requested THEN
    UPDATE batch_tasks
    SET
      status = 'cancelled',
      completed_at = COALESCE(completed_at, now()),
      error_message = COALESCE(error_message, '') || CASE WHEN COALESCE(error_message,'') = '' THEN '' ELSE ' ' END
        || 'Cancelled: cancellation requested'
    WHERE batch_job_id = p_job_id
      AND status IN ('pending','processing');

    SELECT
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE status IN ('failed','cancelled')) AS failed
    INTO task_stats
    FROM batch_tasks
    WHERE batch_job_id = p_job_id;

    UPDATE batch_jobs
    SET
      completed_tasks = COALESCE(task_stats.completed, 0),
      failed_tasks = COALESCE(task_stats.failed, 0),
      status = 'cancelled',
      completed_at = COALESCE(completed_at, now())
    WHERE id = p_job_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'finalized',
      'completed_tasks', COALESCE(task_stats.completed, 0),
      'failed_tasks', COALESCE(task_stats.failed, 0),
      'message', 'Job cancelled and finalized'
    );
  END IF;

  -- Normal reconciliation/resume path
  SELECT
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing,
    COUNT(*) AS total
  INTO task_stats
  FROM batch_tasks bt
  WHERE bt.batch_job_id = p_job_id;

  IF task_stats.completed + task_stats.failed = job_record.total_tasks THEN
    UPDATE batch_jobs
    SET
      completed_tasks = task_stats.completed,
      failed_tasks = task_stats.failed,
      status = 'completed',
      completed_at = COALESCE(completed_at, now())
    WHERE id = p_job_id;

    result := jsonb_build_object(
      'success', true,
      'action', 'finalized',
      'completed_tasks', task_stats.completed,
      'failed_tasks', task_stats.failed,
      'message', 'Job marked as completed'
    );
  ELSIF task_stats.pending > 0 OR task_stats.processing > 0 THEN
    -- Reset any stuck processing tasks (older than 10 minutes) back to pending
    UPDATE batch_tasks
    SET
      status = 'pending',
      started_at = NULL,
      attempts = COALESCE(attempts, 0)
    WHERE batch_job_id = p_job_id
      AND status = 'processing'
      AND started_at < now() - interval '10 minutes';

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
    -- No pending tasks, just finalize as completed
    UPDATE batch_jobs
    SET
      completed_tasks = task_stats.completed,
      failed_tasks = task_stats.failed,
      status = 'completed',
      completed_at = COALESCE(completed_at, now())
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
$function$;
