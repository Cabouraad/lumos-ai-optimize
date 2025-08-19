-- Add database indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompt_runs_prompt_id_run_at ON prompt_runs(prompt_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_runs_provider_id ON prompt_runs(provider_id);
CREATE INDEX IF NOT EXISTS idx_visibility_results_prompt_run_id ON visibility_results(prompt_run_id);
CREATE INDEX IF NOT EXISTS idx_visibility_results_score ON visibility_results(score);
CREATE INDEX IF NOT EXISTS idx_brand_catalog_org_id_name ON brand_catalog(org_id, name);
CREATE INDEX IF NOT EXISTS idx_competitor_mentions_org_id ON competitor_mentions(org_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_org_id_status ON recommendations(org_id, status);

-- Ensure scheduler_state table has proper structure
INSERT INTO scheduler_state (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- Add gemini provider if not exists
INSERT INTO llm_providers (name, enabled) VALUES ('gemini', true) ON CONFLICT (name) DO NOTHING;