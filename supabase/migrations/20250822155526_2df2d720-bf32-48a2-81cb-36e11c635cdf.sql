-- FIX CRITICAL SECURITY VULNERABILITY: Restrict subscribers table operations to service role only
-- Current policies allow ANY authenticated user to modify payment data

-- Drop existing insecure policies
DROP POLICY IF EXISTS "subscribers_insert_service_only" ON public.subscribers;
DROP POLICY IF EXISTS "subscribers_update_service_only" ON public.subscribers;  
DROP POLICY IF EXISTS "subscribers_delete_service_only" ON public.subscribers;

-- Create secure policies that only allow service role to modify subscription data
CREATE POLICY "subscribers_insert_service_only" ON public.subscribers
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "subscribers_update_service_only" ON public.subscribers  
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "subscribers_delete_service_only" ON public.subscribers
FOR DELETE
USING (auth.role() = 'service_role');

-- Keep the existing SELECT policy unchanged (users can view their own data)
-- Policy "subscribers_select_userid_only" already correctly restricts to (user_id = auth.uid())

-- Verify the fix by checking updated policies
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
WHERE cls.relname = 'subscribers'
ORDER BY pol.polname;