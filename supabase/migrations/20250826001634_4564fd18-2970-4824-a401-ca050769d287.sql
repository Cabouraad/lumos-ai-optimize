-- Simplify competitor tracking by removing redundant competitor_mentions table
-- The brand_catalog table is sufficient for competitor tracking

-- Drop the competitor_mentions table as it duplicates data in brand_catalog
DROP TABLE IF EXISTS competitor_mentions CASCADE;

-- Drop the related upsert function
DROP FUNCTION IF EXISTS upsert_competitor_mention(uuid, uuid, text, text, numeric, text);

-- Add index to brand_catalog for better performance on competitor queries
CREATE INDEX IF NOT EXISTS idx_brand_catalog_competitors 
ON brand_catalog (org_id, is_org_brand, last_seen_at DESC) 
WHERE is_org_brand = false;

-- Add index for total_appearances sorting
CREATE INDEX IF NOT EXISTS idx_brand_catalog_appearances 
ON brand_catalog (org_id, total_appearances DESC) 
WHERE is_org_brand = false;

-- Update the upsert_competitor_brand function to be more efficient
CREATE OR REPLACE FUNCTION public.upsert_competitor_brand(
  p_org_id uuid, 
  p_brand_name text, 
  p_score integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_record RECORD;
  normalized_name text;
BEGIN
  -- Normalize the brand name
  normalized_name := trim(lower(p_brand_name));
  
  -- Skip very short or generic terms
  IF length(normalized_name) < 3 OR normalized_name IN ('seo', 'marketing', 'social media', 'facebook', 'social', 'media') THEN
    RETURN;
  END IF;
  
  -- Check if brand already exists (case-insensitive)
  SELECT * INTO existing_record
  FROM brand_catalog 
  WHERE org_id = p_org_id 
    AND lower(trim(name)) = normalized_name
    AND is_org_brand = false;

  IF existing_record IS NOT NULL THEN
    -- Update existing competitor
    UPDATE brand_catalog 
    SET 
      last_seen_at = now(),
      total_appearances = total_appearances + 1,
      average_score = ((average_score * total_appearances) + p_score) / (total_appearances + 1)
    WHERE id = existing_record.id;
  ELSE
    -- Only insert if it's not already an org brand
    IF NOT EXISTS (
      SELECT 1 FROM brand_catalog 
      WHERE org_id = p_org_id 
        AND lower(trim(name)) = normalized_name
        AND is_org_brand = true
    ) THEN
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
        p_org_id,
        initcap(trim(p_brand_name)), -- Proper case
        false,
        '[]'::jsonb,
        now(),
        now(),
        1,
        p_score
      );
    END IF;
  END IF;
END;
$function$