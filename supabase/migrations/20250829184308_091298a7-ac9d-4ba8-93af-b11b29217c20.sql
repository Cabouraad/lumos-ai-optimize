-- Clean up competitor detection: Remove generic terms and rebuild competitor data

-- 1. Remove generic terms from brand_catalog that are clearly not real competitors
DELETE FROM brand_catalog 
WHERE is_org_brand = false 
  AND (
    -- Single generic words
    LOWER(name) IN ('track', 'automate', 'analyze', 'implement', 'use', 'create', 'build',
                    'tools', 'tool', 'software', 'platform', 'service', 'solution', 'system',
                    'data', 'content', 'marketing', 'business', 'company', 'team', 'user', 'users',
                    'customer', 'customers', 'client', 'clients', 'email', 'web', 'mobile', 'app',
                    'digital', 'online', 'social', 'media', 'search', 'analytics', 'insights',
                    'management', 'automation', 'integration', 'optimization', 'performance',
                    'experience', 'strategy', 'campaigns', 'audience', 'engagement', 'conversion',
                    'feedback', 'surveys', 'meetings', 'collaboration', 'personalization',
                    'privacy', 'compliance', 'training', 'documentation', 'visualization',
                    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
                    'for', 'and', 'the', 'with', 'you', 'your', 'our', 'their', 'this', 'that')
    -- Very short terms (likely parsing errors)
    OR LENGTH(TRIM(name)) < 3
    -- Single generic words without clear brand indicators
    OR (name NOT LIKE '%.%' AND name NOT LIKE '%-%' AND LENGTH(TRIM(name)) < 5 
        AND LOWER(name) ~ '^[a-z]+$')
  );

-- 2. Create function to rebuild competitors_json with catalog-only brands
CREATE OR REPLACE FUNCTION rebuild_competitors_catalog_only()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_record RECORD;
  brand_record RECORD;
  catalog_competitors jsonb;
  updated_count INTEGER := 0;
BEGIN
  -- Process each response with competitors
  FOR response_record IN
    SELECT id, org_id, competitors_json
    FROM prompt_provider_responses 
    WHERE competitors_json IS NOT NULL 
      AND jsonb_array_length(competitors_json) > 0
      AND status = 'success'
      AND run_at >= now() - interval '30 days'
  LOOP
    catalog_competitors := '[]'::jsonb;
    
    -- Check each competitor against brand_catalog
    FOR brand_record IN
      SELECT DISTINCT competitor_name
      FROM (
        SELECT jsonb_array_elements_text(response_record.competitors_json) AS competitor_name
      ) competitors
      WHERE competitor_name IN (
        SELECT name FROM brand_catalog 
        WHERE org_id = response_record.org_id 
          AND is_org_brand = false
          AND LENGTH(TRIM(name)) >= 3
      )
    LOOP
      catalog_competitors := catalog_competitors || jsonb_build_array(brand_record.competitor_name);
    END LOOP;
    
    -- Update response with cleaned competitors
    UPDATE prompt_provider_responses 
    SET 
      competitors_json = catalog_competitors,
      competitors_count = jsonb_array_length(catalog_competitors),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'competitors_cleaned', true,
        'cleaned_at', now(),
        'original_competitor_count', jsonb_array_length(response_record.competitors_json)
      )
    WHERE id = response_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN format('Cleaned %s responses, rebuilt competitors from catalog only', updated_count);
END;
$$;

-- 3. Execute the cleanup
SELECT rebuild_competitors_catalog_only();