#!/bin/bash

# Manual test script to trigger the daily batch function
SUPABASE_URL="https://cgocsffxqyhojtyzniyz.supabase.co"
CRON_SECRET="a978931713ce1c30123378480cbf38a3fc3ea7b9d299c6c848c463c3ca6e983"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb2NzZmZ4cXlob2p0eXpuaXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI1MDksImV4cCI6MjA3MDYxODUwOX0.Rn2lVaTcuu0TEn7S20a_56mkEBkG3_a7CT16CpEfirk"

echo "🚀 Testing Daily Batch Trigger (Manual Override)"
echo "================================================="

# Test daily batch trigger
echo ""
echo "📡 Calling daily-batch-trigger..."
curl -X POST "${SUPABASE_URL}/functions/v1/daily-batch-trigger" \
  -H "Content-Type: application/json" \
  -H "x-manual-call: true" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "manual_test": true,
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'"
  }' \
  --verbose

echo ""
echo "⏳ Waiting 10 seconds for processing..."
sleep 10

echo ""
echo "🔧 Calling batch-reconciler..."
curl -X POST "${SUPABASE_URL}/functions/v1/batch-reconciler" \
  -H "Content-Type: application/json" \
  -H "x-manual-call: true" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "manual_test": true,
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'"
  }' \
  --verbose

echo ""
echo "✅ Manual test completed!"
echo "Check Supabase logs and database tables for results."