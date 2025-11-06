-- Update get_latest_prompt_provider_responses to only return successful/completed responses
CREATE OR REPLACE FUNCTION public.get_latest_prompt_provider_responses(p_org_id uuid)
RETURNS TABLE(
  id uuid,
  prompt_id uuid,
  provider text,
  model text,
  status text,
  run_at timestamp with time zone,
  raw_ai_response text,
  error text,
  metadata jsonb,
  score numeric,
  org_brand_present boolean,
  org_brand_prominence integer,
  competitors_count integer,
  competitors_json jsonb,
  brands_json jsonb,
  citations_json jsonb,
  token_in integer,
  token_out integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH normalized_responses AS (
    SELECT 
      ppr.id,
      ppr.prompt_id,
      -- Normalize provider names
      CASE 
        WHEN ppr.provider = 'perplexity_ai' THEN 'perplexity'
        WHEN ppr.provider = 'google_aio' THEN 'google_ai_overview'
        ELSE ppr.provider
      END as normalized_provider,
      ppr.model,
      ppr.status,
      ppr.run_at,
      ppr.raw_ai_response,
      ppr.error as error_text,
      ppr.metadata,
      ppr.score,
      ppr.org_brand_present,
      ppr.org_brand_prominence,
      -- Calculate competitors_count dynamically from competitors_json
      COALESCE(jsonb_array_length(ppr.competitors_json), 0) as competitors_count,
      ppr.competitors_json,
      ppr.brands_json,
      ppr.citations_json,
      ppr.token_in,
      ppr.token_out,
      ROW_NUMBER() OVER (
        PARTITION BY ppr.prompt_id, 
        CASE 
          WHEN ppr.provider = 'perplexity_ai' THEN 'perplexity'
          WHEN ppr.provider = 'google_aio' THEN 'google_ai_overview'
          ELSE ppr.provider
        END
        ORDER BY ppr.run_at DESC
      ) as rn
    FROM prompt_provider_responses ppr
    INNER JOIN prompts p ON p.id = ppr.prompt_id
    WHERE p.org_id = p_org_id
      AND ppr.provider IS NOT NULL
      AND ppr.status IN ('success', 'completed') -- CRITICAL: Only return successful responses
  )
  SELECT 
    nr.id,
    nr.prompt_id,
    nr.normalized_provider as provider,
    nr.model,
    nr.status,
    nr.run_at,
    nr.raw_ai_response,
    nr.error_text as error,
    nr.metadata,
    nr.score,
    nr.org_brand_present,
    nr.org_brand_prominence,
    nr.competitors_count,
    nr.competitors_json,
    nr.brands_json,
    nr.citations_json,
    nr.token_in,
    nr.token_out
  FROM normalized_responses nr
  WHERE nr.rn = 1
  ORDER BY nr.run_at DESC;
END;
$function$;