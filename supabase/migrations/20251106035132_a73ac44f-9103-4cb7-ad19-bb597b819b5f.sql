-- Normalize status filters across visibility and competitor analytics to support both legacy ('success') and new ('completed') statuses

-- 1) Update real-time visibility function
CREATE OR REPLACE FUNCTION public.get_prompt_visibility_realtime(
  p_org_id UUID,
  p_days INTEGER DEFAULT 14
)
RETURNS TABLE (
  prompt_id UUID,
  org_id UUID,
  prompt_text TEXT,
  presence_rate NUMERIC,
  runs_total INTEGER,
  last_run_at TIMESTAMP WITH TIME ZONE,
  provider_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH recent_responses AS (
    SELECT 
      ppr.prompt_id,
      ppr.org_brand_present,
      ppr.provider,
      ppr.run_at
    FROM public.prompt_provider_responses ppr
    WHERE ppr.org_id = p_org_id
      AND ppr.status IN ('success','completed')
      AND ppr.run_at >= (now() - (p_days || ' days')::interval)
  ),
  prompt_stats AS (
    SELECT
      rr.prompt_id,
      COUNT(*) as total_runs,
      SUM(CASE WHEN rr.org_brand_present THEN 1 ELSE 0 END) as present_count,
      MAX(rr.run_at) as last_run,
      jsonb_object_agg(
        rr.provider,
        jsonb_build_object(
          'runs', COUNT(*),
          'present', SUM(CASE WHEN rr.org_brand_present THEN 1 ELSE 0 END)
        )
      ) as provider_stats
    FROM recent_responses rr
    GROUP BY rr.prompt_id
  )
  SELECT
    p.id as prompt_id,
    p.org_id,
    p.text as prompt_text,
    COALESCE(
      ROUND((ps.present_count::NUMERIC / NULLIF(ps.total_runs, 0)::NUMERIC) * 100, 2),
      0
    ) as presence_rate,
    COALESCE(ps.total_runs, 0)::INTEGER as runs_total,
    ps.last_run as last_run_at,
    COALESCE(ps.provider_stats, '{}'::jsonb) as provider_breakdown
  FROM public.prompts p
  LEFT JOIN prompt_stats ps ON ps.prompt_id = p.id
  WHERE p.org_id = p_org_id
    AND p.active = true
  ORDER BY presence_rate ASC, runs_total DESC;
END;
$$;

-- 2) Update 7d visibility summary
CREATE OR REPLACE FUNCTION public.get_prompt_visibility_7d(requesting_org_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  prompt_id uuid,
  text text,
  runs_7d bigint,
  avg_score_7d numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Use provided org_id or default to user's org_id
  IF requesting_org_id IS NULL THEN
    requesting_org_id := user_org_id;
  END IF;
  
  -- Only allow access to user's own org data
  IF requesting_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own organization data';
  END IF;
  
  -- Get prompt visibility data for the last 7 days
  RETURN QUERY
  SELECT 
    p.id as prompt_id,
    p.text,
    COUNT(*) as runs_7d,
    AVG(ppr.score) as avg_score_7d
  FROM public.prompts p
  JOIN public.prompt_provider_responses ppr ON ppr.prompt_id = p.id
  WHERE p.org_id = requesting_org_id
    AND ppr.status IN ('success','completed')
    AND ppr.run_at >= now() - interval '7 days'
  GROUP BY p.id, p.text
  HAVING COUNT(*) >= 1
  ORDER BY runs_7d DESC, avg_score_7d ASC;
END;
$function$;

-- 3) Update competitor share 7d function
CREATE OR REPLACE FUNCTION public.get_competitor_share_7d(p_org_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(prompt_id uuid, competitor_name text, share numeric, total_mentions bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get the authenticated user's org_id
  SELECT u.org_id INTO user_org_id
  FROM users u 
  WHERE u.id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Use provided org_id or default to user's org_id
  IF p_org_id IS NULL THEN
    p_org_id := user_org_id;
  END IF;
  
  -- Only allow access to user's own org data
  IF p_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own organization data';
  END IF;
  
  -- Get competitor share data for the last 7 days
  RETURN QUERY
  WITH recent_responses AS (
    SELECT 
      ppr.prompt_id,
      ppr.competitors_json,
      ppr.run_at
    FROM public.prompt_provider_responses ppr
    JOIN public.prompts p ON p.id = ppr.prompt_id
    WHERE p.org_id = p_org_id
      AND ppr.status IN ('success','completed')
      AND ppr.run_at >= now() - interval '7 days'
      AND ppr.competitors_json IS NOT NULL
      AND jsonb_array_length(ppr.competitors_json) > 0
  ),
  competitor_mentions AS (
    SELECT 
      rr.prompt_id,
      competitor_text as competitor_name,
      COUNT(*) as mentions
    FROM recent_responses rr,
         jsonb_array_elements_text(rr.competitors_json) AS competitor_text
    WHERE LENGTH(TRIM(competitor_text)) >= 3
      AND TRIM(competitor_text) !~ '^[0-9]+$'
      AND EXISTS (
        SELECT 1 FROM public.brand_catalog bc 
        WHERE bc.org_id = p_org_id 
          AND bc.is_org_brand = false
          AND LOWER(TRIM(bc.name)) = LOWER(TRIM(competitor_text))
      )
    GROUP BY rr.prompt_id, competitor_text
  ),
  prompt_totals AS (
    SELECT 
      prompt_id,
      SUM(mentions) as total_mentions_for_prompt
    FROM competitor_mentions
    GROUP BY prompt_id
  )
  SELECT 
    cm.prompt_id,
    cm.competitor_name,
    CASE 
      WHEN pt.total_mentions_for_prompt > 0 
      THEN ROUND((cm.mentions::numeric / pt.total_mentions_for_prompt) * 100, 1)
      ELSE 0
    END as share,
    cm.mentions as total_mentions
  FROM competitor_mentions cm
  JOIN prompt_totals pt ON pt.prompt_id = cm.prompt_id
  WHERE cm.mentions > 0
  ORDER BY cm.prompt_id, cm.mentions DESC;
END;
$function$;

-- 4) Recreate views with CASCADE to handle dependencies
DROP VIEW IF EXISTS public.low_visibility_prompts CASCADE;
DROP VIEW IF EXISTS public.prompt_visibility_14d CASCADE;

CREATE OR REPLACE VIEW public.prompt_visibility_14d
WITH (security_invoker = on) AS
WITH runs AS (
  SELECT ppr.org_id, ppr.prompt_id, ppr.id as run_id
  FROM public.prompt_provider_responses ppr
  WHERE ppr.run_at >= now() - interval '14 days'
    AND ppr.status IN ('success','completed')
),
presence AS (
  SELECT ppr.org_id, ppr.prompt_id,
         (sum(case when ppr.org_brand_present then 1 else 0 end)::float
          / nullif(count(*),0)::float) * 100.0 as presence_rate
  FROM public.prompt_provider_responses ppr
  WHERE ppr.run_at >= now() - interval '14 days'
    AND ppr.status IN ('success','completed')
  GROUP BY ppr.org_id, ppr.prompt_id
)
SELECT p.org_id,
       p.id        as prompt_id,
       p.text      as prompt_text,
       coalesce(presence.presence_rate, 0.0)              as presence_rate,
       coalesce(count(distinct runs.run_id), 0)           as runs_14d
FROM public.prompts p
LEFT JOIN runs     on runs.org_id = p.org_id and runs.prompt_id = p.id
LEFT JOIN presence on presence.org_id = p.org_id and presence.prompt_id = p.id
WHERE p.active = true
GROUP BY p.org_id, p.id, p.text, coalesce(presence.presence_rate, 0.0);

-- Recreate low_visibility_prompts view based on updated prompt_visibility_14d
CREATE OR REPLACE VIEW public.low_visibility_prompts AS
SELECT prompt_id, org_id, presence_rate, runs_14d as runs, prompt_text
FROM public.prompt_visibility_14d
WHERE presence_rate < 50;

-- Set proper permissions
REVOKE ALL ON public.prompt_visibility_14d FROM public, anon;
GRANT SELECT ON public.prompt_visibility_14d TO authenticated;

REVOKE ALL ON public.low_visibility_prompts FROM public, anon;
GRANT SELECT ON public.low_visibility_prompts TO authenticated;
