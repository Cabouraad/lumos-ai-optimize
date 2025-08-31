# Jobs & Scheduling Audit Report

## Executive Summary

The scheduling system is **functionally operational but architecturally complex** with multiple overlapping cron jobs and redundant pathways. While the system successfully prevents duplicate runs and handles failures, it suffers from over-engineering and maintenance overhead.

**Status:** 🟡 **WORKING WITH ISSUES** - System runs but needs simplification and cleanup

---

## 1. Daily Scheduled Functions

### 1.1 Primary Functions

| Function | Purpose | Frequency | Authentication | Status |
|----------|---------|-----------|----------------|---------|
| `daily-batch-trigger` | Main orchestrator for daily prompt processing | Multiple schedules | CRON_SECRET | ✅ Working |
| `batch-reconciler` | Cleanup stuck batch jobs | Every 10-30 min | CRON_SECRET | ✅ Working |  
| `weekly-suggestions` | Generate prompt suggestions | Weekly | CRON_SECRET | ❓ Unclear |

### 1.2 Function Details

#### Daily Batch Trigger (`daily-batch-trigger`)
- **Execution Window**: 3:00 AM - 6:00 AM Eastern Time
- **DST Handling**: Uses `Intl.DateTimeFormat` with `America/New_York` timezone
- **Idempotency**: ✅ Via `scheduler_state` table and `try_mark_daily_run()` function
- **Organizations Processed**: Queries orgs with `active=true` prompts
- **Downstream**: Calls `robust-batch-processor` for each organization

#### Batch Reconciler (`batch-reconciler`)  
- **Purpose**: Finds and fixes stuck batch jobs (>2min without heartbeat)
- **Detection Logic**: Jobs with stale heartbeats or minimal progress after 3+ minutes
- **Recovery**: Uses `resume_stuck_batch_job()` function to finalize or reset tasks
- **Logging**: Comprehensive status tracking in `scheduler_runs`

---

## 2. Cron Job Infrastructure

### 2.1 Active pg_cron Jobs

```sql
-- CURRENT ACTIVE JOBS (9 total)
daily-batch-trigger-resilient    */15 * * * *    (Every 15 minutes)
daily-batch-trigger-every-5min   */5 * * * *     (Every 5 minutes) 
batch-reconciler-cleanup         */30 * * * *    (Every 30 minutes)
batch-reconciler-every-10min     */10 * * * *    (Every 10 minutes)
daily-batch-midnight-edt         0 5 * * *       (5 AM UTC = 12 AM EST)
daily-batch-midnight-est         0 4 * * *       (4 AM UTC = 11 PM EST prev day)
daily-batch-trigger-12am-est     0 5 * * *       (Duplicate of midnight-edt)
daily-scheduler-3am-edt          0 7 * * *       (7 AM UTC = 3 AM EDT)
daily-scheduler-3am-est          0 8 * * *       (8 AM UTC = 3 AM EST)
```

### 2.2 Authentication Mechanism

**CRON_SECRET Authentication:**
- ✅ 64-character secret stored in `app_settings.cron_secret`  
- ✅ Validated against `x-cron-secret` header in all functions
- ✅ Manual bypass via `x-manual-call: true` header
- ✅ Service role access for cron operations

---

## 3. DST Handling & Timezone Logic

### 3.1 Implementation
```typescript
// Uses Intl.DateTimeFormat for accurate NY timezone conversion
function nyParts(d = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    // ... configuration
  });
}

// Execution window check
function isInExecutionWindow(d = new Date()): boolean {
  const { hh } = nyParts(d);
  const hour = Number(hh);
  return hour >= 3 && hour < 6; // 3:00 AM - 6:00 AM ET
}
```

### 3.2 DST Coverage Strategy
- **EDT (Eastern Daylight Time)**: 7 AM UTC jobs
- **EST (Eastern Standard Time)**: 8 AM UTC jobs  
- **Result**: Functions run twice daily during DST transitions
- **Protection**: Window validation prevents duplicate processing

**Assessment:** ✅ **ROBUST** - Handles DST transitions correctly with dual scheduling

---

## 4. Idempotency & Duplicate Prevention

### 4.1 Mechanism
```sql
-- Uses atomic RPC function for duplicate prevention
CREATE FUNCTION try_mark_daily_run(p_today_key text) RETURNS jsonb
-- Returns: { "updated": boolean, "previous_key": text, "new_key": text }
```

### 4.2 State Management
- **Table**: `scheduler_state` (single global row)
- **Key Format**: `YYYY-MM-DD` (e.g., "2025-08-30")
- **Logic**: Only allows one successful run per date key
- **Current State**: `last_daily_run_key: "2025-08-30"`

**Assessment:** ✅ **WORKING** - Successfully prevents duplicate daily runs

---

## 5. Failure Handling & Recovery

### 5.1 Error Handling Layers

#### Function Level
- **Comprehensive Logging**: All functions log to `scheduler_runs` table
- **Status Tracking**: `running` → `completed` / `failed`
- **Error Capture**: Detailed error messages and stack traces

#### API Level (in robust-batch-processor)
- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Timeout Protection**: 120-second timeout per API call
- **Provider Fallback**: Continues if one provider fails

#### Job Level
- **Heartbeat System**: `batch_jobs.last_heartbeat` tracks progress
- **Stuck Job Detection**: Reconciler finds jobs >2 min without heartbeat
- **Recovery Options**: Finalize completed jobs or reset for retry

