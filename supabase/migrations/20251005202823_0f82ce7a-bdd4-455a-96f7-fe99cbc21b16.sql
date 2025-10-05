-- ============================================================================
-- OPTIMIZATIONS V2: Complete Rewrite for Performance & Quality
-- ============================================================================

-- Drop old tables and views (preserve data with _archive suffix)
ALTER TABLE IF EXISTS optimizations RENAME TO optimizations_legacy;
ALTER TABLE IF EXISTS ai_visibility_recommendations RENAME TO ai_visibility_recommendations_legacy;
ALTER TABLE IF EXISTS optimization_jobs RENAME TO optimization_jobs_legacy;

-- ============================================================================
-- CORE OPTIMIZATIONS TABLE
-- ============================================================================
CREATE TABLE optimizations_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  
  -- Core content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('blog_post', 'case_study', 'guide', 'video', 'podcast', 'infographic', 'webinar', 'whitepaper', 'social_post', 'reddit_post', 'quora_answer')),
  optimization_category TEXT NOT NULL DEFAULT 'visibility' CHECK (optimization_category IN ('visibility', 'citation', 'competitor', 'content_gap')),
  
  -- Implementation tracking
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'dismissed')),
  priority_score INTEGER NOT NULL DEFAULT 50 CHECK (priority_score BETWEEN 0 AND 100),
  difficulty_level TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  estimated_hours INTEGER,
  
  -- Content specifications (JSONB for flexibility)
  content_specs JSONB NOT NULL DEFAULT '{}',
  distribution_channels JSONB NOT NULL DEFAULT '[]',
  implementation_steps JSONB NOT NULL DEFAULT '[]',
  success_metrics JSONB NOT NULL DEFAULT '{}',
  citations_used JSONB DEFAULT '[]',
  prompt_context JSONB DEFAULT '{}',
  
  -- Deduplication
  content_hash TEXT NOT NULL,
  
  -- LLM metadata
  llm_model TEXT DEFAULT 'google/gemini-2.5-flash',
  llm_tokens_used INTEGER DEFAULT 0,
  generation_confidence NUMERIC(3,2) DEFAULT 0.85,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Performance indexes
