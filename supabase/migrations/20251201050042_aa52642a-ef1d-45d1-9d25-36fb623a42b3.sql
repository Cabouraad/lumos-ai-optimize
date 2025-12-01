-- Update citation RPCs to support brand filtering via prompts table

-- 1. Update get_citation_health_dashboard to support brand filtering
CREATE OR REPLACE FUNCTION public.get_citation_health_dashboard(
  p_org_id UUID,
  p_days INT DEFAULT 30,
  p_brand_id UUID DEFAULT NULL
)
RETURNS TABLE (
  health_score NUMERIC,
  total_citations BIGINT,
  avg_visibility_score NUMERIC,
  market_share_pct NUMERIC,
  week_over_week_change NUMERIC,
  total_own_citations BIGINT,
  total_competitor_citations BIGINT,
  trending_up BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_responses AS (
    SELECT ppr.*
    FROM prompt_provider_responses ppr
    INNER JOIN prompts p ON p.id = ppr.prompt_id
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= NOW() - (p_days || ' days')::INTERVAL
      AND ppr.status = 'success'
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
  ),
  citation_stats AS (
    SELECT
      COUNT(DISTINCT CASE WHEN citations_json IS NOT NULL THEN id END) as total_citations,
      AVG(score) as avg_visibility,
      COUNT(*) FILTER (WHERE org_brand_present) as own_mentions,
      COUNT(*) FILTER (WHERE NOT org_brand_present) as competitor_mentions
    FROM filtered_responses
  ),
  recent_stats AS (
    SELECT COUNT(*) as recent_count
    FROM filtered_responses
    WHERE run_at >= NOW() - INTERVAL '7 days'
  ),
  older_stats AS (
    SELECT COUNT(*) as older_count
    FROM filtered_responses
    WHERE run_at >= NOW() - INTERVAL '14 days'
      AND run_at < NOW() - INTERVAL '7 days'
  )
  SELECT
    LEAST(100, COALESCE(cs.avg_visibility * 10, 0))::NUMERIC as health_score,
    COALESCE(cs.total_citations, 0)::BIGINT as total_citations,
    COALESCE(cs.avg_visibility, 0)::NUMERIC as avg_visibility_score,
    CASE WHEN cs.own_mentions + cs.competitor_mentions > 0 
         THEN (cs.own_mentions::NUMERIC / (cs.own_mentions + cs.competitor_mentions) * 100)
         ELSE 0 END::NUMERIC as market_share_pct,
    CASE WHEN os.older_count > 0 
         THEN ((rs.recent_count - os.older_count)::NUMERIC / os.older_count * 100)
         ELSE 0 END::NUMERIC as week_over_week_change,
    COALESCE(cs.own_mentions, 0)::BIGINT as total_own_citations,
    COALESCE(cs.competitor_mentions, 0)::BIGINT as total_competitor_citations,
    (rs.recent_count >= os.older_count)::BOOLEAN as trending_up
  FROM citation_stats cs
  CROSS JOIN recent_stats rs
  CROSS JOIN older_stats os;
END;
$$;

-- 2. Update get_citation_recommendations to support brand filtering
CREATE OR REPLACE FUNCTION public.get_citation_recommendations(
  p_org_id UUID,
  p_days INT DEFAULT 30,
  p_brand_id UUID DEFAULT NULL
)
RETURNS TABLE (
  recommendation_type TEXT,
  title TEXT,
  description TEXT,
  expected_impact TEXT,
  difficulty TEXT,
  priority INT,
  data_support JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_responses AS (
    SELECT ppr.*
    FROM prompt_provider_responses ppr
    INNER JOIN prompts p ON p.id = ppr.prompt_id
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= NOW() - (p_days || ' days')::INTERVAL
      AND ppr.status = 'success'
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
  ),
  stats AS (
    SELECT
      COUNT(*) as total_responses,
      COUNT(*) FILTER (WHERE org_brand_present) as brand_present_count,
      AVG(score) as avg_score
    FROM filtered_responses
  )
  SELECT
    'visibility'::TEXT as recommendation_type,
    'Improve AI Visibility'::TEXT as title,
    'Focus on creating content that answers common AI queries'::TEXT as description,
    'High'::TEXT as expected_impact,
    'Medium'::TEXT as difficulty,
    1::INT as priority,
    jsonb_build_object(
      'total_responses', s.total_responses,
      'brand_present_rate', CASE WHEN s.total_responses > 0 
        THEN ROUND((s.brand_present_count::NUMERIC / s.total_responses) * 100, 1) 
        ELSE 0 END
    ) as data_support
  FROM stats s;
END;
$$;

-- 3. Update get_content_type_performance to support brand filtering
CREATE OR REPLACE FUNCTION public.get_content_type_performance(
  p_days INT DEFAULT 30,
  p_org_id UUID DEFAULT NULL,
  p_brand_id UUID DEFAULT NULL
)
RETURNS TABLE (
  content_category TEXT,
  total_citations BIGINT,
  avg_brand_visibility NUMERIC,
  unique_domains BIGINT,
  own_content_count BIGINT,
  competitor_content_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get org_id from current user if not provided
  IF p_org_id IS NULL THEN
    SELECT org_id INTO v_org_id
    FROM users
    WHERE id = auth.uid();
  ELSE
    v_org_id := p_org_id;
  END IF;

  RETURN QUERY
  SELECT
    'general'::TEXT as content_category,
    COUNT(*)::BIGINT as total_citations,
    AVG(ppr.score)::NUMERIC as avg_brand_visibility,
    COUNT(DISTINCT ppr.provider)::BIGINT as unique_domains,
    COUNT(*) FILTER (WHERE ppr.org_brand_present)::BIGINT as own_content_count,
    COUNT(*) FILTER (WHERE NOT ppr.org_brand_present)::BIGINT as competitor_content_count
  FROM prompt_provider_responses ppr
  INNER JOIN prompts p ON p.id = ppr.prompt_id
  WHERE ppr.org_id = v_org_id
    AND ppr.run_at >= NOW() - (p_days || ' days')::INTERVAL
    AND ppr.status = 'success'
    AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
  GROUP BY 1;
END;
$$;

-- 4. Update get_citation_competitive_insights to support brand filtering
CREATE OR REPLACE FUNCTION public.get_citation_competitive_insights(
  p_days INT DEFAULT 30,
  p_org_id UUID DEFAULT NULL,
  p_brand_id UUID DEFAULT NULL
)
RETURNS TABLE (
  domain TEXT,
  domain_type TEXT,
  total_citations BIGINT,
  content_types JSONB,
  avg_impact_score NUMERIC,
  citation_trend TEXT,
  top_cited_pages JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get org_id from current user if not provided
  IF p_org_id IS NULL THEN
    SELECT org_id INTO v_org_id
    FROM users
    WHERE id = auth.uid();
  ELSE
    v_org_id := p_org_id;
  END IF;

  RETURN QUERY
  SELECT
    ppr.provider::TEXT as domain,
    CASE WHEN ppr.org_brand_present THEN 'own' ELSE 'competitor' END::TEXT as domain_type,
    COUNT(*)::BIGINT as total_citations,
    '{}'::JSONB as content_types,
    AVG(ppr.score)::NUMERIC as avg_impact_score,
    'stable'::TEXT as citation_trend,
    '[]'::JSONB as top_cited_pages
  FROM prompt_provider_responses ppr
  INNER JOIN prompts p ON p.id = ppr.prompt_id
  WHERE ppr.org_id = v_org_id
    AND ppr.run_at >= NOW() - (p_days || ' days')::INTERVAL
    AND ppr.status = 'success'
    AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
  GROUP BY ppr.provider, ppr.org_brand_present;
END;
$$;

-- 5. Update get_citation_performance_insights to support brand filtering
CREATE OR REPLACE FUNCTION public.get_citation_performance_insights(
  p_days INT DEFAULT 30,
  p_limit INT DEFAULT 100,
  p_org_id UUID DEFAULT NULL,
  p_brand_id UUID DEFAULT NULL
)
RETURNS TABLE (
  citation_url TEXT,
  citation_domain TEXT,
  citation_title TEXT,
  content_type TEXT,
  total_mentions BIGINT,
  unique_prompts BIGINT,
  avg_brand_visibility_score NUMERIC,
  brand_present_rate NUMERIC,
  is_own_domain BOOLEAN,
  providers TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get org_id from current user if not provided
  IF p_org_id IS NULL THEN
    SELECT org_id INTO v_org_id
    FROM users
    WHERE id = auth.uid();
  ELSE
    v_org_id := p_org_id;
  END IF;

  RETURN QUERY
  SELECT
    ''::TEXT as citation_url,
    ppr.provider::TEXT as citation_domain,
    ''::TEXT as citation_title,
    'general'::TEXT as content_type,
    COUNT(*)::BIGINT as total_mentions,
    COUNT(DISTINCT ppr.prompt_id)::BIGINT as unique_prompts,
    AVG(ppr.score)::NUMERIC as avg_brand_visibility_score,
    (COUNT(*) FILTER (WHERE ppr.org_brand_present)::NUMERIC / NULLIF(COUNT(*), 0) * 100)::NUMERIC as brand_present_rate,
    FALSE::BOOLEAN as is_own_domain,
    ARRAY_AGG(DISTINCT ppr.provider)::TEXT[] as providers
  FROM prompt_provider_responses ppr
  INNER JOIN prompts p ON p.id = ppr.prompt_id
  WHERE ppr.org_id = v_org_id
    AND ppr.run_at >= NOW() - (p_days || ' days')::INTERVAL
    AND ppr.status = 'success'
    AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
  GROUP BY ppr.provider
  LIMIT p_limit;
END;
$$;

-- 6. Update get_citation_trends to support brand filtering
CREATE OR REPLACE FUNCTION public.get_citation_trends(
  p_org_id UUID,
  p_days INT DEFAULT 30,
  p_limit INT DEFAULT 100,
  p_brand_id UUID DEFAULT NULL
)
RETURNS TABLE (
  citation_url TEXT,
  trend_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ppr.provider::TEXT as citation_url,
    jsonb_build_object(
      'dates', ARRAY_AGG(DISTINCT DATE(ppr.run_at)::TEXT ORDER BY DATE(ppr.run_at)::TEXT),
      'citation_counts', ARRAY_AGG(1),
      'visibility_scores', ARRAY_AGG(ppr.score)
    ) as trend_data
  FROM prompt_provider_responses ppr
  INNER JOIN prompts p ON p.id = ppr.prompt_id
  WHERE ppr.org_id = p_org_id
    AND ppr.run_at >= NOW() - (p_days || ' days')::INTERVAL
    AND ppr.status = 'success'
    AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
  GROUP BY ppr.provider
  LIMIT p_limit;
END;
$$;