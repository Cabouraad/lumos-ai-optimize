# Automated Audit Runner

The Automated Audit Runner is a comprehensive end-to-end testing system that exercises the full user journey through the application without manual intervention. It validates that core user flows work correctly by simulating real user behavior from signup to dashboard usage.

## Overview

The audit system creates synthetic users and organizations to test the complete application flow:

1. **Signup**: Creates test accounts (`starter_audit@test.app`, `growth_audit@test.app`)
2. **Organization Setup**: Creates isolated test organizations with proper verification
3. **Pricing/Billing**: Validates subscription flows using bypass logic (no real charges)
4. **Entitlement**: Verifies that subscription checks work correctly
5. **Onboarding**: Tests business context setup flows
6. **Dashboard**: Validates that core data access and APIs work

All testing is done in isolation using synthetic data that never affects real users or billing.

## Architecture

### Database Tables

- **`audit_runs`**: Stores audit execution metadata and results
- **`audit_events`**: Detailed event log for each audit run

### Edge Functions

- **`auto-audit`**: Main orchestrator that runs the full audit sequence
- **`_shared/audit_report.ts`**: HTML report generator

### Web UI

- **`/admin/audit-runs`**: Admin interface to view audit history and run manual audits
- Requires `AUDIT_UI=true` feature flag and admin privileges

### Scheduling

- **Nightly runs**: Automatically executes daily at 7:00 AM UTC
- **Manual runs**: Can be triggered via admin UI or direct API call

## Configuration

### Required Secrets

The following secrets must be configured in Supabase Edge Functions:

```bash
CRON_SECRET=your-secret-key                    # Authentication for scheduled runs
APP_ORIGINS=https://llumos.app,http://localhost:5173  # CORS origins
E2E_TEST_PASSWORD=Test123!pass                 # Password for synthetic users (optional)
BILLING_BYPASS_ENABLED=true                    # Enable billing bypass for audit users
BILLING_BYPASS_EMAILS=starter_audit@test.app,growth_audit@test.app  # Bypass-eligible emails
```

### Feature Flags

- **`AUDIT_UI`**: Enables the admin UI at `/admin/audit-runs`

## Usage

### Running Manually

Via Admin UI:
1. Navigate to `/admin/audit-runs`
2. Click "Run Now" button

Via API (requires CRON_SECRET):
```bash
curl -X POST https://your-project.supabase.co/functions/v1/auto-audit \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Viewing Results

1. **Admin UI**: Visit `/admin/audit-runs` to see run history
2. **HTML Reports**: Each run generates a detailed HTML report with:
   - Phase-by-phase results
   - Event timeline
   - Performance metrics
   - Error details
3. **JSON Export**: Download raw audit data for analysis

### Scheduled Execution

Audits run automatically every night at 7:00 AM UTC via the configured cron schedule:

```toml
auto_audit_nightly = { schedule = "0 7 * * *", endpoint = "/auto-audit", method = "POST", headers = { authorization = "Bearer ${CRON_SECRET}" } }
```

## Security & Isolation

### Data Protection

- **Synthetic Only**: All operations use dedicated test accounts (`*_audit@test.app`)
- **Isolated Orgs**: Test organizations are completely separate from real data
- **No Real Billing**: Uses billing bypass logic, never charges real payment methods
- **Data Redaction**: Logs automatically redact sensitive information

### Access Control

- **CORS Protected**: Only allows requests from configured APP_ORIGINS
- **Authentication**: Requires CRON_SECRET for automated runs
- **Admin Only**: UI restricted to admin users with proper privileges
- **RLS Enforced**: Database queries respect Row Level Security policies

### Cleanup

- **Idempotent**: Safe to run multiple times; reuses existing test data
- **Self-Contained**: Only creates/modifies data within synthetic organizations
- **Automatic Cleanup**: Old audit runs can be cleaned up via database maintenance

## Monitoring & Troubleshooting

### Common Issues

1. **Authentication Failures**: Verify CRON_SECRET is correctly configured
2. **Billing Bypass Not Working**: Check BILLING_BYPASS_ENABLED and BILLING_BYPASS_EMAILS
3. **Missing Test Users**: Audit will create users if they don't exist
4. **Permission Errors**: Ensure service role has proper database permissions

### Logs

- **Edge Function Logs**: Check Supabase Edge Functions logs for detailed execution info
- **Audit Events**: Query `audit_events` table for step-by-step execution details
- **Console Output**: Structured logging with correlation IDs for tracing

### Performance

- **Timeouts**: Individual steps timeout after 15 seconds, full audit after 4 minutes
- **Parallel Execution**: Tests multiple user tiers simultaneously when possible
- **Efficient Storage**: HTML reports are stored in Supabase Storage with signed URLs

## Disabling the System

### Temporary Disable

1. **Pause Scheduling**: Comment out the cron schedule in `supabase/config.toml`
2. **Disable UI**: Set `AUDIT_UI=false` feature flag
3. **Block Manual Runs**: Remove or rotate the CRON_SECRET

### Permanent Removal

1. **Remove Edge Function**: Delete `supabase/functions/auto-audit/`
2. **Remove UI**: Delete `src/pages/admin/AuditRuns.tsx` and remove route
3. **Remove Database Tables**: Run migration to drop `audit_runs` and `audit_events`
4. **Clean Config**: Remove auto-audit configuration from `supabase/config.toml`

## Development

### Local Testing

1. Set up local environment variables
2. Configure feature flags: `VITE_AUDIT_UI=true`
3. Use development CRON_SECRET for testing
4. Run manual audits via admin UI

### Extending Audits

1. **Add New Phases**: Extend the `runPhase` calls in `auto-audit/index.ts`
2. **Custom Assertions**: Add validation logic for specific business requirements
3. **Additional Metrics**: Extend event logging with custom data points
4. **Integration Tests**: Hook into existing test frameworks for deeper validation

## Maintenance

### Regular Tasks

- **Review Audit Results**: Check nightly runs for consistent failures
- **Update Test Data**: Refresh synthetic user credentials if needed
- **Monitor Performance**: Track audit execution time trends
- **Clean Old Reports**: Archive or delete old audit artifacts

### Upgrades

- **Version Compatibility**: Ensure audit tests match current application features
- **Schema Changes**: Update audit logic when database schema changes
- **API Updates**: Modify audit calls when API endpoints change

## Support

For issues or questions:

1. Check Edge Function logs in Supabase dashboard
2. Review audit event timeline in admin UI
3. Verify all required secrets are configured
4. Confirm feature flags are properly set
5. Test with manual audit run to isolate issues