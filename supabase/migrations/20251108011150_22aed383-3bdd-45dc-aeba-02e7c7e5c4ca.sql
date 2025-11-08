-- Get citation trends over time for sparkline visualizations
CREATE OR REPLACE FUNCTION get_citation_trends(
  p_org_id UUID,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  citation_url TEXT,
  trend_data JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH citation_daily AS (
    SELECT 
      c.citation_url,
      DATE(ppr.run_at) as date,
      COUNT(*) as daily_citations,
      AVG(ppr.org_brand_prominence) as avg_visibility
    FROM prompt_provider_responses ppr
    CROSS JOIN LATERAL jsonb_array_elements(ppr.citations_json) c(citation)
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= NOW() - (p_days || ' days')::INTERVAL
      AND ppr.status = 'completed'
      AND c.citation_url IS NOT NULL
    GROUP BY c.citation_url, DATE(ppr.run_at)
  ),
  top_citations AS (
    SELECT citation_url
    FROM citation_daily
    GROUP BY citation_url
    ORDER BY SUM(daily_citations) DESC
    LIMIT p_limit
  )
  SELECT 
    cd.citation_url,
    jsonb_build_object(
      'dates', jsonb_agg(cd.date ORDER BY cd.date),
      'citation_counts', jsonb_agg(cd.daily_citations ORDER BY cd.date),
      'visibility_scores', jsonb_agg(ROUND(cd.avg_visibility::numeric, 1) ORDER BY cd.date)
    ) as trend_data
  FROM citation_daily cd
  WHERE cd.citation_url IN (SELECT citation_url FROM top_citations)
  GROUP BY cd.citation_url;
END;
$$;