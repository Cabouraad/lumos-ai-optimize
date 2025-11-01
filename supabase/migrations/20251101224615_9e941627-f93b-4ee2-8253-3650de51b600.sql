-- Helper RPC functions for user count management

-- Function to get current user count for an organization
CREATE OR REPLACE FUNCTION get_org_user_count(org_id_param uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM users
  WHERE org_id = org_id_param;
$$;

COMMENT ON FUNCTION get_org_user_count IS 'Returns the current number of users in an organization';

-- Function to get user limit for an organization based on their subscription tier
CREATE OR REPLACE FUNCTION get_org_user_limit(org_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier text;
  user_limit integer;
BEGIN
  -- Get the subscription tier from organizations table
  SELECT subscription_tier INTO tier
  FROM organizations
  WHERE id = org_id_param;
  
  -- Return user limit based on tier
  CASE tier
    WHEN 'starter' THEN user_limit := 1;
    WHEN 'growth' THEN user_limit := 3;
    WHEN 'pro' THEN user_limit := 10;
    ELSE user_limit := 1; -- Default to free tier limit
  END CASE;
  
  RETURN user_limit;
END;
$$;

COMMENT ON FUNCTION get_org_user_limit IS 'Returns the maximum number of users allowed for an organization based on their subscription tier';
