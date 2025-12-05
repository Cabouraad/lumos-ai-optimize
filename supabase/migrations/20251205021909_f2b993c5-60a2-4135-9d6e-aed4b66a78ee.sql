-- Drop the policy that applies to public (unauthenticated) role
-- This is flagged as a security risk because public role shouldn't have any access to user emails
DROP POLICY IF EXISTS "users_select_own_record_only" ON public.users;

-- Verify the authenticated-only policy exists and is correct
-- If it doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND schemaname = 'public' 
    AND policyname = 'users_can_read_own_record'
  ) THEN
    CREATE POLICY "users_can_read_own_record" ON public.users
    FOR SELECT TO authenticated
    USING (id = auth.uid());
  END IF;
END $$;