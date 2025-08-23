
-- Phase 1: Add missing foreign keys and helpful indexes

-- 1) Prompts -> Organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'prompts_org_id_fkey'
  ) THEN
    ALTER TABLE public.prompts
      ADD CONSTRAINT prompts_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- 2) Prompt Runs -> Prompts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'prompt_runs_prompt_id_fkey'
  ) THEN
    ALTER TABLE public.prompt_runs
      ADD CONSTRAINT prompt_runs_prompt_id_fkey
      FOREIGN KEY (prompt_id) REFERENCES public.prompts(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- 3) Prompt Runs -> LLM Providers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'prompt_runs_provider_id_fkey'
  ) THEN
    ALTER TABLE public.prompt_runs
      ADD CONSTRAINT prompt_runs_provider_id_fkey
      FOREIGN KEY (provider_id) REFERENCES public.llm_providers(id)
      ON DELETE RESTRICT;
  END IF;
END$$;

-- 4) Visibility Results -> Prompt Runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'visibility_results_prompt_run_id_fkey'
  ) THEN
    ALTER TABLE public.visibility_results
      ADD CONSTRAINT visibility_results_prompt_run_id_fkey
      FOREIGN KEY (prompt_run_id) REFERENCES public.prompt_runs(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- 5) Competitor Mentions -> Prompts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'competitor_mentions_prompt_id_fkey'
  ) THEN
    ALTER TABLE public.competitor_mentions
      ADD CONSTRAINT competitor_mentions_prompt_id_fkey
      FOREIGN KEY (prompt_id) REFERENCES public.prompts(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- 6) Competitor Mentions -> Organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'competitor_mentions_org_id_fkey'
  ) THEN
    ALTER TABLE public.competitor_mentions
      ADD CONSTRAINT competitor_mentions_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- 7) Brand Catalog -> Organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'brand_catalog_org_id_fkey'
  ) THEN
    ALTER TABLE public.brand_catalog
      ADD CONSTRAINT brand_catalog_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- Helpful indexes for performance and joins

-- Prompt runs frequent filters and sorts
CREATE INDEX IF NOT EXISTS idx_prompt_runs_prompt_id_run_at
  ON public.prompt_runs (prompt_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_runs_status
  ON public.prompt_runs (status);

CREATE INDEX IF NOT EXISTS idx_prompt_runs_provider_id
  ON public.prompt_runs (provider_id);

-- Visibility results join
CREATE INDEX IF NOT EXISTS idx_visibility_results_prompt_run_id
  ON public.visibility_results (prompt_run_id);

-- Competitor mentions lookups
CREATE INDEX IF NOT EXISTS idx_competitor_mentions_prompt_id
  ON public.competitor_mentions (prompt_id);

CREATE INDEX IF NOT EXISTS idx_competitor_mentions_org_id
  ON public.competitor_mentions (org_id);

-- Prompts/org
CREATE INDEX IF NOT EXISTS idx_prompts_org_id
  ON public.prompts (org_id);

-- Brand catalog/org
CREATE INDEX IF NOT EXISTS idx_brand_catalog_org_id
  ON public.brand_catalog (org_id);
