-- Function to calculate overall citation health score and metrics
CREATE OR REPLACE FUNCTION get_citation_health_dashboard(
  p_org_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  health_score INTEGER,
  total_citations INTEGER,
  avg_visibility_score NUMERIC,
  market_share_pct NUMERIC,
  week_over_week_change NUMERIC,
  total_own_citations INTEGER,
  total_competitor_citations INTEGER,
  trending_up BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_citations INTEGER;
  v_previous_citations INTEGER;
  v_total_all_citations INTEGER;
BEGIN
  -- Get current period metrics
  SELECT 
    COUNT(DISTINCT CASE WHEN c.is_own_domain THEN c.citation_url END),
    COUNT(DISTINCT CASE WHEN NOT c.is_own_domain THEN c.citation_url END),
    AVG(CASE WHEN c.is_own_domain THEN ppr.org_brand_prominence END),
    COUNT(DISTINCT c.citation_url)
  INTO 
    total_own_citations,
    total_competitor_citations,
    avg_visibility_score,
    v_current_citations
  FROM prompt_provider_responses ppr
  CROSS JOIN LATERAL jsonb_array_elements(ppr.citations_json) c(citation)
  LEFT JOIN LATERAL (
    SELECT EXISTS(
      SELECT 1 FROM brands b 
      WHERE b.org_id = p_org_id 
      AND c.citation_domain = b.domain
    ) as is_own_domain
  ) own ON true
  WHERE ppr.org_id = p_org_id
    AND ppr.run_at >= NOW() - (p_days || ' days')::INTERVAL
    AND ppr.status = 'completed'
    AND c.citation_url IS NOT NULL;

  -- Get previous period for comparison
  SELECT COUNT(DISTINCT c.citation_url)
  INTO v_previous_citations
  FROM prompt_provider_responses ppr
  CROSS JOIN LATERAL jsonb_array_elements(ppr.citations_json) c(citation)
  WHERE ppr.org_id = p_org_id
    AND ppr.run_at >= NOW() - (p_days * 2 || ' days')::INTERVAL
    AND ppr.run_at < NOW() - (p_days || ' days')::INTERVAL
    AND ppr.status = 'completed'
    AND c.citation_url IS NOT NULL;

  -- Calculate week over week change
  IF v_previous_citations > 0 THEN
    week_over_week_change := ((v_current_citations::NUMERIC - v_previous_citations::NUMERIC) / v_previous_citations::NUMERIC) * 100;
  ELSE
    week_over_week_change := 0;
  END IF;

  -- Calculate market share
  v_total_all_citations := total_own_citations + total_competitor_citations;
  IF v_total_all_citations > 0 THEN
    market_share_pct := (total_own_citations::NUMERIC / v_total_all_citations::NUMERIC) * 100;
  ELSE
    market_share_pct := 0;
  END IF;

  -- Calculate health score (0-100)
  health_score := LEAST(100, GREATEST(0, 
    (COALESCE(avg_visibility_score, 0) * 4)::INTEGER +
    (market_share_pct * 0.3)::INTEGER +
    (CASE 
      WHEN week_over_week_change > 20 THEN 30
      WHEN week_over_week_change > 10 THEN 25
      WHEN week_over_week_change > 0 THEN 20
      WHEN week_over_week_change > -10 THEN 15
      ELSE 10
    END)
  ));

  total_citations := v_current_citations;
  trending_up := week_over_week_change > 0;

  RETURN QUERY SELECT 
    health_score,
    total_citations,
    COALESCE(avg_visibility_score, 0),
    market_share_pct,
    week_over_week_change,
    total_own_citations,
    total_competitor_citations,
    trending_up;
END;
$$;

-- Function to generate AI-powered recommendations
CREATE OR REPLACE FUNCTION get_citation_recommendations(
  p_org_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  recommendation_type TEXT,
  title TEXT,
  description TEXT,
  expected_impact TEXT,
  difficulty TEXT,
  priority INTEGER,
  data_support JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH content_gaps AS (
    SELECT 
      c.content_type,
      COUNT(CASE WHEN NOT own.is_own_domain THEN 1 END) as competitor_count,
      COUNT(CASE WHEN own.is_own_domain THEN 1 END) as own_count,
      AVG(ppr.org_brand_prominence) as avg_score
    FROM prompt_provider_responses ppr
    CROSS JOIN LATERAL jsonb_array_elements(ppr.citations_json) c(citation)
    LEFT JOIN LATERAL (
      SELECT EXISTS(
        SELECT 1 FROM brands b 
        WHERE b.org_id = p_org_id 
        AND c.citation_domain = b.domain
      ) as is_own_domain
    ) own ON true
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= NOW() - (p_days || ' days')::INTERVAL
      AND ppr.status = 'completed'
    GROUP BY c.content_type
    HAVING COUNT(CASE WHEN NOT own.is_own_domain THEN 1 END) > COUNT(CASE WHEN own.is_own_domain THEN 1 END) * 2
  ),
  top_competitors AS (
    SELECT 
      c.citation_domain,
      COUNT(*) as citation_count
    FROM prompt_provider_responses ppr
    CROSS JOIN LATERAL jsonb_array_elements(ppr.citations_json) c(citation)
    LEFT JOIN LATERAL (
      SELECT EXISTS(
        SELECT 1 FROM brands b 
        WHERE b.org_id = p_org_id 
        AND c.citation_domain = b.domain
      ) as is_own_domain
    ) own ON true
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= NOW() - (p_days || ' days')::INTERVAL
      AND ppr.status = 'completed'
      AND NOT own.is_own_domain
    GROUP BY c.citation_domain
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
  SELECT 
    'content_gap'::TEXT as recommendation_type,
    ('Create More ' || cg.content_type || ' Content')::TEXT as title,
    ('Competitors have ' || cg.competitor_count || ' citations from ' || cg.content_type || ' content while you have only ' || cg.own_count || '. This content type has high visibility impact.')::TEXT as description,
    ('+' || ROUND((cg.competitor_count - cg.own_count) * 0.3) || ' potential citations')::TEXT as expected_impact,
    CASE 
      WHEN cg.content_type IN ('blog', 'article') THEN 'Easy'
      WHEN cg.content_type IN ('video', 'pdf') THEN 'Medium'
      ELSE 'Hard'
    END::TEXT as difficulty,
    1::INTEGER as priority,
    jsonb_build_object(
      'competitor_count', cg.competitor_count,
      'own_count', cg.own_count,
      'avg_score', ROUND(cg.avg_score::NUMERIC, 1)
    ) as data_support
  FROM content_gaps cg
  ORDER BY cg.competitor_count DESC
  LIMIT 1;
END;
$$;