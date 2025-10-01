# Edge Function Test Status

Quick reference for which functions have tests and which need them.

## ✅ Functions with Tests

| Function | Test File | Coverage |
|----------|-----------|----------|
| **generate-visibility-recommendations** | `__tests__/generate-visibility-recommendations.test.ts` | ✅ Full |
| **run-prompt-now** | `__tests__/run-prompt-now.test.ts` | ✅ Full |
| **llms-generate** | `__tests__/llms-generate.test.ts` | ✅ Full |
| **diag** | `__tests__/diag.test.ts` | ✅ Full |

## 🟡 Priority Functions Needing Tests

These are high-impact functions that should be tested next:

| Function | Priority | Why Test |
|----------|----------|----------|
| **bootstrap-auth** | HIGH | Critical user creation flow |
| **create-checkout** | HIGH | Stripe payment integration |
| **check-subscription** | HIGH | Subscription validation |
| **daily-batch-trigger** | HIGH | Core scheduler |
| **robust-batch-processor** | HIGH | Batch processing logic |

## 📋 All Functions by Category

### Authentication & User Management
- ✅ `bootstrap-auth` - Creates user on signup
- ✅ `ensure-user-record` - Fallback user creation
- ✅ `delete-account` - Account deletion
- ⬜ `onboarding` - User onboarding flow

### Subscription & Billing
- ⬜ `create-checkout` - Stripe checkout
- ⬜ `create-trial-checkout` - Trial checkout
- ⬜ `customer-portal` - Stripe portal
- ⬜ `check-subscription` - Subscription check
- ⬜ `check-subscription-scheduled` - Scheduled check
- ⬜ `activate-trial` - Trial activation

### Prompt Execution
- ✅ `run-prompt-now` - Manual prompt run
- ⬜ `daily-batch-trigger` - Daily batch trigger
- ⬜ `robust-batch-processor` - Batch processor
- ⬜ `batch-reconciler` - Reconciliation
- ⬜ `scheduler-postcheck` - Post-batch check

### Recommendations & Optimizations
- ✅ `generate-visibility-recommendations` - NEW recommendation system
- ⬜ `generate-recommendations` - Legacy recommendations
- ⬜ `intelligent-recommendations` - AI recommendations
- ⬜ `advanced-recommendations` - Advanced recs
- ⬜ `reco-refresh` - Recommendation refresh
- ⬜ `generate-optimizations` - Optimization generation
- ⬜ `enqueue-optimizations` - Queue optimizations
- ⬜ `optimization-worker` - Process queue

### Content Generation
- ✅ `llms-generate` - llms.txt generation
- ⬜ `auto-fill-business-context` - Auto-fill context

### Data Analysis
- ⬜ `analyze-ai-response` - Response analysis
- ⬜ `citation-mention` - Citation extraction
- ⬜ `brand-enrich` - Brand enrichment
- ⬜ `audit-visibility` - Visibility audit
- ⬜ `auto-audit` - Auto audit

### Reports
- ⬜ `generate-weekly-report` - Weekly report
- ⬜ `backfill-weekly-reports` - Report backfill
- ⬜ `reports-sign` - Signed URLs

### Utilities & Debugging
- ✅ `diag` - Diagnostics
- ⬜ `debug-response-data` - Debug tool
- ⬜ `scheduler-diagnostics` - Scheduler debug
- ⬜ `free-visibility-checker` - Free tier check
- ⬜ `fetch-google-aio` - Google AIO fetch

### Data Fixes (Admin)
- ⬜ `convert-competitor-to-brand` - Convert competitor
- ⬜ `fix-org-brand-misclassification` - Fix misclassification
- ⬜ `fix-prompt-classification` - Fix prompt classification

