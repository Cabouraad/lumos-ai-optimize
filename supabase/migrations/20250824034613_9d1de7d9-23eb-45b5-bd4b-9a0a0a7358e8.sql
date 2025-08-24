-- CLEANUP: Remove redundant tables and fix RPC functions

-- Drop the obsolete tables (they're not being used anymore)
DROP TABLE IF EXISTS public.visibility_results CASCADE;
DROP TABLE IF EXISTS public.prompt_runs CASCADE;

-- Update the RPC function to use the new table structure
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
$function$

-- Remove any orphaned RPC functions that reference the old tables
DROP FUNCTION IF EXISTS public.get_competitor_share_7d(uuid);

-- Create a cleaner competitor analysis function using the new structure
CREATE OR REPLACE FUNCTION public.get_competitor_analysis_7d(requesting_org_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(org_id uuid, prompt_id uuid, competitor_name text, mention_count bigint, avg_score numeric)
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
  
  IF user_org_id IS NULL THEN
    RETURN;
  END IF;
  
  IF requesting_org_id IS NULL THEN
    requesting_org_id := user_org_id;
  END IF;
  
  IF requesting_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own organization data';
  END IF;
  
  -- Extract competitor data from the new table
  RETURN QUERY
  SELECT
    p.org_id,
    p.id as prompt_id,
    competitor_data.brand_name as competitor_name,
    COUNT(*) as mention_count,
    AVG((competitor_data.score)::numeric) as avg_score
  FROM prompts p
  JOIN prompt_provider_responses ppr ON ppr.prompt_id = p.id
  JOIN LATERAL jsonb_to_recordset(ppr.competitors_json) AS competitor_data(brand_name text, score numeric) ON true
  WHERE ppr.run_at >= now() - interval '7 days'
    AND ppr.status = 'success'
    AND p.org_id = requesting_org_id
  GROUP BY p.org_id, p.id, competitor_data.brand_name
  ORDER BY mention_count DESC, avg_score DESC;
END;
$function$