-- Replace the latest_prompt_provider_responses view with a secure RPC function
-- This eliminates the security warning by using proper function-based access control

-- Drop the existing view
DROP VIEW IF EXISTS public.latest_prompt_provider_responses;

-- Create a secure function that provides the same functionality with proper access control
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
SET search_path = public
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
      AND ppr.status = 'success'
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

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.get_latest_prompt_provider_responses(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_prompt_provider_responses(uuid, uuid) TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION public.get_latest_prompt_provider_responses IS 'Secure function to get latest prompt provider responses with proper RLS-like filtering. Replaces the previous view to eliminate security warnings.';