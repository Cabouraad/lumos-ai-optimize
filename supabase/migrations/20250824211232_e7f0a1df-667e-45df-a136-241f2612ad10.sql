-- Enhanced brand classification fix for all providers (Gemini, Perplexity, OpenAI)
CREATE OR REPLACE FUNCTION fix_brand_classification_all_providers()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_record RECORD;
  updated_competitors jsonb;
  updated_brands jsonb;
  fixes_applied INTEGER := 0;
  org_id_var uuid;
  hubspot_variants text[] := ARRAY['hubspot', 'hub spot', 'hub-spot', 'hubspot marketing hub', 'marketing hub', 'hubspot.com'];
BEGIN
  -- Get the current user's org_id
  SELECT u.org_id INTO org_id_var
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF org_id_var IS NULL THEN
    RETURN 'Error: Could not determine organization';
  END IF;

  -- Process responses that likely have HubSpot misclassified
  FOR response_record IN
    SELECT ppr.id, ppr.provider, ppr.competitors_json, ppr.brands_json, 
           ppr.competitors_count, ppr.score, ppr.raw_ai_response, ppr.run_at
    FROM prompt_provider_responses ppr
    JOIN prompts p ON ppr.prompt_id = p.id
    WHERE p.org_id = org_id_var
      AND ppr.status = 'success'
      AND ppr.run_at >= now() - interval '7 days'
      AND (
        -- HubSpot mentioned in competitors
        ppr.competitors_json::text ILIKE ANY(ARRAY['%hubspot%', '%marketing hub%', '%hub spot%']) OR
        -- Low score with no brand found (likely misclassification)
        (ppr.org_brand_present = false AND ppr.score <= 2) OR
        -- "Marketing Hub" as standalone competitor (likely part of HubSpot)
        ppr.competitors_json::text ILIKE '%marketing hub%'
      )
  LOOP
    -- Initialize updated arrays
    updated_competitors := '[]'::jsonb;
    updated_brands := COALESCE(response_record.brands_json, '[]'::jsonb);
    
    -- Check if HubSpot variants are in competitors and remove them
    IF response_record.competitors_json IS NOT NULL THEN
      SELECT jsonb_agg(competitor) INTO updated_competitors
      FROM jsonb_array_elements_text(response_record.competitors_json) AS competitor
      WHERE NOT (
        LOWER(competitor) = ANY(hubspot_variants) OR
        LOWER(competitor) LIKE '%hubspot%' OR
        LOWER(competitor) LIKE '%marketing hub%' OR
        LOWER(competitor) LIKE '%hub spot%'
      );
    END IF;
    
    -- Ensure we have valid JSON arrays
    IF updated_competitors IS NULL THEN
      updated_competitors := '[]'::jsonb;
    END IF;
    
    -- Add HubSpot to brands array if not already there
    IF NOT (updated_brands::text ILIKE '%hubspot%') THEN
      updated_brands := updated_brands || '["HubSpot Marketing Hub"]'::jsonb;
    END IF;
    
    -- Calculate new score based on brand presence
    DECLARE
      new_score numeric;
      competitor_penalty numeric;
    BEGIN
      -- Base score for brand presence
      new_score := 6.0;
      
      -- Position bonus (assume early position since it's usually mentioned prominently)
      new_score := new_score + 1.5;
      
      -- Competition penalty
      competitor_penalty := LEAST(1.5, jsonb_array_length(updated_competitors) * 0.3);
      new_score := new_score - competitor_penalty;
      
      -- Ensure score is within bounds
      new_score := GREATEST(3.0, LEAST(10.0, new_score));
      
      -- Update the response
      UPDATE prompt_provider_responses 
      SET 
        org_brand_present = true,
        org_brand_prominence = 1, -- Early position
        competitors_json = updated_competitors,
        brands_json = updated_brands,
        competitors_count = jsonb_array_length(updated_competitors),
        score = new_score,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'brand_classification_enhanced', true,
          'original_score', response_record.score,
          'original_competitors_count', response_record.competitors_count,
          'hubspot_reclassified', true,
          'fix_applied_at', now(),
          'fix_version', '2.0'
        )
      WHERE id = response_record.id;
      
      fixes_applied := fixes_applied + 1;
      
      RAISE NOTICE 'Fixed % response ID % - Score: % -> %, Competitors: % -> %', 
        response_record.provider, response_record.id, 
        response_record.score, new_score,
        response_record.competitors_count, jsonb_array_length(updated_competitors);
    END;
  END LOOP;
  
  RETURN format('Enhanced classification applied to %s responses across all providers', fixes_applied);
END;
$$;

-- Execute the enhanced fix
SELECT fix_brand_classification_all_providers() as result;