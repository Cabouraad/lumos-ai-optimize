-- SECURITY FIX: Strengthen users table RLS policies to prevent email address exposure
-- The current policy may have gaps that allow unauthorized access to user email addresses

-- First, let's ensure we have the most restrictive and secure RLS policies
-- Drop existing policies to rebuild them more securely
DROP POLICY IF EXISTS "users_read_self" ON public.users;

-- Create a stronger, more explicit RLS policy for users table
-- This policy ensures users can ONLY see their own record and nothing else
CREATE POLICY "users_select_own_data_only" 
ON public.users
FOR SELECT 
TO authenticated
USING (
  -- Only allow access to the user's own record
  id = auth.uid()
  AND 
  -- Additional safety check: ensure the authenticated user exists
  auth.uid() IS NOT NULL
);

-- Ensure no other operations are allowed except by service role
CREATE POLICY "users_service_role_only_mutations"
ON public.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add a policy to prevent any other access patterns
CREATE POLICY "users_block_all_other_access"
ON public.users
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Create a security function to safely get user org info
-- This prevents any potential RLS bypasses in edge functions
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER  -- Uses caller's permissions, not function owner's
STABLE
AS $$
  -- This function will respect RLS policies
  SELECT org_id 
  FROM public.users 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute permission only to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO service_role;

-- Add comment explaining the security measures
COMMENT ON TABLE public.users IS 'User table with strict RLS policies. Users can only access their own record. Email addresses are protected from unauthorized access.';
COMMENT ON FUNCTION public.get_current_user_org_id() IS 'Secure function to get current user org_id while respecting RLS policies';