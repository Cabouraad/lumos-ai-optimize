#!/bin/bash

# Pre-deploy validation script
# Ensures edge functions are properly configured before deployment

set -e

echo "🚀 Running pre-deploy checks..."

# Check if validation script exists
if [ ! -f "scripts/validate-edge-functions.ts" ]; then
    echo "❌ Validation script not found!"
    exit 1
fi

# Run edge function validation
echo "🔍 Validating edge functions..."
npx tsx scripts/validate-edge-functions.ts

echo "✅ Pre-deploy checks completed successfully!"