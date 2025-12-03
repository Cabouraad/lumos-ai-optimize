-- Add brand_id column to suggested_prompts for brand-specific suggestions
ALTER TABLE public.suggested_prompts 
ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE;

-- Add index for efficient brand filtering
CREATE INDEX idx_suggested_prompts_brand_id ON public.suggested_prompts(brand_id);

-- Update metadata column to store additional data like search volume metadata
ALTER TABLE public.suggested_prompts 
ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;