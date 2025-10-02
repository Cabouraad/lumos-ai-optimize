-- Recreate get_latest_prompt_provider_responses to ensure provider and model are returned
DROP FUNCTION IF EXISTS public.get_latest_prompt_provider_responses(uuid, uuid);
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
  metadata jsonb
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
      ppr.metadata
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