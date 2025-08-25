-- Fix database schema issues for score field
ALTER TABLE prompt_provider_responses ALTER COLUMN score TYPE NUMERIC;