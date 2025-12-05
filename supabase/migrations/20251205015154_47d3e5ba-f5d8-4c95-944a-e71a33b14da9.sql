
-- Add INSERT policy: Users can only insert their own record (matching auth.uid())
CREATE POLICY "users_insert_own_record" ON public.users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Add UPDATE policy: Users can only update their own record
CREATE POLICY "users_update_own_record" ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Explicitly deny DELETE for regular users (only service_role can delete)
-- No DELETE policy for authenticated users means they cannot delete any records
-- Service role already has ALL access via users_service_role_all

-- Add a restrictive policy comment for documentation
COMMENT ON TABLE public.users IS 'User profiles with RLS enabled. Users can only read/insert/update their own record. Only service_role can delete.';
