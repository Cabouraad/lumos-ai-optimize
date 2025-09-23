-- Create the missing get_competitor_share_7d RPC function that the recommendation engine needs
CREATE OR REPLACE FUNCTION public.get_competitor_share_7d(p_org_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(
   prompt_id uuid, 
   competitor_name text, 
   share numeric, 
   total_mentions bigint
 )
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
  
  -- Get competitor share data for the last 7 days
  RETURN QUERY
  WITH recent_responses AS (
    SELECT 
      ppr.prompt_id,
      ppr.competitors_json,
      ppr.run_at
    FROM prompt_provider_responses ppr
    JOIN prompts p ON p.id = ppr.prompt_id
    WHERE p.org_id = p_org_id
      AND ppr.status = 'success'
      AND ppr.run_at >= now() - interval '7 days'
      AND ppr.competitors_json IS NOT NULL
      AND jsonb_array_length(ppr.competitors_json) > 0
  ),
  competitor_mentions AS (
    SELECT 
      rr.prompt_id,
      competitor_text as competitor_name,
      COUNT(*) as mentions
    FROM recent_responses rr,
         jsonb_array_elements_text(rr.competitors_json) AS competitor_text
    WHERE LENGTH(TRIM(competitor_text)) >= 3
      AND TRIM(competitor_text) !~ '^[0-9]+$'
      -- Only include competitors that exist in brand_catalog
      AND EXISTS (
        SELECT 1 FROM brand_catalog bc 
        WHERE bc.org_id = p_org_id 
          AND bc.is_org_brand = false
          AND LOWER(TRIM(bc.name)) = LOWER(TRIM(competitor_text))
      )
    GROUP BY rr.prompt_id, competitor_text
  ),
  prompt_totals AS (
    SELECT 
      prompt_id,
      SUM(mentions) as total_mentions_for_prompt
    FROM competitor_mentions
    GROUP BY prompt_id
  )
  SELECT 
    cm.prompt_id,
    cm.competitor_name,
    CASE 
      WHEN pt.total_mentions_for_prompt > 0 
      THEN ROUND((cm.mentions::numeric / pt.total_mentions_for_prompt) * 100, 1)
      ELSE 0
    END as share,
    cm.mentions as total_mentions
  FROM competitor_mentions cm
  JOIN prompt_totals pt ON pt.prompt_id = cm.prompt_id
  WHERE cm.mentions > 0
  ORDER BY cm.prompt_id, cm.mentions DESC;
END;
$function$;