-- Optimize dashboard queries by adding indexes and setting statement timeout

-- 1. Add indexes to speed up the dashboard RPC queries (without time-based WHERE clauses)
CREATE INDEX IF NOT EXISTS idx_prompt_provider_responses_org_run 
ON prompt_provider_responses(org_id, run_at DESC) 
WHERE status = 'success';

CREATE INDEX IF NOT EXISTS idx_prompt_provider_responses_org_score 
ON prompt_provider_responses(org_id, score, run_at DESC) 
WHERE status = 'success';

CREATE INDEX IF NOT EXISTS idx_prompts_org_active 
ON prompts(org_id, active);

-- 2. Recreate the get_unified_dashboard_data function with statement timeout and optimizations
CREATE OR REPLACE FUNCTION get_unified_dashboard_data(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '30s' -- Prevent indefinite hangs
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

  -- Build unified response with optimized queries (14 days instead of 30)
  WITH prompts_data AS (
    SELECT 
      p.id,
      p.text,
      p.active,
      p.created_at
    FROM prompts p
    WHERE p.org_id = p_org_id
    ORDER BY p.created_at DESC
    LIMIT 100 -- Limit to prevent excessive data
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
      ppr.metadata
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= now() - interval '14 days' -- Reduced from 30 to 14 days
    ORDER BY ppr.run_at DESC
    LIMIT 500 -- Add limit to prevent excessive data
  ),
  chart_data AS (
    SELECT 
      date_trunc('day', ppr.run_at)::date AS date,
      AVG(ppr.score) as avg_score,
      COUNT(*) as response_count
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'success'
      AND ppr.run_at >= now() - interval '14 days'
    GROUP BY date_trunc('day', ppr.run_at)::date
    ORDER BY date
  ),
  metrics_data AS (
    SELECT
      -- Average score from last 7 days
      COALESCE(AVG(ppr.score) FILTER (WHERE ppr.run_at >= now() - interval '7 days' AND ppr.status = 'success'), 0) as avg_score,
      
      -- Overall score from recent data (last 14 days for performance)
      COALESCE(AVG(ppr.score) FILTER (WHERE ppr.status = 'success'), 0) as overall_score,
      
      -- Trend calculation (compare last 7 days vs previous 7 days)
      CASE 
        WHEN AVG(ppr.score) FILTER (WHERE ppr.run_at >= now() - interval '14 days' AND ppr.run_at < now() - interval '7 days' AND ppr.status = 'success') > 0 
        THEN ((AVG(ppr.score) FILTER (WHERE ppr.run_at >= now() - interval '7 days' AND ppr.status = 'success') - 
               AVG(ppr.score) FILTER (WHERE ppr.run_at >= now() - interval '14 days' AND ppr.run_at < now() - interval '7 days' AND ppr.status = 'success')) /
              AVG(ppr.score) FILTER (WHERE ppr.run_at >= now() - interval '14 days' AND ppr.run_at < now() - interval '7 days' AND ppr.status = 'success')) * 100
        ELSE 0
      END as trend,
      
      -- Prompt counts
      (SELECT COUNT(*) FROM prompts WHERE org_id = p_org_id) as prompt_count,
      (SELECT COUNT(*) FROM prompts WHERE org_id = p_org_id AND active = true) as active_prompts,
      (SELECT COUNT(*) FROM prompts WHERE org_id = p_org_id AND active = false) as inactive_prompts,
      
      -- Response counts from recent data
      COUNT(*) as total_runs,
      COUNT(*) FILTER (WHERE ppr.run_at >= now() - interval '7 days') as recent_runs_count
      
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= now() - interval '14 days'
  )
  SELECT jsonb_build_object(
    'success', true,
    'prompts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', pd.id,
      'text', pd.text,
      'active', pd.active,
      'created_at', pd.created_at
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
      'metadata', rd.metadata
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
    'timestamp', now()
  ) INTO result;
  
  RETURN result;
END;
$$;