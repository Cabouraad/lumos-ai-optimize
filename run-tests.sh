#!/bin/bash

# Test Runner Script for Competitor Detection
# Usage: ./run-tests.sh

echo "🧪 Competitor Detection Test Suite"
echo "=================================="
echo ""

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Deno is not installed. Please install Deno first:"
    echo "   curl -fsSL https://deno.land/x/install/install.sh | sh"
    exit 1
fi

echo "✅ Deno found: $(deno --version | head -n1)"
echo ""

# Set executable permissions
chmod +x test-competitor-detection.ts

# Run the tests
echo "🚀 Running competitor detection tests..."
echo ""

if deno run --allow-all test-competitor-detection.ts; then
    echo ""
    echo "🎉 All tests passed successfully!"
    echo "The competitor detection system is working correctly."
    exit 0
else
    echo ""
    echo "💥 Tests failed. Please check the output above for details."
    exit 1
fi