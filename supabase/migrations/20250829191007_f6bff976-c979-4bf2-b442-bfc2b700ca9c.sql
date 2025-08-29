-- Step 1: Create brand_candidates table for moderation
CREATE TABLE public.brand_candidates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL,
    candidate_name TEXT NOT NULL,
    detection_count INTEGER NOT NULL DEFAULT 1,
    first_detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(org_id, candidate_name)
);

-- Enable RLS for brand_candidates
ALTER TABLE public.brand_candidates ENABLE ROW LEVEL SECURITY;

-- RLS policies for brand_candidates
CREATE POLICY "brand_candidates_org_access" ON public.brand_candidates
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid() 
        AND u.org_id = brand_candidates.org_id 
        AND u.role = 'owner'
    )
);

-- Step 2: Update upsert_competitor_brand to only update existing brands
CREATE OR REPLACE FUNCTION public.upsert_competitor_brand(
    p_org_id uuid, 
    p_brand_name text, 
    p_score integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    existing_brand RECORD;
    normalized_name text;
    stopwords text[] := ARRAY[
        'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'for', 'and', 'the', 'with', 'you', 'your', 'our', 'their', 'this', 'that',
        'tools', 'tool', 'software', 'platform', 'service', 'solution', 'system',
        'data', 'content', 'marketing', 'business', 'company', 'team', 'user', 'users',
        'customer', 'customers', 'client', 'clients', 'email', 'web', 'mobile', 'app',
        'digital', 'online', 'social', 'media', 'search', 'analytics', 'insights',
        'management', 'automation', 'integration', 'optimization', 'performance',
        'experience', 'strategy', 'campaigns', 'audience', 'engagement', 'conversion',
        'choose', 'focus', 'start', 'implement', 'use', 'create', 'build', 'get',
        'facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'google', 'microsoft'
    ];
BEGIN
    normalized_name := LOWER(TRIM(p_brand_name));
    
    -- Comprehensive validation - reject invalid entries
    IF (
        LENGTH(normalized_name) < 3 
        OR normalized_name = ANY(stopwords)
        OR normalized_name ~ '^[0-9]+$'
        OR normalized_name ~ '[<>{}[\]()"`''""''„"‚'']'
        OR LENGTH(normalized_name) > 50
        OR normalized_name LIKE '%click here%'
        OR normalized_name LIKE '%learn more%'
    ) THEN
        RETURN; -- Skip invalid entries completely
    END IF;
    
    -- Check if brand exists in catalog (case-insensitive)
    SELECT * INTO existing_brand
    FROM brand_catalog 
    WHERE org_id = p_org_id 
        AND LOWER(TRIM(name)) = normalized_name;
    
    IF existing_brand IS NOT NULL THEN
        -- Update existing brand only
        IF existing_brand.is_org_brand = false THEN
            UPDATE brand_catalog 
            SET 
                last_seen_at = now(),
                total_appearances = total_appearances + 1,
                average_score = ((average_score * total_appearances) + p_score) / (total_appearances + 1)
            WHERE id = existing_brand.id;
        END IF;
    ELSE
        -- Route to candidates table for moderation (but only if not an org brand)
        IF NOT EXISTS (
            SELECT 1 FROM brand_catalog 
            WHERE org_id = p_org_id 
                AND LOWER(TRIM(name)) = normalized_name
                AND is_org_brand = true
        ) THEN
            INSERT INTO brand_candidates (
                org_id,
                candidate_name,
                detection_count,
                first_detected_at,
                last_detected_at
            ) VALUES (
                p_org_id,
                INITCAP(TRIM(p_brand_name)),
                1,
                now(),
                now()
            )
            ON CONFLICT (org_id, candidate_name) 
            DO UPDATE SET
                detection_count = brand_candidates.detection_count + 1,
                last_detected_at = now();
        END IF;
    END IF;
END;
$$;

-- Step 3: Create trigger to filter competitors_json against brand_catalog
CREATE OR REPLACE FUNCTION filter_competitors_against_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    filtered_competitors jsonb := '[]'::jsonb;
    competitor text;
    verified_count integer := 0;
BEGIN
    -- Only process if competitors_json is being updated and not null
    IF NEW.competitors_json IS NOT NULL AND jsonb_array_length(NEW.competitors_json) > 0 THEN
        -- Filter each competitor against brand_catalog
        FOR competitor IN SELECT jsonb_array_elements_text(NEW.competitors_json)
        LOOP
            -- Only include if exists in brand_catalog as competitor
            IF EXISTS (
                SELECT 1 FROM brand_catalog 
                WHERE org_id = NEW.org_id 
                    AND LOWER(TRIM(name)) = LOWER(TRIM(competitor))
                    AND is_org_brand = false
            ) THEN
                filtered_competitors := filtered_competitors || jsonb_build_array(competitor);
                verified_count := verified_count + 1;
            END IF;
        END LOOP;
        
        -- Update with filtered competitors
        NEW.competitors_json := filtered_competitors;
        NEW.competitors_count := verified_count;
        
        -- Add metadata about filtering
        NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
            'competitors_filtered_by_catalog', true,
            'filtered_at', now(),
            'verified_competitors_count', verified_count
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create the trigger on prompt_provider_responses
CREATE TRIGGER filter_competitors_catalog_trigger
    BEFORE INSERT OR UPDATE OF competitors_json ON prompt_provider_responses
    FOR EACH ROW
    EXECUTE FUNCTION filter_competitors_against_catalog();

-- Step 4: Seed brand_catalog with common HubSpot competitors
DO $$
DECLARE
    org_record RECORD;
    common_competitors text[] := ARRAY[
        'Salesforce', 'Pipedrive', 'Zoho CRM', 'ActiveCampaign', 'Mailchimp', 
        'Constant Contact', 'ConvertKit', 'Pardot', 'Marketo', 'Eloqua',
        'Zendesk', 'Intercom', 'Drift', 'Freshworks', 'Monday.com',
        'Asana', 'Trello', 'Notion', 'Airtable', 'ClickFunnels',
        'Leadpages', 'Unbounce', 'OptinMonster', 'Sumo', 'Hotjar'
    ];
    competitor_name text;
BEGIN
    -- For each organization with HubSpot as org brand, add common competitors
    FOR org_record IN
        SELECT DISTINCT org_id 
        FROM brand_catalog 
        WHERE is_org_brand = true 
            AND (LOWER(name) LIKE '%hubspot%' OR LOWER(name) LIKE '%marketing hub%')
    LOOP
        -- Add each common competitor if not already exists
        FOREACH competitor_name IN ARRAY common_competitors
        LOOP
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
                org_record.org_id,
                competitor_name,
                false,
                '[]'::jsonb,
                now(),
                now(),
                1,
                5.0
            )
            ON CONFLICT (org_id, name) DO NOTHING; -- Skip if already exists
        END LOOP;
    END LOOP;
END;
$$;