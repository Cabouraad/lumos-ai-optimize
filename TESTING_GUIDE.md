# Complete Testing Guide for Llumos

## Overview

This guide covers all testing in the project: frontend unit tests, edge function tests, and end-to-end tests.

## Quick Start

```bash
# Run all frontend tests
npm run test

# Run edge function tests
deno test --allow-env --allow-net supabase/functions/__tests__/*.test.ts

# Run specific edge function test
deno test --allow-env --allow-net supabase/functions/__tests__/generate-visibility-recommendations.test.ts
```

## Frontend Tests (Vitest)

### Location
- `src/__tests__/` - General unit tests
- `src/__tests__/critical-flows/` - Critical user flow tests
- `src/features/**/__tests__/` - Feature-specific tests

### Running Tests

```bash
# Run all tests
npm run test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test src/features/visibility-recommendations/__tests__/api.test.ts
```

### Current Test Coverage

#### Visibility Recommendations Feature
- **API Tests** (`src/features/visibility-recommendations/__tests__/api.test.ts`)
  - `generateVisibilityRecommendations()` - API call with error handling
  - `listVisibilityRecommendations()` - Fetching recommendations
  - `listAllOrgRecommendations()` - Org-wide recommendations
  
- **Hook Tests** (`src/features/visibility-recommendations/__tests__/hooks.test.tsx`)
  - `useVisibilityRecommendations()` - Query hook
  - `useGenerateVisibilityRecs()` - Mutation hook
  - `useAllVisibilityRecommendations()` - Org query hook

#### Domain Resolver Tests
- **Unit Tests** (`src/lib/citations/__tests__/domainResolver.test.ts`)
  - Domain to brand resolution
  - Competitor matching
  - Citation enrichment

#### Critical Flow Tests
- **Pricing Alignment** (`src/__tests__/critical-flows/pricing-alignment.test.ts`)
  - Stripe prices match pricing page
  
- **Sign Up Flow** (`src/__tests__/critical-flows/signup.test.ts`)
  - Email verification
  - Organization setup
  - Onboarding completion

## Edge Function Tests (Deno)

### Location
- `supabase/functions/__tests__/` - Edge function unit tests
- `supabase/functions/generate-visibility-recommendations/__tests__/` - Function-specific tests

### Running Tests

```bash
# Run all edge function tests
deno test --allow-env --allow-net supabase/functions/__tests__/*.test.ts

# Run specific function test
deno test --allow-env --allow-net supabase/functions/__tests__/generate-visibility-recommendations.test.ts

# Run with coverage
deno test --allow-env --allow-net --coverage=coverage supabase/functions/__tests__/*.test.ts
deno coverage coverage
```

### Test Files

1. **generate-visibility-recommendations.test.ts**
   - Auth validation
   - Input validation (promptId required)
   - CORS preflight handling
   - Deterministic fallback structure
   - User prompt formatting
   - Recommendation row structures

2. **run-prompt-now.test.ts**
   - Auth validation
   - Prompt execution across providers
   - Brand analysis structure
   - Subscription tier filtering
   - Usage tracking

3. **llms-generate.test.ts**
   - Website crawling
   - Sitemap parsing
   - Content extraction
   - llms.txt generation

4. **diag.test.ts**
   - Environment diagnostics
   - CORS validation
   - Origin checking

### Prerequisites for Edge Function Tests

1. **Start Supabase locally**:
```bash
supabase start
```

2. **Set environment variables** (create `.env.local`):
```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-key
```

3. **Serve functions**:
```bash
supabase functions serve
```

## End-to-End Tests (Playwright)

### Location
- `tests/e2e/` - Playwright E2E tests

### Running Tests

```bash
# Install Playwright (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/e2e/00_auth.spec.ts
```

### Test Files

1. **00_auth.spec.ts** - Authentication flows
2. **security.rls.spec.ts** - Row Level Security
3. **security.exposure.spec.ts** - Data exposure prevention
4. **security.force-rls.spec.ts** - RLS enforcement
5. **subscribers.rls.spec.ts** - Subscriber data security

## CI/CD Testing

### GitHub Actions Workflows

1. **PR Tests** (`.github/workflows/pr-tests.yml`)
   - Runs on every pull request
   - Executes: linting, frontend tests, type checking
   - Uploads coverage reports

2. **Security Audit** (`.github/workflows/security-audit.yml`)
   - Runs database security checks
   - Validates RLS policies

### What Runs Automatically

On every PR:
- ✅ ESLint checks
- ✅ TypeScript type checking
- ✅ All frontend unit tests
- ✅ Coverage report generation

## Test Organization by Feature

### Visibility Recommendations
```
src/features/visibility-recommendations/
├── api.ts
├── hooks.ts
├── components/
│   └── RecommendationCard.tsx
└── __tests__/
    ├── api.test.ts          ✅ API layer
    └── hooks.test.tsx       ✅ React hooks

supabase/functions/
├── generate-visibility-recommendations/
│   ├── index.ts
│   └── __tests__/
│       └── index.test.ts    ✅ Edge function
```

## Writing New Tests

### Frontend Unit Test Template

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyFeature', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Edge Function Test Template

```typescript
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const FUNCTION_URL = "http://localhost:54321/functions/v1/my-function";

Deno.test("my-function: should validate input", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "value" })
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.result);
});
```

## Test Coverage Goals

- **Frontend**: >80% coverage for business logic
- **Edge Functions**: All critical paths tested
- **Integration**: All critical user flows covered
- **E2E**: Auth, authorization, and data access patterns

## Debugging Tests

### Frontend Tests
```bash
# Run single test with verbose output
npm run test -- -t "test name pattern" --reporter=verbose

# Debug in VS Code
# Set breakpoint and use "Debug Test" option
```

### Edge Function Tests
```bash
# Run with verbose logging
deno test --allow-env --allow-net --log-level=debug

# Use console.log in test files for debugging
```

## Common Issues & Solutions

### Frontend Tests

**Issue**: `Cannot find module '@/...'`
```bash
# Solution: Check tsconfig paths and vitest.config.ts alias
```

**Issue**: `ReferenceError: fetch is not defined`
```bash
# Solution: Already handled by jsdom environment in vitest.config.ts
```

### Edge Function Tests

**Issue**: `Connection refused to localhost:54321`
```bash
# Solution: Make sure Supabase is running
supabase start
supabase functions serve
```

**Issue**: `Function not found`
```bash
# Solution: Restart function server
supabase functions serve
```

## Pre-Commit Checklist

Before committing changes:

1. ✅ Run frontend tests: `npm run test`
2. ✅ Run linter: `npm run lint`
3. ✅ Type check: `npx tsc --noEmit`
4. ✅ Run edge function tests: `deno test --allow-env --allow-net supabase/functions/__tests__/*.test.ts`

## Continuous Improvement

### Adding Tests for New Features

1. **Create feature tests alongside implementation**:
   - API tests in `__tests__/api.test.ts`
   - Hook tests in `__tests__/hooks.test.tsx`
   - Component tests in `__tests__/ComponentName.test.tsx`

2. **Edge function tests**:
   - Create test file in `supabase/functions/__tests__/`
   - Test auth, input validation, business logic, output format

3. **Integration tests** (when needed):
   - Add to `src/__tests__/integration/`
   - Test complete user workflows

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Deno Testing](https://deno.land/manual/testing)
