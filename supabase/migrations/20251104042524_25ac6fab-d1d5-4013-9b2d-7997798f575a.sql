-- Fix security warnings for ai_sources functions

-- Update extract_domain function with search_path
CREATE OR REPLACE FUNCTION extract_domain(url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  domain text;
BEGIN
  -- Remove protocol
  domain := regexp_replace(url, '^https?://', '');
  -- Remove www.
  domain := regexp_replace(domain, '^www\.', '');
  -- Extract just the domain (before first /)
  domain := split_part(domain, '/', 1);
  -- Remove port if present
  domain := split_part(domain, ':', 1);
  RETURN lower(domain);
END;
$$;

-- Update process_citation_sources function with search_path
CREATE OR REPLACE FUNCTION process_citation_sources()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  citation jsonb;
  citation_url text;
  source_domain text;
  tracked_date date;
BEGIN
  -- Only process if citations exist
  IF NEW.citations_json IS NOT NULL AND jsonb_array_length(NEW.citations_json) > 0 THEN
    tracked_date := DATE(NEW.run_at);
    
    -- Loop through each citation
    FOR citation IN SELECT * FROM jsonb_array_elements(NEW.citations_json)
    LOOP
      -- Extract URL from citation
      citation_url := citation->>'url';
      
      IF citation_url IS NOT NULL AND citation_url != '' THEN
        -- Extract domain
        source_domain := extract_domain(citation_url);
        
        IF source_domain IS NOT NULL AND source_domain != '' THEN
          -- Insert or update source tracking
          INSERT INTO public.ai_sources (org_id, domain, frequency, model, date_tracked, timestamp)
          VALUES (NEW.org_id, source_domain, 1, NEW.model, tracked_date, NEW.run_at)
          ON CONFLICT (org_id, domain, date_tracked, model) 
          DO UPDATE SET 
            frequency = ai_sources.frequency + 1,
            updated_at = now();
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;