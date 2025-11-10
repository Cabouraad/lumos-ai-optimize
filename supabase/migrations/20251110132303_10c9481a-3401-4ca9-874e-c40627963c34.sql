-- Update Citation Authority calculation to use quality_score from citations
-- This ensures the Llumos score properly factors in the domain authority, recency, and relevance
-- that we calculate during citation extraction

DROP FUNCTION IF EXISTS public.calculate_citation_authority_score(jsonb, text[]);

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
  v_quality_score numeric;
  v_domain_authority numeric;
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
    v_quality_score := (v_citation ->> 'quality_score')::numeric;
    v_domain_authority := (v_citation -> 'quality_factors' ->> 'domain_authority')::numeric;
    
    IF v_domain IS NULL OR v_domain = '' THEN
      CONTINUE;
    END IF;
    
    v_total_citations := v_total_citations + 1;
    v_has_brand_mention := v_brand_mention = 'yes';
    
    -- Use quality_score if available, otherwise fallback to legacy calculation
    IF v_quality_score IS NOT NULL AND v_quality_score > 0 THEN
      -- Quality score is 0-100, use it directly
      IF EXISTS (
        SELECT 1 FROM unnest(p_org_domains) AS od
        WHERE lower(v_domain) LIKE '%' || lower(od) || '%'
      ) THEN
        -- Org domain citation: boost the score
        IF v_has_brand_mention THEN
          v_weighted_score := v_weighted_score + 100;  -- Maximum score for org domain with brand mention
        ELSE
          v_weighted_score := v_weighted_score + LEAST(v_quality_score * 1.2, 100);  -- 20% boost for org domain
        END IF;
      ELSE
        -- External citation: use quality score with brand mention adjustment
        IF v_has_brand_mention THEN
          v_weighted_score := v_weighted_score + v_quality_score;
        ELSE
          v_weighted_score := v_weighted_score + (v_quality_score * 0.7);  -- 30% reduction if no brand mention
        END IF;
      END IF;
    ELSE
      -- Fallback to legacy domain authority calculation for old data
      DECLARE
        v_legacy_domain_score integer;
      BEGIN
        v_legacy_domain_score := public.get_domain_authority_score(v_domain);
        
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
          IF v_has_brand_mention THEN
            v_weighted_score := v_weighted_score + v_legacy_domain_score;
          ELSE
            v_weighted_score := v_weighted_score + (v_legacy_domain_score * 0.3);
          END IF;
        END IF;
      END;
    END IF;
  END LOOP;
  
  IF v_total_citations = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN LEAST(v_weighted_score / v_total_citations, 100);
END;
$$;

COMMENT ON FUNCTION public.calculate_citation_authority_score IS 'Calculates weighted citation authority score using quality_score from citations (domain authority + recency + relevance), with fallback to legacy domain authority calculation';