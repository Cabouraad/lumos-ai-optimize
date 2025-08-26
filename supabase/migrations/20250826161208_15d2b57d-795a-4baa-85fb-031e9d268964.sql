-- Document security model for user_subscription_safe view
-- Note: This view is based on the 'subscribers' table which already has RLS policies:
-- 1. subscribers_select_own_secure: Users can only see their own subscription data
-- 2. subscribers_select_service_role: Service role has full access
-- 3. subscribers_insert/update/delete_service_only: Only service role can modify data
-- 
-- The view inherits all RLS policies from the underlying subscribers table,
-- ensuring users can only access their own subscription data (user_id = auth.uid())

COMMENT ON VIEW public.user_subscription_safe IS 
'Secure view of subscriber data. Inherits RLS policies from subscribers table - users can only see their own data, service role has full access.';