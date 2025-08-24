-- Direct fix for misclassified responses - targeting specific issues from the image
CREATE OR REPLACE FUNCTION fix_recent_brand_misclassifications()
RETURNS TEXT
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_record RECORD;
  updated_competitors jsonb;
  fixes_applied INTEGER := 0;
  new_score numeric;
BEGIN
  -- Fix responses where "Marketing Hub" is listed as competitor (should be part of HubSpot)
  FOR response_record IN
    SELECT ppr.id, ppr.provider, ppr.competitors_json, ppr.score, ppr.competitors_count
    FROM prompt_provider_responses ppr
    WHERE ppr.status = 'success'
      AND ppr.run_at >= now() - interval '2 days'
      AND (
        ppr.competitors_json::text ILIKE '%marketing hub%' OR
        ppr.competitors_json::text ILIKE '%hubspot%' OR
        (ppr.org_brand_present = false AND ppr.score = 0 AND ppr.competitors_count > 10)
      )
  LOOP
    -- Remove HubSpot-related terms from competitors
    SELECT jsonb_agg(competitor) INTO updated_competitors
    FROM jsonb_array_elements_text(response_record.competitors_json) AS competitor
    WHERE LOWER(competitor) NOT SIMILAR TO '%(hubspot|marketing hub|hub.spot|social media|facebook insights)%'
      AND competitor NOT IN ('Facebook', 'Social Media') -- These were misclassified in the image
      AND LENGTH(competitor) > 2; -- Remove very short/generic terms
    
    -- Handle null case
    IF updated_competitors IS NULL THEN
      updated_competitors := '[]'::jsonb;
    END IF;
    
    -- Calculate appropriate score
    IF jsonb_array_length(updated_competitors) <= 5 THEN
      new_score := 7.5; -- High score: brand present, few competitors
    ELSIF jsonb_array_length(updated_competitors) <= 15 THEN  
      new_score := 6.0; -- Good score: brand present, moderate competition
    ELSE
      new_score := 4.5; -- Lower score: brand present but high competition
    END IF;
    
    -- Update the response
    UPDATE prompt_provider_responses
    SET 
      org_brand_present = true,
      org_brand_prominence = 1,
      competitors_json = updated_competitors,
      competitors_count = jsonb_array_length(updated_competitors),
      score = new_score,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'classification_fixed', true,
        'original_score', response_record.score,
        'original_competitor_count', response_record.competitors_count,
        'hubspot_correctly_classified', true,
        'fixed_at', now()
      )
    WHERE id = response_record.id;
    
    fixes_applied := fixes_applied + 1;
    
    RAISE NOTICE 'Fixed % response - competitors reduced from % to %, score: % -> %',
      response_record.provider, 
      response_record.competitors_count, 
      jsonb_array_length(updated_competitors),
      response_record.score,
      new_score;
  END LOOP;
  
  RETURN format('Fixed %s recent responses with brand misclassification issues', fixes_applied);
END;
$$;

-- Execute the fix
SELECT fix_recent_brand_misclassifications() as result;