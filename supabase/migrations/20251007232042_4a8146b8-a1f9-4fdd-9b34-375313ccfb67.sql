-- Ensure secure RPC function exists with proper return type
-- This function masks sensitive payment data (Stripe IDs, raw metadata, emails)

CREATE OR REPLACE FUNCTION public.get_user_subscription_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Return only safe subscription fields, masking sensitive payment data
  SELECT json_build_object(
    'subscribed', COALESCE(s.subscribed, false),
    'subscription_tier', COALESCE(s.subscription_tier, 'free'),
    'subscription_end', s.subscription_end,
    'trial_expires_at', s.trial_expires_at,
    'trial_started_at', s.trial_started_at,
    'payment_collected', COALESCE(s.payment_collected, false)
    -- Deliberately excluding: stripe_customer_id, stripe_subscription_id, email, raw metadata
  ) INTO result
  FROM public.subscribers s
  WHERE s.user_id = auth.uid();
  
  -- Return null if no subscription found
  RETURN result;
END;
$$;

-- Grant execution to authenticated users only
REVOKE ALL ON FUNCTION public.get_user_subscription_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_status() TO authenticated;

COMMENT ON FUNCTION public.get_user_subscription_status() IS 
  'SECURITY: Returns user subscription status without exposing sensitive payment data (Stripe IDs, emails, metadata). Use this instead of direct subscribers table queries.';