CREATE INDEX idx_optimizations_v2_org_id ON optimizations_v2(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_optimizations_v2_prompt_id ON optimizations_v2(prompt_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_optimizations_v2_status ON optimizations_v2(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_optimizations_v2_category ON optimizations_v2(optimization_category) WHERE deleted_at IS NULL;
CREATE INDEX idx_optimizations_v2_content_hash ON optimizations_v2(content_hash);
CREATE INDEX idx_optimizations_v2_priority ON optimizations_v2(priority_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_optimizations_v2_created_at ON optimizations_v2(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_optimizations_v2_content_specs ON optimizations_v2 USING GIN (content_specs);
CREATE INDEX idx_optimizations_v2_citations ON optimizations_v2 USING GIN (citations_used);

-- ============================================================================
-- GENERATION JOBS TABLE
-- ============================================================================
CREATE TABLE optimization_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('org', 'prompt', 'batch')),
  target_prompt_ids UUID[] DEFAULT '{}',
  category TEXT DEFAULT 'visibility',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  optimizations_created INTEGER DEFAULT 0,
  optimizations_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  input_hash TEXT NOT NULL,
  week_key TEXT DEFAULT to_char(now(), 'IYYY-IW'),
  llm_model TEXT DEFAULT 'google/gemini-2.5-flash',
  total_tokens_used INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generation_jobs_org ON optimization_generation_jobs(org_id);
CREATE INDEX idx_generation_jobs_status ON optimization_generation_jobs(status) WHERE status IN ('queued', 'running');
CREATE INDEX idx_generation_jobs_input_hash ON optimization_generation_jobs(input_hash);
CREATE UNIQUE INDEX idx_generation_jobs_dedup ON optimization_generation_jobs(org_id, input_hash, week_key) 
  WHERE status IN ('queued', 'running', 'completed');

-- ============================================================================
-- MATERIALIZED VIEW: Low Visibility Prompts
-- ============================================================================
CREATE MATERIALIZED VIEW mv_low_visibility_prompts AS
SELECT 
  p.id as prompt_id,
  p.org_id,
  p.text as prompt_text,
  COUNT(DISTINCT ppr.id) as total_runs,
  COUNT(DISTINCT ppr.id) FILTER (WHERE ppr.org_brand_present = true) as present_count,
  ROUND(
    (COUNT(DISTINCT ppr.id) FILTER (WHERE ppr.org_brand_present = true)::NUMERIC / 
     NULLIF(COUNT(DISTINCT ppr.id), 0)::NUMERIC) * 100, 
    2
  ) as presence_rate,
  AVG(ppr.score) FILTER (WHERE ppr.org_brand_present = true) as avg_score_when_present,
  MAX(ppr.run_at) as last_checked_at,
  jsonb_agg(DISTINCT jsonb_build_object(
    'domain', citation->>'domain',
    'title', citation->>'title', 
    'url', citation->>'url'
  )) FILTER (WHERE ppr.citations_json IS NOT NULL) as top_citations
FROM prompts p
LEFT JOIN prompt_provider_responses ppr ON ppr.prompt_id = p.id
  AND ppr.status = 'success'
  AND ppr.run_at >= now() - INTERVAL '14 days'
LEFT JOIN LATERAL jsonb_array_elements(ppr.citations_json) citation ON true
WHERE p.active = true
GROUP BY p.id, p.org_id, p.text
HAVING COUNT(DISTINCT ppr.id) >= 3;

CREATE UNIQUE INDEX idx_mv_low_visibility_prompt_id ON mv_low_visibility_prompts(prompt_id);
CREATE INDEX idx_mv_low_visibility_org ON mv_low_visibility_prompts(org_id);
CREATE INDEX idx_mv_low_visibility_rate ON mv_low_visibility_prompts(presence_rate ASC);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_low_visibility_prompts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_low_visibility_prompts;
END;
$$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE optimizations_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY optimizations_v2_select ON optimizations_v2
  FOR SELECT USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = optimizations_v2.org_id));

CREATE POLICY optimizations_v2_insert ON optimizations_v2
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = optimizations_v2.org_id));

CREATE POLICY optimizations_v2_update ON optimizations_v2
  FOR UPDATE USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = optimizations_v2.org_id));

CREATE POLICY generation_jobs_select ON optimization_generation_jobs
  FOR SELECT USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = optimization_generation_jobs.org_id));

CREATE POLICY generation_jobs_insert ON optimization_generation_jobs
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.org_id = optimization_generation_jobs.org_id));

CREATE POLICY optimizations_v2_service ON optimizations_v2 FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY generation_jobs_service ON optimization_generation_jobs FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION get_optimization_recommendations(
  p_org_id UUID,
  p_category TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'open',
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  content_type TEXT,
  priority_score INTEGER,
  difficulty_level TEXT,
  status TEXT,
  prompt_text TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id, o.title, o.description, o.content_type,
    o.priority_score, o.difficulty_level, o.status,
    p.text as prompt_text, o.created_at
  FROM optimizations_v2 o
  LEFT JOIN prompts p ON p.id = o.prompt_id
  WHERE o.org_id = p_org_id
    AND o.deleted_at IS NULL
    AND (p_status IS NULL OR o.status = p_status)
    AND (p_category IS NULL OR o.optimization_category = p_category)
  ORDER BY o.priority_score DESC, o.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Triggers
CREATE OR REPLACE FUNCTION update_optimizations_v2_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trigger_optimizations_v2_updated_at BEFORE UPDATE ON optimizations_v2
  FOR EACH ROW EXECUTE FUNCTION update_optimizations_v2_updated_at();

CREATE TRIGGER trigger_generation_jobs_updated_at BEFORE UPDATE ON optimization_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_optimizations_v2_updated_at();

-- Permissions
GRANT SELECT ON mv_low_visibility_prompts TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_low_visibility_prompts() TO service_role;
GRANT EXECUTE ON FUNCTION get_optimization_recommendations(UUID, TEXT, TEXT, INTEGER) TO authenticated;