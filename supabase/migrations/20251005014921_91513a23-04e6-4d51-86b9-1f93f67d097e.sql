-- Phase 1: Add performance index for optimization job processing
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_status_created 
ON optimization_jobs(status, created_at) 
WHERE status IN ('queued', 'running');

-- Add comment for documentation
COMMENT ON INDEX idx_optimization_jobs_status_created IS 
'Performance index for cron job processor to efficiently fetch pending jobs';