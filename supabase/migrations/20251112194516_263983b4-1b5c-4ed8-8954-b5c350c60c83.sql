-- Fix Security Definer View issues for remaining 3 views
-- Add security_invoker option to ensure RLS policies are enforced based on querying user

-- 1. Fix ai_sources_top_domains
DROP VIEW IF EXISTS ai_sources_top_domains;

CREATE VIEW ai_sources_top_domains 
WITH (security_invoker = true) AS
SELECT 
  org_id,
  brand_id,
  domain,
  SUM(frequency) AS total_citations,
  COUNT(DISTINCT model) AS model_count,
  MAX(timestamp) AS last_cited,
  ARRAY_AGG(DISTINCT model) AS models
FROM ai_sources
GROUP BY org_id, brand_id, domain
ORDER BY total_citations DESC;

COMMENT ON VIEW ai_sources_top_domains IS 
  'Aggregates AI source citations by domain. Uses SECURITY INVOKER to enforce RLS policies.';

-- 2. Fix citation_quality_metrics
DROP VIEW IF EXISTS citation_quality_metrics;

CREATE VIEW citation_quality_metrics 
WITH (security_invoker = true) AS
SELECT 
  org_id,
  provider,
  DATE(run_at) AS metric_date,
  COUNT(DISTINCT id) AS total_responses,
  COUNT(DISTINCT id) FILTER (
    WHERE citations_json IS NOT NULL 
    AND jsonb_array_length(citations_json) > 0
  ) AS responses_with_citations,
  SUM(jsonb_array_length(COALESCE(citations_json, '[]'::jsonb))) AS total_citations,
  ROUND(
    AVG(jsonb_array_length(COALESCE(citations_json, '[]'::jsonb)))::numeric, 
    2
  ) AS avg_citations_per_response,
  ROUND(
    100.0 * COUNT(DISTINCT id) FILTER (
      WHERE citations_json IS NOT NULL 
      AND jsonb_array_length(citations_json) > 0
    )::numeric / NULLIF(COUNT(DISTINCT id), 0)::numeric,
    1
  ) AS citation_success_rate,
  COUNT(DISTINCT id) FILTER (WHERE org_brand_present = true) AS grounded_responses,
  ROUND(
    100.0 * COUNT(DISTINCT id) FILTER (WHERE org_brand_present = true)::numeric 
    / NULLIF(COUNT(DISTINCT id), 0)::numeric,
    1
  ) AS grounding_success_rate
FROM prompt_provider_responses
WHERE status = 'success'
GROUP BY org_id, provider, DATE(run_at)
ORDER BY metric_date DESC, provider;

COMMENT ON VIEW citation_quality_metrics IS 
  'Tracks citation quality metrics by provider and date. Uses SECURITY INVOKER to enforce RLS policies.';

-- 3. Fix low_visibility_prompts
DROP VIEW IF EXISTS low_visibility_prompts;

CREATE VIEW low_visibility_prompts 
WITH (security_invoker = true) AS
SELECT 
  prompt_id,
  org_id,
  presence_rate,
  runs_14d AS runs,
  prompt_text
FROM prompt_visibility_14d
WHERE presence_rate < 50;

COMMENT ON VIEW low_visibility_prompts IS 
  'Identifies prompts with low visibility (< 50% presence rate). Uses SECURITY INVOKER to enforce RLS policies.';