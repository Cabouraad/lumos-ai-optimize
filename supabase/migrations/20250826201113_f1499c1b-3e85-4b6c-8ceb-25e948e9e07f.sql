-- Drop the insecure user_subscription_safe view
-- This view bypasses RLS policies and provides uncontrolled access to sensitive subscription data
-- Users should query the subscribers table directly which has proper RLS policies

DROP VIEW IF EXISTS public.user_subscription_safe;

-- The user_subscription_safe view was providing access to sensitive subscription data
-- without RLS protection. Users should instead query the subscribers table directly:
-- SELECT subscription_tier, subscribed, trial_expires_at, subscription_end, 
--        CASE WHEN stripe_customer_id IS NOT NULL THEN 'has_payment_method' ELSE NULL END as payment_status
-- FROM subscribers WHERE user_id = auth.uid();

-- This query will be properly protected by the existing RLS policies on the subscribers table