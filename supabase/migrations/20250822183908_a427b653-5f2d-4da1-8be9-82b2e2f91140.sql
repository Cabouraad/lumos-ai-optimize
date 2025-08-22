-- Harden RLS on subscribers table to prevent cross-user access to sensitive payment data
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Drop old/insecure or conflicting policies if present
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "subscribers_select_userid_only" ON public.subscribers;
DROP POLICY IF EXISTS "subscribers_select_own_secure" ON public.subscribers;
DROP POLICY IF EXISTS "subscribers_select_service_role" ON public.subscribers;
DROP POLICY IF EXISTS "subscribers_insert_service_only" ON public.subscribers;
DROP POLICY IF EXISTS "subscribers_update_service_only" ON public.subscribers;
DROP POLICY IF EXISTS "subscribers_delete_service_only" ON public.subscribers;

-- Secure SELECT: only authenticated users can read their own row
CREATE POLICY "subscribers_select_own_secure" ON public.subscribers
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND 
  user_id IS NOT NULL AND 
  user_id = auth.uid()
);

-- Service role can read all for admin/automation tasks
CREATE POLICY "subscribers_select_service_role" ON public.subscribers
FOR SELECT
USING (auth.role() = 'service_role');

-- Lock down writes to service role only (payment operations)
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