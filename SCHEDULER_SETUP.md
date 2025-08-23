# Scheduler Setup - Automated Daily Runs

The daily scheduler system is **automatically configured** and runs without manual setup. This document explains how it works and provides verification steps.

## 🚀 Automatic Operation

The scheduler is **already running** and configured to:

- ✅ **Run automatically at 3:00 AM Eastern Time** every day
- ✅ **Handle Daylight Saving Time** with dual UTC triggers (7:00 AM & 8:00 AM UTC)
- ✅ **Prevent duplicate runs** with built-in idempotency
- ✅ **Process all active prompts** for all organizations
- ✅ **Respect quota limits** and use intelligent caching

## 📋 How It Works

### Automatic Scheduling
The `daily-scan` Edge Function is automatically scheduled via `supabase/config.toml`:
```toml
[functions.daily-scan]
verify_jwt = false
schedule = ["0 7 * * *", "0 8 * * *"]  # 7 AM & 8 AM UTC
```

### Time Gate Protection  
The function only executes after 3:00 AM Eastern Time, regardless of when triggered:
- **During EDT (March-November)**: Triggered at 7:00 AM UTC = 3:00 AM EDT
- **During EST (November-March)**: Triggered at 8:00 AM UTC = 3:00 AM EST

### Idempotency Protection
Using the `scheduler_state` table, the system ensures only one run per day:
- Creates a unique daily key (e.g., "2024-08-23")  
- Uses atomic database operations to prevent race conditions
- Skips execution if already completed for the day

## 🔍 Verify Operation

### 1. Check Scheduler Status
The UI automatically displays current status in the dashboard.

### 2. View Function Logs
Monitor execution in [Supabase Functions Dashboard](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/daily-scan/logs)

### 3. Check Database State
```sql
SELECT * FROM scheduler_state WHERE id = 'global';
```

### 4. Test Function Manually
```bash
curl -X POST https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/daily-scan \
  -H "Content-Type: application/json"
```

## 🛠 Architecture

```
Supabase Scheduler (UTC)
    ↓
daily-scan Edge Function
    ↓
Time Gate Check (3 AM ET)
    ↓
Idempotency Check
    ↓
Process All Organizations
    ↓
Run Active Prompts
    ↓
Store Results
```

## 📊 Features

- **Zero Configuration**: No manual cron setup required
- **DST Aware**: Automatically handles time zone changes  
- **Fault Tolerant**: Handles errors gracefully with retries
- **Cost Optimized**: Respects quotas and uses caching
- **Real-time Status**: UI shows last run and next run times
- **Comprehensive Logging**: Full audit trail in Supabase logs

## 🔧 Troubleshooting

If the scheduler appears to not be running:

1. **Check Function Status**: [Edge Functions Dashboard](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions)
2. **Review Logs**: [Daily Scan Logs](https://supabase.com/dashboard/project/cgocsffxqyhojtyzniyz/functions/daily-scan/logs)  
3. **Verify Database**: Check `scheduler_state` table for recent updates
4. **Test API Keys**: Use the "Test Scheduler APIs" feature in settings

The system is designed to be completely autonomous - no manual intervention should be required.