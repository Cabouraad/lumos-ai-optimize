-- scheduler_state stores last run key for America/New_York day
CREATE TABLE IF NOT EXISTS public.scheduler_state (
  id text PRIMARY KEY DEFAULT 'global',
  last_daily_run_key text,           -- e.g., '2025-08-16' (NY date)
  last_daily_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_scheduler_state_updated_at ON public.scheduler_state;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER trg_scheduler_state_updated_at
BEFORE UPDATE ON public.scheduler_state
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable Row Level Security
ALTER TABLE public.scheduler_state ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access (Edge Functions need this)
CREATE POLICY "scheduler_state_service_access" 
ON public.scheduler_state 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Seed the global row
INSERT INTO public.scheduler_state (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;