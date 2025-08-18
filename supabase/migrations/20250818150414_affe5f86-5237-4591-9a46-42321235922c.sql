-- First, let's see the current constraint and update it to include 'gemini'
ALTER TABLE public.llm_providers 
DROP CONSTRAINT IF EXISTS llm_providers_name_check;

-- Add updated constraint that includes gemini
ALTER TABLE public.llm_providers 
ADD CONSTRAINT llm_providers_name_check 
CHECK (name IN ('openai', 'perplexity', 'gemini'));

-- Now insert Gemini as a provider
INSERT INTO public.llm_providers (name, enabled) 
VALUES ('gemini', true)
ON CONFLICT (name) DO NOTHING;