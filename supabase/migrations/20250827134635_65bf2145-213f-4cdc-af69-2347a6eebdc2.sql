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

-- Unschedule existing cron jobs that might be running at wrong times
SELECT cron.unschedule('daily-batch-12am-est');
SELECT cron.unschedule('daily-scheduler-3am-est');
SELECT cron.unschedule('invoke-daily-batch-trigger');
SELECT cron.unschedule('invoke-daily-scheduler');

-- Create new cron jobs with proper timing and secret handling
-- 12AM EST/EDT (4:00 UTC EST, 5:00 UTC EDT) - Daily Batch Trigger
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

-- 12AM EDT (5:00 UTC EDT) - Daily Batch Trigger for Daylight Saving Time
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

-- 3AM EST/EDT (7:00 UTC EST, 8:00 UTC EDT) - Daily Scheduler
SELECT cron.schedule(
  'daily-scheduler-3am-est',
  '0 7 * * *', -- 7:00 UTC (3AM EST)
  $$
  SELECT
    net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE((SELECT value FROM public.app_settings WHERE key = 'cron_secret'), '')
      ),
      body := jsonb_build_object('trigger_time', now())
    ) as request_id;
  $$
);

-- 3AM EDT (8:00 UTC EDT) - Daily Scheduler for Daylight Saving Time
SELECT cron.schedule(
  'daily-scheduler-3am-edt',
  '0 8 * * *', -- 8:00 UTC (3AM EDT)
  $$
  SELECT
    net.http_post(
      url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE((SELECT value FROM public.app_settings WHERE key = 'cron_secret'), '')
      ),
      body := jsonb_build_object('trigger_time', now())
    ) as request_id;
  $$
);