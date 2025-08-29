-- Fix the ambiguous column reference in get_prompt_competitors function
CREATE OR REPLACE FUNCTION public.get_prompt_competitors(p_prompt_id uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(competitor_name text, mentions bigint, share numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Get latest response per provider, then aggregate competitors
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
  competitor_mentions AS (
    SELECT 
      jsonb_array_elements_text(lr.competitors_json) as competitor,
      lr.score
    FROM latest_responses lr
    WHERE jsonb_array_length(lr.competitors_json) > 0
  ),
  normalized_competitors AS (
    SELECT 
      trim(lower(competitor)) as normalized_name,
      competitor as original_name,
      score
    FROM competitor_mentions
    WHERE trim(competitor) != ''
      AND length(trim(competitor)) >= 3
      -- Filter out generic terms
      AND NOT (trim(lower(competitor)) SIMILAR TO '%(seo|marketing|social media|facebook|adobe|social|media)%')
      -- Filter out org brands
      AND NOT EXISTS (
        SELECT 1 FROM brand_catalog bc 
        WHERE bc.org_id = prompt_org_id 
          AND bc.is_org_brand = true
          AND (
            lower(trim(bc.name)) = trim(lower(competitor)) OR
            bc.variants_json ? competitor
          )
      )
  ),
  aggregated AS (
    SELECT 
      (array_agg(original_name))[1] as competitor_name,
      count(*) as competitor_mentions  -- Qualify the mentions column
    FROM normalized_competitors
    GROUP BY normalized_name
  ),
  total_mentions AS (
    SELECT sum(competitor_mentions) as total FROM aggregated  -- Use qualified name
  )
  SELECT 
    a.competitor_name,
    a.competitor_mentions as mentions,  -- Use qualified name
    CASE 
      WHEN t.total > 0 THEN round((a.competitor_mentions::numeric / t.total::numeric) * 100, 1)
      ELSE 0
    END as share
  FROM aggregated a
  CROSS JOIN total_mentions t
  WHERE a.competitor_mentions > 0  -- Use qualified name
  ORDER BY a.competitor_mentions DESC;  -- Use qualified name
END;
$function$;