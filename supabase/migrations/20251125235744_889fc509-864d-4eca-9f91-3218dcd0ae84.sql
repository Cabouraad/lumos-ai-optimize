
-- ============================================================================
-- SECURITY FIX: Add RLS policies for visibility_report_requests
-- ============================================================================

CREATE POLICY "Anyone can submit visibility report requests"
ON public.visibility_report_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Only service role can read visibility report requests"
ON public.visibility_report_requests
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Only service role can update visibility report requests"
ON public.visibility_report_requests
FOR UPDATE
TO service_role
USING (true);

-- ============================================================================
-- PERFORMANCE: Add missing database indexes
-- ============================================================================

-- Indexes for prompt_provider_responses (most queried table)
CREATE INDEX IF NOT EXISTS idx_ppr_org_run_at 
ON public.prompt_provider_responses(org_id, run_at DESC)
WHERE status IN ('success', 'completed');

CREATE INDEX IF NOT EXISTS idx_ppr_prompt_provider_run 
ON public.prompt_provider_responses(prompt_id, provider, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_ppr_brand_run_at 
ON public.prompt_provider_responses(brand_id, run_at DESC)
WHERE brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ppr_org_brand_present 
ON public.prompt_provider_responses(org_id, org_brand_present, run_at DESC)
WHERE status IN ('success', 'completed');

-- Indexes for prompts table
CREATE INDEX IF NOT EXISTS idx_prompts_org_active 
ON public.prompts(org_id, active);

CREATE INDEX IF NOT EXISTS idx_prompts_brand_active 
ON public.prompts(brand_id, active)
WHERE brand_id IS NOT NULL;

-- Indexes for brand_catalog
CREATE INDEX IF NOT EXISTS idx_brand_catalog_org_is_org_brand 
ON public.brand_catalog(org_id, is_org_brand);

-- Indexes for optimizations_v2
CREATE INDEX IF NOT EXISTS idx_optimizations_org_status 
ON public.optimizations_v2(org_id, status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_optimizations_priority 
ON public.optimizations_v2(org_id, priority_score DESC)
WHERE deleted_at IS NULL AND status = 'pending';

-- Indexes for batch_jobs
CREATE INDEX IF NOT EXISTS idx_batch_jobs_org_status 
ON public.batch_jobs(org_id, status, created_at DESC);

-- Indexes for llumos_scores
CREATE INDEX IF NOT EXISTS idx_llumos_org_scope_window 
ON public.llumos_scores(org_id, scope, window_start DESC);

-- Indexes for user_roles (for permission checks)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_org 
ON public.user_roles(user_id, org_id);

-- Indexes for audit tracking
CREATE INDEX IF NOT EXISTS idx_audit_events_run_ts 
ON public.audit_events(run_id, ts DESC);

-- Composite index for citation analysis (without array length check in WHERE)
CREATE INDEX IF NOT EXISTS idx_ppr_citations_present 
ON public.prompt_provider_responses(org_id, run_at DESC)
WHERE citations_json IS NOT NULL;

-- GIN indexes for JSONB searches
CREATE INDEX IF NOT EXISTS idx_ppr_competitors_gin 
ON public.prompt_provider_responses USING GIN(competitors_json);

CREATE INDEX IF NOT EXISTS idx_ppr_citations_gin 
ON public.prompt_provider_responses USING GIN(citations_json);
