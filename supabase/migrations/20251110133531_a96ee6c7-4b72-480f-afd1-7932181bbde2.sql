-- Fix CA submetric to include 'completed' responses (current data uses this status)
DROP FUNCTION IF EXISTS public.calculate_ca_submetric(uuid, uuid, timestamptz, timestamptz);

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
      AND ppr.status IN ('completed','success')
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

COMMENT ON FUNCTION public.calculate_ca_submetric IS 'Calculates CA submetric for org/prompt within a time window; includes responses with status completed/success.';