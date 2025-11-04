-- Create ai_sources table to track citation sources
CREATE TABLE IF NOT EXISTS public.ai_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  domain text NOT NULL,
  frequency integer NOT NULL DEFAULT 1,
  model text NOT NULL,
  date_tracked date NOT NULL DEFAULT CURRENT_DATE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_sources_org_id ON public.ai_sources(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_sources_domain ON public.ai_sources(domain);
CREATE INDEX IF NOT EXISTS idx_ai_sources_date ON public.ai_sources(date_tracked);
CREATE INDEX IF NOT EXISTS idx_ai_sources_org_domain ON public.ai_sources(org_id, domain);

-- Add unique constraint for daily domain tracking per org and model
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_sources_unique_daily 
  ON public.ai_sources(org_id, domain, date_tracked, model);

-- Enable RLS
ALTER TABLE public.ai_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org's ai sources"
  ON public.ai_sources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.org_id = ai_sources.org_id
    )
  );

CREATE POLICY "Service role can manage ai sources"
  ON public.ai_sources
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to extract domain from URL
CREATE OR REPLACE FUNCTION extract_domain(url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
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

-- Function to process citations and store sources
CREATE OR REPLACE FUNCTION process_citation_sources()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger to automatically process citations
CREATE TRIGGER process_citations_trigger
  AFTER INSERT ON public.prompt_provider_responses
  FOR EACH ROW
  EXECUTE FUNCTION process_citation_sources();

-- Create view for top sources aggregation
CREATE OR REPLACE VIEW public.ai_sources_top_domains AS
SELECT 
  org_id,
  domain,
  SUM(frequency) as total_citations,
  COUNT(DISTINCT model) as model_count,
  MAX(timestamp) as last_cited,
  array_agg(DISTINCT model) as models
FROM public.ai_sources
WHERE date_tracked >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY org_id, domain
ORDER BY total_citations DESC;