-- Drop and recreate views with proper security settings
DROP VIEW IF EXISTS public.v_prompt_visibility_7d;
DROP VIEW IF EXISTS public.v_competitor_share_7d;

-- Recreate views as SECURITY INVOKER (safer - uses permissions of querying user)
CREATE OR REPLACE VIEW public.v_prompt_visibility_7d
WITH (security_invoker=true) AS
SELECT
  p.org_id,
  p.id as prompt_id,
  p.text,
  AVG(vr.score) as avg_score_7d,
  COUNT(*) as runs_7d
FROM public.prompts p
JOIN public.prompt_runs pr ON pr.prompt_id = p.id
JOIN public.visibility_results vr ON vr.prompt_run_id = pr.id
WHERE pr.run_at >= now() - interval '7 days'
GROUP BY 1,2,3;

CREATE OR REPLACE VIEW public.v_competitor_share_7d
WITH (security_invoker=true) AS
SELECT
  p.org_id,
  p.id as prompt_id,
  brand_data.brand_name as brand_norm,
  AVG(vr.score) as mean_score,
  COUNT(*) as n
FROM public.prompts p
JOIN public.prompt_runs pr ON pr.prompt_id = p.id
JOIN public.visibility_results vr ON vr.prompt_run_id = pr.id
CROSS JOIN LATERAL (
  SELECT jsonb_array_elements_text(vr.brands_json) as brand_name
) as brand_data
WHERE pr.run_at >= now() - interval '7 days'
GROUP BY 1,2,3;