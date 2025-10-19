
-- Fix security warning: Set search_path for auto_populate_brand_catalog function
CREATE OR REPLACE FUNCTION auto_populate_brand_catalog()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  competitor_name text;
  existing_id uuid;
BEGIN
  -- Only process successful responses with competitors
  IF NEW.status = 'success' AND NEW.competitors_json IS NOT NULL AND jsonb_array_length(NEW.competitors_json) > 0 THEN
    -- Loop through each competitor in the JSON array
    FOR competitor_name IN 
      SELECT jsonb_array_elements_text(NEW.competitors_json)
    LOOP
      -- Skip invalid names
      IF LENGTH(TRIM(competitor_name)) < 3 OR competitor_name ~ '^[0-9]+$' THEN
        CONTINUE;
      END IF;
      
      -- Check if exists
      SELECT id INTO existing_id
      FROM brand_catalog
      WHERE org_id = NEW.org_id 
        AND name = competitor_name;
      
      IF existing_id IS NOT NULL THEN
        -- Update existing
        UPDATE brand_catalog
        SET 
          last_seen_at = NEW.run_at,
          total_appearances = total_appearances + 1,
          average_score = (average_score + NEW.score) / 2
        WHERE id = existing_id
          AND is_org_brand = false;
      ELSE
        -- Insert new
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
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;
