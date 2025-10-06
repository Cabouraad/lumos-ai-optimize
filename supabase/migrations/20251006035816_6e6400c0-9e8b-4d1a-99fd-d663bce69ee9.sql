-- Clean up old optimization system tables and views
-- This simplifies the system to use only optimizations_v2 table

-- Drop materialized view (we query directly instead)
DROP MATERIALIZED VIEW IF EXISTS mv_low_visibility_prompts CASCADE;

-- Drop old job tracking tables
DROP TABLE IF EXISTS batch_tasks CASCADE;
DROP TABLE IF EXISTS batch_jobs CASCADE;
DROP TABLE IF EXISTS batch_tasks_archive CASCADE;
DROP TABLE IF EXISTS batch_jobs_archive CASCADE;
DROP TABLE IF EXISTS optimization_generation_jobs CASCADE;
DROP TABLE IF EXISTS optimization_jobs_legacy CASCADE;

-- Drop legacy optimization tables
DROP TABLE IF EXISTS optimizations_legacy CASCADE;
DROP TABLE IF EXISTS ai_visibility_recommendations_legacy CASCADE;

-- Drop related functions that are no longer needed
DROP FUNCTION IF EXISTS get_low_visibility_prompts_internal(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS refresh_low_visibility_prompts() CASCADE;
DROP FUNCTION IF EXISTS refresh_low_visibility_view() CASCADE;
DROP FUNCTION IF EXISTS claim_batch_tasks(uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS resume_stuck_batch_job(uuid) CASCADE;
DROP FUNCTION IF EXISTS cancel_active_batch_jobs(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS clean_old_batch_jobs(integer, boolean) CASCADE;

-- Keep these important tables and functions:
-- ✓ optimizations_v2 (main table for recommendations)
-- ✓ prompts
-- ✓ prompt_provider_responses
-- ✓ get_low_visibility_prompts() (used by new simplified function)