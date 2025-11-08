-- Create comprehensive citation analytics for digital marketers
CREATE OR REPLACE FUNCTION get_citation_performance_insights(
  p_org_id uuid DEFAULT NULL,
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  citation_url text,
  citation_domain text,
  citation_title text,
  content_type text,
  total_mentions bigint,
  unique_prompts bigint,
  avg_brand_visibility_score numeric,
  brand_present_rate numeric,
  first_cited timestamp with time zone,
  last_cited timestamp with time zone,
  is_own_domain boolean,
  providers jsonb,
  prompt_contexts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_org_domains text[];
BEGIN
  -- Resolve org_id
  IF p_org_id IS NULL THEN
    SELECT u.org_id INTO v_org_id FROM users u WHERE u.id = auth.uid();
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'User not found or has no org_id';
    END IF;
  ELSE
    v_org_id := p_org_id;
  END IF;

  -- Get organization domains
  v_org_domains := public.org_domain_set(v_org_id);

  RETURN QUERY
  WITH citations_expanded AS (
    SELECT
      ppr.id as response_id,
      ppr.prompt_id,
      ppr.provider,
      ppr.score,
      ppr.org_brand_present,
      ppr.run_at,
      cite.value->>'url' as url,
      cite.value->>'domain' as domain,
      cite.value->>'title' as title,
      COALESCE(cite.value->>'source_type', 'page') as source_type
    FROM prompt_provider_responses ppr
    CROSS JOIN LATERAL jsonb_array_elements(ppr.citations_json->'citations') AS cite
    WHERE ppr.org_id = v_org_id
      AND ppr.status IN ('completed', 'success')
      AND ppr.run_at >= (CURRENT_TIMESTAMP - (p_days || ' days')::interval)
      AND ppr.citations_json IS NOT NULL
      AND jsonb_array_length(ppr.citations_json->'citations') > 0
  ),
  citation_stats AS (
    SELECT
      ce.url,
      ce.domain,
      MAX(ce.title) as title,
      MAX(ce.source_type) as content_type,
      COUNT(*) as mentions,
      COUNT(DISTINCT ce.prompt_id) as unique_prompts,
      AVG(ce.score) as avg_score,
      SUM(CASE WHEN ce.org_brand_present THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100 as brand_rate,
      MIN(ce.run_at) as first_cited,
      MAX(ce.run_at) as last_cited,
      EXISTS (
        SELECT 1 FROM unnest(v_org_domains) od
        WHERE LOWER(ce.domain) LIKE '%' || LOWER(od) || '%'
      ) as is_own,
      jsonb_agg(DISTINCT ce.provider) as providers,
      jsonb_agg(DISTINCT jsonb_build_object(
        'prompt_id', ce.prompt_id,
        'score', ce.score,
        'brand_present', ce.org_brand_present
      )) as contexts
    FROM citations_expanded ce
    WHERE ce.url IS NOT NULL
    GROUP BY ce.url, ce.domain
  )
  SELECT
    cs.url,
    cs.domain,
    cs.title,
    cs.content_type,
    cs.mentions,
    cs.unique_prompts,
    ROUND(cs.avg_score, 2) as avg_brand_visibility_score,
    ROUND(cs.brand_rate, 1) as brand_present_rate,
    cs.first_cited,
    cs.last_cited,
    cs.is_own,
    cs.providers,
    cs.contexts
  FROM citation_stats cs
  ORDER BY cs.mentions DESC, cs.avg_score DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_citation_performance_insights(uuid, int, int) TO authenticated;

-- Create function for content type breakdown
CREATE OR REPLACE FUNCTION get_content_type_performance(
  p_org_id uuid DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS TABLE(
  content_category text,
  total_citations bigint,
  avg_brand_visibility numeric,
  unique_domains bigint,
  own_content_count bigint,
  competitor_content_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_org_domains text[];
BEGIN
  IF p_org_id IS NULL THEN
    SELECT u.org_id INTO v_org_id FROM users u WHERE u.id = auth.uid();
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'User not found or has no org_id';
    END IF;
  ELSE
    v_org_id := p_org_id;
  END IF;

  v_org_domains := public.org_domain_set(v_org_id);

  RETURN QUERY
  WITH citations_expanded AS (
    SELECT
      ppr.score,
      cite.value->>'url' as url,
      cite.value->>'domain' as domain,
      cite.value->>'title' as title,
      COALESCE(cite.value->>'source_type', 'page') as source_type
    FROM prompt_provider_responses ppr
    CROSS JOIN LATERAL jsonb_array_elements(ppr.citations_json->'citations') AS cite
    WHERE ppr.org_id = v_org_id
      AND ppr.status IN ('completed', 'success')
      AND ppr.run_at >= (CURRENT_TIMESTAMP - (p_days || ' days')::interval)
      AND ppr.citations_json IS NOT NULL
  ),
  categorized AS (
    SELECT
      CASE
        WHEN ce.url ~* '/(blog|article|news|post)/' THEN 'Blog/Article'
        WHEN ce.url ~* '/(product|shop|store|buy)/' THEN 'Product/Commerce'
        WHEN ce.url ~* '/(docs|documentation|guide|help|support)/' THEN 'Documentation'
        WHEN ce.url ~* '/(case-study|customer|success)/' THEN 'Case Study'
        WHEN ce.url ~* '/(about|company|team)/' THEN 'About/Company'
        WHEN ce.source_type = 'pdf' THEN 'PDF Resource'
        WHEN ce.source_type = 'video' THEN 'Video Content'
        WHEN ce.url = ce.domain OR ce.url ~* '^https?://[^/]+/?$' THEN 'Homepage'
        ELSE 'Other Content'
      END as category,
      ce.score,
      ce.domain,
      EXISTS (
        SELECT 1 FROM unnest(v_org_domains) od
        WHERE LOWER(ce.domain) LIKE '%' || LOWER(od) || '%'
      ) as is_own
    FROM citations_expanded ce
  )
  SELECT
    c.category,
    COUNT(*) as total,
    ROUND(AVG(c.score), 2) as avg_score,
    COUNT(DISTINCT c.domain) as domains,
    COUNT(*) FILTER (WHERE c.is_own) as own,
    COUNT(*) FILTER (WHERE NOT c.is_own) as competitor
  FROM categorized c
  GROUP BY c.category
  ORDER BY total DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_content_type_performance(uuid, int) TO authenticated;

-- Create function for citation competitive analysis
CREATE OR REPLACE FUNCTION get_citation_competitive_insights(
  p_org_id uuid DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS TABLE(
  domain text,
  domain_type text,
  total_citations bigint,
  content_types jsonb,
  avg_impact_score numeric,
  citation_trend text,
  top_cited_pages jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_org_domains text[];
BEGIN
  IF p_org_id IS NULL THEN
    SELECT u.org_id INTO v_org_id FROM users u WHERE u.id = auth.uid();
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'User not found or has no org_id';
    END IF;
  ELSE
    v_org_id := p_org_id;
  END IF;

  v_org_domains := public.org_domain_set(v_org_id);

  RETURN QUERY
  WITH citations_with_time AS (
    SELECT
      cite.value->>'domain' as domain,
      cite.value->>'url' as url,
      cite.value->>'title' as title,
      COALESCE(cite.value->>'source_type', 'page') as source_type,
      ppr.score,
      ppr.run_at,
      CASE
        WHEN ppr.run_at >= (CURRENT_TIMESTAMP - interval '7 days') THEN 'recent'
        ELSE 'older'
      END as time_period
    FROM prompt_provider_responses ppr
    CROSS JOIN LATERAL jsonb_array_elements(ppr.citations_json->'citations') AS cite
    WHERE ppr.org_id = v_org_id
      AND ppr.status IN ('completed', 'success')
      AND ppr.run_at >= (CURRENT_TIMESTAMP - (p_days || ' days')::interval)
      AND ppr.citations_json IS NOT NULL
  ),
  domain_analysis AS (
    SELECT
      cwt.domain,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM unnest(v_org_domains) od
          WHERE LOWER(cwt.domain) LIKE '%' || LOWER(od) || '%'
        ) THEN 'Your Content'
        WHEN public.is_competitor_domain(v_org_id, cwt.domain) THEN 'Competitor'
        ELSE 'Third Party'
      END as dtype,
      COUNT(*) as citations,
      jsonb_object_agg(cwt.source_type, COUNT(*)) as types,
      AVG(cwt.score) as impact,
      CASE
        WHEN COUNT(*) FILTER (WHERE cwt.time_period = 'recent')::numeric / NULLIF(COUNT(*), 0) > 0.6 THEN 'Growing'
        WHEN COUNT(*) FILTER (WHERE cwt.time_period = 'recent')::numeric / NULLIF(COUNT(*), 0) < 0.4 THEN 'Declining'
        ELSE 'Stable'
      END as trend,
      jsonb_agg(DISTINCT jsonb_build_object('url', cwt.url, 'title', cwt.title) ORDER BY cwt.run_at DESC) as pages
    FROM citations_with_time cwt
    WHERE cwt.domain IS NOT NULL
    GROUP BY cwt.domain
  )
  SELECT
    da.domain,
    da.dtype,
    da.citations,
    da.types,
    ROUND(da.impact, 2),
    da.trend,
    da.pages
  FROM domain_analysis da
  ORDER BY da.citations DESC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION get_citation_competitive_insights(uuid, int) TO authenticated;

COMMENT ON FUNCTION get_citation_performance_insights IS 'Returns detailed citation performance data for digital marketers to optimize content strategy';
COMMENT ON FUNCTION get_content_type_performance IS 'Analyzes which content types get cited most and their impact on brand visibility';
COMMENT ON FUNCTION get_citation_competitive_insights IS 'Provides competitive intelligence on citation patterns across domains';