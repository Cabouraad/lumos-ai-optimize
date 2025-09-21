-- Update the check constraint to include google_ai_overview
ALTER TABLE public.llm_providers 
DROP CONSTRAINT llm_providers_name_check;

ALTER TABLE public.llm_providers 
ADD CONSTRAINT llm_providers_name_check 
CHECK (name = ANY (ARRAY['openai'::text, 'perplexity'::text, 'gemini'::text, 'google_ai_overview'::text]));

-- Now insert the Google AI Overview provider
INSERT INTO public.llm_providers (name, enabled) 
VALUES ('google_ai_overview', true);