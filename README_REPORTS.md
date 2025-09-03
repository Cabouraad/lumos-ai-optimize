# Weekly Reports System

## Overview

The weekly reports system automatically generates comprehensive PDF reports for your organization's brand visibility performance. These reports provide insights into how your brand appears across different AI providers and track competitor analysis over time.

## What Reports Include

Each weekly report contains:
- **Brand Visibility Metrics**: Overall visibility scores and trends
- **Competitor Analysis**: Detailed breakdown of competitors mentioned alongside your brand
- **Provider Performance**: How your brand performs across different AI providers (OpenAI, Perplexity, Gemini)
- **Prompt Performance**: Analysis of which prompts generate the best brand visibility
- **Historical Trends**: Week-over-week comparison and performance changes
- **Recommendations**: AI-generated suggestions for improving brand visibility

## Schedule

Reports are automatically generated every **Monday at 08:00 UTC**.

The system:
1. Collects data from the previous week (Monday to Sunday)
2. Generates a PDF report with comprehensive analytics
3. Stores the report securely in the system
4. Makes it available for download through the Reports page

## How to Download Reports

### Via Web Interface
1. Navigate to the **Reports** page in your dashboard
2. Find the week you want in the reports list
3. Click the **Download** button next to the report
4. The PDF will download automatically to your device

### Via API
You can also generate and download reports programmatically:

```javascript
// Generate a new report (if not already generated for current week)
const { data } = await supabase.functions.invoke('weekly-report', {
  method: 'POST'
});

// Get download link for existing report
const { data } = await supabase.functions.invoke('weekly-report', {
  method: 'GET',
  body: { week_key: '2025-W02' }
});
```

## Feature Toggle

The weekly reports feature can be controlled via the `FEATURE_WEEKLY_REPORT` feature flag.

### Enabling/Disabling Weekly Reports

**Option 1: Via SQL (Recommended)**
```sql
-- Enable weekly reports
INSERT INTO feature_flags (flag_name, enabled, description)
VALUES ('FEATURE_WEEKLY_REPORT', true, 'Enable automatic weekly report generation')
ON CONFLICT (flag_name) 
DO UPDATE SET enabled = true, updated_at = now();

-- Disable weekly reports
UPDATE feature_flags 
SET enabled = false, updated_at = now()
WHERE flag_name = 'FEATURE_WEEKLY_REPORT';
```

**Option 2: Via Supabase Dashboard**
1. Open the [SQL Editor](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/sql/new)
2. Run the appropriate SQL command above
3. The change takes effect immediately

When disabled, the scheduled report generation will skip execution, but users can still manually generate reports on-demand.

## CRON_SECRET Configuration

The weekly reports scheduler uses a `CRON_SECRET` for secure scheduled execution.

### Setting Up CRON_SECRET

**Step 1: Generate a Strong Secret**
```bash
# Generate a secure random secret (32 characters recommended)
openssl rand -base64 32
```

**Step 2: Add to Supabase Secrets**
1. Go to [Edge Functions Secrets](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/settings/functions)
2. Add a new secret:
   - **Name**: `CRON_SECRET`
   - **Value**: Your generated secret
3. Save the secret

**Step 3: Update Scheduler Configuration**
The system uses this secret to authenticate scheduled runs. Make sure your cron job includes the secret:

```sql
-- Example cron job setup
SELECT cron.schedule(
  'weekly-reports-generation',
  '0 8 * * 1', -- Every Monday at 08:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'YOUR_CRON_SECRET_HERE'
    ),
    body := jsonb_build_object('scheduled', true)
  );
  $$
);
```

## Storage and Security

### Reports Storage Bucket

Reports are stored in a private Supabase storage bucket called `reports` with the following structure:

```
reports/
├── org_123/
│   ├── 2025-W01.pdf
│   ├── 2025-W02.pdf
│   └── 2025-W03.pdf
└── org_456/
    ├── 2025-W01.pdf
    └── 2025-W02.pdf
```

### Row-Level Security (RLS) Policies

The system implements strict security policies to ensure data privacy:

#### Storage Bucket Policies
```sql
-- Users can only access their own organization's reports
CREATE POLICY "Users can view their own org reports" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND user_can_access_org((storage.foldername(name))[1]::uuid)
);
```

#### Reports Table Policies
```sql
-- Users can only read reports for their organization
CREATE POLICY "org_members_can_read_reports" 
ON reports 
FOR SELECT 
USING (user_can_access_org(org_id));

-- Only service role can manage reports (for automated generation)
CREATE POLICY "service_role_can_manage_reports" 
ON reports 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
```

### Security Features

1. **Private Storage**: All reports are stored in a private bucket, not accessible via direct URLs
2. **Signed URLs**: Download links are generated with short TTL (5 minutes) for security
3. **Organization Isolation**: Users can only access reports for their own organization
4. **Authenticated Access**: All access requires valid user authentication
5. **Audit Trail**: All report generation and access is logged for compliance

## Troubleshooting

### Common Issues

**1. Reports Not Generating**
- Check if `FEATURE_WEEKLY_REPORT` is enabled
- Verify `CRON_SECRET` is properly configured
- Check [Edge Function Logs](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/weekly-report/logs) for errors

**2. Download Links Not Working**
- Signed URLs expire after 5 minutes - refresh the page to get a new link
- Ensure you're logged in and part of the organization
- Check browser console for authentication errors

**3. Missing Data in Reports**
- Verify your organization has prompt responses in the database
- Ensure brand catalog is properly configured
- Check that prompts are active and have recent runs

**4. Scheduled Generation Failing**
- Verify cron job is properly configured with correct `CRON_SECRET`
- Check database connectivity and permissions
- Review scheduler logs for specific error messages

### Getting Help

If you encounter issues:
1. Check the [Edge Function Logs](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/weekly-report/logs)
2. Verify your organization setup and permissions
3. Contact support with specific error messages and timestamps

## API Reference

### Endpoints

**Generate Report (POST)**
```
POST /functions/v1/weekly-report
Headers: Authorization: Bearer <user_jwt_token>
Response: { storage_path: string } | { exists: true, storage_path: string }
```

**Get Download Link (GET)**
```
GET /functions/v1/weekly-report?week_key=2025-W02
Headers: Authorization: Bearer <user_jwt_token>  
Response: { signed_url: string, expires_at: string }
```

**Scheduled Generation (POST)**
```
POST /functions/v1/weekly-report
Headers: Authorization: Bearer <cron_secret>
Body: { scheduled: true }
Response: { processed_orgs: number, results: object[] }
```

### Response Codes

- `200`: Success
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (user not part of organization)
- `404`: Report not found
- `405`: Method not allowed
- `500`: Internal server error

## Data Retention

- Reports are retained indefinitely unless manually deleted
- Raw data used for report generation follows standard retention policies
- Signed download URLs expire after 5 minutes for security