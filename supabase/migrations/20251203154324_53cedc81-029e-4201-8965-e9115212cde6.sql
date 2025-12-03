-- Add search_volume column to suggested_prompts to store Google Trends interest data
ALTER TABLE public.suggested_prompts 
ADD COLUMN IF NOT EXISTS search_volume integer DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.suggested_prompts.search_volume IS 'Google Trends relative search interest (0-100 scale)';