-- OPTIMIZATION JOBS AND RESULTS TABLES
-- Migration for reliable, idempotent optimization generation with progress tracking

-- OPTIMIZATION JOBS (queue/tracking)
CREATE TABLE IF NOT EXISTS public.optimization_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  scope text NOT NULL CHECK (scope IN ('org','prompt')),
  prompt_ids uuid[] DEFAULT NULL,                     -- when scope='prompt'
  target_week date DEFAULT date_trunc('week', now()),
  input_hash text NOT NULL,                           -- dedupe key (org+scope+prompt_ids+week+model_version)
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','error')),
  started_at timestamptz,
  finished_at timestamptz,
  error_text text,
  model_version text DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_optimization_jobs_input_hash
  ON public.optimization_jobs(org_id, input_hash);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_status
  ON public.optimization_jobs(status, created_at DESC);

-- OPTIMIZATIONS (results)
CREATE TABLE IF NOT EXISTS public.optimizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.optimization_jobs(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'optimizer',
  content_type text NOT NULL CHECK (content_type IN ('social_post','blog_outline','talking_points','cta_snippets')),
  title text,
  body text,                          -- markdown/plain content
  sources jsonb,                      -- normalized citations used
  score_before numeric,               -- visibility before
  projected_impact text,              -- short description of why it helps
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optimizations_org_created ON public.optimizations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimizations_prompt ON public.optimizations(prompt_id);

-- VIEW: low visibility prompts (last 14 days, configurable)
CREATE OR REPLACE VIEW public.low_visibility_prompts
WITH (security_invoker = on) AS
SELECT p.id as prompt_id, p.text as prompt_text, p.org_id,
       COALESCE(AVG(CASE WHEN ppr.org_brand_present THEN 100.0 ELSE 0.0 END), 0) as presence_rate,
       COUNT(DISTINCT ppr.id) as runs
FROM public.prompts p
LEFT JOIN public.prompt_provider_responses ppr ON ppr.prompt_id = p.id AND ppr.org_id = p.org_id
  AND ppr.run_at >= now() - interval '14 days'
  AND ppr.status = 'success'
GROUP BY p.id, p.text, p.org_id
HAVING COALESCE(AVG(CASE WHEN ppr.org_brand_present THEN 100.0 ELSE 0.0 END), 0) < 50; -- threshold 50%

-- RLS (inherit org isolation; no public access)
ALTER TABLE public.optimization_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "optimization_jobs_select" ON public.optimization_jobs;
CREATE POLICY "optimization_jobs_select" ON public.optimization_jobs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.org_id = optimization_jobs.org_id)
  );

CREATE POLICY "optimization_jobs_insert" ON public.optimization_jobs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.org_id = org_id)
  );

CREATE POLICY "optimization_jobs_update" ON public.optimization_jobs
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.org_id = optimization_jobs.org_id)
  );

ALTER TABLE public.optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "optimizations_select" ON public.optimizations;
CREATE POLICY "optimizations_select" ON public.optimizations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.org_id = optimizations.org_id)
  );

CREATE POLICY "optimizations_insert" ON public.optimizations
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.org_id = org_id)
  );

-- Tighten grants (no anon)
REVOKE ALL ON TABLE public.optimization_jobs FROM public, anon;
REVOKE ALL ON TABLE public.optimizations FROM public, anon;
GRANT SELECT, INSERT, UPDATE ON public.optimization_jobs TO authenticated;
GRANT SELECT, INSERT ON public.optimizations TO authenticated;