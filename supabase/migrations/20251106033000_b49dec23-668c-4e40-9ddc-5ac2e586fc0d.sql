-- Fix existing records with incorrect status values
-- Change 'success' to 'completed' and 'error' to 'failed' to match RPC query expectations

UPDATE public.prompt_provider_responses
SET status = 'completed'
WHERE status = 'success';

UPDATE public.prompt_provider_responses
SET status = 'failed'
WHERE status = 'error';

-- Add a comment explaining the expected status values
COMMENT ON COLUMN public.prompt_provider_responses.status IS 
  'Response status: completed (success), failed (error), or processing (in progress)';
