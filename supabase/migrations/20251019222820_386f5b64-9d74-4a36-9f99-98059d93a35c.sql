
-- Fix the auto_populate_brand_catalog trigger to NEVER allow org brand as competitor
-- This ensures accurate brand visibility tracking

CREATE OR REPLACE FUNCTION auto_populate_brand_catalog()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  competitor_name text;
  existing_id uuid;
  org_brand_names text[];
  normalized_competitor text;
  is_org_brand_match boolean;
BEGIN
  -- Only process successful responses with competitors
  IF NEW.status = 'success' AND NEW.competitors_json IS NOT NULL AND jsonb_array_length(NEW.competitors_json) > 0 THEN
    
    -- Get all org brand names and variants for this organization
    SELECT array_agg(DISTINCT LOWER(TRIM(REGEXP_REPLACE(name_or_variant, '[^\w\s]', '', 'g'))))
    INTO org_brand_names
    FROM (
      SELECT bc.name as name_or_variant
      FROM brand_catalog bc
      WHERE bc.org_id = NEW.org_id AND bc.is_org_brand = true
      UNION ALL
      SELECT jsonb_array_elements_text(bc.variants_json) as name_or_variant
      FROM brand_catalog bc
      WHERE bc.org_id = NEW.org_id AND bc.is_org_brand = true
      UNION ALL
      SELECT o.name as name_or_variant
      FROM organizations o
      WHERE o.id = NEW.org_id
    ) all_variants;
    
    -- Loop through each competitor in the JSON array
    FOR competitor_name IN 
      SELECT jsonb_array_elements_text(NEW.competitors_json)
    LOOP
      -- Skip invalid names
      IF LENGTH(TRIM(competitor_name)) < 3 OR competitor_name ~ '^[0-9]+$' THEN
        CONTINUE;
      END IF;
      
      -- Normalize competitor name for comparison
      normalized_competitor := LOWER(TRIM(REGEXP_REPLACE(competitor_name, '[^\w\s]', '', 'g')));
      
      -- Check if this competitor matches any org brand variant
      is_org_brand_match := false;
      IF org_brand_names IS NOT NULL THEN
        is_org_brand_match := normalized_competitor = ANY(org_brand_names);
      END IF;
      
      -- Skip if this is actually the org's brand
      IF is_org_brand_match THEN
        CONTINUE;
      END IF;
      
      -- Check if exists in catalog
      SELECT id INTO existing_id
      FROM brand_catalog
      WHERE org_id = NEW.org_id 
        AND name = competitor_name;
      
      IF existing_id IS NOT NULL THEN
        -- Update existing competitor only (never update org brands)
        UPDATE brand_catalog
        SET 
          last_seen_at = NEW.run_at,
          total_appearances = total_appearances + 1,
          average_score = (average_score + NEW.score) / 2
        WHERE id = existing_id
          AND is_org_brand = false;
      ELSE
        -- Insert new competitor
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

-- Clean up any existing entries where org brand was mistakenly added as competitor
DELETE FROM brand_catalog bc
WHERE bc.is_org_brand = false
  AND EXISTS (
    SELECT 1 
    FROM brand_catalog bc_org
    WHERE bc_org.org_id = bc.org_id
      AND bc_org.is_org_brand = true
      AND (
        -- Exact match
        LOWER(TRIM(bc.name)) = LOWER(TRIM(bc_org.name))
        -- Match against variants
        OR LOWER(TRIM(bc.name)) IN (
          SELECT LOWER(TRIM(jsonb_array_elements_text(bc_org.variants_json)))
        )
      )
  );
