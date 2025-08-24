-- Phase 2: Database Cleanup and Optimization

-- Drop obsolete tables that are no longer receiving data
DROP TABLE IF EXISTS visibility_results CASCADE;
DROP TABLE IF EXISTS prompt_runs CASCADE;

-- Add composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ppr_org_prompt_run_at 
ON prompt_provider_responses (org_id, prompt_id, run_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ppr_org_status_run_at 
ON prompt_provider_responses (org_id, status, run_at DESC) 
WHERE status = 'success';

-- Optimize competitor_mentions for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_competitor_mentions_org_prompt 
ON competitor_mentions (org_id, prompt_id, normalized_name);

-- Add index for brand_catalog performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brand_catalog_org_type 
ON brand_catalog (org_id, is_org_brand);

-- Create materialized view for dashboard performance
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_performance_metrics AS
SELECT 
    org_id,
    COUNT(DISTINCT prompt_id) as total_prompts,
    COUNT(*) as total_runs,
    AVG(score) as avg_score,
    COUNT(*) FILTER (WHERE org_brand_present = true) as brand_mentions,
    COUNT(DISTINCT competitors_json->>'competitors') as unique_competitors,
    MAX(run_at) as last_run_at
FROM prompt_provider_responses 
WHERE status = 'success' 
    AND run_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY org_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_metrics_org 
ON dashboard_performance_metrics (org_id);

-- Add function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_performance_metrics;
END;
$$;