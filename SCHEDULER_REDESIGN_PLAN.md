# Simple Scheduler Redesign Plan

## Overview
A comprehensive plan to build a reliable, simple scheduler that runs prompts at exact times for all users without time zone complications or complex infrastructure dependencies.

## Current Problems with Old System
1. **Time Zone Complexity**: Required handling DST changes and NY timezone conversions
2. **Dual Schedule Triggers**: Two UTC times (7 AM & 8 AM) caused confusion
3. **Infrastructure Dependency**: Relied on Supabase's cron scheduler which can be unreliable
4. **Complex State Management**: scheduler_state table with atomic operations
5. **Testing Difficulties**: Hard to test and debug scheduled operations

## New Architecture: User-Controlled Scheduling

### Core Principle
**Users control when their prompts run instead of a global 3 AM schedule.**

### 1. Database Schema Changes

#### New Table: `prompt_schedules`
```sql
CREATE TABLE prompt_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  prompt_id UUID NOT NULL REFERENCES prompts(id),
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_time TIME NOT NULL, -- User's preferred time (24h format)
  schedule_timezone TEXT NOT NULL DEFAULT 'UTC', -- User's timezone
  days_of_week INTEGER[] NULL, -- For weekly: [1,2,3,4,5] = Mon-Fri
  day_of_month INTEGER NULL, -- For monthly: 1-31
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE NULL,
  next_run_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Pre-calculated next run
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### New Table: `schedule_queue`
```sql
CREATE TABLE schedule_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_schedule_id UUID NOT NULL REFERENCES prompt_schedules(id),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE NULL
);
```

### 2. Simple Queue-Based System

#### How It Works:
1. **Queue Population**: A lightweight function runs every 15 minutes to populate the queue with jobs due in the next hour
2. **Job Processing**: A separate function processes pending jobs from the queue
3. **No Complex Scheduling**: Uses simple timestamp comparisons instead of cron expressions

#### Queue Population Function (`populate-schedule-queue`)
```typescript
// Runs every 15 minutes via simple Supabase cron
// Finds schedules due in next hour and adds to queue
const nextHour = new Date(Date.now() + 60 * 60 * 1000);
const dueSchedules = await supabase
  .from('prompt_schedules')
  .select('*')
  .eq('is_active', true)
  .lte('next_run_at', nextHour.toISOString())
  .is('last_run_at', null) // Never run
  .or(`last_run_at.lt.${someTimeAgo}`); // Or hasn't run recently
```

#### Queue Processor Function (`process-schedule-queue`)
```typescript
// Runs every 5 minutes
// Processes jobs that are due now
const now = new Date();
const dueJobs = await supabase
  .from('schedule_queue')
  .select('*, prompt_schedules(*)')
  .eq('status', 'pending')
  .lte('scheduled_for', now.toISOString())
  .limit(10);
```

### 3. User Interface Components

#### Schedule Management UI
```typescript
// src/components/PromptScheduler.tsx
// - Time picker for preferred run time
// - Timezone selector (auto-detected from browser)
// - Frequency selector (daily/weekly/monthly)
// - Days of week picker for weekly
// - Preview of next run times

