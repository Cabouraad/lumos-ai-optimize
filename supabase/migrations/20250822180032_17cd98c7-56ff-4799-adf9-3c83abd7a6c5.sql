-- FIX CRITICAL SECURITY VULNERABILITY: Strengthen subscribers table RLS policies
-- Current issue: SELECT policy doesn't properly handle NULL values and unauthenticated users

-- Drop the existing potentially vulnerable SELECT policy
DROP POLICY IF EXISTS "subscribers_select_userid_only" ON public.subscribers;

-- Create a more secure SELECT policy that:
-- 1. Requires authentication (auth.uid() IS NOT NULL)
-- 2. Requires user_id to be NOT NULL 
-- 3. Ensures exact match between user_id and auth.uid()
CREATE POLICY "subscribers_select_own_secure" ON public.subscribers
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND 
  user_id IS NOT NULL AND 
  user_id = auth.uid()
);

-- Add additional security: Ensure service role can always access for administrative tasks
CREATE POLICY "subscribers_select_service_role" ON public.subscribers
FOR SELECT
USING (auth.role() = 'service_role');

-- Verify the updated policies
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
  pg_get_expr(pol.polqual, pol.polrelid) as using_expression
FROM pg_policy pol
JOIN pg_class cls on cls.oid = pol.polrelid
WHERE cls.relname = 'subscribers'
  AND pol.polcmd = 'r'  -- Only SELECT policies
ORDER BY pol.polname;