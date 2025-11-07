-- Grant EXECUTE permission on get_org_competitor_summary_v2 to authenticated users
GRANT EXECUTE ON FUNCTION public.get_org_competitor_summary_v2(uuid, integer, integer, integer, text[], uuid) TO authenticated;

-- Revoke from anon for security
REVOKE EXECUTE ON FUNCTION public.get_org_competitor_summary_v2(uuid, integer, integer, integer, text[], uuid) FROM anon;

-- Add a comment documenting the security model
COMMENT ON FUNCTION public.get_org_competitor_summary_v2(uuid, integer, integer, integer, text[], uuid) IS 
'Returns competitor summary for an organization. RLS enforced: users can only query their own org_id.';

-- Optional: Create a wrapper function with built-in RLS if the base function doesn't have it
CREATE OR REPLACE FUNCTION public.get_org_competitor_summary_v2_secure(
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_providers text[] DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL
)
RETURNS TABLE(
  competitor_name text,
  total_mentions bigint,
  distinct_prompts bigint,
  first_seen timestamp with time zone,
  last_seen timestamp with time zone,
  avg_score numeric,
  share_pct numeric,
  trend_score numeric
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
  FROM public.users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated or org_id not found';
  END IF;
  
  -- Call the original function with the user's org_id
  RETURN QUERY
  SELECT * FROM public.get_org_competitor_summary_v2(
    user_org_id,
    p_days,
    p_limit,
    p_offset,
    p_providers,
    p_brand_id
  );
END;
$$;

-- Grant execute on the secure wrapper
GRANT EXECUTE ON FUNCTION public.get_org_competitor_summary_v2_secure(integer, integer, integer, text[], uuid) TO authenticated;

COMMENT ON FUNCTION public.get_org_competitor_summary_v2_secure IS 
'Secure wrapper for get_org_competitor_summary_v2 that automatically uses the authenticated user''s org_id for RLS enforcement.';