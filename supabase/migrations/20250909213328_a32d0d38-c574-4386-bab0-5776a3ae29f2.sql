-- Add citations_json column to prompt_provider_responses table
ALTER TABLE public.prompt_provider_responses 
ADD COLUMN IF NOT EXISTS citations_json JSONB DEFAULT NULL;

-- Add index for querying citations with brand mentions
CREATE INDEX IF NOT EXISTS idx_ppr_citations_brand_mention 
ON public.prompt_provider_responses 
USING gin ((citations_json->'citations')) 
WHERE citations_json IS NOT NULL;

-- Add feature flag for citations
INSERT INTO public.feature_flags (flag_name, enabled, description)
VALUES ('FEATURE_CITATIONS', true, 'Enable citations extraction and brand mention analysis')
ON CONFLICT (flag_name) DO UPDATE SET 
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description;