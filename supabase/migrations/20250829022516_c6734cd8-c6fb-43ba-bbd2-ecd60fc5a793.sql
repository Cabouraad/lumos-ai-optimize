-- Create scheduler_runs table for better observability
CREATE TABLE IF NOT EXISTS public.scheduler_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_key TEXT NOT NULL,
  function_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduler_runs ENABLE ROW LEVEL SECURITY;

-- RLS policy for scheduler_runs (service role only)
CREATE POLICY "scheduler_runs_service_only" 
ON public.scheduler_runs 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_scheduler_runs_function_date 
ON public.scheduler_runs(function_name, run_key, started_at DESC);

-- Clean up old runs (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_scheduler_runs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM scheduler_runs 
  WHERE started_at < now() - interval '30 days';
END;
$$;

-- Update scheduler_state to use 'global' consistently (some functions use 'main')
INSERT INTO public.scheduler_state (id, last_daily_run_key, last_daily_run_at)
VALUES ('global', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Migrate any existing 'main' records to 'global'
UPDATE public.scheduler_state 
SET id = 'global'
WHERE id = 'main' AND NOT EXISTS (
  SELECT 1 FROM public.scheduler_state WHERE id = 'global'
);

-- Remove duplicate 'main' record if 'global' exists
DELETE FROM public.scheduler_state 
WHERE id = 'main' AND EXISTS (
  SELECT 1 FROM public.scheduler_state WHERE id = 'global'
);