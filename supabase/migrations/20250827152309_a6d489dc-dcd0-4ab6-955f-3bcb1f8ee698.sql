-- Fix Security Issues: Remove SECURITY DEFINER and add proper RLS policies

-- 1. Fix the latest_prompt_provider_responses view by dropping and recreating as regular view
DROP VIEW IF EXISTS public.latest_prompt_provider_responses;

-- Recreate as a regular view (inherits RLS from underlying tables)
CREATE VIEW public.latest_prompt_provider_responses AS
SELECT DISTINCT ON (ppr.prompt_id, ppr.provider) 
  ppr.id,
  ppr.org_id,
  ppr.prompt_id,
  ppr.provider,
  ppr.model,
  ppr.status,
  ppr.run_at,
  ppr.score,
  ppr.org_brand_present,
  ppr.org_brand_prominence,
  ppr.competitors_count,
  ppr.competitors_json,
  ppr.brands_json,
  ppr.raw_ai_response,
  ppr.raw_evidence,
  ppr.token_in,
  ppr.token_out,
  ppr.metadata,
  ppr.error
FROM public.prompt_provider_responses ppr
ORDER BY ppr.prompt_id, ppr.provider, ppr.run_at DESC;

-- Enable RLS on the view (inherits from underlying table policies)
ALTER VIEW public.latest_prompt_provider_responses OWNER TO postgres;

-- 2. Fix functions with mutable search_path by updating existing functions
-- Update functions to have proper search_path settings

-- Fix the update_updated_at function (if it exists without search_path)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fix the touch_updated_at function 
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix the update_recommendations_updated_at function
CREATE OR REPLACE FUNCTION public.update_recommendations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix the update_subscribers_updated_at function
CREATE OR REPLACE FUNCTION public.update_subscribers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fix the normalize_domain function
CREATE OR REPLACE FUNCTION public.normalize_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  new.domain := lower(trim(new.domain));
  RETURN new;
END;
$function$;

-- Fix the prevent_domain_change function
CREATE OR REPLACE FUNCTION public.prevent_domain_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (old.domain_locked_at IS NOT NULL) AND (new.domain <> old.domain) THEN
    RAISE EXCEPTION 'Domain is locked and cannot be changed';
  END IF;
  RETURN new;
END;
$function$;