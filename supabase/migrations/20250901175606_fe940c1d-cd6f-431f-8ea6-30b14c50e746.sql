-- Add indexes to improve batch processing performance
-- These indexes will help with the key queries used by the batch processor

-- Index for claiming tasks by job_id and status (used by claim_batch_tasks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_tasks_job_status_created 
ON batch_tasks (batch_job_id, status, created_at);

-- Index for prompt_provider_responses org queries (used by dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_provider_responses_org_run_at 
ON prompt_provider_responses (org_id, run_at DESC);

-- Index for batch_jobs by org and status (used for job management)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_jobs_org_status_created 
ON batch_jobs (org_id, status, created_at DESC);

-- Index for brand_catalog org queries (used by analysis)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brand_catalog_org_brand 
ON brand_catalog (org_id, is_org_brand);