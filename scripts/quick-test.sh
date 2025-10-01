#!/bin/bash

# Quick smoke test - runs only the core 4 function tests
# Usage: ./scripts/quick-test.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "⚡ Quick Smoke Test (Core Functions)"
echo "================================"

TESTS_DIR="supabase/functions/__tests__"

core_tests=(
    "generate-visibility-recommendations"
    "run-prompt-now"
    "llms-generate"
    "diag"
)

passed=0
failed=0

for test_name in "${core_tests[@]}"; do
    test_file="$TESTS_DIR/${test_name}.test.ts"
    
    echo -e "\n${YELLOW}Testing: $test_name${NC}"
    
    if deno test --allow-env --allow-net "$test_file" 2>&1 | grep -q "All.*tests passed"; then
        echo -e "${GREEN}✅ $test_name passed${NC}"
        passed=$((passed + 1))
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        failed=$((failed + 1))
    fi
done

echo -e "\n================================"
echo -e "Passed: ${GREEN}$passed${NC}/4"

if [ $failed -gt 0 ]; then
    echo -e "${RED}Failed: $failed${NC}/4"
    echo -e "\n${RED}💥 Quick test failed!${NC}"
    exit 1
else
    echo -e "\n${GREEN}🎉 All core functions working!${NC}"
    exit 0
fi
