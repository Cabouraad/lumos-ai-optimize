-- Fix compute_llumos_score RPC: correct status filter and window
-- Status should be 'completed' not 'success', window should be 28 days

CREATE OR REPLACE FUNCTION public.compute_llumos_score(
  p_org_id UUID,
  p_prompt_id UUID DEFAULT NULL,
  p_brand_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_total_responses INT;
  v_brand_present_count INT;
  v_avg_prominence NUMERIC;
  v_distinct_prompts INT;
  v_provider_count INT;
  v_citation_count INT;
  v_competitor_mentions INT;
  v_pr NUMERIC; -- Presence Rate
  v_pp NUMERIC; -- Prominence Position
  v_cv NUMERIC; -- Coverage Variance
  v_ca NUMERIC; -- Citation Authority
  v_cs NUMERIC; -- Competitive Share
  v_fc NUMERIC; -- Freshness & Consistency
  v_composite NUMERIC;
  v_score INT;
  v_reason TEXT;
BEGIN
  -- Set window (last 28 days)
  v_window_end := NOW();
  v_window_start := NOW() - INTERVAL '28 days';

  -- Get response stats, filtering by brand via prompts table if brandId provided
  WITH filtered_responses AS (
    SELECT ppr.*
    FROM prompt_provider_responses ppr
    INNER JOIN prompts p ON p.id = ppr.prompt_id
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= v_window_start
      AND ppr.run_at <= v_window_end
      AND ppr.status = 'completed'
      AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
  )
  SELECT 
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE org_brand_present = TRUE)::INT,
    COALESCE(AVG(org_brand_prominence) FILTER (WHERE org_brand_present = TRUE), 0),
    COUNT(DISTINCT prompt_id)::INT,
    COUNT(DISTINCT provider)::INT,
    COALESCE(SUM(
      CASE 
        WHEN citations_json IS NOT NULL AND citations_json::TEXT != 'null' 
        THEN COALESCE(jsonb_array_length(
          CASE 
            WHEN jsonb_typeof(citations_json->'citations') = 'array' THEN citations_json->'citations'
            WHEN jsonb_typeof(citations_json) = 'array' THEN citations_json
            ELSE '[]'::jsonb
          END
        ), 0)
        ELSE 0 
      END
    ), 0)::INT,
    COALESCE(SUM(competitors_count), 0)::INT
  INTO 
    v_total_responses,
    v_brand_present_count,
    v_avg_prominence,
    v_distinct_prompts,
    v_provider_count,
    v_citation_count,
    v_competitor_mentions
  FROM filtered_responses;

  -- Handle insufficient data
  IF v_total_responses < 3 THEN
    RETURN jsonb_build_object(
      'score', 500,
      'composite', 50,
      'tier', 'Fair',
      'submetrics', jsonb_build_object(
        'pr', 50, 'pp', 50, 'cv', 50, 'ca', 50, 'cs', 50, 'fc', 50
      ),
      'window', jsonb_build_object('start', v_window_start, 'end', v_window_end),
      'reason', 'insufficient_data',
      'total_responses', v_total_responses
    );
  END IF;

  -- Calculate submetrics (0-100 scale each)
  
  -- PR: Presence Rate (brand mentioned / total responses)
  v_pr := LEAST(100, (v_brand_present_count::NUMERIC / v_total_responses) * 100);
  
  -- PP: Prominence Position (average prominence when present, scaled)
  v_pp := LEAST(100, GREATEST(0, 100 - COALESCE(v_avg_prominence, 10) * 10));
  
  -- CV: Coverage Variance (coverage across prompts and providers)
  v_cv := LEAST(100, (
    (v_distinct_prompts::NUMERIC / GREATEST(v_total_responses / 4, 1)) * 50 +
    (v_provider_count::NUMERIC / 4) * 50
  ));
  
  -- CA: Citation Authority (citations per response, capped)
  v_ca := LEAST(100, (v_citation_count::NUMERIC / v_total_responses) * 25);
  
  -- CS: Competitive Share (inverse of competitor dominance)
  v_cs := GREATEST(0, 100 - LEAST(100, (v_competitor_mentions::NUMERIC / v_total_responses) * 20));
  
  -- FC: Freshness (based on recent response distribution)
  WITH recent_activity AS (
    SELECT COUNT(*) as recent_count
    FROM prompt_provider_responses ppr
    INNER JOIN prompts p ON p.id = ppr.prompt_id
    WHERE ppr.org_id = p_org_id
      AND ppr.run_at >= NOW() - INTERVAL '7 days'
      AND ppr.status = 'completed'
      AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
  )
  SELECT LEAST(100, (recent_count::NUMERIC / GREATEST(v_total_responses / 4, 1)) * 100)
  INTO v_fc
  FROM recent_activity;

  -- Calculate composite (weighted average)
  v_composite := (
    v_pr * 0.30 +  -- Presence is most important
    v_pp * 0.24 +  -- Prominence position
    v_cv * 0.18 +  -- Coverage variance
    v_ca * 0.20 +  -- Citation authority
    v_cs * 0.18 +  -- Competitive share
    v_fc * 0.10    -- Freshness
  ) / 100;

  -- Scale to 300-900 range (like credit score)
  v_score := ROUND(300 + (v_composite * 600));
  
  -- Determine reason
  IF v_pr < 30 THEN
    v_reason := 'low_presence';
  ELSIF v_pp < 30 THEN
    v_reason := 'low_prominence';
  ELSIF v_cs < 30 THEN
    v_reason := 'high_competition';
  ELSE
    v_reason := 'calculated';
  END IF;

  RETURN jsonb_build_object(
    'score', v_score,
    'composite', ROUND(v_composite::NUMERIC * 100, 1),
    'tier', CASE
      WHEN v_score >= 760 THEN 'Excellent'
      WHEN v_score >= 700 THEN 'Very Good'
      WHEN v_score >= 640 THEN 'Good'
      WHEN v_score >= 580 THEN 'Fair'
      ELSE 'Needs Improvement'
    END,
    'submetrics', jsonb_build_object(
      'pr', ROUND(v_pr::NUMERIC, 1),
      'pp', ROUND(v_pp::NUMERIC, 1),
      'cv', ROUND(v_cv::NUMERIC, 1),
      'ca', ROUND(v_ca::NUMERIC, 1),
      'cs', ROUND(v_cs::NUMERIC, 1),
      'fc', ROUND(v_fc::NUMERIC, 1)
    ),
    'window', jsonb_build_object('start', v_window_start, 'end', v_window_end),
    'reason', v_reason,
    'total_responses', v_total_responses
  );
END;
$$;