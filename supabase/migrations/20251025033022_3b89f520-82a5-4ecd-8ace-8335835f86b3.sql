
-- Fix org_brand_prominence to accurately reflect brand position in responses
-- This replaces the hardcoded prominence=1 with calculated values or NULL

CREATE OR REPLACE FUNCTION calculate_brand_prominence_from_response(
  p_raw_response text,
  p_org_brands text[]
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  brand_text text;
  brand_index integer;
  earliest_position numeric := 1.0;
  response_length integer;
  prominence_score integer;
BEGIN
  IF p_raw_response IS NULL OR array_length(p_org_brands, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  
  response_length := length(p_raw_response);
  IF response_length = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Find the earliest occurrence of any org brand
  FOREACH brand_text IN ARRAY p_org_brands
  LOOP
    brand_index := position(lower(brand_text) in lower(p_raw_response));
    IF brand_index > 0 THEN
      -- Calculate relative position (0 to 1)
      earliest_position := LEAST(earliest_position, brand_index::numeric / response_length::numeric);
    END IF;
  END LOOP;
  
  -- If no brand found, return NULL
  IF earliest_position = 1.0 THEN
    RETURN NULL;
  END IF;
  
  -- Map position to prominence score (1-10 scale, 1=best)
  CASE
    WHEN earliest_position <= 0.1 THEN prominence_score := 1;  -- Very early (0-10%)
    WHEN earliest_position <= 0.2 THEN prominence_score := 2;  -- Early (10-20%)
    WHEN earliest_position <= 0.35 THEN prominence_score := 3; -- Early-middle (20-35%)
    WHEN earliest_position <= 0.5 THEN prominence_score := 4;  -- Middle (35-50%)
    WHEN earliest_position <= 0.65 THEN prominence_score := 5; -- Middle-late (50-65%)
    WHEN earliest_position <= 0.75 THEN prominence_score := 6; -- Late (65-75%)
    WHEN earliest_position <= 0.85 THEN prominence_score := 7; -- Very late (75-85%)
    ELSE prominence_score := 8;                                 -- End (85%+)
  END CASE;
  
  RETURN prominence_score;
END;
$$;

-- Temporarily disable the auto_populate_brand_catalog trigger
ALTER TABLE prompt_provider_responses DISABLE TRIGGER auto_populate_brand_catalog_trigger;

-- Update all responses to have accurate prominence
DO $$
DECLARE
  org_record RECORD;
  org_brand_names text[];
  updated_count integer := 0;
BEGIN
  -- Process each organization
  FOR org_record IN 
    SELECT o.id, o.name
    FROM organizations o
    WHERE o.name IS NOT NULL
  LOOP
    -- Get all org brand variants for this organization
    SELECT array_agg(DISTINCT LOWER(brand_variant))
    INTO org_brand_names
    FROM (
      SELECT o2.name as brand_variant
      FROM organizations o2
      WHERE o2.id = org_record.id
      
      UNION
      
      SELECT bc.name as brand_variant
      FROM brand_catalog bc
      WHERE bc.org_id = org_record.id AND bc.is_org_brand = true
      
      UNION
      
      SELECT jsonb_array_elements_text(bc.variants_json) as brand_variant
      FROM brand_catalog bc
      WHERE bc.org_id = org_record.id 
        AND bc.is_org_brand = true
        AND jsonb_array_length(bc.variants_json) > 0
    ) all_brands
    WHERE brand_variant IS NOT NULL AND length(trim(brand_variant)) >= 2;
    
    -- Update responses for this org
    UPDATE prompt_provider_responses ppr
    SET 
      org_brand_prominence = calculate_brand_prominence_from_response(ppr.raw_ai_response, org_brand_names),
      metadata = COALESCE(ppr.metadata, '{}'::jsonb) || jsonb_build_object(
        'prominence_recalculated', true,
        'prominence_recalculated_at', NOW(),
        'previous_prominence', ppr.org_brand_prominence
      )
    WHERE ppr.org_id = org_record.id
      AND ppr.org_brand_present = true
      AND ppr.status = 'success'
      AND ppr.run_at >= NOW() - INTERVAL '90 days'
      AND (
        -- Only update if we can calculate a different value or if current is the default "1"
        calculate_brand_prominence_from_response(ppr.raw_ai_response, org_brand_names) IS DISTINCT FROM ppr.org_brand_prominence
        OR ppr.org_brand_prominence = 1
      );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % responses for org: %', updated_count, org_record.name;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE prompt_provider_responses ENABLE TRIGGER auto_populate_brand_catalog_trigger;

-- Add comments
COMMENT ON FUNCTION calculate_brand_prominence_from_response IS 
  'Calculates brand prominence (1-10) from raw AI response text based on position. Returns NULL if brand not found. 1=very early (0-10%), 2=early (10-20%), 3=early-middle, 4=middle, 5=middle-late, 6=late, 7=very late, 8=end.';
