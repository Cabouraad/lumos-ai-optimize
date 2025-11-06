-- Fix Llumos Score Status Check - Change from 'success' to 'completed'
-- The compute_llumos_score function was checking for status = 'success' 
-- but responses actually have status = 'completed'

DROP FUNCTION IF EXISTS public.compute_llumos_score(UUID, UUID);

CREATE OR REPLACE FUNCTION public.compute_llumos_score(
  p_org_id UUID,
  p_prompt_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope TEXT;
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_window_end TIMESTAMP WITH TIME ZONE;
  v_prev_window_start TIMESTAMP WITH TIME ZONE;
  
  v_total_responses INTEGER;
  v_org_domains TEXT[];
  v_enable_ca boolean;
  
  -- Submetrics
  v_pr NUMERIC;
  v_pp NUMERIC;
  v_cv NUMERIC;
  v_ca NUMERIC;
  v_cs NUMERIC;
  v_fc NUMERIC;
  
  v_composite NUMERIC;
  v_llumos_score INTEGER;
  v_submetrics JSONB;
  v_reason TEXT;
BEGIN
  v_scope := CASE WHEN p_prompt_id IS NULL THEN 'org' ELSE 'prompt' END;
  
  -- Check if CA scoring is enabled for this org
  SELECT enable_ca_scoring INTO v_enable_ca
  FROM public.organizations
  WHERE id = p_org_id;
  
  v_enable_ca := COALESCE(v_enable_ca, false);
  
  -- Use rolling 28-day window
  v_window_end := now();
  v_window_start := v_window_end - interval '28 days';
  v_prev_window_start := v_window_start - interval '28 days';
  
  RAISE NOTICE '[LlumosScore] Computing for org=%, scope=%, window=[% to %], CA enabled=%', 
    p_org_id, v_scope, v_window_start, v_window_end, v_enable_ca;
  
  v_org_domains := public.org_domain_set(p_org_id);
  
  -- FIXED: Changed from 'success' to 'completed'
  SELECT COUNT(*)
  INTO v_total_responses
  FROM public.prompt_provider_responses ppr
  WHERE ppr.org_id = p_org_id
    AND ppr.status = 'completed'
    AND ppr.run_at >= v_window_start
    AND ppr.run_at < v_window_end
    AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id);
  
  RAISE NOTICE '[LlumosScore] Found % total responses', v_total_responses;
  
  IF v_total_responses < 3 THEN
    v_reason := 'insufficient_data';
    v_pr := 50; v_pp := 50; v_cv := 50; v_ca := 50; v_cs := 50; v_fc := 50;
    v_composite := 50;
    v_llumos_score := 500;
    
    RAISE NOTICE '[LlumosScore] Insufficient data (< 3 responses), returning default score 500';
  ELSE
    -- 1. PR: Presence Rate
    SELECT 
      COALESCE(
        (COUNT(*) FILTER (WHERE ppr.org_brand_present = true)::NUMERIC / 
         NULLIF(COUNT(*), 0)::NUMERIC) * 100,
        0
      )
    INTO v_pr
    FROM public.prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'completed'
      AND ppr.run_at >= v_window_start
      AND ppr.run_at < v_window_end
      AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id);
    
    RAISE NOTICE '[LlumosScore] PR (Presence Rate) = %', ROUND(v_pr, 1);
    
    -- 2. PP: Prominence Position
    SELECT 
      COALESCE(
        100 - LEAST(
          (AVG(ppr.org_brand_prominence) FILTER (WHERE ppr.org_brand_present = true AND ppr.org_brand_prominence IS NOT NULL) * 10),
          100
        ),
        0
      )
    INTO v_pp
    FROM public.prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'completed'
      AND ppr.run_at >= v_window_start
      AND ppr.run_at < v_window_end
      AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id);
    
    RAISE NOTICE '[LlumosScore] PP (Prominence Position) = %', ROUND(v_pp, 1);
    
    -- 3. CV: Coverage Variance
    IF v_scope = 'org' THEN
      WITH prompt_presence AS (
        SELECT 
          ppr.prompt_id,
          COUNT(*) FILTER (WHERE ppr.org_brand_present = true)::NUMERIC / 
            NULLIF(COUNT(*), 0)::NUMERIC as presence_rate
        FROM public.prompt_provider_responses ppr
        WHERE ppr.org_id = p_org_id
          AND ppr.status = 'completed'
          AND ppr.run_at >= v_window_start
          AND ppr.run_at < v_window_end
        GROUP BY ppr.prompt_id
        HAVING COUNT(*) >= 2
      )
      SELECT 
        COALESCE(
          100 - LEAST((STDDEV(presence_rate) * 100), 100),
          50
        )
      INTO v_cv
      FROM prompt_presence;
    ELSE
      v_cv := 100;
    END IF;
    
    RAISE NOTICE '[LlumosScore] CV (Coverage Variance) = %', ROUND(v_cv, 1);
    
    -- 4. CA: Citation Authority (conditional)
    IF v_enable_ca THEN
      v_ca := public.calculate_ca_submetric(p_org_id, p_prompt_id, v_window_start, v_window_end);
      RAISE NOTICE '[LlumosScore] CA (Citation Authority) = % (ENABLED)', ROUND(v_ca, 1);
    ELSE
      v_ca := 0;
      RAISE NOTICE '[LlumosScore] CA (Citation Authority) = % (DISABLED)', ROUND(v_ca, 1);
    END IF;
    
    -- 5. CS: Competitive Share
    WITH response_counts AS (
      SELECT 
        COUNT(*) FILTER (WHERE ppr.org_brand_present = true) as responses_with_org,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(ppr.competitors_json, '[]'::jsonb)) > 0) as responses_with_competitors
      FROM public.prompt_provider_responses ppr
      WHERE ppr.org_id = p_org_id
        AND ppr.status = 'completed'
        AND ppr.run_at >= v_window_start
        AND ppr.run_at < v_window_end
        AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
    )
    SELECT 
      COALESCE(
        (responses_with_org::NUMERIC / NULLIF(responses_with_org + responses_with_competitors, 0)::NUMERIC) * 100,
        50
      )
    INTO v_cs
    FROM response_counts;
    
    RAISE NOTICE '[LlumosScore] CS (Competitive Share) = %', ROUND(v_cs, 1);
    
    -- 6. FC: Freshness & Consistency
    WITH response_recency AS (
      SELECT 
        ppr.run_at,
        EXTRACT(EPOCH FROM (v_window_end - ppr.run_at)) / 
          NULLIF(EXTRACT(EPOCH FROM (v_window_end - v_window_start)), 0) as age_factor
      FROM public.prompt_provider_responses ppr
      WHERE ppr.org_id = p_org_id
        AND ppr.status = 'completed'
        AND ppr.run_at >= v_window_start
        AND ppr.run_at < v_window_end
        AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
    ),
    frequency_score AS (
      SELECT 
        LEAST((COUNT(*)::NUMERIC / 28.0) * 100, 100) as freq_score,
        COALESCE(AVG(1 - age_factor) * 100, 0) as recency_score
      FROM response_recency
    )
    SELECT 
      COALESCE(
        (freq_score * 0.4 + recency_score * 0.6),
        0
      )
    INTO v_fc
    FROM frequency_score;
    
    RAISE NOTICE '[LlumosScore] FC (Freshness & Consistency) = %', ROUND(v_fc, 1);
    
    -- Clamp all values to 0-100 range
    v_pr := LEAST(GREATEST(COALESCE(v_pr, 0), 0), 100);
    v_pp := LEAST(GREATEST(COALESCE(v_pp, 0), 0), 100);
    v_cv := LEAST(GREATEST(COALESCE(v_cv, 0), 0), 100);
    v_ca := LEAST(GREATEST(COALESCE(v_ca, 0), 0), 100);
    v_cs := LEAST(GREATEST(COALESCE(v_cs, 0), 0), 100);
    v_fc := LEAST(GREATEST(COALESCE(v_fc, 0), 0), 100);
    
    -- Calculate weights based on CA status
    IF v_enable_ca THEN
      -- CA enabled: Use PR=30%, PP=24%, CV=18%, CA=20%, CS=18%, FC=10%
      v_composite := (
        (v_pr * 0.30) + 
        (v_pp * 0.24) + 
        (v_cv * 0.18) + 
        (v_ca * 0.20) +
        (v_cs * 0.18) +
        (v_fc * 0.10)
      );
    ELSE
      -- CA disabled: Redistribute to PR=37.5%, PP=30%, CV=22.5%, CS=22.5%, FC=12.5%, CA=0%
      v_composite := (
        (v_pr * 0.375) + 
        (v_pp * 0.30) + 
        (v_cv * 0.225) + 
        (v_cs * 0.225) +
        (v_fc * 0.125)
      );
    END IF;
    
    v_llumos_score := 300 + ROUND((v_composite / 100.0) * 600)::INTEGER;
    v_llumos_score := LEAST(GREATEST(v_llumos_score, 300), 900);
    v_reason := 'success';
    
    RAISE NOTICE '[LlumosScore] Final: composite=%, score=%', ROUND(v_composite, 1), v_llumos_score;
  END IF;
  
  v_submetrics := jsonb_build_object(
    'pr', ROUND(v_pr, 1),
    'pp', ROUND(v_pp, 1),
    'cv', ROUND(v_cv, 1),
    'ca', ROUND(v_ca, 1),
    'cs', ROUND(v_cs, 1),
    'fc', ROUND(v_fc, 1)
  );
  
  RETURN jsonb_build_object(
    'score', v_llumos_score,
    'composite', ROUND(v_composite, 2),
    'submetrics', v_submetrics,
    'window', jsonb_build_object(
      'start', v_window_start,
      'end', v_window_end
    ),
    'reason', v_reason,
    'total_responses', v_total_responses
  );
END;
$$;