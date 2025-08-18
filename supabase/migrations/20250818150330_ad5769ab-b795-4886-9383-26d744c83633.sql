-- Add Gemini as a new LLM provider
INSERT INTO public.llm_providers (name, enabled) 
VALUES ('gemini', true)
ON CONFLICT (name) DO NOTHING;