-- Fix dependency issue by dropping with CASCADE
DROP VIEW IF EXISTS public.low_visibility_prompts CASCADE;
DROP VIEW IF EXISTS public.prompt_visibility_14d CASCADE;

-- Create table for better RLS control
CREATE TABLE public.prompt_visibility_14d (
  org_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  prompt_text text NOT NULL,
  presence_rate numeric NOT NULL DEFAULT 0,
  runs_14d integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, prompt_id)
);

-- Enable RLS
ALTER TABLE public.prompt_visibility_14d ENABLE ROW LEVEL SECURITY;

-- RLS policies for prompt_visibility_14d
CREATE POLICY "prompt_visibility_14d_select" ON public.prompt_visibility_14d
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.org_id = prompt_visibility_14d.org_id
  ));

-- Create function to refresh the prompt visibility data
CREATE OR REPLACE FUNCTION public.refresh_prompt_visibility_14d()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear existing data
  DELETE FROM public.prompt_visibility_14d;
  
  -- Insert fresh calculations
  INSERT INTO public.prompt_visibility_14d (org_id, prompt_id, prompt_text, presence_rate, runs_14d)
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
         p.id as prompt_id,
         p.text as prompt_text,
         coalesce(presence.presence_rate, 0.0) as presence_rate,
         coalesce(count(distinct runs.run_id), 0) as runs_14d
  FROM public.prompts p
  LEFT JOIN runs on runs.org_id = p.org_id and runs.prompt_id = p.id
  LEFT JOIN presence on presence.org_id = p.org_id and presence.prompt_id = p.id
  WHERE p.active = true
  GROUP BY p.org_id, p.id, p.text, coalesce(presence.presence_rate, 0.0);
END;
$$;

-- Create low_visibility_prompts view
CREATE VIEW public.low_visibility_prompts AS
SELECT prompt_id, org_id, presence_rate, runs_14d as runs, prompt_text
FROM public.prompt_visibility_14d
WHERE presence_rate < 50;

-- Set proper permissions
REVOKE ALL ON public.prompt_visibility_14d FROM public, anon;
GRANT SELECT ON public.prompt_visibility_14d TO authenticated;

REVOKE ALL ON public.low_visibility_prompts FROM public, anon;
GRANT SELECT ON public.low_visibility_prompts TO authenticated;

-- Initial data refresh
SELECT public.refresh_prompt_visibility_14d();