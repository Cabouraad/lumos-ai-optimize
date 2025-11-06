-- Fix auto_populate_brand_catalog to handle competitor limit gracefully
-- This prevents prompt responses from failing when competitor limit is reached

CREATE OR REPLACE FUNCTION auto_populate_brand_catalog()
RETURNS TRIGGER AS $$
DECLARE
  competitor_name text;
  existing_id uuid;
  current_competitor_count INT;
BEGIN
  -- Only process successful responses with competitors
  IF NEW.status IN ('success', 'completed') AND NEW.competitors_json IS NOT NULL AND jsonb_array_length(NEW.competitors_json) > 0 THEN
    
    -- Get current competitor count for this org
    SELECT COUNT(*) INTO current_competitor_count
    FROM brand_catalog
    WHERE org_id = NEW.org_id 
      AND is_org_brand = false;
    
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
        -- Update existing competitor (always allowed)
        UPDATE brand_catalog
        SET 
          last_seen_at = NEW.run_at,
          total_appearances = total_appearances + 1,
          average_score = (average_score + NEW.score) / 2
        WHERE id = existing_id
          AND is_org_brand = false;
      ELSE
        -- Only insert new competitor if under limit
        IF current_competitor_count < 50 THEN
          BEGIN
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
            current_competitor_count := current_competitor_count + 1;
          EXCEPTION WHEN OTHERS THEN
            -- Silently skip if insert fails (e.g., due to trigger limit)
            -- This prevents the entire prompt response from failing
            RAISE NOTICE 'Skipped adding competitor % due to: %', competitor_name, SQLERRM;
          END;
        ELSE
          -- Log when limit is reached but don't fail
          RAISE NOTICE 'Competitor limit reached (50), skipping new competitor: %', competitor_name;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  -- Always return NEW to allow the prompt_provider_responses insert to succeed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;