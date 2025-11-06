-- Fix auto_populate_brand_catalog trigger to handle case-insensitive duplicates
-- This prevents "duplicate key violates constraint idx_brand_catalog_org_name" errors

CREATE OR REPLACE FUNCTION auto_populate_brand_catalog()
RETURNS TRIGGER AS $$
DECLARE
  competitor_name text;
BEGIN
  -- Only process successful/completed responses with competitors
  IF (NEW.status = 'completed' OR NEW.status = 'success') 
     AND NEW.competitors_json IS NOT NULL 
     AND jsonb_array_length(NEW.competitors_json) > 0 THEN
    
    -- Loop through each competitor in the JSON array
    FOR competitor_name IN 
      SELECT jsonb_array_elements_text(NEW.competitors_json)
    LOOP
      -- Skip invalid names
      IF LENGTH(TRIM(competitor_name)) < 3 OR competitor_name ~ '^[0-9]+$' THEN
        CONTINUE;
      END IF;
      
      -- Use INSERT ... ON CONFLICT to handle duplicates gracefully
      INSERT INTO brand_catalog (
        org_id,
        name,
        is_org_brand,
        variants_json,
        first_detected_at,
        last_seen_at,
        total_appearances,
        average_score
      ) VALUES (
        NEW.org_id,
        competitor_name,
        false,
        '[]'::jsonb,
        NEW.run_at,
        NEW.run_at,
        1,
        NEW.score
      )
      ON CONFLICT (org_id, lower(name))
      DO UPDATE SET
        last_seen_at = EXCLUDED.last_seen_at,
        total_appearances = brand_catalog.total_appearances + 1,
        average_score = (brand_catalog.average_score + EXCLUDED.average_score) / 2
      WHERE brand_catalog.is_org_brand = false; -- Only update competitors, not org brands
      
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- No need to recreate the trigger, just updated the function

COMMENT ON FUNCTION auto_populate_brand_catalog IS 
  'Auto-populate brand_catalog from competitors_json in prompt_provider_responses. Uses ON CONFLICT to handle case-insensitive duplicates gracefully.';
