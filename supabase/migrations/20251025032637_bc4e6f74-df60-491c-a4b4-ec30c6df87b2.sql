
-- Comprehensive Brand Classification Fix for All Organizations
-- This addresses the issue where org brands are being detected but not marked as present

-- Function to ensure org brand exists in catalog and fix all misclassified responses
CREATE OR REPLACE FUNCTION fix_all_org_brand_classifications()
RETURNS TABLE (
  result_org_id uuid,
  result_org_name text,
  result_brands_added integer,
  result_responses_fixed integer,
  result_avg_score_improvement numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_record RECORD;
  response_record RECORD;
  brand_exists boolean;
  brands_added_count integer := 0;
  responses_fixed_count integer := 0;
  total_score_improvement numeric := 0;
  responses_checked integer := 0;
  org_brand_aliases text[];
  competitor text;
  updated_competitors jsonb;
  found_org_brand boolean;
  old_score numeric;
  new_score numeric;
  current_org_id uuid;
BEGIN
  -- Process each organization
  FOR org_record IN 
    SELECT id, name, domain 
    FROM organizations 
    WHERE name IS NOT NULL
  LOOP
    current_org_id := org_record.id;
    RAISE NOTICE 'Processing organization: % (ID: %)', org_record.name, current_org_id;
    
    -- 1. Ensure org brand exists in brand_catalog
    SELECT EXISTS(
      SELECT 1 FROM brand_catalog bc
      WHERE bc.org_id = current_org_id 
      AND bc.is_org_brand = true
      AND LOWER(bc.name) = LOWER(org_record.name)
    ) INTO brand_exists;
    
    IF NOT brand_exists THEN
      -- Add the organization's brand to catalog
      INSERT INTO brand_catalog (org_id, name, is_org_brand, variants_json)
      VALUES (
        current_org_id,
        org_record.name,
        true,
        jsonb_build_array(
          org_record.name,
          LOWER(org_record.name),
          UPPER(org_record.name)
        )
      )
      ON CONFLICT (org_id, LOWER(name)) DO UPDATE
      SET is_org_brand = true;
      
      brands_added_count := brands_added_count + 1;
      RAISE NOTICE 'Added org brand: %', org_record.name;
    END IF;
    
    -- 2. Build comprehensive list of org brand aliases
    org_brand_aliases := ARRAY[
      LOWER(org_record.name),
      LOWER(org_record.name) || ' crm',
      LOWER(org_record.name) || ' platform',
      LOWER(org_record.name) || ' software',
      LOWER(org_record.name) || ' marketing',
      LOWER(org_record.name) || ' sales'
    ];
    
    -- Add domain-based variants if domain exists
    IF org_record.domain IS NOT NULL THEN
      org_brand_aliases := org_brand_aliases || ARRAY[
        LOWER(split_part(org_record.domain, '.', 1))
      ];
    END IF;
    
    -- 3. Fix responses where org brand is in competitors
    FOR response_record IN
      SELECT id, competitors_json, score, org_brand_present, metadata
      FROM prompt_provider_responses ppr
      WHERE ppr.org_id = current_org_id
        AND ppr.status = 'success'
        AND ppr.run_at > NOW() - INTERVAL '30 days'
        AND ppr.competitors_json IS NOT NULL
        AND jsonb_array_length(ppr.competitors_json) > 0
    LOOP
      found_org_brand := false;
      updated_competitors := '[]'::jsonb;
      
      -- Check each competitor
      FOR competitor IN 
        SELECT jsonb_array_elements_text(response_record.competitors_json)
      LOOP
        -- Check if this competitor is actually the org brand
        IF EXISTS (
          SELECT 1 FROM unnest(org_brand_aliases) AS alias
          WHERE LOWER(competitor) = alias
             OR LOWER(competitor) LIKE alias || ' %'
             OR LOWER(competitor) LIKE '% ' || alias
             OR LOWER(competitor) LIKE '% ' || alias || ' %'
        ) THEN
          found_org_brand := true;
          RAISE NOTICE 'Found org brand in competitors: %', competitor;
        ELSE
          -- Keep this competitor
          updated_competitors := updated_competitors || jsonb_build_array(competitor);
        END IF;
      END LOOP;
      
      -- If we found the org brand in competitors, fix the response
      IF found_org_brand THEN
        old_score := response_record.score;
        
        -- Calculate new score
        IF NOT response_record.org_brand_present THEN
          -- Brand was missed, significant score boost
          new_score := GREATEST(6.0, old_score + 3.0);
          
          -- Adjust for remaining competition
          new_score := new_score - (jsonb_array_length(updated_competitors) * 0.2);
          new_score := GREATEST(4.0, new_score);
        ELSE
          -- Brand was found but also in competitors (inconsistent)
          new_score := GREATEST(old_score, 5.0);
        END IF;
        
        -- Update the response
        UPDATE prompt_provider_responses
        SET 
          org_brand_present = true,
          org_brand_prominence = COALESCE(org_brand_prominence, 1),
          competitors_json = updated_competitors,
          competitors_count = jsonb_array_length(updated_competitors),
          score = new_score,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'org_brand_fix_applied', true,
            'fix_applied_at', NOW(),
            'original_score', old_score,
            'original_competitors_count', jsonb_array_length(response_record.competitors_json),
            'fix_version', '4.0-universal'
          )
        WHERE id = response_record.id;
        
        responses_fixed_count := responses_fixed_count + 1;
        total_score_improvement := total_score_improvement + (new_score - old_score);
        responses_checked := responses_checked + 1;
        
        RAISE NOTICE 'Fixed response % - score: % → %', 
          response_record.id, old_score, new_score;
      END IF;
    END LOOP;
    
    -- Return stats for this org
    RETURN QUERY SELECT 
      current_org_id,
      org_record.name,
      brands_added_count,
      responses_fixed_count,
      CASE 
        WHEN responses_checked > 0 THEN total_score_improvement / responses_checked
        ELSE 0
      END;
    
    -- Reset counters for next org
    brands_added_count := 0;
    responses_fixed_count := 0;
    total_score_improvement := 0;
    responses_checked := 0;
  END LOOP;
  
  RETURN;
