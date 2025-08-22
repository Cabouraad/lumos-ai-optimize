-- Fix Security Definer View issue by recreating user_subscription_safe view
-- The issue is that the view is owned by 'postgres' (superuser) which gives it
-- SECURITY DEFINER behavior even without explicit declaration

-- Drop the existing view
DROP VIEW IF EXISTS public.user_subscription_safe;

-- Recreate the view with proper security context
-- This view should respect RLS policies of the underlying table
CREATE VIEW public.user_subscription_safe 
WITH (security_invoker = true)  -- Explicitly set security invoker
AS
SELECT 
  user_id,
  email,
  subscription_tier,
  subscribed,
  trial_started_at,
  trial_expires_at,
  subscription_end,
  CASE
    WHEN stripe_customer_id IS NOT NULL THEN 'has_payment_method'::text
    ELSE NULL::text
  END AS payment_status,
  created_at,
  updated_at
FROM subscribers;

-- Grant appropriate permissions
GRANT SELECT ON public.user_subscription_safe TO authenticated;
GRANT SELECT ON public.user_subscription_safe TO anon;

-- Note: The view will now respect the RLS policies of the underlying 'subscribers' table
-- instead of bypassing them with superuser privileges