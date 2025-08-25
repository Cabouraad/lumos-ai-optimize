-- Create table to store batch run history
CREATE TABLE public.batch_run_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  prompts_processed INTEGER NOT NULL,
  successful_prompts INTEGER NOT NULL,
  success_rate NUMERIC NOT NULL,
  total_provider_runs INTEGER NOT NULL,
  successful_runs INTEGER NOT NULL,
  failed_runs INTEGER NOT NULL,
  run_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.batch_run_history ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own org's batch history
CREATE POLICY "Users can view their org's batch history" 
ON public.batch_run_history 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM users u 
  WHERE u.id = auth.uid() 
    AND u.org_id = batch_run_history.org_id
));

-- Create policy for service role to insert batch history
CREATE POLICY "Service role can insert batch history" 
ON public.batch_run_history 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Create index for performance
CREATE INDEX idx_batch_run_history_org_timestamp 
ON public.batch_run_history (org_id, run_timestamp DESC);