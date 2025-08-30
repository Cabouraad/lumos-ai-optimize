-- Create function to clean up competitor catalog
CREATE OR REPLACE FUNCTION public.clean_competitor_catalog(p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id uuid;
  org_context RECORD;
  competitor_record RECORD;
  total_competitors integer;
  to_delete_count integer := 0;
  to_keep_count integer := 0;
  deletions jsonb := '[]'::jsonb;
  generic_terms text[] := ARRAY[
    'seo', 'social media', 'facebook', 'google', 'microsoft', 'adobe', 'apple', 'amazon',
    'marketing', 'analytics', 'insights', 'tools', 'software', 'platform', 'service',
    'solution', 'system', 'data', 'content', 'business', 'company', 'team', 'email',
    'web', 'mobile', 'app', 'digital', 'online', 'social', 'media', 'search'
  ];
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found or not authenticated');
  END IF;
  
  -- Get organization context
  SELECT keywords, competitors, products_services, business_description
  INTO org_context
  FROM organizations
  WHERE id = user_org_id;
  
  -- Count total competitors
  SELECT COUNT(*) INTO total_competitors
  FROM brand_catalog
  WHERE org_id = user_org_id AND is_org_brand = false;
  
  -- Identify competitors to delete
  FOR competitor_record IN
    SELECT id, name, total_appearances, last_seen_at
    FROM brand_catalog
    WHERE org_id = user_org_id 
      AND is_org_brand = false
    ORDER BY total_appearances DESC, last_seen_at DESC
  LOOP
    DECLARE
      should_delete boolean := false;
      delete_reason text;
      normalized_name text;
    BEGIN
      normalized_name := LOWER(TRIM(competitor_record.name));
      
      -- Check if it's a generic term
      IF normalized_name = ANY(generic_terms) THEN
        should_delete := true;
        delete_reason := 'Generic term';
      -- Check if name is too short or invalid
      ELSIF LENGTH(normalized_name) < 3 OR normalized_name ~ '^[0-9]+$' THEN
        should_delete := true;
        delete_reason := 'Invalid name format';
      -- Check if it contains problematic characters
      ELSIF normalized_name ~ '[<>{}[\]()"`''""''„"‚'']' THEN
        should_delete := true;
        delete_reason := 'Contains invalid characters';
      -- Check if it's not mentioned in recent prompt responses (likely false positive)
      ELSIF NOT EXISTS (
        SELECT 1 FROM prompt_provider_responses ppr
        WHERE ppr.org_id = user_org_id
          AND ppr.status = 'success'
          AND ppr.run_at >= now() - interval '60 days'
          AND ppr.competitors_json::text ILIKE '%' || competitor_record.name || '%'
      ) THEN
        should_delete := true;
        delete_reason := 'No recent mentions in responses';
      END IF;
      
      IF should_delete THEN
        to_delete_count := to_delete_count + 1;
        deletions := deletions || jsonb_build_object(
          'id', competitor_record.id,
          'name', competitor_record.name,
          'reason', delete_reason,
          'appearances', competitor_record.total_appearances
        );
        
        -- Actually delete if not dry run
        IF NOT p_dry_run THEN
          DELETE FROM brand_catalog WHERE id = competitor_record.id;
        END IF;
      ELSE
        to_keep_count := to_keep_count + 1;
      END IF;
    END;
  END LOOP;
  
  -- If we still have more than 50 after cleanup, keep only top 50 by appearances
  IF NOT p_dry_run AND (to_keep_count > 50) THEN
    WITH ranked_competitors AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY total_appearances DESC, last_seen_at DESC) as rn
      FROM brand_catalog
      WHERE org_id = user_org_id AND is_org_brand = false
    )
    DELETE FROM brand_catalog
    WHERE id IN (
      SELECT id FROM ranked_competitors WHERE rn > 50
    );
    
    to_delete_count := to_delete_count + (to_keep_count - 50);
    to_keep_count := 50;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'total_before', total_competitors,
    'to_delete', to_delete_count,
    'to_keep', to_keep_count,
    'deletions', deletions,
    'final_count', CASE WHEN p_dry_run THEN LEAST(to_keep_count, 50) ELSE (
      SELECT COUNT(*) FROM brand_catalog WHERE org_id = user_org_id AND is_org_brand = false
    ) END
  );
END;
$function$;

-- Update upsert_competitor_brand to enforce 50 limit
CREATE OR REPLACE FUNCTION public.upsert_competitor_brand(p_org_id uuid, p_brand_name text, p_score integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_record RECORD;
  normalized_name text;
  current_count integer;
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
    -- Check current competitor count before inserting new one
    SELECT COUNT(*) INTO current_count
    FROM brand_catalog
    WHERE org_id = p_org_id AND is_org_brand = false;
    
    -- Only insert if under limit and not already an org brand
    IF current_count < 50 AND NOT EXISTS (
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

-- Update approve_brand_candidate to enforce 50 limit
CREATE OR REPLACE FUNCTION public.approve_brand_candidate(p_candidate_id uuid, p_candidate_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id uuid;
  candidate_org_id uuid;
  current_count integer;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not authenticated';
  END IF;
  
  -- Get the candidate's org_id
  SELECT org_id INTO candidate_org_id
  FROM brand_candidates
  WHERE id = p_candidate_id;
  
  -- Security check
  IF candidate_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only approve own organization candidates';
  END IF;
  
  -- Check current competitor count
  SELECT COUNT(*) INTO current_count
  FROM brand_catalog
  WHERE org_id = user_org_id AND is_org_brand = false;
  
  -- Only add if under limit
  IF current_count < 50 THEN
    -- Add to brand_catalog
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
      user_org_id,
      p_candidate_name,
      false,
      '[]'::jsonb,
      now(),
      now(),
      1,
      5.0
    )
    ON CONFLICT (org_id, name) DO NOTHING;
  END IF;
  
  -- Update candidate status regardless
  UPDATE brand_candidates 
  SET 
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = p_candidate_id;
END;
$function$;