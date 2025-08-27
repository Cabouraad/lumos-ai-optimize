-- Fix remaining functions without proper search_path settings

-- Fix all remaining functions that need SECURITY INVOKER and search_path
CREATE OR REPLACE FUNCTION public.assert_service_for_user_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can modify users';
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_service_for_org_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can insert organizations';
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_service_for_llm_provider_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can modify llm_providers';
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.subscribers_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.subscribers_audit (
    subscriber_user_id,
    action,
    old_values,
    new_values,
    changed_by
  ) VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.setup_admin_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if this is one of the admin emails
  IF NEW.email IN ('abouraa.chri@gmail.com', 'amirdt22@gmail.com') THEN
    -- Update user role to owner
    UPDATE users 
    SET role = 'owner' 
    WHERE id = NEW.id;
    
    -- Update their organization to Pro tier
    UPDATE organizations 
    SET subscription_tier = 'pro',
        plan_tier = 'pro'
    WHERE id = (SELECT org_id FROM users WHERE id = NEW.id);
    
    -- Upsert Pro subscription record (handles existing records)
    INSERT INTO subscribers (
        user_id,
        email,
        subscription_tier,
        subscribed,
        payment_collected,
        trial_started_at,
        trial_expires_at,
        subscription_end
    ) VALUES (
        NEW.id,
        NEW.email,
        'pro',
        true,
        true,
        now(),
        now() + interval '1 year',
        now() + interval '1 year'
    )
    ON CONFLICT (email) 
    DO UPDATE SET
        user_id = EXCLUDED.user_id,
        subscription_tier = EXCLUDED.subscription_tier,
        subscribed = EXCLUDED.subscribed,
        payment_collected = EXCLUDED.payment_collected,
        trial_started_at = EXCLUDED.trial_started_at,
        trial_expires_at = EXCLUDED.trial_expires_at,
        subscription_end = EXCLUDED.subscription_end,
        updated_at = now();
    
    RAISE NOTICE 'Admin user % set up with Pro subscription', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$function$;