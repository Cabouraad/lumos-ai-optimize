-- Fix scheduler_state RLS policy to be more restrictive
-- Remove the overly permissive policy
DROP POLICY IF EXISTS "scheduler_state_service_access" ON scheduler_state;

-- Create a more restrictive policy that only allows service role
CREATE POLICY "scheduler_state_service_only" 
ON scheduler_state 
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');