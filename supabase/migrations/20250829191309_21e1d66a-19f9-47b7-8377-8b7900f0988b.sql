-- Fix the constraint issue and continue with core functionality

-- First add unique constraint to brand_catalog
ALTER TABLE brand_catalog ADD CONSTRAINT brand_catalog_org_name_unique UNIQUE (org_id, name);

-- Now seed common HubSpot competitors with proper conflict handling  
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
            ON CONFLICT (org_id, name) DO NOTHING; -- Now this will work
        END LOOP;
    END LOOP;
END;
$$;