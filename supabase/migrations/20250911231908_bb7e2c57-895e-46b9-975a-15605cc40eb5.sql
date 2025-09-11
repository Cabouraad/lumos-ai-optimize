-- Fix infinite recursion in users RLS policy
-- Create a security definer function to get user's org_id without recursion

CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT u.org_id 
  FROM auth.users au
  JOIN public.users u ON u.id = au.id
  WHERE au.id = auth.uid()
  LIMIT 1;
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "users_select_own_org" ON public.users;

-- Create a new policy using the security definer function
CREATE POLICY "users_select_own_org_fixed" 
ON public.users 
FOR SELECT 
USING (
  org_id = public.get_current_user_org_id() 
  AND public.get_current_user_org_id() IS NOT NULL
);