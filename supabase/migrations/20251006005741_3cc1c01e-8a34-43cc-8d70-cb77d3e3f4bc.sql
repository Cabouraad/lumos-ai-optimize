-- Create a service-role-only internal helper to fetch low visibility prompts without auth.uid() dependency
-- Ensures edge functions using the service client can always fetch prompt candidates
CREATE OR REPLACE FUNCTION public.get_low_visibility_prompts_internal(
  p_org_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  prompt_id uuid,
  prompt_text text,
  total_runs bigint,
  presence_rate numeric,
  avg_score_when_present numeric,
  last_checked_at timestamp with time zone,
  top_citations jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Restrict usage to service role only for safety
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service-only function';
  END IF;

  RETURN QUERY
  SELECT 
    mv.prompt_id,
    mv.prompt_text,
    COALESCE(mv.total_runs, 0)::bigint as total_runs,
    COALESCE(mv.presence_rate, 0) as presence_rate,
    COALESCE(mv.avg_score_when_present, 0) as avg_score_when_present,
    mv.last_checked_at,
    COALESCE(mv.top_citations, '[]'::jsonb) as top_citations
  FROM mv_low_visibility_prompts mv
  WHERE mv.org_id = p_org_id
    AND COALESCE(mv.presence_rate, 0) < 75
  ORDER BY mv.presence_rate ASC NULLS FIRST, mv.last_checked_at DESC NULLS LAST
  LIMIT LEAST(COALESCE(p_limit, 20), 100);
END;
$$;