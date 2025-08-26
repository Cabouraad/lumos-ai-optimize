# Llumos Optimization & Simplification Plan

## Priority 1: Immediate Removals (High Impact, Low Risk)

### 1. Remove Over-Engineered Libraries
- [ ] Delete `src/lib/ml-enhancement/brand-learning.ts` (246 lines - unused)
- [ ] Delete `src/lib/advanced-cache/redis-cache.ts` (193 lines - over-complex)
- [ ] Delete `src/lib/background-optimization/data-preloader.ts` (352 lines - unnecessary)
- [ ] Simplify `src/lib/data/unified-fetcher.ts` (remove advanced caching)

### 2. Merge Redundant Edge Functions
```bash
# Merge these function pairs:
mv supabase/functions/analyze-ai-response/* supabase/functions/test-single-provider/
mv supabase/functions/enhanced-prompt-suggestions/* supabase/functions/suggest-prompts-now/
mv supabase/functions/intelligent-recommendations/* supabase/functions/generate-recommendations/

# Delete merged sources
rm -rf supabase/functions/analyze-ai-response/
rm -rf supabase/functions/enhanced-prompt-suggestions/
rm -rf supabase/functions/intelligent-recommendations/
```

### 3. Database Cleanup
```sql
-- Remove unused triggers and functions
DROP FUNCTION IF EXISTS update_batch_job_progress() CASCADE;
DROP FUNCTION IF EXISTS update_batch_updated_at() CASCADE;
DROP TABLE IF EXISTS batch_jobs CASCADE;
DROP TABLE IF EXISTS batch_tasks CASCADE;

-- Simplify recommendations table
ALTER TABLE recommendations DROP COLUMN IF EXISTS prompt_ref;
ALTER TABLE recommendations ALTER COLUMN metadata TYPE jsonb USING '{}';
```

## Priority 2: Architecture Simplification (Medium Impact, Medium Risk)

### 1. Simplify Authentication Context
```typescript
// BEFORE: One complex context
AuthContext: {
  user, session, loading, orgData, subscriptionData, 
  checkSubscription, signOut
}

// AFTER: Three focused contexts
AuthContext: { user, session, signOut }
OrgContext: { orgData, loading }
SubscriptionContext: { subscriptionData, checkSubscription }
```

### 2. Unify Data Fetching Pattern
```typescript
// BEFORE: Multiple patterns
- getUnifiedDashboardData()
- getUnifiedPromptData() 
- Custom fetchers per page

// AFTER: Single pattern
- useQuery() hooks for everything
- Remove "unified" fetchers
```

### 3. Simplify Subscription Logic
```typescript
// BEFORE: Multiple subscription hooks
- useSubscriptionGate()
- canAccessRecommendations()
- canAccessCompetitorAnalysis()

// AFTER: Single hook
- useSubscription() with feature flags
```

## Priority 3: Performance Optimizations (Low Impact, Low Risk)

### 1. Bundle Size Reduction
- [ ] Remove unused dependencies
- [ ] Implement proper code splitting
- [ ] Optimize component lazy loading

### 2. Database Query Optimization
- [ ] Review and optimize N+1 queries
- [ ] Add missing indexes for common queries
- [ ] Simplify complex joins

## Metrics & Validation

### Before Optimization
- **Bundle Size**: ~2.1MB (estimated)
- **Edge Functions**: 27 functions
- **Database Tables**: 12 active tables
- **Component Count**: ~85 components
- **Lines of Code**: ~15,000+ lines

### After Optimization (Projected)
- **Bundle Size**: ~1.4MB (-33%)
- **Edge Functions**: 12 functions (-56%)
- **Database Tables**: 8 active tables (-33%)
- **Component Count**: ~65 components (-24%)
- **Lines of Code**: ~8,500 lines (-43%)

### Success Criteria
- [ ] Page load time < 2s (currently ~3-4s)
- [ ] Function cold start < 500ms
- [ ] Database query time < 100ms average
- [ ] Build time < 30s (currently ~45s)

## Implementation Timeline

### Week 1: Code Removal
- Remove unused libraries and functions
- Database cleanup migrations
- Update imports and dependencies

### Week 2: Architecture Refactoring
- Split contexts
- Unify data fetching
- Simplify subscription logic

### Week 3: Testing & Validation
- Comprehensive testing
- Performance benchmarking
- User acceptance testing

### Week 4: Deployment & Monitoring
- Staged rollout
- Performance monitoring
- Bug fixes and adjustments

## Risk Mitigation

### High Risk Items
- Database migrations (backup before changes)
- Authentication context changes (test thoroughly)
- Edge function merging (maintain API contracts)

### Low Risk Items
- Removing unused code (can be reverted easily)
- Performance optimizations (gradual implementation)
- UI component simplification (visible changes)