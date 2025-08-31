# ROLLOUT CHECKLIST - Maintenance Branch: maint/audit-cleanup-01

## 🎯 DEPLOYMENT OVERVIEW
**Branch**: `maint/audit-cleanup-01`  
**Type**: Infrastructure improvements + flagged features  
**Risk Level**: LOW (all new features behind disabled flags)  
**Breaking Changes**: NONE  

## 📋 CHANGES SUMMARY

### ✅ Active Changes (Immediate Impact)
- **Enhanced ESLint Configuration**: Added 11 accessibility rules via `eslint-plugin-jsx-a11y`
- **Stricter TypeScript**: Enabled strict mode with `noImplicitAny`, `strictNullChecks`
- **New NPM Scripts**: 8 new scripts for linting, testing, and CI workflows
- **Test Suite**: 6 new test files with comprehensive coverage
- **Observability Framework**: Structured logging for client and edge functions

### 🚩 Flagged Features (Default OFF)
- **Strict Competitor Detection**: Ultra-conservative brand matching (`FEATURE_STRICT_COMPETITORS`)
- **Safe Recommendations Engine**: Heuristics-first daily recommendations (`FEATURE_SAFE_RECO`)
- **Condensed UI**: Compact prompt rows with expand/collapse (`FEATURE_CONDENSED_UI`)
- **Scheduling Notices**: "Next run at 3AM ET" indicators (`FEATURE_SCHEDULING_NOTICES`)

## 🎛️ FEATURE FLAG MANAGEMENT

### Current Flag Status (All Default OFF)
```typescript
FEATURE_SAFE_RECO=false             // Safe recommendations engine
FEATURE_STRICT_COMPETITORS=false    // Conservative competitor detection
FEATURE_ENHANCED_LOGGING=false      // Extended observability
FEATURE_DEBUG_MODE=false            // Development debugging tools
FEATURE_BATCH_OPTIMIZATION=false    // Performance improvements
FEATURE_CONDENSED_UI=false          // Compact prompt interface
FEATURE_SCHEDULING_NOTICES=false    // Scheduling time displays
```

### To Enable Features (Development)
```bash
# Individual feature testing
VITE_FEATURE_CONDENSED_UI=true npm run dev
VITE_FEATURE_SCHEDULING_NOTICES=true npm run dev
VITE_FEATURE_STRICT_COMPETITORS=true npm run dev
VITE_FEATURE_SAFE_RECO=true npm run dev

# Multiple features
VITE_FEATURE_CONDENSED_UI=true VITE_FEATURE_SCHEDULING_NOTICES=true npm run dev
```

### Production Activation
Set environment variables in deployment config:
- Vercel: Project Settings → Environment Variables
- Netlify: Site Settings → Environment Variables
- Custom: Update hosting provider's env config

## 💾 BACKUP & MIGRATION STRATEGY

### Pre-Deployment Backup
```sql
-- Database backup (recommended)
pg_dump -h [host] -U [user] -d [database] > backup_pre_maint_cleanup_01.sql

-- Specific table backups
COPY recommendations TO '/tmp/recommendations_backup.csv' WITH CSV HEADER;
COPY prompts TO '/tmp/prompts_backup.csv' WITH CSV HEADER;
```

### No Schema Changes Required
- ✅ No table modifications
- ✅ No column additions/removals  
- ✅ No index changes
- ✅ No constraint modifications

### Configuration Backup
```bash
# Backup current configs
cp package.json package.json.backup
cp eslint.config.js eslint.config.js.backup
cp tsconfig.json tsconfig.json.backup
```

## 🔄 ROLLBACK PROCEDURES

### Level 1: Feature Flag Rollback (Instant)
```bash
# Disable all new features immediately
VITE_FEATURE_CONDENSED_UI=false
VITE_FEATURE_SCHEDULING_NOTICES=false  
VITE_FEATURE_STRICT_COMPETITORS=false
VITE_FEATURE_SAFE_RECO=false
```

### Level 2: Code Rollback (5 minutes)
1. Checkout previous commit: `git checkout [previous-commit-hash]`
2. Force deploy previous version
3. Verify functionality restored

### Level 3: Full Infrastructure Rollback (10 minutes)
```bash
# Restore original configs
mv package.json.backup package.json
mv eslint.config.js.backup eslint.config.js  
mv tsconfig.json.backup tsconfig.json
npm install
```

### Level 4: Database Rollback (if needed)
```sql
-- Only if data corruption occurs (unlikely)
psql -h [host] -U [user] -d [database] < backup_pre_maint_cleanup_01.sql
```

## 🧪 MANUAL QA CHECKLIST

### Pre-Deployment Validation
- [ ] `npm run ci:quality` passes (lint + type-check)
- [ ] `npm run test` passes with >85% coverage  
- [ ] `npm run build` succeeds (dev + production)
- [ ] All feature flags default to OFF
- [ ] No TypeScript compilation errors

### Page-by-Page Testing

#### 🏠 Dashboard (`/`)
**Baseline (Flags OFF)**
- [ ] Page loads without errors
- [ ] Quick insights display correctly
- [ ] Recent prompts widget functions
- [ ] No new UI elements visible

**With FEATURE_CONDENSED_UI=true**
- [ ] Prompt rows appear in compact format
- [ ] Expand/collapse functionality works
- [ ] All metrics display correctly
- [ ] No layout breaking

**With FEATURE_SCHEDULING_NOTICES=true**
- [ ] "Next run at 3:00 AM ET" notices appear
- [ ] Notices only show for active prompts
- [ ] Time format is correct

#### 📝 Prompts (`/prompts`)
**Baseline (Flags OFF)**
- [ ] Prompt list loads correctly
- [ ] Create/edit prompt functions
- [ ] Filtering and search work
- [ ] Existing UI preserved

