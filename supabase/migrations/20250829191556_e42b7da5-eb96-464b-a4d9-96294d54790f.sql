-- Clean up existing data using catalog-only approach
UPDATE prompt_provider_responses 
SET 
  competitors_json = (
    SELECT COALESCE(
      jsonb_agg(competitor_name ORDER BY competitor_name), 
      '[]'::jsonb
    )
    FROM (
      SELECT DISTINCT jsonb_array_elements_text(competitors_json) as competitor_name
      FROM (SELECT competitors_json) as t
      WHERE EXISTS (
        SELECT 1 FROM brand_catalog bc 
        WHERE bc.org_id = prompt_provider_responses.org_id 
          AND LOWER(TRIM(bc.name)) = LOWER(TRIM(jsonb_array_elements_text(t.competitors_json)))
          AND bc.is_org_brand = false
      )
    ) verified_competitors
  ),
  competitors_count = (
    SELECT COALESCE(COUNT(*), 0)::INTEGER
    FROM (
      SELECT DISTINCT jsonb_array_elements_text(competitors_json) as competitor_name
      FROM (SELECT competitors_json) as t
      WHERE EXISTS (
        SELECT 1 FROM brand_catalog bc 
        WHERE bc.org_id = prompt_provider_responses.org_id 
          AND LOWER(TRIM(bc.name)) = LOWER(TRIM(jsonb_array_elements_text(t.competitors_json)))
          AND bc.is_org_brand = false
      )
    ) verified_competitors
  ),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'catalog_only_cleanup_applied', true,
    'cleaned_at', now(),
    'cleanup_version', '3.0'
  )
WHERE status = 'success'
  AND run_at >= now() - interval '30 days'
  AND competitors_json IS NOT NULL 
  AND jsonb_array_length(competitors_json) > 0;