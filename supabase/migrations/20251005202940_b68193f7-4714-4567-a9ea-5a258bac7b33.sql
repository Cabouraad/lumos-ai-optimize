-- Revoke direct access to materialized view (prevent API exposure)
REVOKE ALL ON mv_low_visibility_prompts FROM authenticated;
REVOKE ALL ON mv_low_visibility_prompts FROM anon;

-- Grant access only to service role and postgres
GRANT SELECT ON mv_low_visibility_prompts TO service_role;

-- Create secure function wrapper for accessing low visibility prompts
CREATE OR REPLACE FUNCTION get_low_visibility_prompts(
  p_org_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  prompt_id UUID,
  prompt_text TEXT,
  total_runs BIGINT,
  presence_rate NUMERIC,
  avg_score_when_present NUMERIC,
  last_checked_at TIMESTAMPTZ,
  top_citations JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get user's org_id if not provided
  IF p_org_id IS NULL THEN
    SELECT u.org_id INTO v_org_id
    FROM users u
    WHERE u.id = auth.uid();
    
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'User not found or not authenticated';
    END IF;
  ELSE
    -- Verify user has access to requested org
    IF NOT EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
        AND u.org_id = p_org_id
    ) THEN
      RAISE EXCEPTION 'Access denied to organization data';
    END IF;
    v_org_id := p_org_id;
  END IF;

  -- Return data from materialized view
  RETURN QUERY
  SELECT 
    mv.prompt_id,
    mv.prompt_text,
    mv.total_runs,
    mv.presence_rate,
    mv.avg_score_when_present,
    mv.last_checked_at,
    mv.top_citations
  FROM mv_low_visibility_prompts mv
  WHERE mv.org_id = v_org_id
    AND mv.presence_rate < 75 -- Focus on low visibility
  ORDER BY mv.presence_rate ASC, mv.last_checked_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_low_visibility_prompts(UUID, INTEGER) TO authenticated;