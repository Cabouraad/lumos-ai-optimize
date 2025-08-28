
-- 1) Add required columns to batch_jobs (idempotent)
ALTER TABLE public.batch_jobs
  ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz,
  ADD COLUMN IF NOT EXISTS runner_id text,
  ADD COLUMN IF NOT EXISTS cancellation_requested boolean NOT NULL DEFAULT false;

-- 2) Pre-clean: ensure at most one active job (pending/processing) per org before adding the unique index
WITH ranked AS (
  SELECT
    id,
    org_id,
    status,
    COALESCE(started_at, created_at) AS started_ts,
    ROW_NUMBER() OVER (
      PARTITION BY org_id
      ORDER BY COALESCE(started_at, created_at) DESC, created_at DESC
    ) AS rn
  FROM public.batch_jobs
  WHERE status IN ('pending','processing')
)
UPDATE public.batch_jobs b
SET
  status = 'cancelled',
  cancellation_requested = true,
  completed_at = COALESCE(b.completed_at, now()),
  metadata = COALESCE(b.metadata, '{}'::jsonb) ||
             jsonb_build_object(
               'cancel_reason', 'pre-index cleanup: enforcing one active job per org',
               'cancelled_at', now()
             )
FROM ranked r
WHERE b.id = r.id
  AND r.rn > 1;

-- 3) Enforce single active job per org (pending or processing)
CREATE UNIQUE INDEX IF NOT EXISTS ux_batch_jobs_one_active_per_org
ON public.batch_jobs (org_id)
WHERE status IN ('pending','processing');

-- 4) Helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_jobs_last_heartbeat_active
  ON public.batch_jobs (last_heartbeat)
  WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS idx_batch_tasks_job_status
  ON public.batch_tasks (batch_job_id, status);

-- 5) Deterministic cancellation RPC to preempt existing jobs
CREATE OR REPLACE FUNCTION public.cancel_active_batch_jobs(
  p_org_id uuid,
  p_reason text DEFAULT 'preempted by new job'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_cancelled_jobs int := 0;
  v_cancelled_tasks int := 0;
BEGIN
  -- Cancel tasks first to prevent new work on old jobs
  WITH active_jobs AS (
    SELECT id
    FROM public.batch_jobs
    WHERE org_id = p_org_id
      AND status IN ('pending','processing')
  ),
  upd_tasks AS (
    UPDATE public.batch_tasks t
    SET
      status = 'cancelled',
      error_message = COALESCE(
        t.error_message, ''
      ) || CASE WHEN t.error_message IS NULL OR t.error_message = '' THEN '' ELSE E'\n' END
        || '[CANCELLED] ' || p_reason || ' at ' || to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
    WHERE t.batch_job_id IN (SELECT id FROM active_jobs)
      AND t.status IN ('pending','processing')
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_cancelled_tasks FROM upd_tasks;

  -- Then cancel the jobs
  WITH upd_jobs AS (
    UPDATE public.batch_jobs j
    SET
      status = 'cancelled',
      cancellation_requested = true,
      completed_at = COALESCE(j.completed_at, now()),
      metadata = COALESCE(j.metadata, '{}'::jsonb) ||
                 jsonb_build_object(
                   'cancel_reason', p_reason,
                   'cancelled_at', now()
                 )
    WHERE j.org_id = p_org_id
      AND j.status IN ('pending','processing')
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_cancelled_jobs FROM upd_jobs;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_jobs', v_cancelled_jobs,
    'cancelled_tasks', v_cancelled_tasks,
    'org_id', p_org_id,
    'reason', p_reason
  );
END;
$fn$;
