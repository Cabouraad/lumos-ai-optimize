-- Harden RLS on sensitive subscription tables to prevent cross-user access
-- 1) subscribers table
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

-- Secure SELECT: only the owner can read their row
CREATE POLICY "subscribers_select_own_secure" ON public.subscribers
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND 
  user_id IS NOT NULL AND 
  user_id = auth.uid()
);

-- Service role can read for admin/automation
CREATE POLICY "subscribers_select_service_role" ON public.subscribers
FOR SELECT
USING (auth.role() = 'service_role');

-- Lock down writes to service role only
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

-- 2) user_subscription_safe table (mirror protections)
ALTER TABLE public.user_subscription_safe ENABLE ROW LEVEL SECURITY;

-- Drop any existing conflicting policies
DROP POLICY IF EXISTS "user_subscription_safe_select_own" ON public.user_subscription_safe;
DROP POLICY IF EXISTS "user_subscription_safe_select_service_role" ON public.user_subscription_safe;
DROP POLICY IF EXISTS "user_subscription_safe_insert_service_only" ON public.user_subscription_safe;
DROP POLICY IF EXISTS "user_subscription_safe_update_service_only" ON public.user_subscription_safe;
DROP POLICY IF EXISTS "user_subscription_safe_delete_service_only" ON public.user_subscription_safe;

-- Secure SELECT: only the owner can read their row
CREATE POLICY "user_subscription_safe_select_own" ON public.user_subscription_safe
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND 
  user_id IS NOT NULL AND 
  user_id = auth.uid()
);

-- Service role can read for admin/automation
CREATE POLICY "user_subscription_safe_select_service_role" ON public.user_subscription_safe
FOR SELECT
USING (auth.role() = 'service_role');

-- Lock down writes to service role only
CREATE POLICY "user_subscription_safe_insert_service_only" ON public.user_subscription_safe
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "user_subscription_safe_update_service_only" ON public.user_subscription_safe
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "user_subscription_safe_delete_service_only" ON public.user_subscription_safe
FOR DELETE
USING (auth.role() = 'service_role');