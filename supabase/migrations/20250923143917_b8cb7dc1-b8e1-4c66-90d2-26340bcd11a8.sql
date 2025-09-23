-- Add legitimate competitors to brand_catalog - simplified approach
-- Step 1: Manually add the most common legitimate competitors we identified

DO $$
DECLARE
  target_org_id uuid;
  competitor_names text[] := ARRAY['Google Analytics', 'Salesforce', 'Zoho', 'Zoho CRM', 'Microsoft Teams', 'Make', 'Pipedrive', 'Marketo', 'ActiveCampaign', 'Zapier'];
  competitor_name text;
BEGIN
  -- Find org with recent competitor data
  SELECT DISTINCT ppr.org_id INTO target_org_id
  FROM prompt_provider_responses ppr
  WHERE ppr.status = 'success'
    AND ppr.run_at >= now() - interval '7 days'
    AND jsonb_array_length(ppr.competitors_json) > 0
  LIMIT 1;

  IF target_org_id IS NOT NULL THEN
    -- Add each competitor if it doesn't already exist
    FOREACH competitor_name IN ARRAY competitor_names
    LOOP
      INSERT INTO brand_catalog (org_id, name, is_org_brand, variants_json, first_detected_at, last_seen_at, total_appearances, average_score)
      SELECT 
        target_org_id,
        competitor_name,
        false,
        '[]'::jsonb,
        now(),
        now(),
        10, -- Default appearance count
        6.0
      WHERE NOT EXISTS (
        SELECT 1 FROM brand_catalog 
        WHERE org_id = target_org_id 
          AND lower(trim(name)) = lower(trim(competitor_name))
      );
    END LOOP;
    
    RAISE NOTICE 'Added competitors to brand_catalog for org_id: %', target_org_id;
  END IF;
END $$;