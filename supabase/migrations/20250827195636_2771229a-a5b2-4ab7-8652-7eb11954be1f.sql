
-- 1) Make user_subscription_safe explicitly use invoker semantics and restrict grants
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'user_subscription_safe'
  ) THEN
    EXECUTE $v$
      ALTER VIEW public.user_subscription_safe SET (security_invoker = true);
      REVOKE ALL ON public.user_subscription_safe FROM PUBLIC;
      GRANT SELECT ON public.user_subscription_safe TO authenticated;
    $v$;
  END IF;
END$$;

-- 2) Recreate latest_prompt_provider_responses as security_invoker and encode explicit org filter
DROP VIEW IF EXISTS public.latest_prompt_provider_responses;

CREATE VIEW public.latest_prompt_provider_responses
WITH (security_invoker = true) AS
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
FROM public.prompt_provider_responses AS ppr
JOIN public.users AS u
  ON u.org_id = ppr.org_id
 AND u.id = auth.uid()
ORDER BY ppr.prompt_id, ppr.provider, ppr.run_at DESC;

REVOKE ALL ON public.latest_prompt_provider_responses FROM PUBLIC;
GRANT SELECT ON public.latest_prompt_provider_responses TO authenticated;
