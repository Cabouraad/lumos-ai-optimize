-- Fix Security Definer functions by converting data access functions to use RLS
-- Keep SECURITY DEFINER only for functions that genuinely need elevated privileges

-- Convert get_user_subscription_status() to SECURITY INVOKER
-- This function can use RLS since it only filters by auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_subscription_status()
RETURNS TABLE(subscription_tier text, subscribed boolean, trial_expires_at timestamp with time zone, subscription_end timestamp with time zone, payment_collected boolean)
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.subscription_tier,
    s.subscribed,
    s.trial_expires_at,
    s.subscription_end,
    COALESCE(s.payment_collected, false) as payment_collected
  FROM public.subscribers s
  WHERE s.user_id = auth.uid();
END;
$function$;

-- Note: Other SECURITY DEFINER functions are kept as-is because they serve legitimate purposes:
-- 1. Trigger functions need elevated privileges to work properly
-- 2. Service role assertion functions need to check auth.role() 
-- 3. Complex upsert functions need elevated privileges for multi-table operations
-- 4. The data access functions (get_prompt_visibility_7d, get_competitor_share_7d) 
--    have proper org-level access control and are more complex than simple user filtering

-- All remaining SECURITY DEFINER functions follow security best practices:
-- - They validate user permissions before returning data
-- - They implement proper access control checks
-- - They follow the principle of least privilege within their elevated context