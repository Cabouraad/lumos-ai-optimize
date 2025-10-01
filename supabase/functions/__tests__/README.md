# Edge Function Tests

Simple, fast tests for edge functions that can be run locally to verify functionality after changes.

## Running Tests

### Run all tests
```bash
deno test --allow-env --allow-net supabase/functions/__tests__/*.test.ts
```

### Run specific test file
```bash
deno test --allow-env --allow-net supabase/functions/__tests__/generate-visibility-recommendations.test.ts
```

### Run with coverage
```bash
deno test --allow-env --allow-net --coverage=coverage supabase/functions/__tests__/*.test.ts
deno coverage coverage
```

## Test Files

### 1. **generate-visibility-recommendations.test.ts**
Tests the recommendation generation function:
- Auth validation
- Input validation
- Deterministic fallback structure
- User prompt formatting
- CORS handling
- Recommendation row structures (content & social)

### 2. **run-prompt-now.test.ts**
Tests the prompt execution function:
- Auth validation
- Input validation
- Provider execution results
- Brand analysis structure
- Subscription tier filtering
- Usage tracking

### 3. **llms-generate.test.ts**
Tests the llms.txt generation function:
- Auth validation
- Page discovery from sitemaps
- HTML title extraction
- Content extraction (HTML stripping)
- llms.txt content structure
- Path normalization
- Metadata generation

### 4. **diag.test.ts**
Tests the diagnostic function:
- CORS preflight handling
- Diagnostic response structure
- Environment variable checks
- Origin validation
- Timestamp formatting
- Development environment detection

## Test Structure

Each test file follows this pattern:

1. **Authentication Tests**: Verify JWT validation
2. **Input Validation Tests**: Check required parameters
3. **CORS Tests**: Verify CORS headers
4. **Business Logic Tests**: Test core functionality
5. **Data Structure Tests**: Validate output formats

## Quick Smoke Test

Before deploying, run this quick check:

```bash
# Test all functions
npm run test:functions

# Or manually:
deno test --allow-env --allow-net supabase/functions/__tests__/*.test.ts
```

## Local Testing Setup

1. **Start Supabase locally**:
```bash
supabase start
```

2. **Set environment variables**:
```bash
export SUPABASE_URL="http://localhost:54321"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export OPENAI_API_KEY="your-openai-key"
```

3. **Serve functions**:
```bash
supabase functions serve
```

4. **Run tests**:
```bash
deno test --allow-env --allow-net supabase/functions/__tests__/*.test.ts
```

## CI/CD Integration

These tests run automatically on every PR via GitHub Actions (`.github/workflows/pr-tests.yml`).

## Writing New Tests

When adding new edge functions, create a corresponding test file:

```typescript
// supabase/functions/__tests__/my-function.test.ts
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const FUNCTION_URL = "http://localhost:54321/functions/v1/my-function";

Deno.test("my-function: should reject missing auth", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });

  assertEquals(response.status, 401);
});

// Add more tests...

console.log("✅ All my-function tests passed!");
```

## Best Practices

1. **Keep tests simple**: Focus on happy paths and obvious error cases
2. **Test data structures**: Verify output format compliance
3. **Mock expensive operations**: Don't call real APIs in unit tests
4. **Use descriptive names**: Test names should explain what's being tested
5. **Test edge cases**: Empty inputs, missing fields, invalid formats
6. **Run locally before committing**: Catch issues early

## Common Issues

### Port already in use
```bash
# Kill existing Supabase processes
pkill -f supabase
supabase start
```

### Missing environment variables
```bash
# Copy .env.example to .env.local
cp .env.example .env.local
# Edit with your actual keys
```

### Function not found
```bash
# Restart function server
supabase functions serve --no-verify-jwt
```

## Integration with npm scripts

Add to `package.json`:
```json
{
  "scripts": {
    "test:functions": "deno test --allow-env --allow-net supabase/functions/__tests__/*.test.ts"
  }
}
```

Run with:
```bash
npm run test:functions
```
