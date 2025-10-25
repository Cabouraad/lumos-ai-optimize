
-- Re-run backfill using simple detection with catalog trigger disabled to avoid duplicate insert conflicts

-- Ensure helper functions exist (no-op if already created)
CREATE OR REPLACE FUNCTION public.get_org_brand_aliases(p_org_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT array_agg(DISTINCT lower(trim(b)))
  FROM (
    SELECT o.name AS b FROM public.organizations o WHERE o.id = p_org_id AND o.name IS NOT NULL
    UNION ALL
    SELECT bc.name AS b FROM public.brand_catalog bc WHERE bc.org_id = p_org_id AND bc.is_org_brand = true
    UNION ALL
    SELECT v AS b FROM public.brand_catalog bc, LATERAL jsonb_array_elements_text(bc.variants_json) v
      WHERE bc.org_id = p_org_id AND bc.is_org_brand = true AND jsonb_array_length(bc.variants_json) > 0
    UNION ALL
    SELECT split_part(o.domain, '.', 1) AS b FROM public.organizations o WHERE o.id = p_org_id AND o.domain IS NOT NULL
  ) s
  WHERE b IS NOT NULL AND length(trim(b)) >= 2
$$;

-- Disable auto populate trigger to prevent catalog writes during backfill
ALTER TABLE public.prompt_provider_responses DISABLE TRIGGER auto_populate_brand_catalog_trigger;

DO $$
DECLARE
  r RECORD;
  aliases text[];
BEGIN
  FOR r IN
    SELECT id, org_id, raw_ai_response
    FROM public.prompt_provider_responses
    WHERE status = 'success'
      AND run_at >= now() - interval '90 days'
  LOOP
    aliases := public.get_org_brand_aliases(r.org_id);
    IF aliases IS NOT NULL THEN
      UPDATE public.prompt_provider_responses p
      SET 
        org_brand_present = EXISTS (
          SELECT 1 FROM unnest(aliases) a
          WHERE a IS NOT NULL AND a <> '' AND position(a in lower(r.raw_ai_response)) > 0
        ),
        org_brand_prominence = public.calculate_brand_prominence_from_response(r.raw_ai_response, aliases)
      WHERE p.id = r.id;
    END IF;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE public.prompt_provider_responses ENABLE TRIGGER auto_populate_brand_catalog_trigger;
