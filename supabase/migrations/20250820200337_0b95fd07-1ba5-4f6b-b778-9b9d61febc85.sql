-- Tighten RLS on public.subscribers to prevent unauthorized access/modification
-- Ensure RLS is enabled
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Replace INSERT policy: only allow creating own row (by user_id or email) for authenticated users
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;
CREATE POLICY "insert_subscription"
ON public.subscribers
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR email = auth.email());

-- Replace UPDATE policy: only allow updating own row for authenticated users
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
CREATE POLICY "update_own_subscription"
ON public.subscribers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR email = auth.email());

-- Re-create SELECT policy explicitly scoped to authenticated users
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;
CREATE POLICY "select_own_subscription"
ON public.subscribers
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR email = auth.email());