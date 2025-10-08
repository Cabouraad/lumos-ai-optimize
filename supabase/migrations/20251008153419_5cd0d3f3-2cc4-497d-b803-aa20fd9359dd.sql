-- ===================================================================
-- FIX CRON JOB INFRASTRUCTURE
-- Creates missing functions and tables needed for cron management
-- ===================================================================

-- Create cron_schedule wrapper function
-- This allows edge functions to schedule cron jobs via RPC
CREATE OR REPLACE FUNCTION public.cron_schedule(
  job_name text,
  cron_schedule text,
  sql_command text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_id bigint;
BEGIN
  -- Call the pg_cron extension's schedule function
  SELECT cron.schedule(job_name, cron_schedule, sql_command) INTO job_id;
  RETURN job_id;
END;
$$;

-- Create cron_unschedule wrapper function
CREATE OR REPLACE FUNCTION public.cron_unschedule(
  job_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the pg_cron extension's unschedule function
  RETURN cron.unschedule(job_name);
END;
$$;

-- Create batch_jobs table for tracking batch processing
CREATE TABLE IF NOT EXISTS public.batch_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  total_tasks integer NOT NULL DEFAULT 0,
  completed_tasks integer NOT NULL DEFAULT 0,
  failed_tasks integer NOT NULL DEFAULT 0,
  providers text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  trigger_source text
);

-- Enable RLS on batch_jobs
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "batch_jobs_service_all"
  ON public.batch_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Org members can view their org's batch jobs
CREATE POLICY "batch_jobs_org_read"
  ON public.batch_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.org_id = batch_jobs.org_id
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_batch_jobs_org_id ON public.batch_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON public.batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_created_at ON public.batch_jobs(created_at DESC);

-- Add comment
COMMENT ON TABLE public.batch_jobs IS 'Tracks batch job execution for prompt processing';
COMMENT ON FUNCTION public.cron_schedule IS 'Wrapper function to schedule cron jobs via RPC';
COMMENT ON FUNCTION public.cron_unschedule IS 'Wrapper function to unschedule cron jobs via RPC';