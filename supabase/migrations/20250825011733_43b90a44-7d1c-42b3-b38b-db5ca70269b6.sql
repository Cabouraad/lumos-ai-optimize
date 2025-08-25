-- Drop all views that depend on the score column
DROP VIEW IF EXISTS latest_prompt_provider_responses;
DROP MATERIALIZED VIEW IF EXISTS dashboard_performance_metrics;

-- Fix the score column to accept decimal values
ALTER TABLE prompt_provider_responses ALTER COLUMN score TYPE NUMERIC;

-- Recreate the latest responses view
CREATE VIEW latest_prompt_provider_responses AS
SELECT DISTINCT ON (prompt_id, provider) 
  id, org_id, prompt_id, provider, model, status, 
  raw_ai_response, error, raw_evidence, metadata,
  token_in, token_out, brands_json, org_brand_present, 
  org_brand_prominence, competitors_json, competitors_count, 
  score, run_at
FROM prompt_provider_responses 
ORDER BY prompt_id, provider, run_at DESC;