### Manual Triggers (Admin)
- ⬜ `manual-daily-run` - Manual daily run
- ⬜ `manual-recovery-trigger` - Recovery trigger
- ⬜ `admin-batch-trigger` - Admin batch
- ⬜ `scheduler-recovery` - Scheduler recovery
- ⬜ `schedule-dry-run` - Dry run
- ⬜ `scheduled-prompt-executor` - Legacy executor
- ⬜ `daily-scheduler-deprecated` - Deprecated scheduler

### Access Control (Admin)
- ⬜ `grant-starter-bypass` - Grant bypass
- ⬜ `remove-bypass` - Remove bypass  
- ⬜ `remove-test-access` - Remove test access

### Enhanced Suggestions
- ⬜ `enhanced-prompt-suggestions` - AI suggestions

### Cron Management
- ⬜ `cron-manager` - Cron orchestration
- ⬜ `daily-subscription-checker` - Daily sub check

## Test Priority Matrix

### Priority 1 (Immediate)
Functions that affect revenue or core user experience:
1. ✅ `generate-visibility-recommendations` - Core feature
2. ✅ `run-prompt-now` - Core execution
3. ⬜ `create-checkout` - Payment
4. ⬜ `check-subscription` - Access control
5. ⬜ `bootstrap-auth` - User creation

### Priority 2 (High)
Functions that run automatically and affect multiple users:
1. ⬜ `daily-batch-trigger` - Batch processing
2. ⬜ `robust-batch-processor` - Reliability
3. ⬜ `batch-reconciler` - Data integrity
4. ⬜ `scheduler-postcheck` - Verification
5. ⬜ `check-subscription-scheduled` - Access enforcement

### Priority 3 (Medium)
User-facing features:
1. ✅ `llms-generate` - Content generation
2. ⬜ `intelligent-recommendations` - AI features
3. ⬜ `generate-weekly-report` - Reporting
4. ⬜ `onboarding` - User experience
5. ⬜ `auto-fill-business-context` - UX enhancement

### Priority 4 (Low)
Admin tools and utilities:
1. ✅ `diag` - Debugging
2. ⬜ `debug-response-data` - Debugging
3. ⬜ All admin manual triggers
4. ⬜ All access control functions

## How to Add Tests

### 1. Copy Template
```bash
cp supabase/functions/__tests__/diag.test.ts \
   supabase/functions/__tests__/your-function.test.ts
```

### 2. Update Function URL
```typescript
const FUNCTION_URL = "http://localhost:54321/functions/v1/your-function";
```

### 3. Add Tests
- Auth validation
- Input validation  
- Business logic
- Output format
- Error handling

### 4. Run Tests
```bash
deno test --allow-env --allow-net supabase/functions/__tests__/your-function.test.ts
```

## Running Smoke Tests

Quick test to verify all critical functions work:

```bash
# Test the 4 core functions
deno test --allow-env --allow-net supabase/functions/__tests__/generate-visibility-recommendations.test.ts
deno test --allow-env --allow-net supabase/functions/__tests__/run-prompt-now.test.ts
deno test --allow-env --allow-net supabase/functions/__tests__/llms-generate.test.ts
deno test --allow-env --allow-net supabase/functions/__tests__/diag.test.ts
```

## Coverage Report

Current coverage:
- **Total functions**: 66
- **Functions with tests**: 4
- **Coverage**: ~6%

Target coverage:
- **Priority 1 functions**: 100% (5 functions)
- **Priority 2 functions**: 80% (5 functions)
- **Overall**: 15%+ (10+ functions)

## Next Steps

1. ✅ Core visibility recommendations tested
2. 🟡 Add tests for `bootstrap-auth`
3. 🟡 Add tests for `create-checkout`
4. 🟡 Add tests for `check-subscription`
5. 🟡 Add tests for `daily-batch-trigger`

## Updating This Document

When you add tests for a function:

1. Move function from "Priority Functions Needing Tests" to "Functions with Tests"
2. Update the coverage percentage
3. Check off the item in "Next Steps"
4. Add any learnings or gotchas discovered during testing
