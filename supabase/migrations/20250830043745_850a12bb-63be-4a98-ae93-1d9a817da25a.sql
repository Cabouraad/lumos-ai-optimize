-- Create catalog-only competitor filtering function
CREATE OR REPLACE FUNCTION public.get_latest_prompt_provider_responses_catalog_only(
  p_prompt_id uuid DEFAULT NULL::uuid, 
  p_org_id uuid DEFAULT NULL::uuid
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
  -- with competitors filtered to only show catalog competitors
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
  ),
  filtered_responses AS (
    SELECT 
      r.*,
      -- Filter competitors to only include those in brand_catalog
      (
        SELECT jsonb_agg(competitor_name)
        FROM (
          SELECT competitor_name
          FROM jsonb_array_elements_text(r.competitors_json) AS competitor_name
          WHERE EXISTS (
            SELECT 1 FROM brand_catalog bc 
            WHERE bc.org_id = p_org_id 
              AND bc.is_org_brand = false
              AND LOWER(TRIM(bc.name)) = LOWER(TRIM(competitor_name))
          )
        ) filtered_competitors
      ) as filtered_competitors_json
    FROM ranked_responses r
    WHERE r.rn = 1
  )
  SELECT 
    fr.id,
    fr.org_id,
    fr.prompt_id,
    fr.run_at,
    fr.score,
    fr.org_brand_present,
    fr.org_brand_prominence,
    -- Update competitor count to reflect filtered competitors
    COALESCE(jsonb_array_length(fr.filtered_competitors_json), 0) as competitors_count,
    COALESCE(fr.filtered_competitors_json, '[]'::jsonb) as competitors_json,
    fr.brands_json,
    fr.token_in,
    fr.token_out,
    fr.metadata,
    fr.status,
    fr.raw_ai_response,
    fr.raw_evidence,
    fr.error,
    fr.provider,
    fr.model
  FROM filtered_responses fr
  ORDER BY fr.run_at DESC;
END;
$$;