### 5.2 Monitoring & Alerting
```sql
-- Recent function executions
SELECT function_name, status, error_message, completed_at 
FROM scheduler_runs 
ORDER BY started_at DESC LIMIT 10;

-- Batch job health
SELECT status, COUNT(*) 
FROM batch_jobs 
GROUP BY status;
```

**Assessment:** ✅ **COMPREHENSIVE** - Multi-layer failure handling with good observability

---

## 6. Manual Run Pathways

### 6.1 Available Methods

#### Test Scripts
```bash
# Comprehensive test with idempotency check
node test-scheduler-final.js

# Simple direct test  
node test-direct.js
```

#### Manual Headers
```javascript
headers: {
  'x-manual-call': 'true',           // Bypass cron secret check
  'x-cron-secret': CRON_SECRET,      // Or use actual secret
  'Content-Type': 'application/json'
}

body: {
  "force": true,                     // Bypass execution window
  "manual_test": true                // Flag for logging
}
```

#### Force Execution
- **Bypass Window**: `{"force": true}` in request body
- **Bypass Secret**: `x-manual-call: true` header
- **Bypass Idempotency**: Not available (by design)

**Assessment:** ✅ **FLEXIBLE** - Multiple pathways for testing and emergency execution

---

## 7. Current System Health

### 7.1 Recent Activity (Last 24 Hours)
- **Daily Trigger**: ✅ Running every 15 minutes, correctly skipping outside window  
- **Batch Reconciler**: ✅ Running every 30 minutes, finding no stuck jobs
- **Execution Window**: ⏰ Correctly enforced (3-6 AM ET)
- **Idempotency**: ✅ Last run marked for 2025-08-30

### 7.2 Performance Metrics
- **Batch Jobs**: 31 completed, 4 cancelled, 2 failed
- **Current Queue**: 0 pending/processing jobs (system idle)
- **Success Rate**: ~84% (31/37 total jobs)

---

## 8. Issues Identified

### 8.1 🟡 Medium Priority Issues

1. **Job Redundancy**: 9 cron jobs with overlapping schedules
   - `daily-batch-trigger-every-5min` vs `daily-batch-trigger-resilient` 
   - `daily-batch-midnight-edt` vs `daily-batch-trigger-12am-est` (duplicates)
   - Multiple reconciler schedules (10min + 30min)

2. **Over-Scheduled Execution**: 
   - Functions run every 5-15 minutes but only work 3-6 AM
   - Wastes compute resources during 20+ hours of no-op runs
   - Creates excessive log entries

3. **Complex DST Logic**: 
   - Dual scheduling (EDT + EST) adds complexity
   - Window validation is defensive but creates architectural debt

### 8.2 🟢 Low Priority Issues

4. **Test Script Hardcoded Values**: 
   - Secrets and URLs embedded in test files
   - Not suitable for production environment changes

5. **Insufficient Documentation**: 
   - No clear operational runbook
   - Manual intervention procedures not documented

---

## 9. Minimal Improvement Plan

### Phase 1: Immediate Cleanup (1-2 days)
```sql
-- Remove redundant cron jobs
SELECT cron.unschedule('daily-batch-trigger-every-5min');
SELECT cron.unschedule('daily-batch-midnight-est'); -- Duplicates midnight-edt
SELECT cron.unschedule('batch-reconciler-every-10min'); -- Keep 30min version

-- Consolidate to essential jobs only:
-- ✅ daily-batch-trigger-resilient (*/15 * * * *)
-- ✅ batch-reconciler-cleanup (*/30 * * * *)  
-- ✅ daily-scheduler-3am-edt (0 7 * * *)
-- ✅ daily-scheduler-3am-est (0 8 * * *)
```

### Phase 2: Optimization (3-5 days)
1. **Smarter Scheduling**: Only run cron jobs during active hours (2-7 AM UTC)
2. **Environment-Aware Testing**: Replace hardcoded values with environment variables
3. **Operational Documentation**: Create runbook for manual interventions

### Phase 3: Future Architecture (Optional)
- Consider implementing the user-controlled scheduling system outlined in `SCHEDULER_REDESIGN_PLAN.md`
- Migrate from global 3 AM execution to per-organization scheduling
- Eliminate pg_cron dependency with queue-based processing

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Cron Job Conflicts** | Medium | Low | Remove redundant jobs |
| **DST Transition Issues** | Low | Medium | Current dual-schedule handles this |
| **Secret Rotation** | Low | High | Document rotation procedure |
| **Supabase Cron Outage** | Low | High | Manual trigger capabilities exist |
| **Stuck Job Accumulation** | Low | Medium | Reconciler actively monitors |

---

## Conclusion

The scheduling system is **operationally sound** with robust failure handling and duplicate prevention. However, it suffers from **architectural bloat** with redundant cron jobs and unnecessary complexity.

**Recommendation**: Proceed with Phase 1 cleanup immediately to reduce operational overhead, then evaluate Phase 3 redesign based on user feedback and scaling requirements.

The system will continue working reliably in its current state, but simplification will improve maintainability and reduce the cognitive load for future developers.

---

**Generated**: 2025-08-31  
**Audit Scope**: Read-only analysis of scheduling infrastructure  
**Next Review**: After Phase 1 cleanup completion