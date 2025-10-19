-- Llumos Score System: Credit-style 300-900 AI visibility score

-- 1. Create llumos_scores table
CREATE TABLE IF NOT EXISTS public.llumos_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.prompts(id) ON DELETE CASCADE,
  
  -- Score values
  composite NUMERIC(5,2) NOT NULL CHECK (composite >= 0 AND composite <= 100),
  llumos_score INTEGER NOT NULL CHECK (llumos_score >= 300 AND llumos_score <= 900),
  
  -- Submetrics (0-100 each)
  submetrics JSONB NOT NULL DEFAULT '{
    "pr": 50,
    "pp": 50,
    "cv": 50,
    "ca": 50,
    "cs": 50,
    "fc": 50
  }'::jsonb,
  
  -- Metadata
  scope TEXT NOT NULL CHECK (scope IN ('org', 'prompt')),
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CHECK (
    (scope = 'org' AND prompt_id IS NULL) OR
    (scope = 'prompt' AND prompt_id IS NOT NULL)
  )
);

-- Unique index for idempotent inserts
CREATE UNIQUE INDEX IF NOT EXISTS llumos_scores_unique_window 
  ON public.llumos_scores(org_id, scope, COALESCE(prompt_id, '00000000-0000-0000-0000-000000000000'::uuid), window_start);

-- Index for queries
CREATE INDEX IF NOT EXISTS llumos_scores_org_scope_recent 
  ON public.llumos_scores(org_id, scope, window_end DESC);

-- Enable RLS
ALTER TABLE public.llumos_scores ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their org's scores
CREATE POLICY "Users can view org llumos scores"
  ON public.llumos_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
        AND u.org_id = llumos_scores.org_id
    )
  );

-- RLS: Service role can insert/update
CREATE POLICY "Service role can manage llumos scores"
  ON public.llumos_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Helper function: normalize domain to root
