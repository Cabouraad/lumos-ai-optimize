# E2E Test Harness

Comprehensive end-to-end testing suite that exercises the app like a real user with synthetic test accounts and isolated test data.

## 🚀 Quick Start

```bash
# 1. Seed test data
deno run --allow-all scripts/e2e-seed.ts

# 2. Run Playwright tests  
npm run test:e2e

# 3. Run edge function smoke tests
deno run --allow-all scripts/e2e-smoke.ts

# 4. Clean up test data
deno run --allow-all scripts/e2e-clean.ts
```

## 📋 Test Coverage

### Authentication & Access (00_auth.spec.ts)
- ✅ Login/logout flows for both test users
- ✅ Invalid credential handling
- ✅ Session persistence

### Subscription Gating (01_pricing_gates.spec.ts)  
- ✅ Starter vs Growth tier access
- ✅ Reports restriction for Starter
- ✅ Trial information display

### Dashboard Core (02_dashboard_core.spec.ts)
- ✅ Prompt creation and execution
- ✅ Provider toggles and results
- ✅ Error handling

### Brand Detection (03_competitor_brand_detect.spec.ts)
- ✅ Competitor chip display
- ✅ Organization brand recognition
- ✅ Multi-provider consistency

### Reports (04_reports.spec.ts)
- ✅ Tier-based access control
- ✅ Report generation and download
- ✅ Metadata display

### Accessibility (05_accessibility.spec.ts)
- ✅ Console error monitoring
- ✅ Keyboard navigation
- ✅ ARIA labels and semantic HTML
- ✅ Color contrast basics

### Navigation & CORS (06_nav_cors_diag.spec.ts)
- ✅ Cross-page navigation
- ✅ Responsive design
- ✅ CORS diagnostic via /diag endpoint
- ✅ Session persistence

## 🧪 Test Accounts

| Email | Password | Tier | Access |
|-------|----------|------|--------|
| `starter_e2e@test.app` | `test123456789` | Starter | Basic features only |
| `growth_e2e@test.app` | `test123456789` | Growth | All features including reports |

## 🔧 Environment Setup

Set these secrets in Supabase Edge Functions:

```bash
APP_ORIGINS="https://llumos.app,http://localhost:5173"
CRON_SECRET="<random-uuid>"
BILLING_BYPASS_ENABLED=true
BILLING_BYPASS_EMAILS="starter_e2e@test.app,growth_e2e@test.app"
E2E_FAKE_PROVIDERS=true
E2E_DRY_RUN_SCHEDULER=true
```

## 📁 File Structure

```
tests/e2e/           # Playwright E2E tests
scripts/             # Data management scripts  
lib/providers/fake.ts # Fake provider for testing
supabase/functions/
├── diag/           # CORS connectivity test
└── schedule-dry-run/ # Scheduler testing
```

## 🎯 Success Criteria

All tests should pass with:
- ✅ Authentication flows working
- ✅ Proper tier-based access control  
- ✅ Fake providers returning predictable results
- ✅ No console errors or accessibility violations
- ✅ CORS allowing https://llumos.app origin
- ✅ RLS isolating org data correctly

## 🔍 Debugging

```bash
# Check diagnostic endpoint
curl https://cgocsffxqyhojtyzniyz.supabase.co/functions/v1/diag

# Run single test file
npx playwright test tests/e2e/00_auth.spec.ts --headed

# View test report
npx playwright show-report
```

## 🧹 Cleanup

The test data cleanup script preserves users by default:

```bash
# Clean data but keep user accounts
deno run --allow-all scripts/e2e-clean.ts

# Full cleanup including users
deno run --allow-all scripts/e2e-clean.ts --keep-users=false
```

This harness provides non-breaking, comprehensive testing that exercises real user workflows with predictable, isolated test data.