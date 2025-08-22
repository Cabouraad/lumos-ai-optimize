-- Backfill user_id for subscribers from public.users by matching email
UPDATE public.subscribers s
SET user_id = u.id
FROM public.users u
WHERE s.user_id IS NULL
  AND s.email = u.email;

-- Replace RLS policy to require strict user_id match only
DROP POLICY IF EXISTS "secure_subscription_access" ON public.subscribers;
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;

CREATE POLICY "subscribers_select_userid_only"
ON public.subscribers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

COMMENT ON POLICY "subscribers_select_userid_only" ON public.subscribers IS
'Restricts access strictly to rows where user_id matches the authenticated user. Email-based access removed to prevent data leakage.';