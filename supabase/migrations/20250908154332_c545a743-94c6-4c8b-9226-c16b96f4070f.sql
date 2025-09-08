-- Replace get_prompt_competitors with catalog-agnostic version
-- This function will aggregate competitors directly from prompt_provider_responses
-- without requiring them to exist in brand_catalog

DROP FUNCTION IF EXISTS public.get_prompt_competitors(uuid);

CREATE OR REPLACE FUNCTION public.get_prompt_competitors(p_prompt_id uuid)
RETURNS TABLE(
  competitor_name text,
  total_mentions bigint,
  share numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  user_org_id uuid;
  prompt_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  -- Security check: ensure user has access to this prompt
  SELECT p.org_id INTO prompt_org_id
  FROM prompts p 
  WHERE p.id = p_prompt_id;
  
  IF prompt_org_id IS NULL OR user_org_id != prompt_org_id THEN
    RETURN; -- No access or prompt not found
  END IF;
  
  -- Aggregate competitors from recent responses (last 30 days)
  RETURN QUERY
  WITH competitor_mentions AS (
    SELECT 
      TRIM(INITCAP(competitor)) as normalized_name,
      COUNT(*) as mentions
    FROM prompt_provider_responses ppr
    CROSS JOIN jsonb_array_elements_text(ppr.competitors_json) AS competitor
    WHERE ppr.prompt_id = p_prompt_id
      AND ppr.status = 'success'
      AND ppr.run_at >= now() - interval '30 days'
      AND ppr.competitors_json IS NOT NULL
      AND jsonb_array_length(ppr.competitors_json) > 0
      -- Filter out obvious non-competitors
      AND LENGTH(TRIM(competitor)) >= 3
      AND TRIM(competitor) !~* '^[0-9]+$'  -- Not purely numeric
      AND TRIM(competitor) !~ '[<>{}[\]()"`''""''„"‚'']'  -- No problematic chars
      -- Filter out org brands (case-insensitive check)
      AND NOT EXISTS (
        SELECT 1 FROM brand_catalog bc 
        WHERE bc.org_id = prompt_org_id 
          AND bc.is_org_brand = true
          AND LOWER(TRIM(bc.name)) = LOWER(TRIM(competitor))
      )
    GROUP BY TRIM(INITCAP(competitor))
  ),
  total_mentions_sum AS (
    SELECT COALESCE(SUM(mentions), 0) as total_sum
    FROM competitor_mentions
  )
  SELECT 
    cm.normalized_name as competitor_name,
    cm.mentions as total_mentions,
    CASE 
      WHEN tms.total_sum > 0 THEN ROUND((cm.mentions::numeric / tms.total_sum) * 100, 1)
      ELSE 0
    END as share
  FROM competitor_mentions cm
  CROSS JOIN total_mentions_sum tms
  ORDER BY cm.mentions DESC, cm.normalized_name
  LIMIT 20; -- Reasonable limit for UI display
END;
$function$;