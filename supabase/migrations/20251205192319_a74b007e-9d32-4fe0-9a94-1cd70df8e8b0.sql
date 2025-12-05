
-- Fix: Add brand_id filtering to compute_llumos_score function
-- This ensures brand-isolated Llumos score calculations

CREATE OR REPLACE FUNCTION public.compute_llumos_score(
  p_org_id uuid, 
  p_prompt_id uuid DEFAULT NULL::uuid,
  p_brand_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  RAISE NOTICE '[LlumosScore] Computing for org=%, scope=%, brand=%, window=[% to %], CA enabled=%', 
    p_org_id, v_scope, p_brand_id, v_window_start, v_window_end, v_enable_ca;
  
  v_org_domains := public.org_domain_set(p_org_id);
  
  -- Count total responses (filtered by brand via prompts table)
  SELECT COUNT(*)
  INTO v_total_responses
  FROM public.prompt_provider_responses ppr
  INNER JOIN public.prompts p ON p.id = ppr.prompt_id
  WHERE ppr.org_id = p_org_id
    AND ppr.status = 'completed'
    AND ppr.run_at >= v_window_start
    AND ppr.run_at < v_window_end
    AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
    AND (p_brand_id IS NULL OR p.brand_id = p_brand_id);
  
  RAISE NOTICE '[LlumosScore] Found % total responses', v_total_responses;
  
  IF v_total_responses < 3 THEN
    v_reason := 'insufficient_data';
    v_pr := 50; v_pp := 50; v_cv := 50; v_ca := 50; v_cs := 50; v_fc := 50;
    v_composite := 50;
    v_llumos_score := 500;
    
    RAISE NOTICE '[LlumosScore] Insufficient data (< 3 responses), returning default score 500';
  ELSE
    -- 1. PR: Presence Rate (filtered by brand)
    SELECT 
      COALESCE(
        (COUNT(*) FILTER (WHERE ppr.org_brand_present = true)::NUMERIC / 
         NULLIF(COUNT(*), 0)::NUMERIC) * 100,
        0
      )
    INTO v_pr
    FROM public.prompt_provider_responses ppr
    INNER JOIN public.prompts p ON p.id = ppr.prompt_id
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'completed'
      AND ppr.run_at >= v_window_start
      AND ppr.run_at < v_window_end
      AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id);
    
    RAISE NOTICE '[LlumosScore] PR (Presence Rate) = %', ROUND(v_pr, 1);
    
    -- 2. PP: Prominence Position (filtered by brand)
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
    INNER JOIN public.prompts p ON p.id = ppr.prompt_id
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'completed'
      AND ppr.run_at >= v_window_start
      AND ppr.run_at < v_window_end
      AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id);
    
    RAISE NOTICE '[LlumosScore] PP (Prominence Position) = %', ROUND(v_pp, 1);
    
    -- 3. CV: Coverage Variance (filtered by brand)
    IF v_scope = 'org' THEN
      WITH prompt_presence AS (
        SELECT 
          ppr.prompt_id,
          COUNT(*) FILTER (WHERE ppr.org_brand_present = true)::NUMERIC / 
            NULLIF(COUNT(*), 0)::NUMERIC as presence_rate
        FROM public.prompt_provider_responses ppr
        INNER JOIN public.prompts p ON p.id = ppr.prompt_id
        WHERE ppr.org_id = p_org_id
          AND ppr.status = 'completed'
          AND ppr.run_at >= v_window_start
          AND ppr.run_at < v_window_end
          AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
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
    
    -- 4. CA: Citation Authority (conditional) - pass brand_id if the function supports it
    IF v_enable_ca THEN
      v_ca := public.calculate_ca_submetric(p_org_id, p_prompt_id, v_window_start, v_window_end);
      RAISE NOTICE '[LlumosScore] CA (Citation Authority) = % (ENABLED)', ROUND(v_ca, 1);
    ELSE
      v_ca := 0;
      RAISE NOTICE '[LlumosScore] CA (Citation Authority) = 0 (DISABLED for this org)';
    END IF;
    
    -- 5. CS: Competitive Share (filtered by brand)
    WITH brand_mentions AS (
      SELECT 
        SUM(CASE WHEN ppr.org_brand_present THEN 1 ELSE 0 END) as org_mentions,
        SUM(COALESCE(ppr.competitors_count, 0)) as competitor_mentions
      FROM public.prompt_provider_responses ppr
      INNER JOIN public.prompts p ON p.id = ppr.prompt_id
      WHERE ppr.org_id = p_org_id
        AND ppr.status = 'completed'
        AND ppr.run_at >= v_window_start
        AND ppr.run_at < v_window_end
        AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
        AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
    )
    SELECT 
      COALESCE(
        CASE 
          WHEN (org_mentions + competitor_mentions) > 0 
          THEN LEAST((org_mentions::NUMERIC / (org_mentions + competitor_mentions)::NUMERIC) * 100, 100)
          ELSE 50
        END,
        50
      )
    INTO v_cs
    FROM brand_mentions;
    
    RAISE NOTICE '[LlumosScore] CS (Competitive Share) = %', ROUND(v_cs, 1);
    
    -- 6. FC: Freshness & Consistency (filtered by brand)
    WITH weekly_presence AS (
      SELECT 
        date_trunc('week', ppr.run_at) as week,
        COUNT(*) FILTER (WHERE ppr.org_brand_present = true)::NUMERIC / 
          NULLIF(COUNT(*), 0)::NUMERIC as presence_rate
      FROM public.prompt_provider_responses ppr
      INNER JOIN public.prompts p ON p.id = ppr.prompt_id
      WHERE ppr.org_id = p_org_id
        AND ppr.status = 'completed'
        AND ppr.run_at >= v_window_start
        AND ppr.run_at < v_window_end
        AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
        AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
      GROUP BY date_trunc('week', ppr.run_at)
      HAVING COUNT(*) >= 2
    ),
    recent_activity AS (
      SELECT COUNT(*) as recent_responses
      FROM public.prompt_provider_responses ppr
      INNER JOIN public.prompts p ON p.id = ppr.prompt_id
      WHERE ppr.org_id = p_org_id
        AND ppr.status = 'completed'
        AND ppr.run_at >= v_window_end - interval '7 days'
        AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
        AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
    )
    SELECT 
      COALESCE(
        (
          -- Consistency component (40%)
          (100 - LEAST(COALESCE((SELECT STDDEV(presence_rate) * 100 FROM weekly_presence), 0), 100)) * 0.4 +
          -- Recency component (60%)
          LEAST((SELECT recent_responses FROM recent_activity)::NUMERIC / GREATEST(v_total_responses::NUMERIC / 4, 1) * 100, 100) * 0.6
        ),
        50
      )
    INTO v_fc;
    
    RAISE NOTICE '[LlumosScore] FC (Freshness & Consistency) = %', ROUND(v_fc, 1);
    
    -- Calculate composite score with weighted formula
    IF v_enable_ca THEN
      -- With CA enabled: PR 25%, PP 20%, CV 15%, CA 20%, CS 15%, FC 5%
      v_composite := (v_pr * 0.25) + (v_pp * 0.20) + (v_cv * 0.15) + (v_ca * 0.20) + (v_cs * 0.15) + (v_fc * 0.05);
    ELSE
      -- Without CA: PR 30%, PP 25%, CV 20%, CS 20%, FC 5%
      v_composite := (v_pr * 0.30) + (v_pp * 0.25) + (v_cv * 0.20) + (v_cs * 0.20) + (v_fc * 0.05);
    END IF;
    
    -- Map to 300-900 scale
    v_llumos_score := LEAST(GREATEST(ROUND(300 + (v_composite * 6)), 300), 900);
    
    v_reason := 'calculated';
    
    RAISE NOTICE '[LlumosScore] Composite = %, Final Score = %', ROUND(v_composite, 1), v_llumos_score;
  END IF;
  
  -- Build submetrics object
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
    'composite', ROUND(v_composite, 1),
    'tier', CASE 
      WHEN v_llumos_score >= 800 THEN 'Excellent'
      WHEN v_llumos_score >= 700 THEN 'Good'
      WHEN v_llumos_score >= 600 THEN 'Fair'
      WHEN v_llumos_score >= 500 THEN 'Needs Work'
      ELSE 'Poor'
    END,
    'submetrics', v_submetrics,
    'window', jsonb_build_object(
      'start', v_window_start,
      'end', v_window_end
    ),
    'reason', v_reason,
    'total_responses', v_total_responses
  );
END;
$function$;
