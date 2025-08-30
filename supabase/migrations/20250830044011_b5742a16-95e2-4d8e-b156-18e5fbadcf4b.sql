-- Update get_org_competitor_summary to ensure catalog-only filtering
CREATE OR REPLACE FUNCTION public.get_org_competitor_summary(p_org_id uuid DEFAULT NULL::uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(competitor_name text, total_mentions bigint, distinct_prompts bigint, first_seen timestamp with time zone, last_seen timestamp with time zone, avg_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Use provided org_id or default to user's org_id
  IF p_org_id IS NULL THEN
    p_org_id := user_org_id;
  END IF;
  
  -- Only allow access to user's own org data
  IF p_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own organization data';
  END IF;
  
  -- Extract competitors from responses within the time window
  -- CRITICAL: Only return competitors that exist in brand_catalog
  RETURN QUERY
  WITH competitor_mentions AS (
    SELECT 
      jsonb_array_elements_text(ppr.competitors_json) as competitor,
      ppr.prompt_id,
      ppr.run_at,
      ppr.score
    FROM prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'success'
      AND ppr.run_at >= now() - (p_days || ' days')::interval
      AND jsonb_array_length(ppr.competitors_json) > 0
  ),
  catalog_filtered_mentions AS (
    SELECT 
      bc.name as competitor_name,  -- Use catalog name for consistency
      cm.prompt_id,
      cm.run_at,
      cm.score
    FROM competitor_mentions cm
    JOIN brand_catalog bc ON (
      bc.org_id = p_org_id 
      AND bc.is_org_brand = false
      AND LOWER(TRIM(bc.name)) = LOWER(TRIM(cm.competitor))
    )
    WHERE TRIM(cm.competitor) != ''
      AND LENGTH(TRIM(cm.competitor)) >= 3
  )
  SELECT 
    cfm.competitor_name,
    count(*) as total_mentions,
    count(DISTINCT cfm.prompt_id) as distinct_prompts,
    min(cfm.run_at) as first_seen,
    max(cfm.run_at) as last_seen,
    avg(cfm.score) as avg_score
  FROM catalog_filtered_mentions cfm
  GROUP BY cfm.competitor_name
  HAVING count(*) > 0
  ORDER BY total_mentions DESC, last_seen DESC;
END;
$function$;