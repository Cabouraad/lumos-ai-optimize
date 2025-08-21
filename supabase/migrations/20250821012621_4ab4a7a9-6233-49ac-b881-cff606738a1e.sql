-- Create secure function to replace v_competitor_share_7d view
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
SET search_path = public
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
  
  -- Return the competitor share data for the authorized org
  RETURN QUERY
  SELECT 
    v.org_id,
    v.prompt_id,
    v.brand_norm,
    v.mean_score,
    v.n
  FROM v_competitor_share_7d v
  WHERE v.org_id = requesting_org_id;
END;
$$;

-- Create secure function to replace v_prompt_visibility_7d view  
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
SET search_path = public
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
  
  -- Return the prompt visibility data for the authorized org
  RETURN QUERY
  SELECT 
    v.org_id,
    v.prompt_id,
    v.text,
    v.runs_7d,
    v.avg_score_7d
  FROM v_prompt_visibility_7d v
  WHERE v.org_id = requesting_org_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_competitor_share_7d(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prompt_visibility_7d(uuid) TO authenticated;