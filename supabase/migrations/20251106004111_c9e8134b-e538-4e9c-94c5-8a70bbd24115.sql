-- Add brand_id to ai_sources table for brand-specific filtering
ALTER TABLE public.ai_sources
ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id);

-- Add index for brand filtering
CREATE INDEX IF NOT EXISTS idx_ai_sources_brand_id ON public.ai_sources(brand_id);
CREATE INDEX IF NOT EXISTS idx_ai_sources_org_brand ON public.ai_sources(org_id, brand_id);

-- Update unique constraint to include brand_id
DROP INDEX IF EXISTS idx_ai_sources_unique_daily;
CREATE UNIQUE INDEX idx_ai_sources_unique_daily 
  ON public.ai_sources(org_id, domain, date_tracked, model, COALESCE(brand_id::text, 'null'));

-- Update the process_citation_sources function to include brand_id
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
          -- Insert or update source tracking with brand_id
          INSERT INTO public.ai_sources (org_id, domain, frequency, model, date_tracked, timestamp, brand_id)
          VALUES (NEW.org_id, source_domain, 1, NEW.model, tracked_date, NEW.run_at, NEW.brand_id)
          ON CONFLICT (org_id, domain, date_tracked, model, COALESCE(brand_id::text, 'null'))
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

-- Drop and recreate view to support brand filtering
DROP VIEW IF EXISTS public.ai_sources_top_domains;

CREATE VIEW public.ai_sources_top_domains AS
SELECT 
  org_id,
  brand_id,
  domain,
  SUM(frequency) as total_citations,
  COUNT(DISTINCT model) as model_count,
  MAX(timestamp) as last_cited,
  array_agg(DISTINCT model) as models
FROM public.ai_sources
WHERE date_tracked >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY org_id, brand_id, domain
ORDER BY total_citations DESC;