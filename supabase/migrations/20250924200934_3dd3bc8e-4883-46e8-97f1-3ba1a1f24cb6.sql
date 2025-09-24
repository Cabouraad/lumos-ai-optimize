-- Drop and recreate the view with proper security invoker setting
DROP VIEW IF EXISTS public.low_visibility_prompts CASCADE;

-- Create the view with explicit security invoker (use true instead of on)
CREATE VIEW public.low_visibility_prompts
WITH (security_invoker = true) AS
SELECT 
  prompt_id, 
  org_id, 
  presence_rate, 
  runs_14d AS runs, 
  prompt_text
FROM public.prompt_visibility_14d
WHERE presence_rate < 50
ORDER BY presence_rate ASC, runs_14d DESC
LIMIT 10;

-- Set proper permissions
REVOKE ALL ON public.low_visibility_prompts FROM public, anon;
GRANT SELECT ON public.low_visibility_prompts TO authenticated;