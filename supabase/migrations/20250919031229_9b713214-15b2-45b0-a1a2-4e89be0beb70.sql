-- Create table for free checker leads
CREATE TABLE public.free_checker_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  domain text NOT NULL,
  company_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed boolean NOT NULL DEFAULT false,
  results_sent boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.free_checker_leads ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage leads
CREATE POLICY "Service role can manage free checker leads"
ON public.free_checker_leads
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create index for performance
CREATE INDEX idx_free_checker_leads_email ON public.free_checker_leads(email);
CREATE INDEX idx_free_checker_leads_created_at ON public.free_checker_leads(created_at DESC);