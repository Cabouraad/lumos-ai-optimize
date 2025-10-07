-- Fix users table RLS policy to prevent email harvesting
-- Users should only be able to view their own record, not all users in their organization

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "users_select_own_org_fixed" ON public.users;

-- Create new restrictive policy: users can only see their own record
CREATE POLICY "users_select_own_record_only" 
ON public.users 
FOR SELECT 
USING (id = auth.uid());

-- Add comment for clarity
COMMENT ON POLICY "users_select_own_record_only" ON public.users IS 
'Security: Users can only view their own record to prevent email harvesting and unauthorized access to employee information';