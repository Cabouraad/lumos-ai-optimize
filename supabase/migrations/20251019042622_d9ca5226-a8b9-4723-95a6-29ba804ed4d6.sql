
-- Populate brand_catalog with competitors from existing prompt_provider_responses
-- Restructured to avoid set-returning functions in HAVING

DO $$
DECLARE
  competitor_record RECORD;
BEGIN
  FOR competitor_record IN (
    WITH expanded_competitors AS (
      SELECT 
        jsonb_array_elements_text(ppr.competitors_json) as competitor_name,
        ppr.org_id,
        ppr.run_at,
        ppr.score
      FROM prompt_provider_responses ppr
      JOIN prompts p ON p.id = ppr.prompt_id
      WHERE ppr.org_id = 'd2a2aa3a-1df3-4a26-bdf2-18a819b1f6b3'
        AND ppr.status = 'success'
        AND ppr.competitors_json IS NOT NULL
        AND jsonb_array_length(ppr.competitors_json) > 0
    )
    SELECT 
      competitor_name,
      org_id,
      MIN(run_at) as first_seen,
      MAX(run_at) as last_seen,
      COUNT(*) as appearances,
      AVG(score) as avg_score
    FROM expanded_competitors
    WHERE LENGTH(TRIM(competitor_name)) >= 3
      AND competitor_name !~ '^[0-9]+$'
      AND LOWER(TRIM(competitor_name)) != 'the software smith'
    GROUP BY org_id, competitor_name
  )
  LOOP
    -- Check if exists
    IF EXISTS (
      SELECT 1 FROM brand_catalog 
      WHERE org_id = competitor_record.org_id 
        AND name = competitor_record.competitor_name
    ) THEN
      -- Update existing
      UPDATE brand_catalog
      SET 
        last_seen_at = competitor_record.last_seen,
        total_appearances = total_appearances + competitor_record.appearances,
        average_score = (average_score + competitor_record.avg_score) / 2
      WHERE org_id = competitor_record.org_id 
        AND name = competitor_record.competitor_name
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
        competitor_record.org_id,
        competitor_record.competitor_name,
        false,
        '[]'::jsonb,
        competitor_record.first_seen,
        competitor_record.last_seen,
        competitor_record.appearances::integer,
        COALESCE(competitor_record.avg_score, 5.0)::numeric
      );
    END IF;
  END LOOP;
END $$;

-- Create a trigger to auto-populate brand_catalog from future responses
CREATE OR REPLACE FUNCTION auto_populate_brand_catalog()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on prompt_provider_responses
DROP TRIGGER IF EXISTS auto_populate_brand_catalog_trigger ON prompt_provider_responses;
CREATE TRIGGER auto_populate_brand_catalog_trigger
  AFTER INSERT OR UPDATE ON prompt_provider_responses
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_brand_catalog();
