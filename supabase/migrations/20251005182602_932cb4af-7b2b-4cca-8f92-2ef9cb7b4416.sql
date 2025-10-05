-- ============================================================
-- Competitors V2 Performance Optimization Migration
-- Adds indexes + new parameterized RPC with server-side calculations
-- ============================================================

-- 1) Performance indexes (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_ppr_org_runat 
  ON public.prompt_provider_responses (org_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_ppr_org_prompt 
  ON public.prompt_provider_responses (org_id, prompt_id);

CREATE INDEX IF NOT EXISTS idx_ppr_org_status_competitors 
  ON public.prompt_provider_responses (org_id, status) 
  WHERE jsonb_array_length(competitors_json) > 0;

CREATE INDEX IF NOT EXISTS idx_bc_org_lowername 
  ON public.brand_catalog (org_id, lower(name));

-- 2) Optimized V2 RPC with filters, pagination, and server-side calculations
DROP FUNCTION IF EXISTS public.get_org_competitor_summary_v2(uuid,int,int,int,text[]) CASCADE;

CREATE OR REPLACE FUNCTION public.get_org_competitor_summary_v2(
  p_org_id uuid DEFAULT NULL,
  p_days int DEFAULT 30,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_providers text[] DEFAULT NULL
)
RETURNS TABLE(
  competitor_name text,
  total_mentions integer,
  distinct_prompts integer,
  first_seen timestamptz,
  last_seen timestamptz,
  avg_score numeric,
  share_pct numeric,
  trend_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  -- Resolve caller's org safely
  v_org := public.get_current_user_org_id();
  
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Access denied: user has no org' USING ERRCODE = '28000';
  END IF;
  
  -- Security check: only allow access to own org
  IF p_org_id IS NOT NULL AND p_org_id <> v_org THEN
    RAISE EXCEPTION 'Access denied: org mismatch' USING ERRCODE = '28000';
  END IF;
  
  v_org := COALESCE(p_org_id, v_org);
  
  -- Extract and aggregate competitor data with optional provider filtering
  RETURN QUERY
  WITH competitor_mentions AS (
    SELECT 
      jsonb_array_elements_text(ppr.competitors_json) as competitor,
      ppr.prompt_id,
      ppr.provider,
      ppr.run_at,
      ppr.score
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = v_org
      AND ppr.status = 'success'
      AND ppr.run_at >= (now() - (COALESCE(p_days, 30) || ' days')::interval)
      AND jsonb_array_length(ppr.competitors_json) > 0
      AND (p_providers IS NULL OR ppr.provider = ANY(p_providers))
  ),
  catalog_filtered AS (
    SELECT 
      bc.name as competitor_name,
      cm.prompt_id,
      cm.run_at,
      cm.score
    FROM competitor_mentions cm
    JOIN brand_catalog bc ON (
      bc.org_id = v_org
      AND bc.is_org_brand = false
      AND LOWER(TRIM(bc.name)) = LOWER(TRIM(cm.competitor))
    )
    WHERE TRIM(cm.competitor) != ''
      AND LENGTH(TRIM(cm.competitor)) >= 3
  ),
  aggregated AS (
    SELECT
      cf.competitor_name,
      COUNT(*)::int as total_mentions,
      COUNT(DISTINCT cf.prompt_id)::int as distinct_prompts,
      MIN(cf.run_at) as first_seen,
      MAX(cf.run_at) as last_seen,
      AVG(cf.score)::numeric(10,2) as avg_score
    FROM catalog_filtered cf
    GROUP BY cf.competitor_name
  ),
  totals AS (
    SELECT COALESCE(SUM(total_mentions), 0)::numeric as all_mentions 
    FROM aggregated
  ),
  with_trend AS (
    SELECT
      cf.competitor_name,
      -- Trend: weight recent mentions (last 7d) 3x vs older
      (SUM(CASE WHEN cf.run_at >= now() - interval '7 days' THEN 3 ELSE 1 END))::numeric
        / GREATEST(EXTRACT(EPOCH FROM (now() - MIN(cf.run_at))) / 86400.0, 1) as trend_score
    FROM catalog_filtered cf
    GROUP BY cf.competitor_name
  )
  SELECT
    a.competitor_name,
    a.total_mentions,
    a.distinct_prompts,
    a.first_seen,
    a.last_seen,
    a.avg_score,
    -- Share percentage
    CASE 
      WHEN t.all_mentions > 0 
      THEN ROUND((a.total_mentions::numeric / t.all_mentions) * 100.0, 1)
      ELSE 0 
    END as share_pct,
    -- Trend score (normalized)
    COALESCE(ROUND(wt.trend_score, 2), 0)::numeric as trend_score
  FROM aggregated a
  CROSS JOIN totals t
  LEFT JOIN with_trend wt ON wt.competitor_name = a.competitor_name
  WHERE a.total_mentions > 0
  ORDER BY a.total_mentions DESC, a.last_seen DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.get_org_competitor_summary_v2(uuid,int,int,int,text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_org_competitor_summary_v2(uuid,int,int,int,text[]) TO authenticated;

COMMENT ON FUNCTION public.get_org_competitor_summary_v2 IS 
  'Optimized competitor summary with filters (days, providers), pagination, and server-side share/trend calculations. Security: enforces org_id check.';
