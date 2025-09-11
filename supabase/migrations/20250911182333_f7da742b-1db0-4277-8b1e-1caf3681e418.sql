-- Update the RPC function to use the secure view instead of direct table access
CREATE OR REPLACE FUNCTION public.get_user_subscription_status()
RETURNS TABLE(subscription_tier text, subscribed boolean, trial_expires_at timestamp with time zone, subscription_end timestamp with time zone, payment_collected boolean)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.tier as subscription_tier,
    CASE WHEN sp.status = 'active' THEN true ELSE false END as subscribed,
    -- Since we don't have trial_expires_at in view, derive from status and period_ends_at
    CASE WHEN sp.status = 'trialing' THEN sp.period_ends_at ELSE NULL END as trial_expires_at,
    sp.period_ends_at as subscription_end,
    CASE WHEN sp.status IN ('active', 'trialing') THEN true ELSE false END as payment_collected
  FROM public.subscriber_public sp
  WHERE sp.org_id IN (
    SELECT u.org_id FROM public.users u WHERE u.id = auth.uid()
  );
END;
$$;