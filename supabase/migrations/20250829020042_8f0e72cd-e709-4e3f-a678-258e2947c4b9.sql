-- STEP 1: Clean up existing polluted competitor data
DELETE FROM brand_catalog 
WHERE is_org_brand = false 
  AND (
    -- Remove obviously generic/stopword entries
    LOWER(name) IN (
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
      'for', 'and', 'the', 'with', 'you', 'your', 'our', 'their', 'this', 'that',
      'tools', 'tool', 'software', 'platform', 'service', 'solution', 'system',
      'data', 'content', 'marketing', 'business', 'company', 'team', 'user', 'users',
      'customer', 'customers', 'client', 'clients', 'email', 'web', 'mobile', 'app',
      'digital', 'online', 'social', 'media', 'search', 'analytics', 'insights',
      'management', 'automation', 'integration', 'optimization', 'performance',
      'experience', 'strategy', 'campaigns', 'audience', 'engagement', 'conversion',
      'roi', 'kpi', 'dashboard', 'report', 'reporting', 'analysis', 'tracking',
      'facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'pinterest',
      'adobe', 'microsoft', 'google', 'apple', 'amazon', 'meta'
    )
    -- Remove single character entries
    OR LENGTH(TRIM(name)) <= 1
    -- Remove entries that are purely numbers
    OR name ~ '^[0-9]+$'
    -- Remove entries with special characters that suggest parsing errors
    OR name ~ '[<>{}[\]()"`''""''„"‚'']'
    -- Remove very long entries (likely sentence fragments)
    OR LENGTH(name) > 50
    -- Remove entries that are common file extensions or technical terms
    OR LOWER(name) IN ('com', 'org', 'net', 'io', 'co', 'uk', 'html', 'php', 'js', 'css', 'jpg', 'png', 'gif', 'pdf')
  );

