-- Add Google AI Overview provider to llm_providers table
INSERT INTO public.llm_providers (name, enabled) 
VALUES ('google_ai_overview', true)
ON CONFLICT (name) DO UPDATE SET 
  enabled = true;