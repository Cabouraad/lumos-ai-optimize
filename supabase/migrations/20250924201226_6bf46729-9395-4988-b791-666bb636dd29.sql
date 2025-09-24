-- Fix all public views to use security_invoker for proper RLS enforcement

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
FROM subscribers s
JOIN users u ON u.id = s.user_id;

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
  EXTRACT(day FROM (now() - bc.last_seen_at)) AS days_since_last_seen,
  CASE
    WHEN EXTRACT(day FROM (now() - bc.last_seen_at)) <= 7 THEN true
    ELSE false
  END AS recently_active,
  CASE
    WHEN bc.total_appearances >= 50 AND bc.average_score >= 6 THEN 'strong'::text
    WHEN bc.total_appearances >= 20 AND bc.average_score >= 4 THEN 'moderate'::text
    ELSE 'weak'::text
  END AS competitor_strength
FROM brand_catalog bc
WHERE bc.is_org_brand = false;

-- Set proper permissions on all views
REVOKE ALL ON public.subscriber_public FROM public, anon;
GRANT SELECT ON public.subscriber_public TO authenticated;

REVOKE ALL ON public.org_competitor_analytics FROM public, anon;
GRANT SELECT ON public.org_competitor_analytics TO authenticated;