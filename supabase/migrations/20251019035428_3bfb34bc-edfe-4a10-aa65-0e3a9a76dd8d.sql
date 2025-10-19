-- First, check if the brand already exists and insert only if it doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM brand_catalog 
    WHERE org_id = 'd2a2aa3a-1df3-4a26-bdf2-18a819b1f6b3' 
    AND name = 'The Software Smith'
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
      'd2a2aa3a-1df3-4a26-bdf2-18a819b1f6b3',
      'The Software Smith',
      true,
      '["The Software Smith", "Software Smith", "softwaresmith.io"]'::jsonb,
      now(),
      now(),
      2,
      1.0
    );
  END IF;
END $$;

-- Update the existing responses to correctly classify the org brand
UPDATE prompt_provider_responses
SET 
  org_brand_present = true,
  org_brand_prominence = 1,
  competitors_json = (
    SELECT COALESCE(jsonb_agg(competitor), '[]'::jsonb)
    FROM jsonb_array_elements_text(competitors_json) AS competitor
    WHERE LOWER(competitor) NOT LIKE '%software smith%'
  ),
  competitors_count = (
    SELECT COUNT(*)
    FROM jsonb_array_elements_text(competitors_json) AS competitor
    WHERE LOWER(competitor) NOT LIKE '%software smith%'
  ),
  brands_json = '["The Software Smith"]'::jsonb,
  score = 7.5,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'brand_fix_applied', true,
    'original_score', score,
    'original_org_brand_present', org_brand_present,
    'fix_timestamp', now(),
    'fix_reason', 'Org brand was misclassified as competitor'
  )
WHERE id IN (
  '4d0ec6a2-cf6c-4d8b-aca5-509b82f3cac3',
  'c3567e03-c063-4258-b518-e62d9d41ac11'
);