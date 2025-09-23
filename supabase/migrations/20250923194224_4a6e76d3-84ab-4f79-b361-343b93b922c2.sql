-- Drop and recreate the get_prompt_visibility_7d function with correct return type
DROP FUNCTION IF EXISTS public.get_prompt_visibility_7d(uuid);

CREATE OR REPLACE FUNCTION public.get_prompt_visibility_7d(requesting_org_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  prompt_id uuid,
  text text,
  runs_7d bigint,
  avg_score_7d numeric
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
  IF requesting_org_id IS NULL THEN
    requesting_org_id := user_org_id;
  END IF;
  
  -- Only allow access to user's own org data
  IF requesting_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own organization data';
  END IF;
  
  -- Get prompt visibility data for the last 7 days
  RETURN QUERY
  SELECT 
    p.id as prompt_id,
    p.text,
    COUNT(*) as runs_7d,
    AVG(ppr.score) as avg_score_7d
  FROM prompts p
  JOIN prompt_provider_responses ppr ON ppr.prompt_id = p.id
  WHERE p.org_id = requesting_org_id
    AND ppr.status = 'success'
    AND ppr.run_at >= now() - interval '7 days'
  GROUP BY p.id, p.text
  HAVING COUNT(*) >= 1
  ORDER BY runs_7d DESC, avg_score_7d ASC;
END;
$function$;