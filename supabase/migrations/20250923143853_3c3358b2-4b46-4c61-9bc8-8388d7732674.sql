-- Add legitimate competitors found in recent responses to brand_catalog
-- Fixed version with proper column scoping

DO $$
DECLARE
  target_org_id uuid;
BEGIN
  -- Find org with recent competitor data
  SELECT DISTINCT ppr.org_id INTO target_org_id
  FROM prompt_provider_responses ppr
  WHERE ppr.status = 'success'
    AND ppr.run_at >= now() - interval '7 days'
    AND jsonb_array_length(ppr.competitors_json) > 0
  LIMIT 1;

  IF target_org_id IS NOT NULL THEN
    -- Add legitimate competitors that appear frequently
    WITH frequent_competitors AS (
      SELECT 
        jsonb_array_elements_text(ppr.competitors_json) as competitor_name,
        count(*) as mention_count
      FROM prompt_provider_responses ppr
      WHERE ppr.org_id = target_org_id
        AND ppr.status = 'success' 
        AND ppr.run_at >= now() - interval '14 days'
        AND jsonb_array_length(ppr.competitors_json) > 0
      GROUP BY jsonb_array_elements_text(ppr.competitors_json)
      HAVING count(*) >= 2  -- Only competitors mentioned multiple times
        AND length(trim(jsonb_array_elements_text(ppr.competitors_json))) >= 3  -- Minimum length
        AND jsonb_array_elements_text(ppr.competitors_json) !~* '^(price|these|offers|trade|cost|free|paid|premium|basic|pro|standard)$'  -- Filter generic terms
        AND jsonb_array_elements_text(ppr.competitors_json) !~ '^\d+$'  -- Not purely numeric
    )
    INSERT INTO brand_catalog (org_id, name, is_org_brand, variants_json, first_detected_at, last_seen_at, total_appearances, average_score)
    SELECT 
      target_org_id,
      fc.competitor_name,
      false,
      '[]'::jsonb,
      now(),
      now(),
      GREATEST(fc.mention_count, 1),
      6.0
    FROM frequent_competitors fc
    WHERE fc.competitor_name NOT IN (
      -- Don't add if already exists
      SELECT name FROM brand_catalog 
      WHERE org_id = target_org_id 
        AND lower(trim(name)) = lower(trim(fc.competitor_name))
    )
    ORDER BY fc.mention_count DESC
    LIMIT 10;  -- Add top 10 most mentioned competitors
    
    RAISE NOTICE 'Added competitors to brand_catalog for org_id: %', target_org_id;
  END IF;
END $$;