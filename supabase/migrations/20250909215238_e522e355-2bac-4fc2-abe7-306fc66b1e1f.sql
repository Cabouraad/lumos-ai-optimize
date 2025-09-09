-- Create scheduler_runs table for tracking weekly report generation
CREATE TABLE IF NOT EXISTS public.scheduler_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type text NOT NULL,
  job_name text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  result_summary jsonb,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add RLS for scheduler_runs
ALTER TABLE public.scheduler_runs ENABLE ROW LEVEL SECURITY;

-- Only service role can manage scheduler runs
CREATE POLICY "Service role can manage scheduler runs" ON public.scheduler_runs
  FOR ALL USING (auth.role() = 'service_role');

-- Add index for efficient querying
CREATE INDEX idx_scheduler_runs_job_type_started ON public.scheduler_runs (job_type, started_at DESC);

-- Create weekly report scheduler cron job (Mondays at 08:10 UTC)
SELECT cron.schedule(
  'weekly-report-scheduler',
  '10 8 * * 1',  -- Every Monday at 08:10 UTC
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT get_cron_secret())
    ),
    body := jsonb_build_object('scheduled', true, 'timestamp', now())
  );
  $$
);

-- Sync the CRON_SECRET to app_settings for use in cron jobs
INSERT INTO public.app_settings (key, value, description)
VALUES ('cron_secret', '', 'Secret for authenticating cron job requests')
ON CONFLICT (key) DO NOTHING;