-- Add missing Google AI Overview provider to complete the 4-provider set
INSERT INTO llm_providers (name, enabled) 
VALUES ('google_ai_overview', true)
ON CONFLICT (name) DO NOTHING;