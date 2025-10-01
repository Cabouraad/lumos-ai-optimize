# Test Suite Documentation

## Overview

This project includes comprehensive test coverage for all critical functionality, including unit tests, integration tests, and end-to-end tests.

## Running Tests

### All Tests
```bash
npm run test
```

### Watch Mode
```bash
npm run test:watch
```

### With Coverage
```bash
npm run test:coverage
```

### Specific Test File
```bash
npm run test src/features/visibility-recommendations/__tests__/api.test.ts
```

## CI/CD Integration

Tests automatically run on every pull request via GitHub Actions (`.github/workflows/pr-tests.yml`).

The workflow includes:
- Linting
- Unit tests
- Type checking
- Coverage reporting

## Test Structure

### Unit Tests
Located in `src/features/**/__tests__/`

- **API Tests** (`api.test.ts`): Test API client functions
- **Hook Tests** (`hooks.test.tsx`): Test React Query hooks
- **Component Tests**: Test React components (when added)

### Edge Function Tests
Located in `supabase/functions/*/__tests__/`

- Test core business logic without requiring deployed infrastructure
- Run with: `deno test --allow-env supabase/functions/*/`

### Integration Tests
Located in `src/__tests__/integration/`

- Test complete user flows
- Test interactions between multiple modules

### E2E Tests
Located in `tests/e2e/`

- Run with Playwright: `npm run test:e2e`
- Test security policies (RLS, CORS)
- Test critical user journeys

## Writing Tests

### Example Unit Test
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyFeature', () => {
  it('should do something', () => {
    const result = doSomething();
    expect(result).toBe(expected);
  });
});
```

### Example Hook Test
```typescript
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

const { result } = renderHook(() => useMyHook(), { wrapper });
expect(result.current.data).toBeDefined();
```

## Coverage Goals

- **Unit Tests**: >80% coverage for business logic
- **Integration Tests**: Cover all critical user flows
- **E2E Tests**: Cover authentication, authorization, and data access patterns

## Debugging Tests

### View Test Output
```bash
npm run test -- --reporter=verbose
```

### Run Single Test
```bash
npm run test -- -t "test name pattern"
```

### Debug in VS Code
Add breakpoints and use the "Debug Test" option in VS Code.

## Best Practices

1. **Isolate Tests**: Mock external dependencies
2. **Test Behavior**: Focus on user-facing behavior, not implementation
3. **Keep Tests Fast**: Mock slow operations (network, DB)
4. **Clear Names**: Use descriptive test names that explain the scenario
5. **Arrange-Act-Assert**: Structure tests clearly
6. **One Assertion Per Test**: When possible, test one thing at a time
