
-- Tighten privileges on the secure view without changing functionality
DO $$
BEGIN
  -- Ensure the view exists before altering
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'latest_prompt_provider_responses'
  ) THEN
    -- Keep security_invoker on
    EXECUTE 'ALTER VIEW public.latest_prompt_provider_responses SET (security_invoker = true)';
    -- Ensure stable ownership
    EXECUTE 'ALTER VIEW public.latest_prompt_provider_responses OWNER TO postgres';

    -- Revoke overly broad privileges
    EXECUTE 'REVOKE ALL ON VIEW public.latest_prompt_provider_responses FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON VIEW public.latest_prompt_provider_responses FROM anon';
    EXECUTE 'REVOKE ALL ON VIEW public.latest_prompt_provider_responses FROM authenticated';
    EXECUTE 'REVOKE ALL ON VIEW public.latest_prompt_provider_responses FROM service_role';

    -- Grant minimal, read-only privileges
    EXECUTE 'GRANT SELECT ON VIEW public.latest_prompt_provider_responses TO authenticated';
    EXECUTE 'GRANT SELECT ON VIEW public.latest_prompt_provider_responses TO service_role';
  END IF;
END$$;
