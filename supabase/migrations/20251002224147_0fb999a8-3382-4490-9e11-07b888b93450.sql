-- Fix get_latest_prompt_provider_responses to include all necessary fields
DROP FUNCTION IF EXISTS public.get_latest_prompt_provider_responses(uuid);

CREATE OR REPLACE FUNCTION public.get_latest_prompt_provider_responses(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  prompt_id uuid,
  provider text,
  model text,
  status text,
  run_at timestamp with time zone,
  full_text text,
  error_message text,
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
AS $$
BEGIN
  RETURN QUERY
  WITH latest_per_provider AS (
    SELECT DISTINCT ON (ppr.prompt_id, ppr.provider)
      ppr.id,
      ppr.prompt_id,
      ppr.provider,
      ppr.model,
      ppr.status,
      ppr.run_at,
      ppr.full_text,
      ppr.error_message,
      ppr.metadata,
      ppr.score,
      ppr.org_brand_present,
      ppr.org_brand_prominence,
      ppr.competitors_count,
      ppr.competitors_json,
      ppr.brands_json,
      ppr.citations_json,
      ppr.token_in,
      ppr.token_out
    FROM prompt_provider_responses ppr
    INNER JOIN prompts p ON p.id = ppr.prompt_id
    WHERE p.org_id = p_org_id
      AND ppr.provider IS NOT NULL
    ORDER BY ppr.prompt_id, ppr.provider, ppr.run_at DESC
  )
  SELECT * FROM latest_per_provider
  ORDER BY run_at DESC;
END;
$$;