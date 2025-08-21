-- Fix subscribers table RLS policies - remove dangerous UPDATE/INSERT policies
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;

-- Keep only SELECT policy for users to view their own subscription
-- The existing "select_own_subscription" policy is safe to keep

-- Create a security definer function to handle subscriber updates safely
CREATE OR REPLACE FUNCTION public.update_subscriber_safe(
    p_user_id uuid,
    p_email text,
    p_stripe_customer_id text DEFAULT NULL,
    p_stripe_subscription_id text DEFAULT NULL,
    p_subscription_tier text DEFAULT NULL,
    p_subscribed boolean DEFAULT NULL,
    p_trial_started_at timestamp with time zone DEFAULT NULL,
    p_trial_expires_at timestamp with time zone DEFAULT NULL,
    p_payment_collected boolean DEFAULT NULL,
    p_subscription_end timestamp with time zone DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- Fix search_path for existing SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.get_prompt_visibility_7d(requesting_org_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(org_id uuid, prompt_id uuid, text text, runs_7d bigint, avg_score_7d numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  -- If no org_id found, return no results
  IF user_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Use provided org_id or default to user's org_id
  IF requesting_org_id IS NULL THEN
    requesting_org_id := user_org_id;
  END IF;
  
  -- Only allow access to user's own org data
  IF requesting_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own organization data';
  END IF;
  
  -- Query underlying tables directly instead of view
  RETURN QUERY
  SELECT
    p.org_id,
    p.id as prompt_id,
    p.text,
    COUNT(pr.id) as runs_7d,
    AVG(vr.score::numeric) as avg_score_7d
  FROM prompts p
  LEFT JOIN prompt_runs pr ON pr.prompt_id = p.id AND pr.run_at >= now() - interval '7 days'
  LEFT JOIN visibility_results vr ON vr.prompt_run_id = pr.id
  WHERE p.org_id = requesting_org_id
  GROUP BY p.org_id, p.id, p.text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_competitor_share_7d(requesting_org_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(org_id uuid, prompt_id uuid, brand_norm text, mean_score numeric, n bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  -- If no org_id found, return no results
  IF user_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Use provided org_id or default to user's org_id
  IF requesting_org_id IS NULL THEN
    requesting_org_id := user_org_id;
  END IF;
  
  -- Only allow access to user's own org data
  IF requesting_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own organization data';
  END IF;
  
  -- Query underlying tables directly instead of view
  RETURN QUERY
  SELECT
    p.org_id,
    p.id as prompt_id,
    brand_data.brand_name as brand_norm,
    AVG(brand_data.score::numeric) as mean_score,
    COUNT(*) as n
  FROM prompts p
  JOIN prompt_runs pr ON pr.prompt_id = p.id
  JOIN visibility_results vr ON vr.prompt_run_id = pr.id,
  jsonb_to_recordset(vr.brands_json) AS brand_data(brand_name text, score int)
  WHERE pr.run_at >= now() - interval '7 days'
    AND p.org_id = requesting_org_id
  GROUP BY p.org_id, p.id, brand_data.brand_name;
END;
$function$;