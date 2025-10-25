
-- Simple brand detection: use org-provided brand name to find it in responses
-- This will run automatically on new responses and can be applied to existing ones

-- Get all brand name variants for an org (from onboarding)
CREATE OR REPLACE FUNCTION public.get_org_brand_aliases(p_org_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT array_agg(DISTINCT lower(trim(b)))
  FROM (
    SELECT o.name AS b FROM organizations o WHERE o.id = p_org_id AND o.name IS NOT NULL
    UNION ALL
    SELECT bc.name AS b FROM brand_catalog bc WHERE bc.org_id = p_org_id AND bc.is_org_brand = true
    UNION ALL
    SELECT jsonb_array_elements_text(bc.variants_json) AS b FROM brand_catalog bc WHERE bc.org_id = p_org_id AND bc.is_org_brand = true
    UNION ALL
    SELECT split_part(o.domain, '.', 1) AS b FROM organizations o WHERE o.id = p_org_id AND o.domain IS NOT NULL
  ) s
  WHERE b IS NOT NULL AND length(trim(b)) >= 2
$$;

-- Trigger to automatically detect brand in responses
CREATE OR REPLACE FUNCTION public.set_org_brand_presence_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  aliases text[];
  found boolean := false;
  brand_alias text;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'success' AND NEW.raw_ai_response IS NOT NULL THEN
    aliases := public.get_org_brand_aliases(NEW.org_id);
    
    IF aliases IS NOT NULL THEN
      FOREACH brand_alias IN ARRAY aliases LOOP
        IF brand_alias IS NOT NULL AND position(brand_alias in lower(NEW.raw_ai_response)) > 0 THEN
          found := true;
          EXIT;
        END IF;
      END LOOP;
      
      IF found THEN
        NEW.org_brand_present := true;
        NEW.org_brand_prominence := public.calculate_brand_prominence_from_response(NEW.raw_ai_response, aliases);
      ELSIF NEW.org_brand_present IS DISTINCT FROM true THEN
        NEW.org_brand_present := false;
        NEW.org_brand_prominence := NULL;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_org_brand_presence_simple_trigger ON public.prompt_provider_responses;
CREATE TRIGGER set_org_brand_presence_simple_trigger
BEFORE INSERT OR UPDATE OF raw_ai_response, status
ON public.prompt_provider_responses
FOR EACH ROW
EXECUTE FUNCTION public.set_org_brand_presence_simple();

-- Backfill existing data (disable conflicting trigger first)
ALTER TABLE prompt_provider_responses DISABLE TRIGGER auto_populate_brand_catalog_trigger;

-- Apply to all recent responses
UPDATE public.prompt_provider_responses ppr
SET 
  org_brand_present = (
    SELECT EXISTS (
      SELECT 1 FROM unnest(public.get_org_brand_aliases(ppr.org_id)) AS alias
      WHERE alias IS NOT NULL AND position(alias in lower(ppr.raw_ai_response)) > 0
    )
  ),
  org_brand_prominence = public.calculate_brand_prominence_from_response(
    ppr.raw_ai_response, 
    public.get_org_brand_aliases(ppr.org_id)
  ),
  metadata = COALESCE(ppr.metadata, '{}'::jsonb) || jsonb_build_object(
    'simple_detection_applied', true,
    'simple_detection_at', NOW()
  )
WHERE ppr.status = 'success'
  AND ppr.raw_ai_response IS NOT NULL
  AND ppr.run_at >= NOW() - INTERVAL '90 days';

-- Re-enable trigger
ALTER TABLE prompt_provider_responses ENABLE TRIGGER auto_populate_brand_catalog_trigger;

COMMENT ON FUNCTION public.get_org_brand_aliases IS 'Returns all brand name variants for an org from onboarding data.';
COMMENT ON FUNCTION public.set_org_brand_presence_simple IS 'Automatically detects org brand in responses using simple string matching.';
