-- Fix: Allow users to read their own user record
-- This is critical for the app to function - users need to see their own org_id

-- First, check existing policies on users table
DO $$
BEGIN
  -- Drop existing restrictive policies if they exist
  DROP POLICY IF EXISTS "users_select_own" ON public.users;
  DROP POLICY IF EXISTS "users_read_own" ON public.users;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policy allowing users to read their own user record
CREATE POLICY "users_can_read_own_record"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Allow service role full access
CREATE POLICY "users_service_role_all"
ON public.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "users_can_read_own_record" ON public.users IS 
  'Critical: Users must be able to read their own user record to get org_id';
