-- Drop the existing security definer view
DROP VIEW IF EXISTS public.latest_prompt_provider_responses;

-- Recreate the view without SECURITY DEFINER
-- The view will automatically inherit RLS policies from the underlying prompt_provider_responses table
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
  ppr.error,
  ppr.token_in,
  ppr.token_out,
  ppr.metadata
FROM prompt_provider_responses ppr
ORDER BY ppr.prompt_id, ppr.provider, ppr.run_at DESC;