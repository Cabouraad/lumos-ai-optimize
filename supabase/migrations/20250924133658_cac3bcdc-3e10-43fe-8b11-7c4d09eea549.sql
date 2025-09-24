-- Fix the optimizations table schema to allow direct generation without job_id
ALTER TABLE public.optimizations 
ALTER COLUMN job_id DROP NOT NULL;

-- Add a comment to clarify the column usage
COMMENT ON COLUMN public.optimizations.job_id IS 'Optional: NULL for direct generation, UUID for batch job generation';