-- Create scheduler_state table to track daily runs
CREATE TABLE IF NOT EXISTS public.scheduler_state (
  id TEXT PRIMARY KEY DEFAULT 'global',
  last_daily_run_key TEXT, -- YYYY-MM-DD in America/New_York timezone
  last_daily_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduler_state ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access (schedulers run as service)
CREATE POLICY "scheduler_state_service_access" 
ON public.scheduler_state 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Insert initial row
INSERT INTO public.scheduler_state (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_scheduler_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_scheduler_state_updated_at
  BEFORE UPDATE ON public.scheduler_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scheduler_state_updated_at();