-- Fix search path issues for the increment functions
CREATE OR REPLACE FUNCTION increment_completed_tasks(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE batch_jobs 
  SET completed_tasks = completed_tasks + 1
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
  SET failed_tasks = failed_tasks + 1
  WHERE id = job_id;
END;
$$;