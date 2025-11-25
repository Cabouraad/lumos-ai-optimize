# Edge Functions Consolidation Plan

## Current State: 82 Edge Functions ❌

**Goal**: Reduce to ~20-25 functions without any functional changes

---

## Phase 1: Safe Deletions (Zero Risk)

### 1.1 Deprecated Functions (DELETE)
- ✅ `daily-scheduler-deprecated` - Already replaced by `daily-batch-trigger`

### 1.2 Test/Debug Functions (KEEP in dev, document for removal in prod)
- `test-analysis-fixes`
- `test-ca-calculation`
- `test-prompt-response`
- `test-single-provider`
- `run-tests`
- `diag` (keep - useful for support)

### 1.3 One-Time Migration Functions (DELETE if completed)
- `fix-org-brand-misclassification`
- `fix-prompt-classification`
- `fix-brand-classification-all-providers`
- `fix-hubspot-brand-classification`
- `fix-recent-brand-misclassifications`
- `backfill-weekly-reports`

---

## Phase 2: Consolidate Duplicates (Low Risk)

### 2.1 Subscription Checking (3 → 1)
**Current**: 
- `check-subscription`
- `check-subscription-scheduled` 
- `daily-subscription-checker`

**Consolidate to**: `subscription-manager`
```typescript
// Single function with mode parameter
POST /subscription-manager { mode: 'check' | 'schedule' | 'daily' }
```

### 2.2 Checkout Functions (3 → 1)
**Current**:
- `create-checkout`
- `create-trial-checkout`
- `create-bf-checkout`

**Consolidate to**: `checkout`
```typescript
POST /checkout { 
  type: 'subscription' | 'trial' | 'black-friday',
  priceId: string 
}
```

### 2.3 Manual Trigger Functions (5 → 1)
**Current**:
- `manual-daily-run`
- `manual-prompt-trigger`
- `manual-recovery-trigger`
- `admin-batch-trigger`
- `trigger-all-orgs-batch`

**Consolidate to**: `admin-trigger`
```typescript
POST /admin-trigger { 
  action: 'daily' | 'prompt' | 'recovery' | 'batch' | 'all-orgs'
}
```

### 2.4 Access Control (3 → 1)
**Current**:
- `grant-starter-bypass`
- `remove-bypass`
- `remove-test-access`

**Consolidate to**: `access-control`
```typescript
POST /access-control { 
  action: 'grant-bypass' | 'remove-bypass' | 'remove-test'
}
```

---

## Phase 3: Domain-Based Grouping (Medium Risk)

### 3.1 Scheduler Functions → `scheduler`
Combine all scheduler-related functions into one with path routing:
- `daily-batch-trigger`
- `scheduler-postcheck`
- `scheduler-recovery`
- `scheduler-diagnostics`
- `schedule-dry-run`

### 3.2 Batch Processing → `batch-processor`
- `robust-batch-processor`
- `batch-reconciler`
- `batch-health-check`
- `process-optimization-jobs`

### 3.3 Recommendations → `recommendations`
- `generate-recommendations`
- `advanced-recommendations`
- `intelligent-recommendations`
- `enhanced-prompt-suggestions`
- `reco-refresh`

### 3.4 Reports → `reports`
- `generate-weekly-report`
- `weekly-report`
- `weekly-report-scheduler`
- `reports-sign`
- `backfill-weekly-reports`

### 3.5 Competitor Management → `competitors`
- `sync-competitor-detection`
- `trigger-competitor-sync`
- `convert-competitor-to-brand`

### 3.6 Analysis → `analysis`
- `analyze-ai-response`
- `citation-mention`
- `diagnose-citations`
- `validate-citations`

---

## Phase 4: Keep Separate (No Change)

These should remain independent:
- ✅ `onboarding` - Critical user flow
- ✅ `run-prompt-now` - Core feature
- ✅ `llms-generate` - Standalone utility
- ✅ `stripe-webhook` - Webhook handler
- ✅ `delete-account` - Security-sensitive
- ✅ `customer-portal` - Stripe integration
- ✅ `verify-domain` - Standalone utility
- ✅ `free-visibility-checker` - Public endpoint
- ✅ `request-visibility-report` - Lead generation
- ✅ `invite-user` - Team management
- ✅ `remove-user` - Team management
- ✅ `send-support-email` - Support
- ✅ `ensure-user-record` - Auth flow
- ✅ `bootstrap-auth` - Auth webhook

---

## Implementation Strategy

### Week 1: Safe Deletions
- Delete `daily-scheduler-deprecated`
- Document test functions for eventual removal
- Delete completed migration functions

### Week 2-3: Duplicate Consolidation
- Subscription checking (3 → 1)
- Checkout functions (3 → 1)
- Manual triggers (5 → 1)
- Access control (3 → 1)

### Week 4-6: Domain Grouping
- Start with lowest-risk domain (reports)
- Use feature flags for gradual rollout
- Monitor error rates closely

### Week 7-8: Testing & Cleanup
- Comprehensive testing of all consolidated functions
- Remove old functions after 1 week of monitoring
- Update documentation

---

## Expected Outcome

**Before**: 82 functions
**After**: ~22 functions

| Category | Before | After | Savings |
|----------|--------|-------|---------|
| Deprecated/Test | 15 | 0 | -15 |
| Duplicates | 14 | 4 | -10 |
| Domain Groups | 35 | 6 | -29 |
| Keep Separate | 18 | 18 | 0 |
| **TOTAL** | **82** | **22** | **-60** |

---

## Risk Mitigation

1. **Feature Flags**: Roll out gradually per org
2. **Dual Running**: Keep old functions for 1 week during transition
3. **Monitoring**: Track error rates for each consolidated function
4. **Rollback Plan**: Keep old functions disabled but deployable
5. **Testing**: Comprehensive E2E tests before consolidation

---

## Next Steps

1. User approval of consolidation plan
2. Start with Phase 1 (Safe Deletions)
3. Implement Phase 2 one function at a time
4. Monitor and iterate
