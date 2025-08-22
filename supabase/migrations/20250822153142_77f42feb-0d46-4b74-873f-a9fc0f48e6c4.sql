-- Fix remaining Security Definer issues by converting data access functions to SECURITY INVOKER
-- Only keep SECURITY DEFINER for functions that genuinely need elevated privileges

-- Convert get_prompt_visibility_7d() to SECURITY INVOKER since it has proper org access control
CREATE OR REPLACE FUNCTION public.get_prompt_visibility_7d(requesting_org_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(org_id uuid, prompt_id uuid, text text, runs_7d bigint, avg_score_7d numeric)
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
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

-- Convert get_competitor_share_7d() to SECURITY INVOKER since it has proper org access control
CREATE OR REPLACE FUNCTION public.get_competitor_share_7d(requesting_org_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(org_id uuid, prompt_id uuid, brand_norm text, mean_score numeric, n bigint)
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
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

-- Note: The remaining SECURITY DEFINER functions are kept as-is because they serve legitimate purposes:
-- 1. Trigger functions (normalize_domain, touch_updated_at, etc.) need elevated privileges
-- 2. Service role assertion functions (assert_service_for_*) need to check auth.role()
-- 3. Admin setup functions (setup_admin_user) need elevated privileges
-- 4. Complex upsert functions (upsert_competitor_*, reco_upsert) need elevated privileges for multi-table operations
-- 5. Service-only functions (update_subscriber_safe) are explicitly designed for service role access

-- These functions all follow security best practices within their elevated context.