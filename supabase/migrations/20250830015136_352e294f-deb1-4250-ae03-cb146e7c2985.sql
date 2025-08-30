-- Create brand_candidates table for managing potential competitor brands
CREATE TABLE IF NOT EXISTS public.brand_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  candidate_name TEXT NOT NULL,
  detection_count INTEGER NOT NULL DEFAULT 1,
  confidence_score NUMERIC NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  first_detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique candidates per org
  CONSTRAINT unique_candidate_per_org UNIQUE (org_id, candidate_name)
);

-- Enable RLS for brand_candidates
ALTER TABLE public.brand_candidates ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access candidates from their org
CREATE POLICY "brand_candidates_org_access" ON public.brand_candidates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.org_id = brand_candidates.org_id
    )
  );

-- Service role can manage all candidates
CREATE POLICY "brand_candidates_service_all" ON public.brand_candidates
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add updated_at trigger
CREATE TRIGGER update_brand_candidates_updated_at
  BEFORE UPDATE ON public.brand_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create index for better performance
CREATE INDEX idx_brand_candidates_org_status ON public.brand_candidates(org_id, status);
CREATE INDEX idx_brand_candidates_detection_count ON public.brand_candidates(detection_count DESC);