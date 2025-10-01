#!/bin/bash

# Simple test runner for edge functions
# Usage: ./scripts/test-functions.sh [function-name]

set -e

TESTS_DIR="supabase/functions/__tests__"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🧪 Edge Function Test Runner"
echo "================================"

# Check if deno is installed
if ! command -v deno &> /dev/null; then
    echo -e "${RED}❌ Deno is not installed. Please install Deno first.${NC}"
    echo "Visit: https://deno.land/#installation"
    exit 1
fi

# Check if tests directory exists
if [ ! -d "$TESTS_DIR" ]; then
    echo -e "${RED}❌ Tests directory not found: $TESTS_DIR${NC}"
    exit 1
fi

# Function to run a single test file
run_test() {
    local test_file=$1
    local test_name=$(basename "$test_file" .test.ts)
    
    echo -e "\n${YELLOW}Testing: $test_name${NC}"
    echo "------------------------------------"
    
    if deno test --allow-env --allow-net "$test_file"; then
        echo -e "${GREEN}✅ $test_name passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
}

# If specific function provided, run only that test
if [ $# -eq 1 ]; then
    function_name=$1
    test_file="$TESTS_DIR/${function_name}.test.ts"
    
    if [ -f "$test_file" ]; then
        run_test "$test_file"
        exit $?
    else
        echo -e "${RED}❌ Test file not found: $test_file${NC}"
        echo -e "\nAvailable tests:"
        for f in "$TESTS_DIR"/*.test.ts; do
            echo "  - $(basename "$f" .test.ts)"
        done
        exit 1
    fi
fi

# Run all tests
echo -e "\n${YELLOW}Running all edge function tests...${NC}\n"

passed=0
failed=0
total=0

for test_file in "$TESTS_DIR"/*.test.ts; do
    if [ -f "$test_file" ]; then
        total=$((total + 1))
        
        if run_test "$test_file"; then
            passed=$((passed + 1))
        else
            failed=$((failed + 1))
        fi
    fi
done

# Summary
echo -e "\n================================"
echo -e "📊 Test Summary"
echo -e "================================"
echo -e "Total:  $total"
echo -e "${GREEN}Passed: $passed${NC}"
if [ $failed -gt 0 ]; then
    echo -e "${RED}Failed: $failed${NC}"
else
    echo -e "Failed: $failed"
fi

# Exit with error if any tests failed
if [ $failed -gt 0 ]; then
    echo -e "\n${RED}💥 Some tests failed!${NC}"
    exit 1
else
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
fi
