-- Add citation validation tracking fields
ALTER TABLE prompt_provider_responses
ADD COLUMN IF NOT EXISTS citations_validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS citations_validation_status TEXT CHECK (citations_validation_status IN ('pending', 'validating', 'completed', 'failed'));

-- Create citation quality metrics view
CREATE OR REPLACE VIEW citation_quality_metrics AS
SELECT
  ppr.org_id,
  ppr.provider,
  DATE(ppr.run_at) as metric_date,
  COUNT(DISTINCT ppr.id) as total_responses,
  COUNT(DISTINCT ppr.id) FILTER (WHERE ppr.citations_json IS NOT NULL AND jsonb_array_length(ppr.citations_json->'citations') > 0) as responses_with_citations,
  ROUND(
    COUNT(DISTINCT ppr.id) FILTER (WHERE ppr.citations_json IS NOT NULL AND jsonb_array_length(ppr.citations_json->'citations') > 0)::numeric / 
    NULLIF(COUNT(DISTINCT ppr.id), 0) * 100, 
    2
  ) as citation_success_rate,
  AVG(jsonb_array_length(ppr.citations_json->'citations')) FILTER (WHERE ppr.citations_json IS NOT NULL) as avg_citations_per_response,
  SUM(jsonb_array_length(ppr.citations_json->'citations')) FILTER (WHERE ppr.citations_json IS NOT NULL) as total_citations,
  COUNT(DISTINCT ppr.id) FILTER (WHERE ppr.citations_json->'citations' @> '[{"from_provider": true}]'::jsonb) as grounded_responses,
  ROUND(
    COUNT(DISTINCT ppr.id) FILTER (WHERE ppr.citations_json->'citations' @> '[{"from_provider": true}]'::jsonb)::numeric / 
    NULLIF(COUNT(DISTINCT ppr.id) FILTER (WHERE ppr.citations_json IS NOT NULL), 0) * 100,
    2
  ) as grounding_success_rate
FROM prompt_provider_responses ppr
WHERE ppr.status IN ('completed', 'success')
  AND ppr.run_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY ppr.org_id, ppr.provider, DATE(ppr.run_at);

-- Grant access to view
GRANT SELECT ON citation_quality_metrics TO authenticated;

-- Create function to get citation comparison for a prompt
CREATE OR REPLACE FUNCTION get_citation_comparison(p_prompt_id uuid, p_org_id uuid DEFAULT NULL)
RETURNS TABLE(
  provider text,
  response_id uuid,
  run_at timestamp with time zone,
  citation_url text,
  citation_domain text,
  citation_title text,
  from_provider boolean,
  source_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Resolve org_id
  IF p_org_id IS NULL THEN
    SELECT u.org_id INTO v_org_id FROM users u WHERE u.id = auth.uid();
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'User not found or has no org_id';
    END IF;
  ELSE
    v_org_id := p_org_id;
  END IF;

  RETURN QUERY
  SELECT
    ppr.provider,
    ppr.id as response_id,
    ppr.run_at,
    cite.value->>'url' as citation_url,
    cite.value->>'domain' as citation_domain,
    cite.value->>'title' as citation_title,
    COALESCE((cite.value->>'from_provider')::boolean, false) as from_provider,
    COALESCE(cite.value->>'source_type', 'unknown') as source_type
  FROM prompt_provider_responses ppr
  CROSS JOIN LATERAL jsonb_array_elements(ppr.citations_json->'citations') AS cite
  WHERE ppr.prompt_id = p_prompt_id
    AND ppr.org_id = v_org_id
    AND ppr.status IN ('completed', 'success')
    AND ppr.citations_json IS NOT NULL
  ORDER BY ppr.run_at DESC, ppr.provider;
END;
$$;

GRANT EXECUTE ON FUNCTION get_citation_comparison(uuid, uuid) TO authenticated;

COMMENT ON VIEW citation_quality_metrics IS 'Aggregated citation quality metrics by provider and date';
COMMENT ON FUNCTION get_citation_comparison IS 'Returns all citations for a prompt across providers for comparison';