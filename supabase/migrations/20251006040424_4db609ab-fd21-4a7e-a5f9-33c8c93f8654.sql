-- Remove old batch processing tables
DROP TABLE IF EXISTS batch_tasks CASCADE;
DROP TABLE IF EXISTS batch_jobs CASCADE;
DROP TABLE IF EXISTS batch_tasks_archive CASCADE;
DROP TABLE IF EXISTS batch_jobs_archive CASCADE;
DROP TABLE IF EXISTS optimization_generation_jobs CASCADE;

-- Remove materialized view (we query directly now)
DROP MATERIALIZED VIEW IF EXISTS mv_low_visibility_prompts CASCADE;

-- Remove unused functions
DROP FUNCTION IF EXISTS refresh_low_visibility_prompts() CASCADE;
DROP FUNCTION IF EXISTS claim_batch_tasks(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS resume_stuck_batch_job(uuid) CASCADE;
DROP FUNCTION IF EXISTS cancel_active_batch_jobs() CASCADE;
DROP FUNCTION IF EXISTS get_batch_cleanup_status() CASCADE;
DROP FUNCTION IF EXISTS fix_stuck_batch_jobs() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_scheduler_runs() CASCADE;

-- Keep optimizations_v2 and get_low_visibility_prompts (still used)