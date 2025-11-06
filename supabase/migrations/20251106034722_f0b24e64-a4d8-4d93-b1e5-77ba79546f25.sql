
-- Fix get_unified_dashboard_data to use 'completed' status instead of 'success'
-- The batch processor now writes 'completed' instead of 'success' after recent migrations

CREATE OR REPLACE FUNCTION public.get_unified_dashboard_data(
  p_org_id UUID,
  p_brand_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '30s'
AS $$
DECLARE
  result jsonb;
  user_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not authenticated or org_id not found'
    );
  END IF;
  
  -- Security: Only allow access to user's own org data
  IF p_org_id != user_org_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: Can only access own organization data'
    );
  END IF;

  -- Build unified response with brand filtering when specified
  WITH prompts_data AS (
    SELECT 
      p.id,
      p.text,
      p.active,
      p.created_at,
      p.brand_id
    FROM prompts p
    WHERE p.org_id = p_org_id
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id OR p.brand_id IS NULL)
    ORDER BY p.created_at DESC
    LIMIT 100
  ),
  responses_data AS (
    SELECT 
      ppr.id,
      ppr.prompt_id,
      ppr.provider,
      ppr.model,
      ppr.run_at,
      ppr.status,
      ppr.score,
      ppr.org_brand_present,
      ppr.org_brand_prominence,
      ppr.competitors_count,
      ppr.competitors_json,
      ppr.brands_json,
      ppr.citations_json,
      ppr.token_in,
      ppr.token_out,
      ppr.error,
      ppr.metadata,
      ppr.brand_id
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= now() - interval '14 days'
      AND (p_brand_id IS NULL OR ppr.brand_id = p_brand_id OR ppr.brand_id IS NULL)
    ORDER BY ppr.run_at DESC
    LIMIT 500
  ),
  chart_data AS (
    SELECT 
      date_trunc('day', ppr.run_at)::date AS date,
      AVG(ppr.score) as avg_score,
      COUNT(*) as response_count
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'completed'  -- FIXED: Changed from 'success' to 'completed'
      AND ppr.run_at >= now() - interval '14 days'
      AND (p_brand_id IS NULL OR ppr.brand_id = p_brand_id OR ppr.brand_id IS NULL)
    GROUP BY date_trunc('day', ppr.run_at)::date
    ORDER BY date
  ),
  metrics_data AS (
    SELECT
      COALESCE(AVG(ppr.score) FILTER (WHERE ppr.run_at >= now() - interval '7 days' AND ppr.status = 'completed'), 0) as avg_score,
      COALESCE(AVG(ppr.score) FILTER (WHERE ppr.status = 'completed'), 0) as overall_score,
      CASE 
        WHEN AVG(ppr.score) FILTER (WHERE ppr.run_at >= now() - interval '14 days' AND ppr.run_at < now() - interval '7 days' AND ppr.status = 'completed') > 0 
        THEN ((AVG(ppr.score) FILTER (WHERE ppr.run_at >= now() - interval '7 days' AND ppr.status = 'completed') - 
               AVG(ppr.score) FILTER (WHERE ppr.run_at >= now() - interval '14 days' AND ppr.run_at < now() - interval '7 days' AND ppr.status = 'completed')) /
              AVG(ppr.score) FILTER (WHERE ppr.run_at >= now() - interval '14 days' AND ppr.run_at < now() - interval '7 days' AND ppr.status = 'completed')) * 100
        ELSE 0
      END as trend,
      (SELECT COUNT(*) FROM prompts WHERE org_id = p_org_id AND (p_brand_id IS NULL OR brand_id = p_brand_id OR brand_id IS NULL)) as prompt_count,
      (SELECT COUNT(*) FROM prompts WHERE org_id = p_org_id AND active = true AND (p_brand_id IS NULL OR brand_id = p_brand_id OR brand_id IS NULL)) as active_prompts,
      (SELECT COUNT(*) FROM prompts WHERE org_id = p_org_id AND active = false AND (p_brand_id IS NULL OR brand_id = p_brand_id OR brand_id IS NULL)) as inactive_prompts,
      COUNT(*) as total_runs,
      COUNT(*) FILTER (WHERE ppr.run_at >= now() - interval '7 days') as recent_runs_count
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= now() - interval '14 days'
      AND (p_brand_id IS NULL OR ppr.brand_id = p_brand_id OR ppr.brand_id IS NULL)
  )
  SELECT jsonb_build_object(
    'success', true,
    'prompts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', pd.id,
      'text', pd.text,
      'active', pd.active,
      'created_at', pd.created_at,
      'brand_id', pd.brand_id
    )) FROM prompts_data pd), '[]'::jsonb),
    'responses', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', rd.id,
      'prompt_id', rd.prompt_id,
      'provider', rd.provider,
      'model', rd.model,
      'run_at', rd.run_at,
      'status', rd.status,
      'score', rd.score,
      'org_brand_present', rd.org_brand_present,
      'org_brand_prominence', rd.org_brand_prominence,
      'competitors_count', rd.competitors_count,
      'competitors_json', rd.competitors_json,
      'brands_json', rd.brands_json,
      'citations_json', rd.citations_json,
      'token_in', rd.token_in,
      'token_out', rd.token_out,
      'error', rd.error,
      'metadata', rd.metadata,
      'brand_id', rd.brand_id
    )) FROM responses_data rd), '[]'::jsonb),
    'chartData', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'date', cd.date,
      'avgScore', cd.avg_score,
      'responseCount', cd.response_count
    )) FROM chart_data cd), '[]'::jsonb),
    'metrics', (SELECT jsonb_build_object(
      'avgScore', COALESCE(m.avg_score, 0),
      'overallScore', COALESCE(m.overall_score, 0),
      'trend', COALESCE(m.trend, 0),
      'promptCount', COALESCE(m.prompt_count, 0),
      'activePrompts', COALESCE(m.active_prompts, 0),
      'inactivePrompts', COALESCE(m.inactive_prompts, 0),
      'totalRuns', COALESCE(m.total_runs, 0),
      'recentRunsCount', COALESCE(m.recent_runs_count, 0)
    ) FROM metrics_data m),
    'timestamp', now(),
    'brandId', p_brand_id
  ) INTO result;
  
  RETURN result;
END;
$$;
