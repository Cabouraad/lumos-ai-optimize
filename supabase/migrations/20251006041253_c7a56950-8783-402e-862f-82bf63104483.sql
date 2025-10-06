-- Fix get_low_visibility_prompts to query live data instead of deleted materialized view
CREATE OR REPLACE FUNCTION public.get_low_visibility_prompts(
  p_org_id uuid DEFAULT NULL::uuid, 
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
AS $function$
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

  -- Calculate low visibility prompts directly from responses
  RETURN QUERY
  WITH recent_responses AS (
    SELECT 
      ppr.prompt_id,
      ppr.org_brand_present,
      ppr.score,
      ppr.run_at,
      ppr.citations_json
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = v_org_id
      AND ppr.status = 'success'
      AND ppr.run_at >= now() - interval '14 days'
  ),
  prompt_stats AS (
    SELECT
      rr.prompt_id,
      COUNT(*) as total_runs,
      ROUND(
        (SUM(CASE WHEN rr.org_brand_present THEN 1 ELSE 0 END)::numeric / 
         NULLIF(COUNT(*), 0)::numeric) * 100, 
        2
      ) as presence_rate,
      AVG(rr.score) FILTER (WHERE rr.org_brand_present) as avg_score_when_present,
      MAX(rr.run_at) as last_checked_at,
      -- Collect top 5 most common citations
      (
        SELECT jsonb_agg(DISTINCT citation)
        FROM (
          SELECT jsonb_array_elements_text(rr2.citations_json) as citation
          FROM recent_responses rr2
          WHERE rr2.prompt_id = rr.prompt_id
            AND rr2.citations_json IS NOT NULL
          LIMIT 5
        ) citations
      ) as top_citations
    FROM recent_responses rr
    GROUP BY rr.prompt_id
    HAVING COUNT(*) >= 3  -- At least 3 runs
  )
  SELECT
    p.id as prompt_id,
    p.text as prompt_text,
    ps.total_runs,
    COALESCE(ps.presence_rate, 0) as presence_rate,
    ps.avg_score_when_present,
    ps.last_checked_at,
    COALESCE(ps.top_citations, '[]'::jsonb) as top_citations
  FROM prompts p
  INNER JOIN prompt_stats ps ON ps.prompt_id = p.id
  WHERE p.org_id = v_org_id
    AND p.active = true
    AND COALESCE(ps.presence_rate, 0) < 75  -- Low visibility threshold
  ORDER BY ps.presence_rate ASC, ps.last_checked_at DESC
  LIMIT p_limit;
END;
$function$;