-- STEP 2: Enhance the upsert_competitor_brand function with comprehensive filtering
CREATE OR REPLACE FUNCTION public.upsert_competitor_brand(p_org_id uuid, p_brand_name text, p_score integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_record RECORD;
  normalized_name text;
  stopwords text[] := ARRAY[
    -- Generic terms
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'for', 'and', 'the', 'with', 'you', 'your', 'our', 'their', 'this', 'that',
    'tools', 'tool', 'software', 'platform', 'service', 'solution', 'system',
    'data', 'content', 'marketing', 'business', 'company', 'team', 'user', 'users',
    'customer', 'customers', 'client', 'clients', 'email', 'web', 'mobile', 'app',
    'digital', 'online', 'social', 'media', 'search', 'analytics', 'insights',
    'management', 'automation', 'integration', 'optimization', 'performance',
    'experience', 'strategy', 'campaigns', 'audience', 'engagement', 'conversion',
    'roi', 'kpi', 'dashboard', 'report', 'reporting', 'analysis', 'tracking',
    -- Tech giants (too generic to be useful competitors)
    'facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'pinterest',
    'adobe', 'microsoft', 'google', 'apple', 'amazon', 'meta',
    -- File extensions and technical
    'com', 'org', 'net', 'io', 'co', 'uk', 'html', 'php', 'js', 'css', 'jpg', 'png', 'gif', 'pdf'
  ];
BEGIN
  -- Normalize and validate the brand name
  normalized_name := LOWER(TRIM(p_brand_name));
  
  -- Comprehensive validation checks
  IF (
    -- Too short
    LENGTH(normalized_name) < 3 
    -- Is a stopword
    OR normalized_name = ANY(stopwords)
    -- Purely numeric
    OR normalized_name ~ '^[0-9]+$'
    -- Contains problematic characters (likely parsing errors)
    OR normalized_name ~ '[<>{}[\]()"`''""''„"‚'']'
    -- Too long (likely sentence fragment)
    OR LENGTH(normalized_name) > 50
    -- Contains common spam patterns
    OR normalized_name LIKE '%click here%'
    OR normalized_name LIKE '%learn more%'
    OR normalized_name LIKE '%sign up%'
    OR normalized_name LIKE '%get started%'
    -- Ends with common domain patterns but isn't a proper domain
    OR (normalized_name LIKE '%.com' AND LENGTH(normalized_name) <= 7)
    OR (normalized_name LIKE '%.org' AND LENGTH(normalized_name) <= 7)
  ) THEN
    RETURN; -- Skip invalid entries
  END IF;
  
  -- Check if brand already exists (case-insensitive)
  SELECT * INTO existing_record
  FROM brand_catalog 
  WHERE org_id = p_org_id 
    AND LOWER(TRIM(name)) = normalized_name
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
        AND LOWER(TRIM(name)) = normalized_name
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
        INITCAP(TRIM(p_brand_name)), -- Proper case
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
$function$;

-- STEP 3: Enhance the get_prompt_competitors function with better filtering
CREATE OR REPLACE FUNCTION public.get_prompt_competitors(p_prompt_id uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(competitor_name text, mentions bigint, share numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id uuid;
  prompt_org_id uuid;
  competitor_stopwords text[] := ARRAY[
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'for', 'and', 'the', 'with', 'you', 'your', 'our', 'their', 'this', 'that',
    'tools', 'tool', 'software', 'platform', 'service', 'solution', 'system',
    'data', 'content', 'marketing', 'business', 'company', 'team', 'user', 'users',
    'customer', 'customers', 'client', 'clients', 'email', 'web', 'mobile', 'app',
    'digital', 'online', 'social', 'media', 'search', 'analytics', 'insights',
    'facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'adobe', 'microsoft', 'google'
  ];
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get the prompt's org_id
  SELECT p.org_id INTO prompt_org_id
  FROM prompts p
  WHERE p.id = p_prompt_id;
  
  IF prompt_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Only allow access to user's own org prompts
  IF prompt_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own organization prompts';
  END IF;
  
  -- Get latest response per provider, then aggregate competitors with aggressive filtering
  RETURN QUERY
  WITH latest_responses AS (
    SELECT DISTINCT ON (ppr.provider)
      ppr.competitors_json,
      ppr.score
    FROM prompt_provider_responses ppr
    WHERE ppr.prompt_id = p_prompt_id
      AND ppr.status = 'success'
      AND ppr.run_at >= now() - (p_days || ' days')::interval
    ORDER BY ppr.provider, ppr.run_at DESC
  ),
  competitor_mentions AS (
    SELECT 
      jsonb_array_elements_text(lr.competitors_json) as competitor,
      lr.score
    FROM latest_responses lr
    WHERE jsonb_array_length(lr.competitors_json) > 0
  ),
  filtered_competitors AS (
    SELECT 
      TRIM(LOWER(competitor)) as normalized_name,
      competitor as original_name,
      score
    FROM competitor_mentions
    WHERE TRIM(competitor) != ''
      AND LENGTH(TRIM(competitor)) >= 3
      AND LENGTH(TRIM(competitor)) <= 50
      -- Filter out stopwords
      AND NOT (LOWER(TRIM(competitor)) = ANY(competitor_stopwords))
      -- Filter out purely numeric entries
      AND NOT (TRIM(competitor) ~ '^[0-9]+$')
      -- Filter out entries with problematic characters
      AND NOT (TRIM(competitor) ~ '[<>{}[\]()"`''""''„"‚'']')
      -- Filter out obvious spam patterns
      AND NOT (LOWER(TRIM(competitor)) LIKE '%click here%')
      AND NOT (LOWER(TRIM(competitor)) LIKE '%learn more%')
      -- Filter out org brands
      AND NOT EXISTS (
        SELECT 1 FROM brand_catalog bc 
        WHERE bc.org_id = prompt_org_id 
          AND bc.is_org_brand = true
          AND (
            LOWER(TRIM(bc.name)) = LOWER(TRIM(competitor)) OR
            bc.variants_json ? competitor
          )
      )
  ),
  aggregated AS (
    SELECT 
      (array_agg(original_name ORDER BY original_name))[1] as competitor_name,
      count(*) as competitor_mentions_count
    FROM filtered_competitors
    GROUP BY normalized_name
  ),
  total_mentions AS (
    SELECT sum(competitor_mentions_count) as total FROM aggregated
  )
  SELECT 
    a.competitor_name,
    a.competitor_mentions_count as mentions,
    CASE 
      WHEN t.total > 0 THEN round((a.competitor_mentions_count::numeric / t.total::numeric) * 100, 1)
      ELSE 0
    END as share
  FROM aggregated a
  CROSS JOIN total_mentions t
  WHERE a.competitor_mentions_count > 0
    -- Only show competitors mentioned multiple times across providers (higher confidence)
    AND a.competitor_mentions_count >= 1
  ORDER BY a.competitor_mentions_count DESC
  LIMIT 10; -- Show only top 10 most mentioned competitors
END;
$function$;