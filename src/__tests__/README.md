# Sign-Up Flow Test Suite

Comprehensive automated tests for the user sign-up and onboarding flow.

## Test Organization

### 1. Edge Function Tests
Location: `src/__tests__/edge-functions/`

- **`create-trial-checkout-security.test.ts`** - Stripe checkout security & idempotency
- **`activate-trial.test.ts`** - Trial activation, security checks, database updates
- **`onboarding.test.ts`** - Organization creation, user linking, brand catalog setup

### 2. Integration Tests
Location: `src/__tests__/integration/`

- **`signup-flow.test.ts`** - End-to-end flow validation from registration to dashboard access

### 3. Critical Flow Tests
Location: `src/__tests__/critical-flows/`

- **`signup.test.ts`** - UI integration tests for the sign-up components

### 4. Database Verification Tests
Location: `src/__tests__/database/`

- **`signup-verification.test.ts`** - Database state verification after sign-up operations

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Edge function tests only
npm test -- edge-functions

# Integration tests only
npm test -- integration

# Critical flow tests only
npm test -- critical-flows

# Database verification only
npm test -- database
```

### Run With Coverage
```bash
npm run test:coverage
```

### Watch Mode (for development)
```bash
npm test -- --watch
```

## Test Coverage

The test suite covers:

### ✅ Phase 1: User Registration
- Email validation
- Password strength requirements
- Duplicate email handling
- Account creation

### ✅ Phase 2: Email Verification & Authentication
- Auth code exchange
- User record creation
- Bootstrap auth flow
- Session management

### ✅ Phase 3: Organization Setup
- Organization creation with all fields
- User-org linking as owner
- Brand catalog initialization
- LLM providers setup

### ✅ Phase 4: Subscription & Trial
- Stripe checkout session creation
- Trial activation
- 7-day trial period verification
- Subscriber record updates

### ✅ Phase 5: Security & Access Control
- JWT validation
- Email/user ID matching
- RLS policy enforcement
- Cross-org access prevention

### ✅ Phase 6: Error Handling
- Network failures
- Database errors
- Stripe errors
- Validation errors
- Retry mechanisms

## Test Data

### Mock Users
```typescript
{
  email: 'test@example.com',
  password: 'TestPassword123!',
  userId: 'test-user-uuid'
}
```

### Mock Organizations
```typescript
{
  name: 'Test Organization',
  domain: 'testorg.com',
  business_description: 'A test organization',
  products_services: 'Testing services',
  target_audience: 'Developers',
  keywords: 'testing, development'
}
```

## Manual Testing Checklist

While these automated tests cover most scenarios, some aspects require manual verification:

### 🔍 Manual Tests Required

1. **Email Delivery**
   - [ ] Verification email arrives in inbox
   - [ ] Email contains correct verification link
   - [ ] Link expires after 24 hours

2. **Stripe Integration** (Test Mode)
   - [ ] Checkout page loads correctly
   - [ ] Test card (4242 4242 4242 4242) works
   - [ ] Payment setup completes
   - [ ] Redirect back to app works

3. **Trial Experience**
   - [ ] Trial countdown displays correctly
   - [ ] Trial expiration warning appears
   - [ ] Access is blocked after trial expires

4. **UI/UX Flow**
   - [ ] Progress indicators work
   - [ ] Form validation displays correctly
   - [ ] Error messages are user-friendly
   - [ ] Loading states are clear

5. **Cross-Browser Testing**
   - [ ] Chrome/Edge
   - [ ] Firefox
   - [ ] Safari
   - [ ] Mobile browsers

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm test

- name: Generate Coverage Report
  run: npm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests Failing Locally

1. **Clear test database**
   ```bash
   npm run test:reset-db
   ```

2. **Check environment variables**
   - Ensure test `.env` file exists
   - Verify Supabase test project credentials

3. **Update dependencies**
   ```bash
   npm install
   ```

### Mock Not Working

- Check that mocks are cleared in `beforeEach`
- Verify mock paths match actual imports
- Look for async timing issues

### Database Tests Failing

- Verify test database is accessible
- Check RLS policies allow test operations
- Ensure test user has correct permissions

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Add tests to appropriate category
3. Include descriptive test names
4. Add mock data to test utils
5. Document any manual test requirements
6. Update this README

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/getting-started/testing)
- [Stripe Testing](https://stripe.com/docs/testing)
