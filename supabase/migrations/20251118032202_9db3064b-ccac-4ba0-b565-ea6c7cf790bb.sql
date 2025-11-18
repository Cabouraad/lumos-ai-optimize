-- Fix get_low_visibility_prompts to handle citations_json that may not be arrays
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
  last_checked_at timestamptz,
  top_citations jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Resolve org_id from caller if not provided
  IF p_org_id IS NULL THEN
    SELECT u.org_id INTO v_org_id
    FROM users u
    WHERE u.id = auth.uid();

    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'User not found or not authenticated';
    END IF;
  ELSE
    -- Verify caller has access to the requested org
    IF NOT EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.org_id = p_org_id
    ) THEN
      RAISE EXCEPTION 'Access denied to organization data';
    END IF;
    v_org_id := p_org_id;
  END IF;

  -- Compute prompt visibility over the last 14 days
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
      AND ppr.status IN ('success', 'completed')
      AND ppr.run_at >= now() - interval '14 days'
  ),
  prompt_stats AS (
    SELECT
      rr.prompt_id,
      COUNT(*) AS total_runs,
      ROUND(
        (SUM(CASE WHEN rr.org_brand_present THEN 1 ELSE 0 END)::numeric /
         NULLIF(COUNT(*), 0)::numeric) * 100,
        2
      ) AS presence_rate,
      AVG(rr.score) FILTER (WHERE rr.org_brand_present) AS avg_score_when_present,
      MAX(rr.run_at) AS last_checked_at,
      (
        SELECT jsonb_agg(DISTINCT citation)
        FROM (
          SELECT jsonb_array_elements_text(rr2.citations_json) AS citation
          FROM recent_responses rr2
          WHERE rr2.prompt_id = rr.prompt_id
            AND rr2.citations_json IS NOT NULL
            AND jsonb_typeof(rr2.citations_json) = 'array'
          LIMIT 5
        ) citations
      ) AS top_citations
    FROM recent_responses rr
    GROUP BY rr.prompt_id
    HAVING COUNT(*) >= 1
  )
  SELECT
    p.id AS prompt_id,
    p.text AS prompt_text,
    ps.total_runs,
    COALESCE(ps.presence_rate, 0) AS presence_rate,
    ps.avg_score_when_present,
    ps.last_checked_at,
    COALESCE(ps.top_citations, '[]'::jsonb) AS top_citations
  FROM prompts p
  INNER JOIN prompt_stats ps ON ps.prompt_id = p.id
  WHERE p.org_id = v_org_id
    AND p.active = true
    AND COALESCE(ps.presence_rate, 0) < 75
  ORDER BY ps.presence_rate ASC, ps.last_checked_at DESC
  LIMIT p_limit;
END;
$$;