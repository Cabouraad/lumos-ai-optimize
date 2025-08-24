-- Fix HubSpot classification issue - Add as org brand and update misclassified responses

-- Function to fix HubSpot classification for all orgs where it should be the org brand
CREATE OR REPLACE FUNCTION fix_hubspot_classification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_record RECORD;
  response_record RECORD;
  updated_competitors jsonb;
BEGIN
  -- Find orgs that likely use HubSpot as their brand (domain contains hubspot or name contains hubspot)
  FOR org_record IN 
    SELECT id, name, domain 
    FROM organizations 
    WHERE LOWER(name) LIKE '%hubspot%' 
       OR LOWER(domain) LIKE '%hubspot%'
  LOOP
    -- Add HubSpot as org brand if not exists
    INSERT INTO brand_catalog (
      org_id, name, is_org_brand, variants_json, 
      first_detected_at, last_seen_at, total_appearances, average_score
    ) VALUES (
      org_record.id, 'HubSpot', true, '["hubspot", "hub-spot", "hubspot.com"]'::jsonb,
      now(), now(), 1, 5.0
    ) ON CONFLICT (org_id, name) DO UPDATE SET
      is_org_brand = true,
      variants_json = '["hubspot", "hub-spot", "hubspot.com"]'::jsonb,
      last_seen_at = now();
    
    RAISE NOTICE 'Added/Updated HubSpot as org brand for org: %', org_record.name;
    
    -- Update misclassified responses for this org
    FOR response_record IN
      SELECT ppr.id, ppr.competitors_json, ppr.competitors_count, ppr.score
      FROM prompt_provider_responses ppr
      JOIN prompts p ON ppr.prompt_id = p.id
      WHERE p.org_id = org_record.id
        AND ppr.status = 'success'
        AND (ppr.competitors_json::text ILIKE '%hubspot%')
        AND ppr.org_brand_present = false
    LOOP
      -- Remove HubSpot from competitors list
      updated_competitors = ppr.competitors_json;
      
      -- Remove HubSpot variants from competitors
      SELECT jsonb_agg(competitor) INTO updated_competitors
      FROM jsonb_array_elements_text(response_record.competitors_json) AS competitor
      WHERE LOWER(competitor) NOT LIKE '%hubspot%';
      
      -- Update the response - now brand is present, competitors reduced
      UPDATE prompt_provider_responses 
      SET 
        org_brand_present = true,
        org_brand_prominence = 1, -- Assume first position if found
        competitors_json = COALESCE(updated_competitors, '[]'::jsonb),
        competitors_count = jsonb_array_length(COALESCE(updated_competitors, '[]'::jsonb)),
        score = GREATEST(5.0, response_record.score + 3.0), -- Boost score since brand is present
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'brand_classification_fixed', true,
          'original_score', response_record.score,
          'fix_applied_at', now()
        )
      WHERE id = response_record.id;
      
      RAISE NOTICE 'Fixed response % - removed HubSpot from competitors, set brand_present=true', response_record.id;
    END LOOP;
  END LOOP;
  
  -- Also check for any org where recent responses mention HubSpot as competitor
  FOR org_record IN
    SELECT DISTINCT o.id, o.name, o.domain
    FROM organizations o
    JOIN prompts p ON p.org_id = o.id
    JOIN prompt_provider_responses ppr ON ppr.prompt_id = p.id
    WHERE ppr.competitors_json::text ILIKE '%hubspot%'
      AND ppr.run_at >= now() - interval '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM brand_catalog bc 
        WHERE bc.org_id = o.id AND bc.name = 'HubSpot' AND bc.is_org_brand = true
      )
  LOOP
    RAISE NOTICE 'Found org % with HubSpot as competitor - may need manual review', org_record.name;
  END LOOP;
END;
$$;

-- Execute the fix function
SELECT fix_hubspot_classification();