-- Create leads table for exit-intent and other lead capture forms
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false
);

-- Create index on email for quick lookups
CREATE INDEX idx_leads_email ON public.leads(email);

-- Create index on source for analytics
CREATE INDEX idx_leads_source ON public.leads(source);

-- Create index on created_at for time-based queries
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Service role can manage all leads
CREATE POLICY "Service role can manage leads"
  ON public.leads
  FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- Allow anonymous inserts (for lead capture forms)
CREATE POLICY "Anyone can insert leads"
  ON public.leads
  FOR INSERT
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.leads IS 'Stores leads from various sources like exit-intent popups, lead magnets, etc.';