
-- Populate brand_catalog with competitors from existing prompt_provider_responses
-- Using a different approach without ON CONFLICT

-- First, create a temporary table with the competitor data
CREATE TEMP TABLE temp_competitors AS
WITH competitor_names AS (
  SELECT DISTINCT 
    jsonb_array_elements_text(ppr.competitors_json) as competitor_name,
    ppr.org_id,
    MIN(ppr.run_at) as first_seen,
    MAX(ppr.run_at) as last_seen,
    COUNT(*) as appearances,
    AVG(ppr.score) as avg_score
  FROM prompt_provider_responses ppr
  JOIN prompts p ON p.id = ppr.prompt_id
  WHERE ppr.org_id = 'd2a2aa3a-1df3-4a26-bdf2-18a819b1f6b3'
    AND ppr.status = 'success'
    AND ppr.competitors_json IS NOT NULL
    AND jsonb_array_length(ppr.competitors_json) > 0
  GROUP BY ppr.org_id, competitor_name
)
SELECT 
  org_id,
  competitor_name,
  first_seen,
  last_seen,
  appearances::integer,
  COALESCE(avg_score, 5.0)::numeric as avg_score
FROM competitor_names
WHERE LENGTH(TRIM(competitor_name)) >= 3
  AND competitor_name !~ '^[0-9]+$'
  AND LOWER(TRIM(competitor_name)) != LOWER('The Software Smith');

-- Insert only new competitors (that don't exist yet)
INSERT INTO brand_catalog (
  org_id,
  name,
  is_org_brand,
  variants_json,
  first_detected_at,
  last_seen_at,
  total_appearances,
  average_score
)
SELECT 
  tc.org_id,
  tc.competitor_name,
  false,
  '[]'::jsonb,
  tc.first_seen,
  tc.last_seen,
  tc.appearances,
  tc.avg_score
FROM temp_competitors tc
WHERE NOT EXISTS (
  SELECT 1 FROM brand_catalog bc 
  WHERE bc.org_id = tc.org_id 
  AND bc.name = tc.competitor_name
);

-- Update existing competitors
UPDATE brand_catalog bc
SET 
  last_seen_at = tc.last_seen,
  total_appearances = bc.total_appearances + tc.appearances,
  average_score = (bc.average_score + tc.avg_score) / 2
FROM temp_competitors tc
WHERE bc.org_id = tc.org_id
  AND bc.name = tc.competitor_name
  AND bc.is_org_brand = false;

-- Create a trigger to auto-populate brand_catalog from future responses
CREATE OR REPLACE FUNCTION auto_populate_brand_catalog()
RETURNS TRIGGER AS $$
DECLARE
  competitor_name text;
  catalog_exists boolean;
BEGIN
  IF NEW.status = 'success' AND NEW.competitors_json IS NOT NULL AND jsonb_array_length(NEW.competitors_json) > 0 THEN
    FOR competitor_name IN 
      SELECT jsonb_array_elements_text(NEW.competitors_json)
    LOOP
      -- Check if competitor already exists
      SELECT EXISTS(
        SELECT 1 FROM brand_catalog 
        WHERE org_id = NEW.org_id AND name = competitor_name
      ) INTO catalog_exists;
      
      IF catalog_exists THEN
        -- Update existing
        UPDATE brand_catalog
        SET 
          last_seen_at = NEW.run_at,
          total_appearances = total_appearances + 1,
          average_score = (average_score + NEW.score) / 2
        WHERE org_id = NEW.org_id 
          AND name = competitor_name
          AND is_org_brand = false;
      ELSE
        -- Insert new
        INSERT INTO brand_catalog (
          org_id, name, is_org_brand, variants_json,
          first_detected_at, last_seen_at, total_appearances, average_score
        ) VALUES (
          NEW.org_id, competitor_name, false, '[]'::jsonb,
          NEW.run_at, NEW.run_at, 1, NEW.score
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS auto_populate_brand_catalog_trigger ON prompt_provider_responses;
CREATE TRIGGER auto_populate_brand_catalog_trigger
  AFTER INSERT OR UPDATE ON prompt_provider_responses
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_brand_catalog();
