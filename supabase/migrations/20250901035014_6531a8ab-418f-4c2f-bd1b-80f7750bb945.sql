-- Step 1: Database hardening for idempotency and deduplication

-- Create idempotent function for prompt provider responses
CREATE OR REPLACE FUNCTION public.upsert_prompt_provider_response(
  p_prompt_id uuid,
  p_provider text,
  p_org_id uuid,
  p_score numeric DEFAULT 0,
  p_org_brand_present boolean DEFAULT false,
  p_org_brand_prominence integer DEFAULT NULL,
  p_competitors_count integer DEFAULT 0,
  p_brands_json jsonb DEFAULT '[]'::jsonb,
  p_competitors_json jsonb DEFAULT '[]'::jsonb,
  p_token_in integer DEFAULT 0,
  p_token_out integer DEFAULT 0,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_model text DEFAULT NULL,
  p_status text DEFAULT 'success',
  p_raw_ai_response text DEFAULT NULL,
  p_raw_evidence text DEFAULT NULL,
  p_error text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  response_id uuid;
  existing_response RECORD;
BEGIN
  -- Check for existing response in the last 5 minutes
  SELECT id, metadata INTO existing_response
  FROM prompt_provider_responses
  WHERE prompt_id = p_prompt_id
    AND provider = p_provider
    AND run_at >= now() - interval '5 minutes'
  ORDER BY run_at DESC
  LIMIT 1;
  
  -- If we found a recent response with same analysis hash, update it
  IF existing_response IS NOT NULL AND 
     (existing_response.metadata->>'analysis_hash') = 
     (p_metadata->>'analysis_hash') AND
     (p_metadata->>'analysis_hash') IS NOT NULL THEN
    
    -- Update existing record
    UPDATE prompt_provider_responses 
    SET 
      run_at = now(),
      metadata = metadata || jsonb_build_object(
        'duplicate_prevented', true,
        'updated_at', now()
      )
    WHERE id = existing_response.id;
    
    RETURN existing_response.id;
  ELSE
    -- Insert new response
    INSERT INTO prompt_provider_responses (
      prompt_id, provider, org_id, score, org_brand_present,
      org_brand_prominence, competitors_count, brands_json,
      competitors_json, token_in, token_out, metadata,
      model, status, raw_ai_response, raw_evidence, error
    ) VALUES (
      p_prompt_id, p_provider, p_org_id, p_score, p_org_brand_present,
      p_org_brand_prominence, p_competitors_count, p_brands_json,
      p_competitors_json, p_token_in, p_token_out, p_metadata,
      p_model, p_status, p_raw_ai_response, p_raw_evidence, p_error
    ) RETURNING id INTO response_id;
    
    RETURN response_id;
  END IF;
END;
$function$;

-- Create unified RPC for dashboard data
CREATE OR REPLACE FUNCTION public.get_unified_dashboard_data(p_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  user_org_id uuid;
  dashboard_data jsonb;
  prompt_data jsonb[];
  response_data jsonb[];
  chart_data jsonb[];
  metrics_data jsonb;
BEGIN
  -- Get authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not authenticated');
  END IF;
  
  -- Use provided org_id or default to user's org_id
  IF p_org_id IS NULL THEN
    p_org_id := user_org_id;
  END IF;
  
  -- Security check
  IF p_org_id != user_org_id THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;
  
  -- Get prompts with 7-day stats
  SELECT array_agg(
    jsonb_build_object(
      'id', p.id,
      'text', p.text,
      'active', p.active,
      'created_at', p.created_at,
      'org_id', p.org_id,
      'runs_7d', COALESCE(stats.runs_7d, 0),
      'avg_score_7d', COALESCE(stats.avg_score_7d, 0)
    )
  ) INTO prompt_data
  FROM prompts p
  LEFT JOIN (
    SELECT 
      prompt_id,
      COUNT(*) as runs_7d,
      AVG(score) as avg_score_7d
    FROM prompt_provider_responses
    WHERE org_id = p_org_id
      AND status = 'success'
      AND run_at >= now() - interval '7 days'
    GROUP BY prompt_id
  ) stats ON stats.prompt_id = p.id
  WHERE p.org_id = p_org_id;
  
  -- Get recent responses (last 30 days)
  SELECT array_agg(
    jsonb_build_object(
      'id', ppr.id,
      'prompt_id', ppr.prompt_id,
      'provider', ppr.provider,
      'score', ppr.score,
      'org_brand_present', ppr.org_brand_present,
      'competitors_count', ppr.competitors_count,
      'run_at', ppr.run_at,
      'status', ppr.status
    )
  ) INTO response_data
  FROM prompt_provider_responses ppr
  WHERE ppr.org_id = p_org_id
    AND ppr.run_at >= now() - interval '30 days'
  ORDER BY ppr.run_at DESC;
  
  -- Get chart data (daily averages for last 30 days)
  WITH daily_scores AS (
    SELECT 
      DATE(run_at) as date,
      AVG(score) as avg_score,
      COUNT(*) as runs
    FROM prompt_provider_responses
    WHERE org_id = p_org_id
      AND status = 'success'
      AND run_at >= now() - interval '30 days'
    GROUP BY DATE(run_at)
    ORDER BY DATE(run_at)
  )
  SELECT array_agg(
    jsonb_build_object(
      'date', ds.date,
      'score', ROUND(ds.avg_score::numeric, 1),
      'runs', ds.runs
    )
  ) INTO chart_data
  FROM daily_scores ds;
  
  -- Calculate key metrics
  WITH metrics AS (
    SELECT
      -- Average score (last 7 days)
      (SELECT COALESCE(AVG(score), 0)
       FROM prompt_provider_responses
       WHERE org_id = p_org_id
         AND status = 'success'
         AND run_at >= now() - interval '7 days') as avg_score,
      
      -- Overall score (last 7 days)
      (SELECT COALESCE(AVG(score), 0)
       FROM prompt_provider_responses
       WHERE org_id = p_org_id
         AND status = 'success'
         AND run_at >= now() - interval '7 days') as overall_score,
      
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
              AND run_at >= now() - interval '7 days') as curr_avg,
           (SELECT COALESCE(AVG(score), 0)
            FROM prompt_provider_responses
            WHERE org_id = p_org_id
              AND status = 'success'
              AND run_at >= now() - interval '14 days'
              AND run_at < now() - interval '7 days') as prev_avg
       ) trend_calc) as trend,
      
      -- Prompt count
      (SELECT COUNT(*) FROM prompts WHERE org_id = p_org_id) as prompt_count,
      
      -- Total runs (last 30 days)
      (SELECT COUNT(*)
       FROM prompt_provider_responses
       WHERE org_id = p_org_id
         AND run_at >= now() - interval '30 days') as total_runs,
      
      -- Recent runs (last 7 days)
      (SELECT COUNT(*)
       FROM prompt_provider_responses
       WHERE org_id = p_org_id
         AND run_at >= now() - interval '7 days') as recent_runs
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
  
  -- Build final response
  SELECT jsonb_build_object(
    'success', true,
    'prompts', COALESCE(prompt_data, '[]'::jsonb),
    'responses', COALESCE(response_data, '[]'::jsonb),
    'chartData', COALESCE(chart_data, '[]'::jsonb),
    'metrics', metrics_data,
    'timestamp', now()
  ) INTO dashboard_data;
  
  RETURN dashboard_data;
END;
$function$;