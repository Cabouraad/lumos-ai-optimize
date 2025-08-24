-- First add unique constraint and fix HubSpot classification

-- Add unique constraint for brand catalog
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_catalog_org_name 
ON brand_catalog (org_id, LOWER(name));

-- Simplified fix function without ON CONFLICT
CREATE OR REPLACE FUNCTION fix_hubspot_brand_classification()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_record RECORD;
  response_record RECORD;
  updated_competitors jsonb;
  fixes_applied INTEGER := 0;
  brands_added INTEGER := 0;
BEGIN
  -- Find orgs that have HubSpot mentioned as competitor in recent responses
  FOR org_record IN
    SELECT DISTINCT o.id, o.name, o.domain
    FROM organizations o
    JOIN prompts p ON p.org_id = o.id
    JOIN prompt_provider_responses ppr ON ppr.prompt_id = p.id
    WHERE ppr.competitors_json::text ILIKE '%hubspot%'
      AND ppr.run_at >= now() - interval '30 days'
      AND ppr.status = 'success'
  LOOP
    -- Check if HubSpot is already set as org brand
    IF NOT EXISTS (
      SELECT 1 FROM brand_catalog 
      WHERE org_id = org_record.id 
        AND LOWER(name) = 'hubspot' 
        AND is_org_brand = true
    ) THEN
      -- Add HubSpot as org brand
      INSERT INTO brand_catalog (
        org_id, name, is_org_brand, variants_json,
        first_detected_at, last_seen_at, total_appearances, average_score
      ) VALUES (
        org_record.id, 'HubSpot', true, 
        '["hubspot", "hub-spot", "hubspot.com", "HubSpot"]'::jsonb,
        now(), now(), 1, 7.0
      );
      brands_added := brands_added + 1;
    END IF;
    
    -- Update responses where HubSpot was misclassified as competitor
    FOR response_record IN
      SELECT ppr.id, ppr.competitors_json, ppr.competitors_count, ppr.score, ppr.raw_ai_response
      FROM prompt_provider_responses ppr
      JOIN prompts p ON ppr.prompt_id = p.id
      WHERE p.org_id = org_record.id
        AND ppr.status = 'success'
        AND ppr.competitors_json::text ILIKE '%hubspot%'
        AND ppr.org_brand_present = false
        AND ppr.run_at >= now() - interval '30 days'
    LOOP
      -- Remove HubSpot from competitors
      SELECT jsonb_agg(competitor) INTO updated_competitors
      FROM jsonb_array_elements_text(response_record.competitors_json) AS competitor
      WHERE LOWER(competitor) NOT LIKE '%hubspot%';
      
      -- If no competitors left after removing HubSpot, set empty array
      IF updated_competitors IS NULL THEN
        updated_competitors := '[]'::jsonb;
      END IF;
      
      -- Update response with corrected classification
      UPDATE prompt_provider_responses 
      SET 
        org_brand_present = true,
        org_brand_prominence = 1,
        competitors_json = updated_competitors,
        competitors_count = jsonb_array_length(updated_competitors),
        score = CASE 
          WHEN response_record.score = 0 THEN 6.0  -- Brand found, good position
          ELSE GREATEST(response_record.score + 3.0, 5.0)  -- Boost existing score
        END,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'brand_fix_applied', true,
          'original_score', response_record.score,
          'hubspot_moved_from_competitor', true,
          'fix_timestamp', now()
        )
      WHERE id = response_record.id;
      
      fixes_applied := fixes_applied + 1;
    END LOOP;
  END LOOP;
  
  RETURN format('Classification fix complete: %s brands added, %s responses updated', 
                brands_added, fixes_applied);
END;
$$;

-- Execute the fix
SELECT fix_hubspot_brand_classification() as result;