CREATE OR REPLACE FUNCTION public.domain_root(p_domain TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_domain IS NULL OR p_domain = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove protocol
  p_domain := regexp_replace(p_domain, '^https?://', '', 'i');
  
  -- Remove www prefix
  p_domain := regexp_replace(p_domain, '^www\.', '', 'i');
  
  -- Remove path and query
  p_domain := split_part(p_domain, '/', 1);
  p_domain := split_part(p_domain, '?', 1);
  
  -- Lowercase and trim
  RETURN lower(trim(p_domain));
END;
$$;

-- 3. Helper function: get org domain set
CREATE OR REPLACE FUNCTION public.org_domain_set(p_org_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(DISTINCT public.domain_root(domain_text))
  FROM (
    SELECT o.domain as domain_text
    FROM public.organizations o
    WHERE o.id = p_org_id AND o.domain IS NOT NULL
    
    UNION ALL
    
    SELECT bc.name as domain_text
    FROM public.brand_catalog bc
    WHERE bc.org_id = p_org_id 
      AND bc.is_org_brand = true
    
    UNION ALL
    
    SELECT jsonb_array_elements_text(bc.variants_json) as domain_text
    FROM public.brand_catalog bc
    WHERE bc.org_id = p_org_id 
      AND bc.is_org_brand = true
      AND jsonb_array_length(bc.variants_json) > 0
  ) domains
  WHERE domain_text IS NOT NULL AND domain_text != '';
$$;

-- 4. Helper function: check if domain is competitor
CREATE OR REPLACE FUNCTION public.is_competitor_domain(p_org_id UUID, p_domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brand_catalog bc
    WHERE bc.org_id = p_org_id
      AND bc.is_org_brand = false
      AND (
        lower(trim(bc.name)) = lower(trim(p_domain))
        OR EXISTS (
          SELECT 1 
          FROM jsonb_array_elements_text(bc.variants_json) v
          WHERE lower(trim(v)) = lower(trim(p_domain))
        )
      )
  );
$$;

-- 5. Main RPC: compute Llumos score
CREATE OR REPLACE FUNCTION public.compute_llumos_score(
  p_org_id UUID,
  p_prompt_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope TEXT;
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_window_end TIMESTAMP WITH TIME ZONE;
  v_prev_window_start TIMESTAMP WITH TIME ZONE;
  
  v_total_responses INTEGER;
  v_org_domains TEXT[];
  
  -- Submetrics
  v_pr NUMERIC;
  v_pp NUMERIC;
  v_cv NUMERIC;
  v_ca NUMERIC;
  v_cs NUMERIC;
  v_fc NUMERIC;
  
  v_composite NUMERIC;
  v_llumos_score INTEGER;
  v_submetrics JSONB;
  v_reason TEXT;
BEGIN
  v_scope := CASE WHEN p_prompt_id IS NULL THEN 'org' ELSE 'prompt' END;
  
  v_window_end := date_trunc('week', now());
  v_window_start := v_window_end - interval '28 days';
  v_prev_window_start := v_window_start - interval '28 days';
  
  v_org_domains := public.org_domain_set(p_org_id);
  
  SELECT COUNT(*)
  INTO v_total_responses
  FROM public.prompt_provider_responses ppr
  WHERE ppr.org_id = p_org_id
    AND ppr.status = 'success'
    AND ppr.run_at >= v_window_start
    AND ppr.run_at < v_window_end
    AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id);
  
  IF v_total_responses < 5 THEN
    v_reason := 'insufficient_data';
    v_pr := 50; v_pp := 50; v_cv := 50; v_ca := 50; v_cs := 50; v_fc := 50;
    v_composite := 50;
    v_llumos_score := 500;
  ELSE
    -- 1. PR: Presence Rate
    SELECT 
      COALESCE(
        (COUNT(*) FILTER (WHERE ppr.org_brand_present = true)::NUMERIC / 
         NULLIF(COUNT(*), 0)::NUMERIC) * 100,
        0
      )
    INTO v_pr
    FROM public.prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'success'
      AND ppr.run_at >= v_window_start
      AND ppr.run_at < v_window_end
      AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id);
    
    -- 2. PP: Prominence Position
    SELECT 
      COALESCE(
        100 - LEAST(
          (AVG(ppr.org_brand_prominence) FILTER (WHERE ppr.org_brand_present = true AND ppr.org_brand_prominence IS NOT NULL) * 10),
          100
        ),
        0
      )
    INTO v_pp
    FROM public.prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status = 'success'
      AND ppr.run_at >= v_window_start
      AND ppr.run_at < v_window_end
      AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id);
    
    -- 3. CV: Coverage Variance
    IF v_scope = 'org' THEN
      WITH prompt_presence AS (
        SELECT 
          ppr.prompt_id,
          COUNT(*) FILTER (WHERE ppr.org_brand_present = true)::NUMERIC / 
            NULLIF(COUNT(*), 0)::NUMERIC as presence_rate
        FROM public.prompt_provider_responses ppr
        WHERE ppr.org_id = p_org_id
          AND ppr.status = 'success'
          AND ppr.run_at >= v_window_start
          AND ppr.run_at < v_window_end
        GROUP BY ppr.prompt_id
        HAVING COUNT(*) >= 2
      )
      SELECT 
        COALESCE(
          100 - LEAST((STDDEV(presence_rate) * 100), 100),
          50
        )
      INTO v_cv
      FROM prompt_presence;
    ELSE
      v_cv := 100;
    END IF;
    
    -- 4. CA: Citation Authority
    WITH citation_domains AS (
      SELECT 
        jsonb_array_elements_text(ppr.citations_json) as citation
      FROM public.prompt_provider_responses ppr
      WHERE ppr.org_id = p_org_id
        AND ppr.status = 'success'
        AND ppr.run_at >= v_window_start
        AND ppr.run_at < v_window_end
        AND ppr.citations_json IS NOT NULL
        AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
    ),
    authority_check AS (
      SELECT 
        citation,
        CASE 
          WHEN citation ILIKE ANY(v_org_domains) THEN true
          ELSE false
        END as is_org_citation
      FROM citation_domains
    )
    SELECT 
      COALESCE(
        (COUNT(*) FILTER (WHERE is_org_citation = true)::NUMERIC / 
         NULLIF(COUNT(*), 0)::NUMERIC) * 100,
        0
      )
    INTO v_ca
    FROM authority_check;
    
    -- 5. CS: Competitive Share
    WITH all_brands AS (
      SELECT 
        SUM(jsonb_array_length(COALESCE(ppr.brands_json, '[]'::jsonb))) as org_mentions,
        SUM(jsonb_array_length(COALESCE(ppr.competitors_json, '[]'::jsonb))) as competitor_mentions
      FROM public.prompt_provider_responses ppr
      WHERE ppr.org_id = p_org_id
        AND ppr.status = 'success'
        AND ppr.run_at >= v_window_start
        AND ppr.run_at < v_window_end
        AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
    )
    SELECT 
      COALESCE(
        (org_mentions::NUMERIC / NULLIF(org_mentions + competitor_mentions, 0)::NUMERIC) * 100,
        50
      )
    INTO v_cs
    FROM all_brands;
    
    -- 6. FC: Freshness & Consistency
    WITH response_recency AS (
      SELECT 
        ppr.run_at,
        EXTRACT(EPOCH FROM (v_window_end - ppr.run_at)) / 
          EXTRACT(EPOCH FROM (v_window_end - v_window_start)) as age_factor
      FROM public.prompt_provider_responses ppr
      WHERE ppr.org_id = p_org_id
        AND ppr.status = 'success'
        AND ppr.run_at >= v_window_start
        AND ppr.run_at < v_window_end
        AND (p_prompt_id IS NULL OR ppr.prompt_id = p_prompt_id)
    ),
    frequency_score AS (
      SELECT 
        (COUNT(*)::NUMERIC / 28.0) * 100 as freq_score,
        AVG(1 - age_factor) * 100 as recency_score
      FROM response_recency
    )
    SELECT 
      COALESCE(
        (freq_score * 0.4 + recency_score * 0.6),
        0
      )
    INTO v_fc
    FROM frequency_score;
    
    v_pr := LEAST(GREATEST(COALESCE(v_pr, 0), 0), 100);
    v_pp := LEAST(GREATEST(COALESCE(v_pp, 0), 0), 100);
    v_cv := LEAST(GREATEST(COALESCE(v_cv, 0), 0), 100);
    v_ca := LEAST(GREATEST(COALESCE(v_ca, 0), 0), 100);
    v_cs := LEAST(GREATEST(COALESCE(v_cs, 0), 0), 100);
    v_fc := LEAST(GREATEST(COALESCE(v_fc, 0), 0), 100);
    
    v_composite := (
      v_pr * 0.25 +
      v_pp * 0.20 +
      v_cv * 0.15 +
      v_ca * 0.20 +
      v_cs * 0.15 +
      v_fc * 0.05
    );
    
    v_llumos_score := 300 + ROUND((v_composite / 100.0) * 600)::INTEGER;
  END IF;
  
  v_submetrics := jsonb_build_object(
    'pr', ROUND(v_pr, 1),
    'pp', ROUND(v_pp, 1),
    'cv', ROUND(v_cv, 1),
    'ca', ROUND(v_ca, 1),
    'cs', ROUND(v_cs, 1),
    'fc', ROUND(v_fc, 1)
  );
  
  RETURN jsonb_build_object(
    'score', v_llumos_score,
    'composite', ROUND(v_composite, 2),
    'submetrics', v_submetrics,
    'tier', CASE
      WHEN v_llumos_score >= 760 THEN 'Excellent'
      WHEN v_llumos_score >= 700 THEN 'Very Good'
      WHEN v_llumos_score >= 640 THEN 'Good'
      WHEN v_llumos_score >= 580 THEN 'Fair'
      ELSE 'Needs Improvement'
    END,
    'window', jsonb_build_object(
      'start', v_window_start,
      'end', v_window_end
    ),
    'reason', v_reason,
    'total_responses', v_total_responses
  );
END;
$$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_llumos_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER llumos_scores_updated_at
  BEFORE UPDATE ON public.llumos_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_llumos_scores_updated_at();