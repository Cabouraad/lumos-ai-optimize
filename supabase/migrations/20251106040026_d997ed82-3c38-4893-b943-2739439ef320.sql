-- Create competitor trends RPC aggregating mentions by week/month
DROP FUNCTION IF EXISTS public.get_competitor_trends(uuid,text,int,int,uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.get_competitor_trends(
  p_org_id uuid DEFAULT NULL,
  p_interval text DEFAULT 'week',
  p_days int DEFAULT 90,
  p_limit int DEFAULT 5,
  p_brand_id uuid DEFAULT NULL
)
RETURNS TABLE(
  period_start date,
  competitor_name text,
  mentions int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_step text;
BEGIN
  v_step := CASE WHEN lower(COALESCE(p_interval,'week')) IN ('month','monthly','mon','m') THEN 'month' ELSE 'week' END;

  IF p_org_id IS NULL THEN
    SELECT u.org_id INTO v_org_id FROM users u WHERE u.id = auth.uid();
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'User not found or has no org_id';
    END IF;
  ELSE
    v_org_id := p_org_id;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT 
      date_trunc(v_step, ppr.run_at)::date AS period_start,
      (elem.value->>'name')::text AS competitor_name
    FROM public.prompt_provider_responses ppr
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ppr.competitors_json, '[]'::jsonb)) elem
    WHERE ppr.org_id = v_org_id
      AND ppr.status IN ('completed','success')
      AND ppr.run_at >= now() - make_interval(days => p_days)
      AND (p_brand_id IS NULL OR ppr.brand_id = p_brand_id OR ppr.brand_id IS NULL)
      AND elem.value->>'name' IS NOT NULL
  ), ranked_competitors AS (
    SELECT competitor_name, SUM(1) AS mentions
    FROM base
    GROUP BY competitor_name
    ORDER BY mentions DESC
    LIMIT LEAST(GREATEST(p_limit,1), 10)
  )
  SELECT b.period_start, b.competitor_name, COUNT(*)::int AS mentions
  FROM base b
  JOIN ranked_competitors rc ON rc.competitor_name = b.competitor_name
  GROUP BY b.period_start, b.competitor_name
  ORDER BY b.period_start, b.competitor_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_competitor_trends(uuid,text,int,int,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_competitor_trends(uuid,text,int,int,uuid) TO authenticated;