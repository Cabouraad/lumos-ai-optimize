-- Drop and recreate claim_batch_tasks with additional return fields
DROP FUNCTION IF EXISTS public.claim_batch_tasks(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.claim_batch_tasks(p_job_id uuid, p_limit integer DEFAULT 5, p_max_attempts integer DEFAULT 3)
 RETURNS TABLE(id uuid, batch_job_id uuid, prompt_id uuid, provider text, attempts integer)
 LANGUAGE plpgsql
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
  RETURNING bt.id, bt.batch_job_id, bt.prompt_id, bt.provider, bt.attempts;
END;
$function$;