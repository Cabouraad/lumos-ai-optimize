-- Fix Security Definer View warning by ensuring all views use security_invoker
-- This ensures views respect RLS policies of the querying user, not the creator
-- No functionality changes - only security property corrections

-- Fix prompt_visibility_14d view
DROP VIEW IF EXISTS public.prompt_visibility_14d CASCADE;
CREATE VIEW public.prompt_visibility_14d
WITH (security_invoker = true) AS
WITH recent_responses AS (
  SELECT 
    ppr.org_id,
    ppr.prompt_id,
    ppr.id AS response_id,
    ppr.org_brand_present
  FROM public.prompt_provider_responses ppr
  WHERE ppr.run_at >= now() - interval '14 days'
    AND ppr.status = 'success'
),
presence_calc AS (
  SELECT 
    rr.org_id,
    rr.prompt_id,
    (SUM(CASE WHEN rr.org_brand_present THEN 1 ELSE 0 END)::float
     / NULLIF(COUNT(*), 0)::float) * 100.0 AS presence_rate,
    COUNT(DISTINCT rr.response_id) AS runs_14d
  FROM recent_responses rr
  GROUP BY rr.org_id, rr.prompt_id
)
SELECT 
  p.org_id,
  p.id AS prompt_id,
  p.text AS prompt_text,
  COALESCE(pc.presence_rate, 0.0) AS presence_rate,
  COALESCE(pc.runs_14d, 0) AS runs_14d
FROM public.prompts p
LEFT JOIN presence_calc pc ON pc.org_id = p.org_id AND pc.prompt_id = p.id
WHERE p.active = true;

-- Fix org_competitor_analytics view
DROP VIEW IF EXISTS public.org_competitor_analytics CASCADE;
CREATE VIEW public.org_competitor_analytics
WITH (security_invoker = true) AS
SELECT 
  bc.org_id,
  bc.name AS competitor_name,
  bc.total_appearances,
  bc.average_score,
  bc.last_seen_at,
  bc.first_detected_at,
  EXTRACT(DAY FROM (now() - bc.last_seen_at)) AS days_since_last_seen,
  CASE
    WHEN EXTRACT(DAY FROM (now() - bc.last_seen_at)) <= 7 THEN true
    ELSE false
  END AS recently_active,
  CASE
    WHEN bc.total_appearances >= 50 AND bc.average_score >= 6 THEN 'strong'::text
    WHEN bc.total_appearances >= 20 AND bc.average_score >= 4 THEN 'moderate'::text
    ELSE 'weak'::text
  END AS competitor_strength
FROM public.brand_catalog bc
WHERE bc.is_org_brand = false;

-- Fix subscriber_public view
DROP VIEW IF EXISTS public.subscriber_public CASCADE;
CREATE VIEW public.subscriber_public
WITH (security_invoker = true) AS
SELECT 
  s.id,
  u.org_id,
  s.subscription_tier AS tier,
  s.subscription_tier AS plan_code,
  CASE
    WHEN (s.subscribed = true) THEN 'active'::text
    WHEN (s.trial_expires_at > now()) THEN 'trial'::text
    ELSE 'inactive'::text
  END AS status,
  s.subscription_end AS period_ends_at,
  s.created_at
FROM public.subscribers s
JOIN public.users u ON u.id = s.user_id;

-- Fix low_visibility_prompts view
DROP VIEW IF EXISTS public.low_visibility_prompts CASCADE;
CREATE VIEW public.low_visibility_prompts
WITH (security_invoker = true) AS
SELECT 
  prompt_id,
  org_id,
  presence_rate,
  runs_14d AS runs,
  prompt_text
FROM public.prompt_visibility_14d
WHERE presence_rate < 50;

-- Set proper permissions on all views
REVOKE ALL ON public.prompt_visibility_14d FROM public, anon;
GRANT SELECT ON public.prompt_visibility_14d TO authenticated;

REVOKE ALL ON public.org_competitor_analytics FROM public, anon;
GRANT SELECT ON public.org_competitor_analytics TO authenticated;

REVOKE ALL ON public.subscriber_public FROM public, anon;
GRANT SELECT ON public.subscriber_public TO authenticated;

REVOKE ALL ON public.low_visibility_prompts FROM public, anon;
GRANT SELECT ON public.low_visibility_prompts TO authenticated;

-- Add documentation comments
COMMENT ON VIEW public.prompt_visibility_14d IS 
  'Standardized 14-day visibility view - uses security_invoker to respect querying user RLS';
COMMENT ON VIEW public.org_competitor_analytics IS 
  'Competitor analytics view - uses security_invoker to respect querying user RLS';
COMMENT ON VIEW public.subscriber_public IS 
  'Public subscription data view - uses security_invoker to respect querying user RLS';
COMMENT ON VIEW public.low_visibility_prompts IS 
  'Low visibility prompts view - uses security_invoker to respect querying user RLS';