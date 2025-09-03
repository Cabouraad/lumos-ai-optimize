# Weekly Reports Feature

## Overview
The Weekly Reports feature generates CSV reports containing visibility performance metrics for each organization on a weekly basis. This feature is completely behind the `FEATURE_WEEKLY_REPORT` feature flag (default: `false`) and is additive - it won't affect existing functionality.

## Feature Flag
- **Flag Name**: `FEATURE_WEEKLY_REPORT`
- **Default**: `false` (disabled)
- **Location**: `src/lib/config/feature-flags.ts`
- **Environment Variable**: `VITE_FEATURE_WEEKLY_REPORT=true` (in development)

## Components

### Database
- **Table**: `weekly_reports` - Stores report metadata
- **Storage Bucket**: `weekly-reports` - Stores actual CSV files
- **RLS**: Enabled with proper policies for user access control

### Edge Functions

#### 1. `generate-weekly-report`
- **Purpose**: Generates weekly reports on-demand or for specific weeks
- **Auth**: `verify_jwt = true` (requires user authentication)
- **Features**:
  - Idempotent (won't regenerate existing reports)
  - Generates CSV with prompt performance metrics
  - Stores files in Supabase Storage
  - Returns signed download URLs

#### 2. `weekly-report-scheduler`  
- **Purpose**: Scheduled weekly report generation for all organizations
- **Auth**: `verify_jwt = false` (uses cron secret for security)
- **Features**:
  - Runs automatically (intended for cron scheduling)
  - Processes all organizations with activity
  - Idempotent operation
  - Comprehensive logging

### Frontend Components

#### 1. `WeeklyReports.tsx`
- Main component for viewing and managing weekly reports
- Hidden when feature flag is disabled
- Features:
  - List of generated reports
  - Generate new reports button
  - Download completed reports
  - Status indicators and metadata

#### 2. `Reports.tsx`
- Page wrapper for the weekly reports feature
- Redirects to home if feature disabled
- Route: `/reports` (only available when feature enabled)

## Usage

### Enabling the Feature
```bash
# Development
echo "VITE_FEATURE_WEEKLY_REPORT=true" >> .env.local

# Production
# Set feature flag in environment or feature flags table
```

### Manual Report Generation
```typescript
// Generate report for current week
const { data } = await supabase.functions.invoke('generate-weekly-report');

// Generate report for specific week
const { data } = await supabase.functions.invoke('generate-weekly-report', {
  body: { 
    weekStart: '2025-01-06', 
    weekEnd: '2025-01-12' 
  }
});
```

### Scheduled Generation
The `weekly-report-scheduler` function can be set up with a cron job to run weekly:

```sql
-- Example cron setup (requires pg_cron extension)
SELECT cron.schedule(
  'weekly-reports',
  '0 6 * * 1', -- Every Monday at 6 AM
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/weekly-report-scheduler',
    headers := '{"x-cron-secret": "your-cron-secret"}'::jsonb
  ) as request_id;
  $$
);
```

## Report Content

### CSV Structure
- **Prompt ID**: Unique identifier for each prompt
- **Prompt Text**: The actual prompt text (quoted for CSV safety)
- **Total Runs**: Number of times the prompt was run this week
- **Average Score**: Average visibility score across all runs
- **Brand Present Rate (%)**: Percentage of runs where org brand was detected
- **Average Competitors**: Average number of competitors detected
- **Brand Present Count**: Absolute number of runs with brand present

### Summary Row
Each report includes a summary row with aggregated metrics across all prompts.

## Security

### Access Control
- **RLS Policies**: Users can only access their organization's reports
- **Storage Policies**: File access restricted by organization
- **JWT Authentication**: Required for manual report generation
- **Cron Secret**: Required for scheduled generation

### File Storage
- Files stored in private `weekly-reports` bucket
- Organized by organization ID: `{org_id}/{date_range}_weekly_report.csv`
- Signed URLs with 1-hour expiration for downloads

## Testing

### Unit Tests
- Component rendering with feature flag on/off
- Empty state handling
- Report display and interaction
- Location: `src/__tests__/weekly-reports.test.tsx`

### Manual Testing
1. Enable feature flag: `VITE_FEATURE_WEEKLY_REPORT=true`
2. Navigate to `/reports`
3. Generate a report for current week
4. Verify CSV download and content
5. Test with existing reports (idempotency)

## Development Notes

### Idempotency
Both edge functions are idempotent:
- Won't regenerate existing completed reports
- Safe to run multiple times
- Status tracking prevents conflicts

### Error Handling
- Comprehensive logging for debugging
- Graceful error states in UI
- Failed reports marked with error messages
- Retry capability through regeneration

### Performance Considerations
- Reports generated asynchronously
- Large datasets handled efficiently
- Proper indexing on date ranges
- Storage organized by organization

## Future Enhancements
- Email delivery (currently disabled by design)
- Report scheduling per organization
- Additional export formats (PDF, Excel)
- Custom date range selection
- Report templates and customization