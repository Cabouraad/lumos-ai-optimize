-- Add foreign key constraint from prompt_provider_responses to prompts
-- This enables Supabase to properly join these tables in queries

ALTER TABLE prompt_provider_responses
ADD CONSTRAINT prompt_provider_responses_prompt_id_fkey
FOREIGN KEY (prompt_id) REFERENCES prompts(id)
ON DELETE CASCADE;