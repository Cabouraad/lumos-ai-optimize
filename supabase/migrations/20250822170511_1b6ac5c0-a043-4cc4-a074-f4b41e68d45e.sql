-- FIX CRITICAL SECURITY VULNERABILITY: Enable RLS and restrict access to user_subscription_safe table
-- Current state: NO RLS policies - any user can access ALL subscription data

-- Enable Row Level Security on the table
ALTER TABLE public.user_subscription_safe ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only view their own subscription data
CREATE POLICY "Users can view own subscription data" ON public.user_subscription_safe
FOR SELECT
USING (user_id = auth.uid());

-- Policy 2: Service role has full access for administrative purposes
CREATE POLICY "Service role full access" ON public.user_subscription_safe
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Verify the fix by checking the new policies
SELECT 
  pol.polname as policy_name,
  CASE pol.polcmd 
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT' 
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE pol.polcmd::text
  END as command,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
JOIN pg_class cls on cls.oid = pol.polrelid
WHERE cls.relname = 'user_subscription_safe'
ORDER BY pol.polname;