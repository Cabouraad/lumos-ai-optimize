-- 1) Prompt runs now store normalized "citations" and shallow parse results
ALTER TABLE IF EXISTS public.prompt_runs
  ADD COLUMN IF NOT EXISTS citations jsonb DEFAULT '[]'::jsonb,          -- array of {type, value} where type= 'url'|'ref'|'brand'
  ADD COLUMN IF NOT EXISTS brands jsonb DEFAULT '[]'::jsonb,             -- array of {name, normalized, mentions, first_pos_ratio}
  ADD COLUMN IF NOT EXISTS competitors jsonb DEFAULT '[]'::jsonb;        -- same shape, excluding user's brand

-- 2) Recommendations table
CREATE TABLE IF NOT EXISTS public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,                 -- 'content' | 'social' | 'site' | 'prompt'
  title text NOT NULL,
  rationale text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  est_lift numeric,                   -- 0..1
  source_prompt_ids uuid[] DEFAULT '{}',   -- prompts that triggered
  source_run_ids uuid[] DEFAULT '{}',      -- runs that triggered
  citations jsonb DEFAULT '[]'::jsonb,     -- array of {type:'url'|'ref', value:string}
  status text NOT NULL DEFAULT 'open',     -- 'open' | 'snoozed' | 'done' | 'dismissed'
  cooldown_until timestamptz,              -- avoid re-suggesting too often
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for recommendations
CREATE POLICY "Recommendations read access by org"
ON public.recommendations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() AND u.org_id = recommendations.org_id
));

CREATE POLICY "Recommendations all access for owners"
ON public.recommendations
FOR ALL
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.id = auth.uid() AND u.org_id = recommendations.org_id AND u.role = 'owner'
));

-- 3) Fast materialization helpers
-- (a) visibility per prompt, 7d rolling
CREATE OR REPLACE VIEW public.v_prompt_visibility_7d AS
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

-- (b) competitor share last 7d
CREATE OR REPLACE VIEW public.v_competitor_share_7d AS
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

-- Create function to update recommendations updated_at
CREATE OR REPLACE FUNCTION public.update_recommendations_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_recommendations_updated_at
BEFORE UPDATE ON public.recommendations
FOR EACH ROW EXECUTE FUNCTION public.update_recommendations_updated_at();