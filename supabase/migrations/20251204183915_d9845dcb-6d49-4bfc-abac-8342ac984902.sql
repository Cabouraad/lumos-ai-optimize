-- Add brand_id column to llumos_scores for brand-specific score caching
ALTER TABLE public.llumos_scores
ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE;

-- Create index for brand-specific lookups
CREATE INDEX idx_llumos_scores_brand_id ON public.llumos_scores(brand_id);

-- Add comment
COMMENT ON COLUMN public.llumos_scores.brand_id IS 'Brand this score was computed for. NULL means org-level aggregate score.';