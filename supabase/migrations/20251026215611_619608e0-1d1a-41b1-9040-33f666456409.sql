-- Fix Security Definer View issue for org_brand_detection_health
-- Convert from SECURITY DEFINER (default) to SECURITY INVOKER to enforce RLS policies

-- Drop the existing view
DROP VIEW IF EXISTS org_brand_detection_health;

-- Recreate the view with SECURITY INVOKER option
-- This ensures RLS policies from underlying tables are enforced
CREATE VIEW org_brand_detection_health 
WITH (security_invoker = true) AS
SELECT 
  o.id as org_id,
  o.name as org_name,
  o.domain,
  COUNT(DISTINCT bc.id) FILTER (WHERE bc.is_org_brand) as org_brands_in_catalog,
  COUNT(ppr.id) FILTER (WHERE ppr.run_at > now() - interval '7 days') as responses_last_7d,
  COUNT(ppr.id) FILTER (WHERE ppr.org_brand_present AND ppr.run_at > now() - interval '7 days') as brand_found_last_7d,
  ROUND(
    100.0 * COUNT(ppr.id) FILTER (WHERE ppr.org_brand_present AND ppr.run_at > now() - interval '7 days')::numeric 
    / NULLIF(COUNT(ppr.id) FILTER (WHERE ppr.run_at > now() - interval '7 days'), 0)::numeric,
    1
  ) as brand_detection_rate_pct,
  ROUND(AVG(ppr.score) FILTER (WHERE ppr.run_at > now() - interval '7 days'), 2) as avg_score_7d
FROM organizations o
LEFT JOIN brand_catalog bc ON bc.org_id = o.id
LEFT JOIN prompt_provider_responses ppr ON ppr.org_id = o.id AND ppr.status = 'success'
GROUP BY o.id, o.name, o.domain
ORDER BY responses_last_7d DESC;

-- Restore the helpful documentation comment
COMMENT ON VIEW org_brand_detection_health IS 
  'Monitors org brand detection rates to identify classification issues. Uses SECURITY INVOKER to enforce RLS policies.';

-- Verification: Check that the view now has security_invoker enabled
-- Run this query to verify: 
-- SELECT relname, reloptions FROM pg_class WHERE relname = 'org_brand_detection_health';
-- Expected result: reloptions = {security_invoker=true}