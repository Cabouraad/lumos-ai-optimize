-- Create function to get all cron jobs (needed for health monitoring)
CREATE OR REPLACE FUNCTION public.get_all_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  database text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $$
  SELECT 
    j.jobid,
    j.jobname::text,
    j.schedule::text,
    j.active,
    j.database::text
  FROM cron.job j
  ORDER BY j.jobid DESC;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_all_cron_jobs() TO service_role;

COMMENT ON FUNCTION public.get_all_cron_jobs() IS 'Returns all cron jobs for health monitoring';
