-- Fix ambiguous column reference in get_prompt_competitors function
CREATE OR REPLACE FUNCTION public.get_prompt_competitors(p_prompt_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE(competitor_name text, mentions bigint, share numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_org_id uuid;
  prompt_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get the prompt's org_id
  SELECT p.org_id INTO prompt_org_id
  FROM prompts p
  WHERE p.id = p_prompt_id;
  
  IF prompt_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Only allow access to user's own org prompts
  IF prompt_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own organization prompts';
  END IF;
  
  -- HARDENED: Only return competitors that exist in brand_catalog
  RETURN QUERY
  WITH latest_responses AS (
    SELECT DISTINCT ON (ppr.provider)
      ppr.competitors_json,
      ppr.score
    FROM prompt_provider_responses ppr
    WHERE ppr.prompt_id = p_prompt_id
      AND ppr.status = 'success'
      AND ppr.run_at >= now() - (p_days || ' days')::interval
    ORDER BY ppr.provider, ppr.run_at DESC
  ),
  catalog_verified_competitors AS (
    SELECT 
      bc.name as brand_name,  -- Renamed to avoid ambiguity
      1 as mention_count
    FROM latest_responses lr,
         jsonb_array_elements_text(lr.competitors_json) AS competitor_text,
         brand_catalog bc
    WHERE bc.org_id = prompt_org_id
      AND bc.is_org_brand = false
      AND LOWER(TRIM(bc.name)) = LOWER(TRIM(competitor_text))
      AND jsonb_array_length(lr.competitors_json) > 0
  ),
  aggregated AS (
    SELECT 
      cvc.brand_name,  -- Use explicit alias
      count(*) as competitor_mentions_count
    FROM catalog_verified_competitors cvc
    GROUP BY cvc.brand_name  -- Use explicit alias
  ),
  total_mentions AS (
    SELECT sum(agg.competitor_mentions_count) as total 
    FROM aggregated agg
  )
  SELECT 
    agg.brand_name as competitor_name,  -- Explicit alias and rename for output
    agg.competitor_mentions_count as mentions,
    CASE 
      WHEN tm.total > 0 THEN round((agg.competitor_mentions_count::numeric / tm.total::numeric) * 100, 1)
      ELSE 0
    END as share
  FROM aggregated agg
  CROSS JOIN total_mentions tm
  WHERE agg.competitor_mentions_count > 0
  ORDER BY agg.competitor_mentions_count DESC
  LIMIT 10;
END;
$$;