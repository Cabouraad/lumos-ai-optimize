-- Real-time monitoring queries for scheduler test results

-- 1. Check recent scheduler runs (last 15 minutes)
SELECT 
    function_name,
    status,
    started_at,
    completed_at,
    EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds,
    result->>'message' as message,
    error_message
FROM scheduler_runs 
WHERE started_at >= now() - interval '15 minutes'
ORDER BY started_at DESC;

-- 2. Check scheduler state
SELECT * FROM scheduler_state WHERE id = 'global';

-- 3. Check recent batch jobs
SELECT 
    id,
    org_id,
    status,
    total_tasks,
    completed_tasks,
    failed_tasks,
    started_at,
    completed_at,
    CASE 
        WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (completed_at - started_at))
        ELSE NULL 
    END as duration_seconds
FROM batch_jobs 
WHERE created_at >= now() - interval '15 minutes'
ORDER BY created_at DESC;

-- 4. Check recent batch tasks for the latest job
WITH latest_job AS (
    SELECT id FROM batch_jobs 
    WHERE created_at >= now() - interval '15 minutes'
    ORDER BY created_at DESC LIMIT 1
)
SELECT 
    bt.provider,
    bt.status,
    COUNT(*) as count
FROM batch_tasks bt
JOIN latest_job lj ON bt.batch_job_id = lj.id
GROUP BY bt.provider, bt.status
ORDER BY bt.provider, bt.status;

-- 5. Organization info
SELECT name, domain FROM organizations WHERE id = '4d1d9ebb-d13e-4094-99c8-e74fe8526239';

-- 6. Count active prompts
SELECT COUNT(*) as active_prompts FROM prompts 
WHERE org_id = '4d1d9ebb-d13e-4094-99c8-e74fe8526239' AND active = true;