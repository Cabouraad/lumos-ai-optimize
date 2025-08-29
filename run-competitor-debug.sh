#!/bin/bash

# Competitor Detection Debug Runner
# Run this to debug the current detection pipeline

echo "🔍 Starting Competitor Detection Debug..."
echo "=========================================="

# Set execute permissions
chmod +x debug-competitor-detection.ts
chmod +x run-competitor-debug.sh

# Run the debug script
echo "📊 Running detection pipeline tests..."
deno run --allow-all debug-competitor-detection.ts

echo ""
echo "📋 Debug complete! Check the output above for:"
echo "   ✅ Detection logic validation"
echo "   🗄️  Database query status"
echo "   💥 Any errors or misclassifications"
echo ""
echo "📖 See COMPETITOR_DETECTION_AUDIT_REPORT.md for detailed analysis"