**With FEATURE_CONDENSED_UI=true**
- [ ] Condensed prompt rows display
- [ ] Metrics visible in single row
- [ ] Expand shows full details
- [ ] Create prompt still accessible

**With FEATURE_SCHEDULING_NOTICES=true**
- [ ] Scheduling indicators present
- [ ] Time calculations accurate
- [ ] Only active prompts show notices

#### 💡 Recommendations (`/recommendations`)
**Baseline (Flags OFF)**
- [ ] Existing recommendations load
- [ ] Standard recommendation cards display
- [ ] Actions (dismiss/implement) work
- [ ] No additional recommendations appear

**With FEATURE_SAFE_RECO=true**
- [ ] Daily recommendations generate
- [ ] Heuristic-based suggestions appear
- [ ] Implementation steps provided
- [ ] Confidence scores displayed
- [ ] Idempotency: same recs for same day

#### 🏆 Competitors (`/competitors`)
**Baseline (Flags OFF)**
- [ ] Competitor list displays
- [ ] Search and filtering function
- [ ] Competitor details accessible
- [ ] Standard detection active

**With FEATURE_STRICT_COMPETITORS=true**
- [ ] More conservative results
- [ ] Fewer false positives
- [ ] Organization gazetteer respected
- [ ] Stopword filtering aggressive

#### ⚙️ Settings (`/settings`)
**All Scenarios**
- [ ] Settings page loads
- [ ] User preferences save
- [ ] API key management works
- [ ] No regression in functionality

### 🔧 Background Job Testing

#### Daily Batch Processor
**Baseline Testing**
- [ ] Daily scans execute on schedule
- [ ] Visibility calculations complete
- [ ] Results persist correctly
- [ ] No errors in function logs

**With FEATURE_SAFE_RECO=true**
- [ ] Daily recommendations generate
- [ ] Idempotency maintained (no duplicates)
- [ ] Recommendations saved to database
- [ ] Performance within acceptable limits

**With FEATURE_STRICT_COMPETITORS=true**
- [ ] Conservative detection runs
- [ ] Results differ from standard detection
- [ ] No performance degradation
- [ ] Accuracy improved (fewer false positives)

#### Recommendation Generation
**Standard Engine**
- [ ] Weekly recommendations generate
- [ ] LLM-based suggestions function
- [ ] Existing recommendation logic preserved

**Safe Engine (Flagged)**
- [ ] Heuristic recommendations generate
- [ ] Daily caching works correctly
- [ ] No duplicate generation
- [ ] Performance better than LLM version

### 🔍 Observability Testing

#### Structured Logging
**Client-Side Logging**
- [ ] Browser console shows structured logs
- [ ] Session correlation IDs present
- [ ] Performance metrics captured
- [ ] Error context preserved

**Edge Function Logging**
- [ ] Supabase function logs structured
- [ ] Request tracing functional
- [ ] Performance measurements included
- [ ] Error handling improved

### 📊 Performance Validation

#### Bundle Size Analysis
- [ ] Run `npm run build` and check size
- [ ] No significant bundle increase
- [ ] Tree shaking works for flagged features
- [ ] Loading times remain acceptable

#### Runtime Performance
- [ ] Page load times unchanged
- [ ] Memory usage stable
- [ ] No new performance warnings
- [ ] Lighthouse scores maintained

## ⚠️ MONITORING CHECKLIST

### Post-Deployment (0-2 hours)
- [ ] Monitor structured logs for errors
- [ ] Check feature flag activation rates
- [ ] Validate no regression in core metrics
- [ ] Confirm background jobs running

### 24-Hour Monitoring
- [ ] Daily batch processor completed successfully
- [ ] Safe recommendations generated (if enabled)
- [ ] No increase in error rates
- [ ] User experience metrics stable

### 7-Day Validation
- [ ] Weekly recommendation cycle completed
- [ ] Feature flag usage patterns analyzed
- [ ] Performance metrics compared to baseline
- [ ] User feedback collected

## 🚨 EMERGENCY PROCEDURES

### Critical Issues (Immediate Response)
1. **Site Down**: Execute Level 2 rollback (previous commit)
2. **Data Corruption**: Execute Level 4 rollback (database restore)
3. **Performance Degradation**: Disable all feature flags (Level 1)

### Feature-Specific Issues
- **Condensed UI Broken**: `VITE_FEATURE_CONDENSED_UI=false`
- **Recommendation Errors**: `VITE_FEATURE_SAFE_RECO=false`
- **Detection Issues**: `VITE_FEATURE_STRICT_COMPETITORS=false`

### Escalation Contacts
- **Technical Lead**: [Contact Info]
- **DevOps Engineer**: [Contact Info]  
- **Product Owner**: [Contact Info]

## ✅ SIGN-OFF CHECKLIST

### Technical Validation
- [ ] All automated tests pass
- [ ] Manual QA completed for all pages
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Accessibility compliance verified

### Business Approval
- [ ] Product owner approval
- [ ] Stakeholder sign-off
- [ ] Risk assessment approved
- [ ] Rollback plan validated

### Deployment Readiness
- [ ] Deployment window scheduled
- [ ] Team availability confirmed
- [ ] Monitoring alerts configured
- [ ] Communication plan executed

---

**⏰ DEPLOYMENT WINDOW**: [TO BE SCHEDULED]  
**👥 ON-CALL TEAM**: [TO BE ASSIGNED]  
**📞 ESCALATION PATH**: [TO BE DEFINED]

**STATUS**: ⏳ AWAITING HUMAN APPROVAL - DO NOT AUTO-MERGE