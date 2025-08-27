-- Create scheduler_state table for preventing duplicate runs
CREATE TABLE public.scheduler_state (
  id text PRIMARY KEY,
  last_daily_run_key text,
  last_daily_run_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create app_settings table for storing configuration
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduler_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can access these tables
CREATE POLICY "scheduler_state_service_only" ON public.scheduler_state
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "app_settings_service_only" ON public.app_settings
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Insert initial scheduler state
INSERT INTO public.scheduler_state (id, last_daily_run_key, last_daily_run_at)
VALUES ('main', null, null);

-- Create new cron jobs with proper timing and secret handling
-- 12AM EST (4:00 UTC) - Daily Batch Trigger
SELECT cron.schedule(
  'daily-batch-midnight-est',
  '0 4 * * *', -- 4:00 UTC (12AM EST)
  $$
  SELECT
    net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE((SELECT value FROM public.app_settings WHERE key = 'cron_secret'), '')
      ),
      body := jsonb_build_object('trigger_time', now())
    ) as request_id;
  $$
);

-- 12AM EDT (5:00 UTC) - Daily Batch Trigger for Daylight Saving Time
SELECT cron.schedule(
  'daily-batch-midnight-edt',
  '0 5 * * *', -- 5:00 UTC (12AM EDT)
  $$
  SELECT
    net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-batch-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE((SELECT value FROM public.app_settings WHERE key = 'cron_secret'), '')
      ),
      body := jsonb_build_object('trigger_time', now())
    ) as request_id;
  $$
);