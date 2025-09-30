-- ============================================================
-- PHASE 1: Real-Time Visibility Calculation System
-- ============================================================

-- 1. Create real-time visibility calculation function
-- This replaces the stale prompt_visibility_14d table with on-demand calculation
CREATE OR REPLACE FUNCTION public.get_prompt_visibility_realtime(
  p_org_id UUID,
  p_days INTEGER DEFAULT 14
)
RETURNS TABLE (
  prompt_id UUID,
  org_id UUID,
  prompt_text TEXT,
  presence_rate NUMERIC,
  runs_total INTEGER,
  last_run_at TIMESTAMP WITH TIME ZONE,
  provider_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH recent_responses AS (
    SELECT 
      ppr.prompt_id,
      ppr.org_brand_present,
      ppr.provider,
      ppr.run_at
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'success'
      AND ppr.run_at >= (now() - (p_days || ' days')::interval)
  ),
  prompt_stats AS (
    SELECT
      rr.prompt_id,
      COUNT(*) as total_runs,
      SUM(CASE WHEN rr.org_brand_present THEN 1 ELSE 0 END) as present_count,
      MAX(rr.run_at) as last_run,
      jsonb_object_agg(
        rr.provider,
        jsonb_build_object(
          'runs', COUNT(*),
          'present', SUM(CASE WHEN rr.org_brand_present THEN 1 ELSE 0 END)
        )
      ) as provider_stats
    FROM recent_responses rr
    GROUP BY rr.prompt_id
  )
  SELECT
    p.id as prompt_id,
    p.org_id,
    p.text as prompt_text,
    COALESCE(
      ROUND((ps.present_count::NUMERIC / NULLIF(ps.total_runs, 0)::NUMERIC) * 100, 2),
      0
    ) as presence_rate,
    COALESCE(ps.total_runs, 0)::INTEGER as runs_total,
    ps.last_run as last_run_at,
    COALESCE(ps.provider_stats, '{}'::jsonb) as provider_breakdown
  FROM prompts p
  LEFT JOIN prompt_stats ps ON ps.prompt_id = p.id
  WHERE p.org_id = p_org_id
    AND p.active = true
  ORDER BY presence_rate ASC, runs_total DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_prompt_visibility_realtime(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prompt_visibility_realtime(UUID, INTEGER) TO service_role;

-- 2. Drop the old stale table and related objects
DROP TABLE IF EXISTS public.prompt_visibility_14d CASCADE;
DROP FUNCTION IF EXISTS public.refresh_prompt_visibility_14d() CASCADE;

-- 3. Recreate low_visibility_prompts view using real-time function
DROP VIEW IF EXISTS public.low_visibility_prompts CASCADE;

CREATE OR REPLACE VIEW public.low_visibility_prompts AS
SELECT 
  prompt_id,
  org_id,
  prompt_text,
  presence_rate,
  runs_total as runs
FROM public.get_prompt_visibility_realtime(
  (SELECT org_id FROM users WHERE id = auth.uid() LIMIT 1),
  14
)
WHERE presence_rate < 100
ORDER BY presence_rate ASC, runs DESC
LIMIT 50;

-- Grant permissions on view
GRANT SELECT ON public.low_visibility_prompts TO authenticated;
GRANT SELECT ON public.low_visibility_prompts TO service_role;

-- 4. Add helpful comment
COMMENT ON FUNCTION public.get_prompt_visibility_realtime IS 
'Calculates real-time visibility metrics from latest prompt_provider_responses. Replaces stale prompt_visibility_14d table.';