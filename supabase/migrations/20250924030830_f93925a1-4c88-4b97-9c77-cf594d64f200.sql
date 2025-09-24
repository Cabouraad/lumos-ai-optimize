-- Accurate presence + run counts per prompt/org for the last 14d
DROP VIEW IF EXISTS public.low_visibility_prompts;

CREATE OR REPLACE VIEW public.prompt_visibility_14d
WITH (security_invoker = on) AS
WITH runs AS (
  SELECT ppr.org_id, ppr.prompt_id, ppr.id as run_id
  FROM public.prompt_provider_responses ppr
  WHERE ppr.run_at >= now() - interval '14 days'
    AND ppr.status = 'success'
),
presence AS (
  SELECT ppr.org_id, ppr.prompt_id,
         (sum(case when ppr.org_brand_present then 1 else 0 end)::float
          / nullif(count(*),0)::float) * 100.0 as presence_rate
  FROM public.prompt_provider_responses ppr
  WHERE ppr.run_at >= now() - interval '14 days'
    AND ppr.status = 'success'
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

-- Create low_visibility_prompts view based on the new prompt_visibility_14d
CREATE OR REPLACE VIEW public.low_visibility_prompts AS
SELECT prompt_id, org_id, presence_rate, runs_14d as runs, prompt_text
FROM public.prompt_visibility_14d
WHERE presence_rate < 50;

-- Set proper permissions
REVOKE ALL ON public.prompt_visibility_14d FROM public, anon;
GRANT SELECT ON public.prompt_visibility_14d TO authenticated;

REVOKE ALL ON public.low_visibility_prompts FROM public, anon;
GRANT SELECT ON public.low_visibility_prompts TO authenticated;