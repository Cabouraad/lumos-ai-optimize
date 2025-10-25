
-- Simple, robust brand presence detection using org-provided brand
-- This creates a straightforward trigger for all future responses

-- Helper: return all org brand aliases (lowercased)
CREATE OR REPLACE FUNCTION public.get_org_brand_aliases(p_org_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT array_agg(DISTINCT lower(trim(b)))
  FROM (
    -- org name from onboarding
    SELECT o.name AS b
    FROM public.organizations o
    WHERE o.id = p_org_id AND o.name IS NOT NULL

    UNION ALL

    -- brand catalog org brands
    SELECT bc.name AS b
    FROM public.brand_catalog bc
    WHERE bc.org_id = p_org_id AND bc.is_org_brand = true

    UNION ALL

    -- brand catalog variants
    SELECT v AS b
    FROM public.brand_catalog bc,
         LATERAL jsonb_array_elements_text(bc.variants_json) v
    WHERE bc.org_id = p_org_id AND bc.is_org_brand = true AND jsonb_array_length(bc.variants_json) > 0

    UNION ALL

    -- domain first label as a last-resort alias (e.g., hubspot.com -> hubspot)
    SELECT split_part(o.domain, '.', 1) AS b
    FROM public.organizations o
    WHERE o.id = p_org_id AND o.domain IS NOT NULL
  ) s
  WHERE b IS NOT NULL AND length(trim(b)) >= 2
$$;

-- Trigger function: set org_brand_present + prominence on insert/update based on simple detection
CREATE OR REPLACE FUNCTION public.set_org_brand_presence_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  aliases text[];
  t text;
  found boolean := false;
  prominence integer;
BEGIN
  -- Only process successful responses with text
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'success' AND NEW.raw_ai_response IS NOT NULL THEN
    aliases := public.get_org_brand_aliases(NEW.org_id);

    IF aliases IS NOT NULL THEN
      -- simple string containment check across aliases
      FOREACH t IN ARRAY aliases LOOP
        IF t IS NOT NULL AND t <> '' AND position(t in lower(NEW.raw_ai_response)) > 0 THEN
          found := true;
          EXIT; -- first hit is enough
        END IF;
      END LOOP;

      IF found THEN
        NEW.org_brand_present := true;
        -- compute prominence using previously defined function
        prominence := public.calculate_brand_prominence_from_response(NEW.raw_ai_response, aliases);
        NEW.org_brand_prominence := COALESCE(prominence, 1);
      ELSE
        -- only set false if not already true
        IF NEW.org_brand_present IS DISTINCT FROM true THEN
          NEW.org_brand_present := false;
        END IF;
        NEW.org_brand_prominence := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger (will run on all future inserts/updates)
DROP TRIGGER IF EXISTS set_org_brand_presence_simple_trigger ON public.prompt_provider_responses;
CREATE TRIGGER set_org_brand_presence_simple_trigger
BEFORE INSERT OR UPDATE OF raw_ai_response, status
ON public.prompt_provider_responses
FOR EACH ROW
EXECUTE FUNCTION public.set_org_brand_presence_simple();

-- Temporarily disable auto_populate trigger for backfill
ALTER TABLE prompt_provider_responses DISABLE TRIGGER auto_populate_brand_catalog_trigger;

-- Backfill: apply simple detection to recent data for all orgs using batch updates
DO $$
DECLARE
  org_rec RECORD;
  aliases text[];
  updated_count integer;
BEGIN
  RAISE NOTICE 'Starting brand presence backfill...';
  
  FOR org_rec IN 
    SELECT DISTINCT org_id 
    FROM public.prompt_provider_responses 
    WHERE status = 'success' AND run_at >= now() - interval '90 days'
  LOOP
    aliases := public.get_org_brand_aliases(org_rec.org_id);
    
    IF aliases IS NOT NULL THEN
      -- Batch update per org to avoid trigger conflicts
      UPDATE public.prompt_provider_responses
      SET 
        org_brand_present = EXISTS (
          SELECT 1 FROM unnest(aliases) a
          WHERE a IS NOT NULL AND a <> '' AND position(a in lower(raw_ai_response)) > 0
        ),
        org_brand_prominence = public.calculate_brand_prominence_from_response(raw_ai_response, aliases)
      WHERE org_id = org_rec.org_id
        AND status = 'success'
        AND run_at >= now() - interval '90 days';
      
      GET DIAGNOSTICS updated_count = ROW_COUNT;
      RAISE NOTICE 'Updated % responses for org %', updated_count, org_rec.org_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Brand presence backfill complete';
END $$;

-- Re-enable auto_populate trigger
ALTER TABLE prompt_provider_responses ENABLE TRIGGER auto_populate_brand_catalog_trigger;

COMMENT ON FUNCTION public.get_org_brand_aliases IS 'Returns org brand aliases from onboarding (org name), catalog org brands and variants, and domain label (lowercased).';
COMMENT ON FUNCTION public.set_org_brand_presence_simple IS 'Simple string matching of org brand aliases in raw response to set org_brand_present and prominence. Runs automatically on all new/updated responses.';