END;
$$;

-- Execute the fix
SELECT * FROM fix_all_org_brand_classifications();

-- Create a view to monitor org brand detection health
CREATE OR REPLACE VIEW org_brand_detection_health AS
SELECT 
  o.id as org_id,
  o.name as org_name,
  o.domain,
  COUNT(DISTINCT bc.id) FILTER (WHERE bc.is_org_brand) as org_brands_in_catalog,
  COUNT(ppr.id) FILTER (WHERE ppr.run_at > NOW() - INTERVAL '7 days') as responses_last_7d,
  COUNT(ppr.id) FILTER (WHERE ppr.org_brand_present AND ppr.run_at > NOW() - INTERVAL '7 days') as brand_found_last_7d,
  ROUND(
    100.0 * COUNT(ppr.id) FILTER (WHERE ppr.org_brand_present AND ppr.run_at > NOW() - INTERVAL '7 days')::numeric / 
    NULLIF(COUNT(ppr.id) FILTER (WHERE ppr.run_at > NOW() - INTERVAL '7 days'), 0),
    1
  ) as brand_detection_rate_pct,
  ROUND(AVG(ppr.score) FILTER (WHERE ppr.run_at > NOW() - INTERVAL '7 days'), 2) as avg_score_7d
FROM organizations o
LEFT JOIN brand_catalog bc ON bc.org_id = o.id
LEFT JOIN prompt_provider_responses ppr ON ppr.org_id = o.id AND ppr.status = 'success'
GROUP BY o.id, o.name, o.domain
ORDER BY responses_last_7d DESC;

COMMENT ON VIEW org_brand_detection_health IS 
  'Monitors org brand detection rates to identify classification issues';
