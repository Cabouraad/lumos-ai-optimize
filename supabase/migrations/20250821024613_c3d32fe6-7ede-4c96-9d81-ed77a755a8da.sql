-- Fix security vulnerability by removing exposed views and updating functions to query underlying tables directly

-- Update get_competitor_share_7d function to query underlying tables instead of view
CREATE OR REPLACE FUNCTION public.get_competitor_share_7d(requesting_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  org_id uuid,
  prompt_id uuid,
  brand_norm text,
  mean_score numeric,
  n bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  -- Query underlying tables directly instead of view
  RETURN QUERY
  SELECT
    p.org_id,
    p.id as prompt_id,
    brand_data.brand_name as brand_norm,
    AVG(brand_data.score::numeric) as mean_score,
    COUNT(*) as n
  FROM prompts p
  JOIN prompt_runs pr ON pr.prompt_id = p.id
  JOIN visibility_results vr ON vr.prompt_run_id = pr.id,
  jsonb_to_recordset(vr.brands_json) AS brand_data(brand_name text, score int)
  WHERE pr.run_at >= now() - interval '7 days'
    AND p.org_id = requesting_org_id
  GROUP BY p.org_id, p.id, brand_data.brand_name;
END;
$$;

-- Update get_prompt_visibility_7d function to query underlying tables instead of view  
CREATE OR REPLACE FUNCTION public.get_prompt_visibility_7d(requesting_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  org_id uuid,
  prompt_id uuid,
  text text,
  runs_7d bigint,
  avg_score_7d numeric
)
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path TO 'public'
AS $$
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
  
  -- Query underlying tables directly instead of view
  RETURN QUERY
  SELECT
    p.org_id,
    p.id as prompt_id,
    p.text,
    COUNT(pr.id) as runs_7d,
    AVG(vr.score::numeric) as avg_score_7d
  FROM prompts p
  LEFT JOIN prompt_runs pr ON pr.prompt_id = p.id AND pr.run_at >= now() - interval '7 days'
  LEFT JOIN visibility_results vr ON vr.prompt_run_id = pr.id
  WHERE p.org_id = requesting_org_id
  GROUP BY p.org_id, p.id, p.text;
END;
$$;

-- Drop the vulnerable views since they are no longer needed
DROP VIEW IF EXISTS public.v_competitor_share_7d;
DROP VIEW IF EXISTS public.v_prompt_visibility_7d;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_competitor_share_7d(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prompt_visibility_7d(uuid) TO authenticated;