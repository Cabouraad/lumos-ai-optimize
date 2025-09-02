# Admin Operations Guide - Post-Deployment Database Maintenance

## Overview
This guide outlines critical post-deployment steps for database optimization and monitoring, specifically focusing on performance-critical tables and functions.

## 1. Index Verification (CRITICAL - Run First)

### Check Existing Indexes
Connect to production database and verify these critical indexes exist:

```sql
-- Verify indexes on prompt_provider_responses (high-volume table)
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'prompt_provider_responses'
ORDER BY indexname;

-- Expected indexes should include:
-- - Primary key on id
-- - Index on (org_id, run_at) for dashboard queries
-- - Index on (prompt_id, run_at) for prompt analysis
-- - Index on (org_id, status, run_at) for filtering
-- - Partial index on (org_id, run_at) WHERE status = 'success'
```

### Check Other Performance-Critical Tables
```sql
-- Verify indexes on other high-traffic tables
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN (
    'prompts',
    'batch_jobs', 
    'batch_tasks',
    'organizations',
    'users',
    'brand_catalog'
)
ORDER BY tablename, indexname;
```

### Missing Index Creation (if needed)
If critical indexes are missing, create them:

```sql
-- Example: Create composite index for dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ppr_org_run_status 
ON prompt_provider_responses (org_id, run_at DESC, status) 
WHERE status = 'success';

-- Example: Create index for prompt analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ppr_prompt_run 
ON prompt_provider_responses (prompt_id, run_at DESC);

-- Example: Create index for batch job queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_jobs_org_status 
ON batch_jobs (org_id, status, created_at DESC);
```

## 2. Database Statistics Update (Run After Index Creation)

### Run ANALYZE on Critical Tables
```sql
-- Update statistics for query planner optimization
ANALYZE prompt_provider_responses;
ANALYZE prompts;
ANALYZE batch_jobs;
ANALYZE batch_tasks;
ANALYZE organizations;
ANALYZE users;
ANALYZE brand_catalog;
ANALYZE recommendations;

-- Full database analyze (use during low-traffic periods)
ANALYZE;
```

### Verify Statistics
```sql
-- Check when statistics were last updated
SELECT 
    schemaname,
    tablename,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE tablename IN (
    'prompt_provider_responses',
    'prompts',
    'batch_jobs',
    'batch_tasks'
)
ORDER BY tablename;
```

## 3. Performance Monitoring Setup

### Enable Slow Query Logging
```sql
-- Check current slow query log settings
SHOW log_min_duration_statement;
SHOW log_statement;
SHOW log_duration;

-- Enable slow query logging (adjust threshold as needed)
-- ALTER SYSTEM SET log_min_duration_statement = '1000'; -- 1 second
-- SELECT pg_reload_conf();
```

### Monitor Specific Query Patterns

#### Dashboard Queries
```sql
-- Monitor dashboard performance queries
EXPLAIN (ANALYZE, BUFFERS) 
SELECT 
    p.id,
    p.text,
    COUNT(ppr.id) as runs_7d,
    AVG(ppr.score) as avg_score_7d
FROM prompts p
LEFT JOIN prompt_provider_responses ppr ON ppr.prompt_id = p.id 
    AND ppr.run_at >= now() - interval '7 days'
    AND ppr.status = 'success'
WHERE p.org_id = 'sample-org-id'
GROUP BY p.id, p.text;
```

#### Competitor Analysis Queries
```sql
-- Monitor competitor summary performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    competitors_json,
    COUNT(*) as frequency,
    AVG(score) as avg_score
FROM prompt_provider_responses 
WHERE org_id = 'sample-org-id'
    AND status = 'success'  
    AND run_at >= now() - interval '30 days'
    AND competitors_count > 0
GROUP BY competitors_json
ORDER BY frequency DESC
LIMIT 20;
```

#### Batch Processing Queries
```sql
-- Monitor batch job performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    bj.id,
    bj.status,
    bj.total_tasks,
    bj.completed_tasks,
    COUNT(bt.id) as task_count
FROM batch_jobs bj
LEFT JOIN batch_tasks bt ON bt.batch_job_id = bj.id
WHERE bj.org_id = 'sample-org-id'
    AND bj.created_at >= now() - interval '7 days'
GROUP BY bj.id, bj.status, bj.total_tasks, bj.completed_tasks;
```

## 4. Ongoing Monitoring Queries

### Daily Performance Check
```sql
-- Check table sizes and growth
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename IN ('prompt_provider_responses', 'batch_tasks', 'batch_jobs', 'prompts')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Query Performance Overview
```sql
-- Top slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%prompt_provider_responses%'
    OR query LIKE '%batch_%'
    OR query LIKE '%competitor%'
ORDER BY mean_time DESC
LIMIT 10;
```

### Lock Monitoring
```sql
-- Check for lock contention
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;
```

## 5. Alert Thresholds

### Set up monitoring for:
- Queries taking > 5 seconds (adjust based on workload)
- Table scans on prompt_provider_responses > 1000 rows
- Index usage ratio < 95% on critical tables
- Lock wait times > 1 second
- Connection count > 80% of max

### Supabase Dashboard Monitoring
Monitor these metrics in Supabase Dashboard:
1. Database → Performance → Slow Queries
2. Database → Replication → Lag metrics  
3. Database → Settings → Resource usage

## 6. Maintenance Schedule

### Weekly
- Review slow query log
- Check table growth patterns
- Verify backup completion
- Review index usage statistics

### Monthly  
- Run VACUUM ANALYZE on large tables
- Review and update query performance baselines
- Check for unused indexes
- Review connection pool settings

### As Needed
- Create new indexes based on slow query patterns
- Archive old prompt_provider_responses data
- Optimize batch processing schedules

## 7. Emergency Procedures

### High Load Response
```sql
-- Identify long-running queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
ORDER BY duration DESC;

-- Kill problematic queries (use with caution)
-- SELECT pg_terminate_backend(pid);
```

### Index Rebuild (if corruption suspected)
```sql
-- Rebuild indexes concurrently
REINDEX INDEX CONCURRENTLY index_name;
```

---

## Checklist for Post-Deployment

- [ ] Verify all expected indexes exist
- [ ] Run ANALYZE on critical tables
- [ ] Enable slow query logging (if not already enabled)
- [ ] Run sample performance queries and verify execution plans
- [ ] Set up monitoring alerts
- [ ] Document baseline performance metrics
- [ ] Schedule regular maintenance tasks

**⚠️ Important**: Always test index creation and maintenance operations in a staging environment first, and run CONCURRENTLY operations during low-traffic periods in production.