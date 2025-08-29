-- Fix get_latest_prompt_provider_responses to include failed responses for better visibility
-- This removes the filter that was hiding error records

DROP FUNCTION IF EXISTS public.get_latest_prompt_provider_responses(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_latest_prompt_provider_responses(
  p_prompt_id uuid DEFAULT NULL,
  p_org_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  org_id uuid,
  prompt_id uuid,
  run_at timestamp with time zone,
  score numeric,
  org_brand_present boolean,
  org_brand_prominence integer,
  competitors_count integer,
  competitors_json jsonb,
  brands_json jsonb,
  token_in integer,
  token_out integer,
  metadata jsonb,
  status text,
  raw_ai_response text,
  raw_evidence text,
  error text,
  provider text,
  model text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF p_org_id IS NULL THEN
    p_org_id := user_org_id;
  END IF;
  
  -- Only allow access to user's own org data
  IF p_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own organization data';
  END IF;
  
  -- Return the latest response for each provider for each prompt
  -- CRITICAL: Removed status = 'success' filter to show ALL responses including errors
  RETURN QUERY
  WITH ranked_responses AS (
    SELECT 
      ppr.*,
      ROW_NUMBER() OVER (
        PARTITION BY ppr.prompt_id, ppr.provider 
        ORDER BY ppr.run_at DESC
      ) as rn
    FROM prompt_provider_responses ppr
    JOIN prompts p ON p.id = ppr.prompt_id
    WHERE p.org_id = p_org_id
      AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
  )
  SELECT 
    r.id,
    r.org_id,
    r.prompt_id,
    r.run_at,
    r.score,
    r.org_brand_present,
    r.org_brand_prominence,
    r.competitors_count,
    r.competitors_json,
    r.brands_json,
    r.token_in,
    r.token_out,
    r.metadata,
    r.status,
    r.raw_ai_response,
    r.raw_evidence,
    r.error,
    r.provider,
    r.model
  FROM ranked_responses r
  WHERE r.rn = 1
  ORDER BY r.run_at DESC;
END;
$$;