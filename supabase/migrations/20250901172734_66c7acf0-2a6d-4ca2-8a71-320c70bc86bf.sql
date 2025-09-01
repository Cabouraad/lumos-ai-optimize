-- Add indexes for better performance on batch processing
CREATE INDEX IF NOT EXISTS idx_batch_tasks_job_status_started 
ON batch_tasks(batch_job_id, status, started_at);

CREATE INDEX IF NOT EXISTS idx_batch_tasks_processing_timeout 
ON batch_tasks(batch_job_id, status, started_at) 
WHERE status = 'processing';