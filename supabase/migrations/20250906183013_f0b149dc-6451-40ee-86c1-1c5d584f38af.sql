-- Update get_unified_dashboard_data to alias run_at as created_at for consistency
CREATE OR REPLACE FUNCTION public.get_unified_dashboard_data(p_org_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id uuid;
  dashboard_data jsonb;
  prompt_data jsonb := '[]'::jsonb;
  response_data jsonb := '[]'::jsonb;
  chart_data jsonb := '[]'::jsonb;
  metrics_data jsonb := '{}'::jsonb;
BEGIN
  -- Resolve org context from authenticated user
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();

  IF user_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  IF p_org_id IS NULL THEN
    p_org_id := user_org_id;
  END IF;

  IF p_org_id != user_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Prompts with 7-day stats
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'text', p.text,
        'active', p.active,
        'created_at', p.created_at,
        'org_id', p.org_id,
        'runs_7d', COALESCE(stats.runs_7d, 0),
        'avg_score_7d', COALESCE(stats.avg_score_7d, 0)
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO prompt_data
  FROM prompts p
  LEFT JOIN (
    SELECT 
      prompt_id,
      COUNT(*) AS runs_7d,
      AVG(score) AS avg_score_7d
    FROM prompt_provider_responses
    WHERE org_id = p_org_id
      AND status = 'success'
      AND run_at >= now() - interval '7 days'
    GROUP BY prompt_id
  ) stats ON stats.prompt_id = p.id
  WHERE p.org_id = p_org_id;

  -- Recent responses (last 30 days), ordered by recency
  -- Include both run_at and created_at (aliased) for consistency
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ppr.id,
        'prompt_id', ppr.prompt_id,
        'provider', ppr.provider,
        'score', ppr.score,
        'org_brand_present', ppr.org_brand_present,
        'competitors_count', ppr.competitors_count,
        'run_at', ppr.run_at,
        'created_at', ppr.run_at,
        'status', ppr.status
      )
      ORDER BY ppr.run_at DESC
    ),
    '[]'::jsonb
  )
  INTO response_data
  FROM prompt_provider_responses ppr
  WHERE ppr.org_id = p_org_id
    AND ppr.run_at >= now() - interval '30 days';

  -- Chart data (daily averages for last 30 days), ordered by date
  WITH daily_scores AS (
    SELECT 
      DATE(run_at) AS date,
      AVG(score) AS avg_score,
      COUNT(*) AS runs
    FROM prompt_provider_responses
    WHERE org_id = p_org_id
      AND status = 'success'
      AND run_at >= now() - interval '30 days'
    GROUP BY DATE(run_at)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date', ds.date,
        'score', ROUND(ds.avg_score::numeric, 1),
        'runs', ds.runs
      )
      ORDER BY ds.date
    ),
    '[]'::jsonb
  )
  INTO chart_data
  FROM daily_scores ds;

  -- Key metrics
  WITH metrics AS (
    SELECT
      -- Average score (last 7 days)
      (SELECT COALESCE(AVG(score), 0)
       FROM prompt_provider_responses
       WHERE org_id = p_org_id
         AND status = 'success'
         AND run_at >= now() - interval '7 days') AS avg_score,

      -- Overall score (last 7 days)
      (SELECT COALESCE(AVG(score), 0)
       FROM prompt_provider_responses
       WHERE org_id = p_org_id
         AND status = 'success'
         AND run_at >= now() - interval '7 days') AS overall_score,

      -- Trend calculation
      (SELECT 
         CASE 
           WHEN prev_avg > 0 THEN ((curr_avg - prev_avg) / prev_avg) * 100
           ELSE 0
         END
       FROM (
         SELECT 
           (SELECT COALESCE(AVG(score), 0)
            FROM prompt_provider_responses
            WHERE org_id = p_org_id
              AND status = 'success'
              AND run_at >= now() - interval '7 days') AS curr_avg,
           (SELECT COALESCE(AVG(score), 0)
            FROM prompt_provider_responses
            WHERE org_id = p_org_id
              AND status = 'success'
              AND run_at >= now() - interval '14 days'
              AND run_at < now() - interval '7 days') AS prev_avg
       ) trend_calc) AS trend,

      -- Prompt count
      (SELECT COUNT(*) FROM prompts WHERE org_id = p_org_id) AS prompt_count,

      -- Total runs (last 30 days)
      (SELECT COUNT(*)
       FROM prompt_provider_responses
       WHERE org_id = p_org_id
         AND run_at >= now() - interval '30 days') AS total_runs,

      -- Recent runs (last 7 days)
      (SELECT COUNT(*)
       FROM prompt_provider_responses
       WHERE org_id = p_org_id
         AND run_at >= now() - interval '7 days') AS recent_runs
  )
  SELECT jsonb_build_object(
    'avgScore', ROUND(m.avg_score::numeric, 1),
    'overallScore', ROUND(m.overall_score::numeric, 1),
    'trend', ROUND(m.trend::numeric, 1),
    'promptCount', m.prompt_count,
    'totalRuns', m.total_runs,
    'recentRunsCount', m.recent_runs
  ) INTO metrics_data
  FROM metrics m;

  -- Final response
  SELECT jsonb_build_object(
    'success', true,
    'prompts', COALESCE(prompt_data, '[]'::jsonb),
    'responses', COALESCE(response_data, '[]'::jsonb),
    'chartData', COALESCE(chart_data, '[]'::jsonb),
    'metrics', COALESCE(metrics_data, '{}'::jsonb),
    'timestamp', now()
  ) INTO dashboard_data;

  RETURN dashboard_data;
END;
$function$;