-- Add Google AI Overview provider to llm_providers table
INSERT INTO public.llm_providers (name, enabled, created_at, updated_at) 
VALUES ('google_ai_overview', true, now(), now())
ON CONFLICT (name) DO UPDATE SET 
  enabled = true,
  updated_at = now();