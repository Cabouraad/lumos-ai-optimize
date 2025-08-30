-- Fix critical RLS policy vulnerabilities
-- These policies are missing proper authentication requirements

-- 1. Fix users table - require authentication for all access
DROP POLICY IF EXISTS "users_select_own_data_only" ON public.users;
CREATE POLICY "users_select_own_data_only" 
ON public.users 
FOR SELECT 
TO authenticated
USING (id = auth.uid());

-- 2. Fix subscribers table - ensure proper authentication 
-- The existing policies look correct but let's verify they're properly restrictive
DROP POLICY IF EXISTS "subscribers_select_own_secure" ON public.subscribers;
CREATE POLICY "subscribers_select_own_secure" 
ON public.subscribers 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id IS NOT NULL AND user_id = auth.uid());

-- 3. Fix organizations table - ensure users can only see their org
DROP POLICY IF EXISTS "org_read" ON public.organizations;
CREATE POLICY "org_read" 
ON public.organizations 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.users u 
  WHERE u.id = auth.uid() AND u.org_id = organizations.id
));

-- 4. Fix function search_path issues for security
-- Update all SECURITY DEFINER functions to explicitly set search_path

CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  secret_value text;
BEGIN
  SELECT value INTO secret_value FROM app_settings WHERE key = 'cron_secret';
  RETURN secret_value;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT org_id 
  FROM public.users 
  WHERE id = auth.uid()
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.update_subscriber_safe(p_user_id uuid, p_email text, p_stripe_customer_id text DEFAULT NULL::text, p_stripe_subscription_id text DEFAULT NULL::text, p_subscription_tier text DEFAULT NULL::text, p_subscribed boolean DEFAULT NULL::boolean, p_trial_started_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_trial_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_payment_collected boolean DEFAULT NULL::boolean, p_subscription_end timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- Only service role can call this function
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Access denied: Only service role can modify subscriptions';
    END IF;
    
    -- Upsert subscriber record
    INSERT INTO public.subscribers (
        user_id, 
        email, 
        stripe_customer_id,
        stripe_subscription_id,
        subscription_tier,
        subscribed,
        trial_started_at,
        trial_expires_at,
        payment_collected,
        subscription_end,
        updated_at
    ) VALUES (
        p_user_id,
        p_email,
        p_stripe_customer_id,
        p_stripe_subscription_id,
        p_subscription_tier,
        COALESCE(p_subscribed, false),
        p_trial_started_at,
        p_trial_expires_at,
        COALESCE(p_payment_collected, false),
        p_subscription_end,
        now()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        email = EXCLUDED.email,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscribers.stripe_customer_id),
        stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscribers.stripe_subscription_id),
        subscription_tier = COALESCE(EXCLUDED.subscription_tier, subscribers.subscription_tier),
        subscribed = COALESCE(EXCLUDED.subscribed, subscribers.subscribed),
        trial_started_at = COALESCE(EXCLUDED.trial_started_at, subscribers.trial_started_at),
        trial_expires_at = COALESCE(EXCLUDED.trial_expires_at, subscribers.trial_expires_at),
        payment_collected = COALESCE(EXCLUDED.payment_collected, subscribers.payment_collected),
        subscription_end = COALESCE(EXCLUDED.subscription_end, subscribers.subscription_end),
        updated_at = now();
END;
$function$;