// src/components/ScheduleStatus.tsx  
// - Shows active schedules
// - Last run times and results
// - Manual trigger capability
```

#### Settings Integration
```typescript
// Add to existing Settings page:
// - Default scheduling preferences
// - Timezone override
// - Batch limits and quotas
// - Email notifications for failures
```

### 4. Implementation Phases

#### Phase 1: Database Setup (Week 1)
- [ ] Create new database tables
- [ ] Add RLS policies for org-based access
- [ ] Create indexes for performance
- [ ] Add database functions for next_run_at calculations

#### Phase 2: Core Scheduling Logic (Week 1-2)  
- [ ] Build queue population function
- [ ] Build queue processing function
- [ ] Add error handling and retry logic
- [ ] Create manual trigger capability

#### Phase 3: User Interface (Week 2)
- [ ] Build schedule management components
- [ ] Add to prompts page as optional feature
- [ ] Create schedule status dashboard
- [ ] Add timezone detection

#### Phase 4: Migration & Testing (Week 2-3)
- [ ] Migrate existing prompts to new system (optional)
- [ ] Add comprehensive testing
- [ ] Performance optimization
- [ ] Documentation and user guides

### 5. Technical Advantages

#### Reliability
- **Simple Logic**: No complex timezone calculations or DST handling
- **Fault Tolerant**: Queue-based system handles failures gracefully  
- **Debuggable**: Clear audit trail in database tables
- **Scalable**: Can handle multiple orgs with different schedules

#### User Experience
- **Flexible**: Users choose their preferred times
- **Transparent**: Clear visibility into when jobs will run
- **Controllable**: Manual triggers available
- **Predictable**: No "3 AM surprise" behavior

#### Maintenance
- **No Cron Dependency**: Uses simple database polling
- **Easy Testing**: Can simulate any time scenario
- **Clear Monitoring**: Database-driven status tracking
- **Simple Debugging**: All state visible in database

### 6. Configuration Details

#### Supabase Edge Functions Setup
```toml
# supabase/config.toml
[functions.populate-schedule-queue]
verify_jwt = false
schedule = ["*/15 * * * *"] # Every 15 minutes

[functions.process-schedule-queue] 
verify_jwt = false
schedule = ["*/5 * * * *"] # Every 5 minutes
```

#### Database Functions
```sql
-- Calculate next run time based on schedule
CREATE OR REPLACE FUNCTION calculate_next_run_at(
  schedule_type TEXT,
  schedule_time TIME,
  schedule_timezone TEXT,
  days_of_week INTEGER[],
  day_of_month INTEGER
) RETURNS TIMESTAMP WITH TIME ZONE;

-- Queue cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_queue_items()
RETURNS void AS $$
DELETE FROM schedule_queue 
WHERE status IN ('completed', 'failed') 
  AND processed_at < now() - interval '7 days';
$$;
```

### 7. Benefits Over Old System

| Aspect | Old System | New System |
|--------|------------|------------|
| **Timing** | Global 3 AM EST | User-defined times |
| **Reliability** | Supabase cron dependency | Queue-based processing |
| **Debugging** | Complex logs | Database audit trail |
| **Testing** | Hard to simulate | Easy to test any scenario |
| **User Control** | None | Full schedule control |
| **Scalability** | Single global schedule | Per-org scheduling |
| **Maintenance** | Complex timezone logic | Simple timestamp comparisons |

### 8. Migration Strategy

#### For Existing Users
1. **Automatic Migration**: Convert existing active prompts to daily 9 AM user timezone
2. **Notification**: Email users about new scheduling options
3. **Gradual Rollout**: Enable for new users first, then migrate existing

#### Backwards Compatibility  
- Keep existing `run-prompt-now` function for manual triggers
- Maintain existing prompt structure and responses
- No breaking changes to existing API

### 9. Success Metrics

#### Technical Metrics
- **Reliability**: >99% successful job execution
- **Performance**: <5 minute delay from scheduled time
- **Scale**: Handle 1000+ concurrent scheduled prompts

#### User Experience Metrics
- **Adoption**: >80% of users set custom schedules within 30 days
- **Satisfaction**: User feedback on schedule reliability
- **Usage**: Reduction in support tickets about scheduling issues

### 10. Risk Mitigation

#### Potential Issues & Solutions
- **Queue Backlog**: Implement job prioritization and parallel processing
- **Failed Jobs**: Exponential backoff retry with max attempts
- **Database Performance**: Proper indexing and query optimization
- **User Timezone Issues**: Robust timezone detection and validation

This redesign eliminates the complexity of global scheduling while giving users full control over when their prompts execute, resulting in a more reliable and user-friendly system.