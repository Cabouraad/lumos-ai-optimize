-- FIX CRITICAL SECURITY VULNERABILITY: Restrict subscribers_audit table access to service role only
-- Current policy allows ANY user to read sensitive audit data including emails and payment info

-- Drop the existing insecure policy that allows public read access
DROP POLICY IF EXISTS "audit_service_only" ON public.subscribers_audit;

-- Create secure policy that ONLY allows service role to access audit data
CREATE POLICY "audit_service_role_only" ON public.subscribers_audit
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Verify the fix by checking the updated policy
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
WHERE cls.relname = 'subscribers_audit'
ORDER BY pol.polname;