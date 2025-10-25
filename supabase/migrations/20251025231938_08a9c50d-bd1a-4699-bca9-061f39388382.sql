-- Phase 1-4: Fix Llumos Score Calculation Issues
-- This migration addresses critical calculation bugs in the Llumos Score system

-- Drop and recreate the compute_llumos_score function with fixes
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
  
  -- PHASE 1 FIX: Use rolling 28-day window instead of ISO week boundaries
  -- This ensures current data is always included in calculations
  v_window_end := now();
  v_window_start := v_window_end - interval '28 days';
  v_prev_window_start := v_window_start - interval '28 days';
  
  -- Log window boundaries for debugging
  RAISE NOTICE '[LlumosScore] Computing for org=%, scope=%, window=[% to %]', 
    p_org_id, v_scope, v_window_start, v_window_end;
  
  v_org_domains := public.org_domain_set(p_org_id);
  
  SELECT COUNT(*)
  INTO v_total_responses
  FROM public.prompt_provider_responses ppr
  WHERE ppr.org_id = p_org_id
    AND ppr.status = 'success'
    AND ppr.run_at >= v_window_start
    AND ppr.run_at < v_window_end
    AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id);
  
  RAISE NOTICE '[LlumosScore] Found % total responses', v_total_responses;
  
  -- PHASE 4 FIX: Lower threshold from 5 to 3 responses
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
      AND ppr.status = 'success'
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
      AND ppr.status = 'success'
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
          AND ppr.status = 'success'
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
    
    -- 4. CA: Citation Authority (currently not populated, set to 0)
    -- PHASE 2: Citations data is not available, so CA will always be 0
    v_ca := 0;
    
    RAISE NOTICE '[LlumosScore] CA (Citation Authority) = % (citations not available)', ROUND(v_ca, 1);
    
    -- PHASE 3 FIX: CS: Competitive Share - Count responses, not brand variant mentions
    -- This gives a more accurate picture of competitive presence
    WITH response_counts AS (
      SELECT 
        COUNT(*) FILTER (WHERE ppr.org_brand_present = true) as responses_with_org,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(ppr.competitors_json, '[]'::jsonb)) > 0) as responses_with_competitors
      FROM public.prompt_provider_responses ppr
      WHERE ppr.org_id = p_org_id
        AND ppr.status = 'success'
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
    -- PHASE 1: Updated to work with rolling window
    WITH response_recency AS (
      SELECT 
        ppr.run_at,
        EXTRACT(EPOCH FROM (v_window_end - ppr.run_at)) / 
          NULLIF(EXTRACT(EPOCH FROM (v_window_end - v_window_start)), 0) as age_factor
      FROM public.prompt_provider_responses ppr
      WHERE ppr.org_id = p_org_id
        AND ppr.status = 'success'
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
    
    -- PHASE 2: Reweight composite to compensate for missing CA data
    -- CA (20%) is redistributed: PR +5%, PP +4%, CV +3%, CS +3%, FC +5%
    v_composite := (
      v_pr * 0.30 +  -- Was 0.25, now +5%
      v_pp * 0.24 +  -- Was 0.20, now +4%
      v_cv * 0.18 +  -- Was 0.15, now +3%
      v_ca * 0.00 +  -- Was 0.20, now 0% (not available)
      v_cs * 0.18 +  -- Was 0.15, now +3%
      v_fc * 0.10    -- Was 0.05, now +5%
    );
    
    RAISE NOTICE '[LlumosScore] Composite = % (reweighted without CA)', ROUND(v_composite, 2);
    
    v_llumos_score := 300 + ROUND((v_composite / 100.0) * 600)::INTEGER;
    
    RAISE NOTICE '[LlumosScore] Final Llumos Score = %', v_llumos_score;
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
    'tier', CASE
      WHEN v_llumos_score >= 760 THEN 'Excellent'
      WHEN v_llumos_score >= 700 THEN 'Very Good'
      WHEN v_llumos_score >= 640 THEN 'Good'
      WHEN v_llumos_score >= 580 THEN 'Fair'
      ELSE 'Needs Improvement'
    END,
    'window', jsonb_build_object(
      'start', v_window_start,
      'end', v_window_end
    ),
    'reason', v_reason,
    'total_responses', v_total_responses
  );
END;
$$;