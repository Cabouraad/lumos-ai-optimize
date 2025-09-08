-- Create function to get cron jobs status for diagnostics
CREATE OR REPLACE FUNCTION public.get_cron_jobs_status()
RETURNS TABLE(
  jobid BIGINT,
  jobname TEXT,
  schedule TEXT,
  command TEXT,
  nodename TEXT,
  nodeport INTEGER,
  database TEXT,
  username TEXT,
  active BOOLEAN
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    j.jobid,
    j.jobname,
    j.schedule,
    j.command,
    j.nodename,
    j.nodeport,
    j.database,
    j.username,
    j.active
  FROM cron.job j
  ORDER BY j.jobname;
$$;

-- Add an admin key setting for secure admin functions
INSERT INTO app_settings (key, value, description) 
VALUES ('admin_key', encode(gen_random_bytes(32), 'hex'), 'Admin access key for management functions')
ON CONFLICT (key) DO NOTHING;