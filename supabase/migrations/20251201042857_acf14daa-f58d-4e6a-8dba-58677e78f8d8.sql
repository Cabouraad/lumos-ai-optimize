
-- Update function to join responses with prompts for brand filtering
-- This works even if response.brand_id is NULL, using prompt.brand_id
CREATE OR REPLACE FUNCTION public.get_unified_dashboard_data(
  p_org_id uuid,
  p_brand_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  org_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM organizations WHERE id = p_org_id) INTO org_exists;
  
  IF NOT org_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Organization not found',
      'prompts', '[]'::jsonb,
      'responses', '[]'::jsonb,
      'chartData', '[]'::jsonb,
      'metrics', jsonb_build_object('avgScore', 0, 'totalRuns', 0, 'promptCount', 0, 'activePrompts', 0)
    );
  END IF;

  WITH prompt_data AS (
    SELECT 
      p.id,
      p.text,
      p.active,
      p.created_at,
      p.brand_id
    FROM prompts p
    WHERE p.org_id = p_org_id
      AND p.active = true
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
    ORDER BY p.created_at DESC
    LIMIT 200
  ),
  -- Get responses for prompts that belong to the selected brand
  response_data AS (
    SELECT 
      r.id,
      r.prompt_id,
      r.provider,
      r.model,
      r.score,
      r.org_brand_present,
      r.org_brand_prominence,
      r.competitors_count,
      r.competitors_json,
      r.brands_json,
      r.citations_json,
      r.run_at,
      r.status,
      r.brand_id as response_brand_id
    FROM prompt_provider_responses r
    INNER JOIN prompts p ON p.id = r.prompt_id
    WHERE r.org_id = p_org_id
      AND r.status IN ('success', 'completed')
      AND r.run_at >= NOW() - INTERVAL '30 days'
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
    ORDER BY r.run_at DESC
    LIMIT 1000
  ),
  chart_data AS (
    SELECT 
      DATE(r.run_at) as date,
      ROUND(AVG(r.score)::numeric, 1) as avg_score,
      COUNT(*) as run_count
    FROM prompt_provider_responses r
    INNER JOIN prompts p ON p.id = r.prompt_id
    WHERE r.org_id = p_org_id
      AND r.status IN ('success', 'completed')
      AND r.run_at >= NOW() - INTERVAL '30 days'
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
    GROUP BY DATE(r.run_at)
    ORDER BY DATE(r.run_at) ASC
  ),
  metrics AS (
    SELECT 
      COALESCE(ROUND(AVG(r.score)::numeric, 1), 0) as "avgScore",
      COUNT(*) as "totalRuns",
      COUNT(DISTINCT r.prompt_id) as "activePrompts"
    FROM prompt_provider_responses r
    INNER JOIN prompts p ON p.id = r.prompt_id
    WHERE r.org_id = p_org_id
      AND r.status IN ('success', 'completed')
      AND r.run_at >= NOW() - INTERVAL '30 days'
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
  ),
  prompt_count AS (
    SELECT COUNT(*) as cnt
    FROM prompts p
    WHERE p.org_id = p_org_id
      AND p.active = true
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
  )
  SELECT jsonb_build_object(
    'success', true,
    'prompts', COALESCE((SELECT jsonb_agg(row_to_json(pd)) FROM prompt_data pd), '[]'::jsonb),
    'responses', COALESCE((SELECT jsonb_agg(row_to_json(rd)) FROM response_data rd), '[]'::jsonb),
    'chartData', COALESCE((SELECT jsonb_agg(row_to_json(cd)) FROM chart_data cd), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'avgScore', (SELECT "avgScore" FROM metrics),
      'totalRuns', (SELECT "totalRuns" FROM metrics),
      'activePrompts', (SELECT "activePrompts" FROM metrics),
      'promptCount', (SELECT cnt FROM prompt_count)
    ),
    'timestamp', NOW()
  ) INTO result;

  RETURN result;
END;
$$;
