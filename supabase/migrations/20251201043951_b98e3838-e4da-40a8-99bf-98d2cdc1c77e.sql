-- Fix get_org_competitor_summary_v2 to filter by brand via prompts table (not response.brand_id)
-- This matches the pattern used in get_unified_dashboard_data

DROP FUNCTION IF EXISTS public.get_org_competitor_summary_v2(uuid,int,int,int,text[],uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.get_org_competitor_summary_v2(
  p_org_id uuid DEFAULT NULL,
  p_days int DEFAULT 30,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_providers text[] DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL
)
RETURNS TABLE(
  competitor_name text,
  total_mentions bigint,
  distinct_prompts bigint,
  first_seen timestamp with time zone,
  last_seen timestamp with time zone,
  avg_score numeric,
  share_pct numeric,
  trend_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_limit int;
  v_offset int;
BEGIN
  -- Resolve org_id
  IF p_org_id IS NULL THEN
    SELECT u.org_id INTO v_org_id
    FROM users u
    WHERE u.id = auth.uid();
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'User not found or has no org_id';
    END IF;
  ELSE
    v_org_id := p_org_id;
  END IF;

  v_limit := LEAST(COALESCE(p_limit, 50), 50);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  WITH filtered_responses AS (
    SELECT
      ppr.id,
      ppr.org_id,
      ppr.competitors_json,
      ppr.run_at,
      ppr.prompt_id,
      ppr.provider,
      ppr.score
    FROM prompt_provider_responses ppr
    INNER JOIN prompts p ON p.id = ppr.prompt_id
    WHERE ppr.org_id = v_org_id
      AND ppr.status IN ('completed', 'success')
      AND ppr.run_at >= (CURRENT_TIMESTAMP - (p_days || ' days')::interval)
      AND (p_providers IS NULL OR ppr.provider = ANY(p_providers))
      -- Brand filtering via prompts table (responses linked to brands through prompts)
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
      AND ppr.competitors_json IS NOT NULL
      AND jsonb_array_length(ppr.competitors_json) > 0
  ),
  -- Expand competitors handling both objects (with name) and strings
  expanded AS (
    SELECT
      fr.id,
      fr.org_id,
      fr.run_at,
      fr.prompt_id,
      fr.score,
      -- Clean competitor text: prefer object.name else string value without quotes
      LOWER(TRIM(
        COALESCE(
          competitor_element.value->>'name',
          TRIM(BOTH '"' FROM competitor_element.value::text)
        )
      )) AS competitor_name_lower
    FROM filtered_responses fr
    CROSS JOIN LATERAL jsonb_array_elements(fr.competitors_json) AS competitor_element
  ),
  -- Only keep names that exist in brand_catalog (name or any variant)
  valid_expanded AS (
    SELECT e.*
    FROM expanded e
    WHERE e.competitor_name_lower IN (
      SELECT LOWER(TRIM(bc.name)) FROM brand_catalog bc
      WHERE bc.org_id = v_org_id AND bc.is_org_brand = false
      UNION
      SELECT LOWER(TRIM(v)) FROM brand_catalog bc,
        LATERAL jsonb_array_elements_text(bc.variants_json) v
      WHERE bc.org_id = v_org_id AND bc.is_org_brand = false
    )
  ),
  aggregated AS (
    SELECT
      e.competitor_name_lower AS competitor_key,
      COUNT(*)::bigint AS total_mentions,
      COUNT(DISTINCT e.prompt_id)::bigint AS distinct_prompts,
      MIN(e.run_at) AS first_seen,
      MAX(e.run_at) AS last_seen,
      AVG(e.score)::numeric AS avg_score
    FROM valid_expanded e
    GROUP BY e.competitor_name_lower
  ),
  totals AS (
    SELECT SUM(agg.total_mentions)::numeric AS grand_total
    FROM aggregated agg
  ),
  with_trend AS (
    SELECT
      e.competitor_name_lower AS competitor_key,
      CASE
        WHEN COUNT(CASE WHEN e.run_at >= (CURRENT_TIMESTAMP - interval '7 days') THEN 1 END) > 0
         AND COUNT(CASE WHEN e.run_at < (CURRENT_TIMESTAMP - interval '7 days') THEN 1 END) > 0
        THEN
          ((COUNT(CASE WHEN e.run_at >= (CURRENT_TIMESTAMP - interval '7 days') THEN 1 END)::numeric /
            NULLIF(COUNT(CASE WHEN e.run_at < (CURRENT_TIMESTAMP - interval '7 days') THEN 1 END)::numeric, 0)) - 1) * 100
        ELSE 0
      END AS trend_score
    FROM valid_expanded e
    GROUP BY e.competitor_name_lower
  )
  SELECT
    -- Map back to canonical brand_catalog name when available; else title-case the key
    COALESCE(
      (
        SELECT bc.name FROM brand_catalog bc
        WHERE bc.org_id = v_org_id AND bc.is_org_brand = false
          AND LOWER(TRIM(bc.name)) = agg.competitor_key
        LIMIT 1
      ),
      INITCAP(agg.competitor_key)
    ) AS competitor_name,
    agg.total_mentions,
    agg.distinct_prompts,
    agg.first_seen,
    agg.last_seen,
    agg.avg_score,
    CASE
      WHEN tot.grand_total > 0 THEN ((agg.total_mentions::numeric / tot.grand_total) * 100)
      ELSE 0
    END AS share_pct,
    COALESCE(wt.trend_score, 0)::numeric AS trend_score
  FROM aggregated agg
  CROSS JOIN totals tot
  LEFT JOIN with_trend wt ON wt.competitor_key = agg.competitor_key
  WHERE agg.total_mentions > 0
  ORDER BY agg.total_mentions DESC, agg.last_seen DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

-- Grant execute permission
REVOKE ALL ON FUNCTION public.get_org_competitor_summary_v2(uuid,int,int,int,text[],uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_org_competitor_summary_v2(uuid,int,int,int,text[],uuid) TO authenticated;

COMMENT ON FUNCTION public.get_org_competitor_summary_v2 IS 'Returns competitor summary for an organization, filtering by brand via prompts table (not response.brand_id directly).';