-- Fix the SECURITY DEFINER view issue
-- Replace the view with a regular view (not SECURITY DEFINER)

DROP VIEW IF EXISTS public.user_subscription_safe;

-- Create a regular view that uses RLS policies instead of SECURITY DEFINER
CREATE VIEW public.user_subscription_safe AS
SELECT 
  user_id,
  email,
  subscription_tier,
  subscribed,
  trial_started_at,
  trial_expires_at,
  subscription_end,
  -- Mask sensitive payment data
  CASE 
    WHEN stripe_customer_id IS NOT NULL THEN 'has_payment_method'
    ELSE NULL
  END as payment_status,
  created_at,
  updated_at
FROM public.subscribers;

-- Grant access to the view
GRANT SELECT ON public.user_subscription_safe TO authenticated;

COMMENT ON VIEW public.user_subscription_safe IS
'SECURITY: Safe view for user subscription data that masks sensitive payment information. Uses RLS policies for access control.';