-- Force Row Level Security on prompt_visibility_14d to ensure security is always applied
ALTER TABLE public.prompt_visibility_14d FORCE ROW LEVEL SECURITY;

-- CRITICAL FIX: Recreate low_visibility_prompts view with security_invoker
-- This ensures the view respects RLS policies from the underlying table
DROP VIEW IF EXISTS public.low_visibility_prompts CASCADE;

CREATE OR REPLACE VIEW public.low_visibility_prompts
WITH (security_invoker = on) AS
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

-- Ensure proper permissions on the view
REVOKE ALL ON public.low_visibility_prompts FROM public, anon;
GRANT SELECT ON public.low_visibility_prompts TO authenticated;