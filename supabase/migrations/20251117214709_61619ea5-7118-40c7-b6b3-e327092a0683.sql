-- Create table for tracking manually excluded competitors
CREATE TABLE IF NOT EXISTS public.org_competitor_exclusions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  excluded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  excluded_by UUID REFERENCES auth.users(id),
  UNIQUE(org_id, competitor_name)
);

-- Enable RLS
ALTER TABLE public.org_competitor_exclusions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view exclusions for their org
CREATE POLICY "Users can view their org exclusions"
  ON public.org_competitor_exclusions
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert exclusions for their org
CREATE POLICY "Users can create exclusions for their org"
  ON public.org_competitor_exclusions
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete exclusions for their org
CREATE POLICY "Users can delete exclusions for their org"
  ON public.org_competitor_exclusions
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Index for faster lookups
CREATE INDEX idx_org_competitor_exclusions_org_id ON public.org_competitor_exclusions(org_id);
CREATE INDEX idx_org_competitor_exclusions_competitor_name ON public.org_competitor_exclusions(competitor_name);