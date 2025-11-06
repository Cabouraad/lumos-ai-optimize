-- Fix RLS policies for ai_sources and related views to prevent "invalid column" errors

-- Enable RLS on ai_sources table if not already enabled
ALTER TABLE public.ai_sources ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their org's AI sources" ON public.ai_sources;
DROP POLICY IF EXISTS "Users can insert their org's AI sources" ON public.ai_sources;
DROP POLICY IF EXISTS "Users can update their org's AI sources" ON public.ai_sources;

-- Create comprehensive RLS policies for ai_sources
CREATE POLICY "Users can view their org's AI sources"
  ON public.ai_sources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.org_id = ai_sources.org_id
    )
  );

CREATE POLICY "Users can insert their org's AI sources"
  ON public.ai_sources
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.org_id = ai_sources.org_id
    )
  );

CREATE POLICY "Users can update their org's AI sources"
  ON public.ai_sources
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.org_id = ai_sources.org_id
    )
  );

-- Grant necessary permissions
GRANT SELECT ON public.ai_sources TO authenticated;
GRANT SELECT ON public.ai_sources_top_domains TO authenticated;

-- Create a helper function to safely query ai_sources_top_domains
CREATE OR REPLACE FUNCTION public.get_ai_sources_top_domains(
  p_org_id uuid,
  p_brand_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  org_id uuid,
  brand_id uuid,
  domain text,
  total_citations bigint,
  model_count bigint,
  last_cited timestamp with time zone,
  models text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    v.org_id,
    v.brand_id,
    v.domain,
    v.total_citations,
    v.model_count,
    v.last_cited,
    v.models
  FROM ai_sources_top_domains v
  WHERE v.org_id = p_org_id
    AND (p_brand_id IS NULL OR v.brand_id = p_brand_id OR v.brand_id IS NULL)
  ORDER BY v.total_citations DESC
  LIMIT p_limit;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_ai_sources_top_domains(uuid, uuid, integer) TO authenticated;