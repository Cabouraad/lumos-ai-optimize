-- Remove redundant tables that are no longer used

-- Drop visibility_results table (data moved to prompt_provider_responses)
DROP TABLE IF EXISTS public.visibility_results CASCADE;

-- Drop prompt_runs table (data moved to prompt_provider_responses) 
DROP TABLE IF EXISTS public.prompt_runs CASCADE;

-- Remove old competitor share function that references deleted tables
DROP FUNCTION IF EXISTS public.get_competitor_share_7d(uuid);