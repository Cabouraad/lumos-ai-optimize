-- CLEANUP: Remove redundant tables step by step

-- First, update RPC function to use new table structure
CREATE OR REPLACE FUNCTION public.get_prompt_visibility_7d(requesting_org_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(org_id uuid, prompt_id uuid, text text, runs_7d bigint, avg_score_7d numeric)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  -- If no org_id found, return no results
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
  
  -- Query the NEW table structure
  RETURN QUERY
  SELECT
    p.org_id,
    p.id as prompt_id,
    p.text,
    COUNT(ppr.id) as runs_7d,
    AVG(ppr.score::numeric) as avg_score_7d
  FROM prompts p
  LEFT JOIN prompt_provider_responses ppr ON ppr.prompt_id = p.id 
    AND ppr.run_at >= now() - interval '7 days'
    AND ppr.status = 'success'
  WHERE p.org_id = requesting_org_id
  GROUP BY p.org_id, p.id, p.text;
END;
$function$;