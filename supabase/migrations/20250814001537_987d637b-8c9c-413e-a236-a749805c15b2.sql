-- Fix the status values in run-prompt-now edge function
-- The constraint allows 'success', 'error', 'pending' but not 'completed'
-- Let's check what constraint exists
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname LIKE '%status%' AND conrelid = 'prompt_runs'::regclass;