-- Phase 2: Database Cleanup - Archive old failed batch jobs safely
-- Create archive tables for batch jobs and tasks

-- Create archive table for batch jobs
CREATE TABLE IF NOT EXISTS batch_jobs_archive (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL,
  status text NOT NULL,
  total_tasks integer NOT NULL DEFAULT 0,
  completed_tasks integer NOT NULL DEFAULT 0,
  failed_tasks integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancellation_requested boolean NOT NULL DEFAULT false,
  runner_id text,
  last_heartbeat timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  archived_reason text NOT NULL DEFAULT 'cleanup_old_failed_jobs'
);

-- Create archive table for batch tasks
CREATE TABLE IF NOT EXISTS batch_tasks_archive (
  id uuid PRIMARY KEY,
  batch_job_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  result jsonb,
  created_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  archived_reason text NOT NULL DEFAULT 'cleanup_old_failed_jobs'
);

-- Create safe cleanup function for old failed batch jobs
CREATE OR REPLACE FUNCTION clean_old_batch_jobs(
  days_old integer DEFAULT 7,
  dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  jobs_to_archive uuid[];
  tasks_count integer := 0;
  jobs_count integer := 0;
  cleanup_result jsonb;
BEGIN
  -- Find jobs older than specified days with failed/cancelled status
  SELECT array_agg(id) INTO jobs_to_archive
  FROM batch_jobs
  WHERE status IN ('failed', 'cancelled')
    AND (completed_at < now() - (days_old || ' days')::interval 
         OR created_at < now() - (days_old || ' days')::interval);
  
  -- Count records that would be affected
  SELECT COUNT(*) INTO jobs_count
  FROM batch_jobs
  WHERE id = ANY(COALESCE(jobs_to_archive, '{}'));
  
  SELECT COUNT(*) INTO tasks_count
  FROM batch_tasks
  WHERE batch_job_id = ANY(COALESCE(jobs_to_archive, '{}'));
  
  -- If dry run, just return counts
  IF dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'jobs_to_archive', jobs_count,
      'tasks_to_archive', tasks_count,
      'job_ids', COALESCE(jobs_to_archive, '{}')
    );
  END IF;
  
  -- Archive tasks first (referential integrity)
  INSERT INTO batch_tasks_archive (
    id, batch_job_id, prompt_id, provider, status, attempts,
    started_at, completed_at, error_message, result, created_at,
    archived_at, archived_reason
  )
  SELECT 
    id, batch_job_id, prompt_id, provider, status, attempts,
    started_at, completed_at, error_message, result, created_at,
    now(), 'cleanup_old_failed_jobs_' || current_date::text
  FROM batch_tasks
  WHERE batch_job_id = ANY(COALESCE(jobs_to_archive, '{}'));
  
  -- Archive jobs
  INSERT INTO batch_jobs_archive (
    id, org_id, status, total_tasks, completed_tasks, failed_tasks,
    started_at, completed_at, cancellation_requested, runner_id,
    last_heartbeat, metadata, created_at, archived_at, archived_reason
  )
  SELECT 
    id, org_id, status, total_tasks, completed_tasks, failed_tasks,
    started_at, completed_at, cancellation_requested, runner_id,
    last_heartbeat, metadata, created_at,
    now(), 'cleanup_old_failed_jobs_' || current_date::text
  FROM batch_jobs
  WHERE id = ANY(COALESCE(jobs_to_archive, '{}'));
  
  -- Delete tasks first
  DELETE FROM batch_tasks
  WHERE batch_job_id = ANY(COALESCE(jobs_to_archive, '{}'));
  
  -- Delete jobs
  DELETE FROM batch_jobs
  WHERE id = ANY(COALESCE(jobs_to_archive, '{}'));
  
  -- Create audit log
  INSERT INTO audit_events (run_id, name, phase, level, data)
  VALUES (
    gen_random_uuid(),
    'batch_jobs_cleanup',
    'cleanup',
    'info',
    jsonb_build_object(
      'jobs_archived', jobs_count,
      'tasks_archived', tasks_count,
      'days_old_threshold', days_old,
      'cleanup_date', now()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'jobs_archived', jobs_count,
    'tasks_archived', tasks_count,
    'cleanup_date', now()
  );
END;
$$;

-- Create function to get cleanup status
CREATE OR REPLACE FUNCTION get_batch_cleanup_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_counts jsonb;
  archive_counts jsonb;
  old_failed_count integer;
BEGIN
  -- Get current table counts
  SELECT jsonb_build_object(
    'total_jobs', COUNT(*),
    'failed_jobs', COUNT(*) FILTER (WHERE status = 'failed'),
    'cancelled_jobs', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'old_failed_jobs', COUNT(*) FILTER (WHERE status IN ('failed', 'cancelled') 
                                        AND (completed_at < now() - interval '7 days' 
                                             OR created_at < now() - interval '7 days'))
  ) INTO current_counts
  FROM batch_jobs;
  
  -- Get archive table counts
  SELECT jsonb_build_object(
    'archived_jobs', COALESCE(COUNT(*), 0),
    'archived_tasks', COALESCE((SELECT COUNT(*) FROM batch_tasks_archive), 0)
  ) INTO archive_counts
  FROM batch_jobs_archive;
  
  RETURN jsonb_build_object(
    'current', current_counts,
    'archived', archive_counts,
    'cleanup_recommended', (current_counts->>'old_failed_jobs')::integer > 0
  );
END;
$$;