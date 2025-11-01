-- Table to store domain authority scores for known domains
CREATE TABLE IF NOT EXISTS public.domain_authority_reference (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL UNIQUE,
  authority_score integer NOT NULL CHECK (authority_score >= 0 AND authority_score <= 100),
  category text,
  tier text NOT NULL CHECK (tier IN ('tier1', 'tier2', 'tier3', 'unknown')),
  notes text,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_domain_authority_domain ON public.domain_authority_reference(domain);
CREATE INDEX idx_domain_authority_tier ON public.domain_authority_reference(tier);

ALTER TABLE public.domain_authority_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage domain authority"
ON public.domain_authority_reference
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can view domain authority"
ON public.domain_authority_reference
FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.domain_authority_reference (domain, authority_score, category, tier) VALUES
  ('wikipedia.org', 95, 'academic', 'tier1'),
  ('github.com', 93, 'tech', 'tier1'),
  ('stackoverflow.com', 92, 'tech', 'tier1'),
  ('nature.com', 97, 'academic', 'tier1'),
  ('science.org', 97, 'academic', 'tier1'),
  ('arxiv.org', 94, 'academic', 'tier1'),
  ('nih.gov', 96, 'government', 'tier1'),
  ('edu', 90, 'academic', 'tier1'),
  ('gov', 93, 'government', 'tier1'),
  ('medium.com', 82, 'tech', 'tier2'),
  ('forbes.com', 88, 'news', 'tier2'),
  ('techcrunch.com', 86, 'tech', 'tier2'),
  ('wired.com', 85, 'tech', 'tier2'),
  ('reuters.com', 89, 'news', 'tier2'),
  ('bloomberg.com', 88, 'news', 'tier2'),
  ('wsj.com', 89, 'news', 'tier2'),
  ('nytimes.com', 90, 'news', 'tier2'),
  ('blog', 55, 'general', 'tier3'),
  ('wordpress.com', 60, 'general', 'tier3'),
  ('substack.com', 65, 'general', 'tier3')
ON CONFLICT (domain) DO NOTHING;

COMMENT ON TABLE public.domain_authority_reference IS 'Reference table for domain authority scores used in CA calculation';

CREATE OR REPLACE FUNCTION public.get_domain_authority_score(p_domain text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score integer;
  v_clean_domain text;
BEGIN
  v_clean_domain := lower(trim(regexp_replace(p_domain, '^(https?://)?(www\.)?', '')));
  v_clean_domain := split_part(v_clean_domain, '/', 1);
  
  SELECT authority_score INTO v_score
  FROM public.domain_authority_reference
  WHERE domain = v_clean_domain;
  
  IF v_score IS NOT NULL THEN
    RETURN v_score;
  END IF;
  
  IF v_clean_domain LIKE '%.edu' THEN
    RETURN 90;
  ELSIF v_clean_domain LIKE '%.gov' THEN
    RETURN 93;
  ELSIF v_clean_domain LIKE '%.ac.%' THEN
    RETURN 88;
  END IF;
  
  IF v_clean_domain LIKE '%.wikipedia.org' THEN
    RETURN 95;
  ELSIF v_clean_domain LIKE '%.github.io' OR v_clean_domain LIKE '%.github.com' THEN
    RETURN 85;
  END IF;
  
  RETURN 50;
END;
$$;

COMMENT ON FUNCTION public.get_domain_authority_score IS 'Returns authority score (0-100) for a given domain';

CREATE OR REPLACE FUNCTION public.calculate_citation_authority_score(
  p_citations_json jsonb,
  p_org_domains text[]
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_citations integer := 0;
  v_weighted_score numeric := 0;
  v_citation jsonb;
  v_domain text;
  v_domain_score integer;
  v_brand_mention text;
  v_has_brand_mention boolean;
BEGIN
  IF p_citations_json IS NULL OR jsonb_array_length(p_citations_json -> 'citations') = 0 THEN
    RETURN 0;
  END IF;
  
  FOR v_citation IN SELECT * FROM jsonb_array_elements(p_citations_json -> 'citations')
  LOOP
    v_domain := v_citation ->> 'domain';
    v_brand_mention := v_citation ->> 'brand_mention';
    
    IF v_domain IS NULL OR v_domain = '' THEN
      CONTINUE;
    END IF;
    
    v_total_citations := v_total_citations + 1;
    v_has_brand_mention := v_brand_mention = 'yes';
    
    IF EXISTS (
      SELECT 1 FROM unnest(p_org_domains) AS od
      WHERE lower(v_domain) LIKE '%' || lower(od) || '%'
    ) THEN
      IF v_has_brand_mention THEN
        v_weighted_score := v_weighted_score + 100;
      ELSE
        v_weighted_score := v_weighted_score + 80;
      END IF;
    ELSE
      v_domain_score := public.get_domain_authority_score(v_domain);
      
      IF v_has_brand_mention THEN
        v_weighted_score := v_weighted_score + v_domain_score;
      ELSE
        v_weighted_score := v_weighted_score + (v_domain_score * 0.3);
      END IF;
    END IF;
  END LOOP;
  
  IF v_total_citations = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN LEAST(v_weighted_score / v_total_citations, 100);
END;
$$;

COMMENT ON FUNCTION public.calculate_citation_authority_score IS 'Calculates weighted citation authority score based on domain quality and brand mentions';

CREATE OR REPLACE FUNCTION public.calculate_ca_submetric(
  p_org_id uuid,
  p_prompt_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_domains text[];
  v_avg_ca_score numeric;
  v_responses_with_citations integer;
BEGIN
  v_org_domains := public.org_domain_set(p_org_id);
  
  WITH response_ca_scores AS (
    SELECT 
      ppr.id,
      public.calculate_citation_authority_score(ppr.citations_json, v_org_domains) as ca_score
    FROM public.prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'success'
      AND ppr.run_at >= p_window_start
      AND ppr.run_at < p_window_end
      AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
      AND ppr.citations_json IS NOT NULL
      AND jsonb_array_length(ppr.citations_json -> 'citations') > 0
  )
  SELECT 
    COUNT(*),
    COALESCE(AVG(ca_score), 0)
  INTO v_responses_with_citations, v_avg_ca_score
  FROM response_ca_scores;
  
  IF v_responses_with_citations = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN v_avg_ca_score;
END;
$$;

COMMENT ON FUNCTION public.calculate_ca_submetric IS 'Calculates CA submetric for org/prompt within a time window';