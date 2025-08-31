# Dependency Cleanup Plan

## Executive Summary

This document provides a comprehensive analysis of unused, duplicative, and heavy dependencies in the project. Based on import graph analysis, **5 packages are completely unused** and can be safely removed. Additionally, **1 duplicative toast system** and **3 heavy dependencies** are candidates for optimization.

**Expected Benefits:**
- Bundle size reduction: ~400KB (estimated)
- Reduced dependency surface area
- Improved build times
- Cleaner dependency tree

---

## 🚫 Completely Unused Dependencies

### High Priority - Zero Risk Removals

#### 1. `cmdk` (v1.1.1)
- **Usage:** Only imported in `src/components/ui/command.tsx`
- **Application Usage:** No imports found outside of UI components
- **Evidence:** No references to `Command` component in application code
- **Bundle Impact:** ~45KB
- **Risk:** Zero - component not used anywhere

#### 2. `embla-carousel-react` (v8.6.0)
- **Usage:** Only imported in `src/components/ui/carousel.tsx`
- **Application Usage:** No imports found outside of UI components
- **Evidence:** No references to `Carousel` component in application code
- **Bundle Impact:** ~65KB
- **Risk:** Zero - component not used anywhere

#### 3. `input-otp` (v1.4.2)
- **Usage:** Only imported in `src/components/ui/input-otp.tsx`
- **Application Usage:** No imports found outside of UI components
- **Evidence:** No references to `InputOTP` component in application code
- **Bundle Impact:** ~25KB
- **Risk:** Zero - component not used anywhere

#### 4. `vaul` (v0.9.9)
- **Usage:** Only imported in `src/components/ui/drawer.tsx`
- **Application Usage:** No imports found outside of UI components
- **Evidence:** No references to `Drawer` component in application code
- **Bundle Impact:** ~35KB
- **Risk:** Zero - component not used anywhere

#### 5. `react-day-picker` (v8.10.1)
- **Usage:** Only imported in `src/components/ui/calendar.tsx`
- **Application Usage:** No references to `Calendar` component found (only `Calendar` icon from lucide-react)
- **Evidence:** All `Calendar` references are icon imports, not component usage
- **Bundle Impact:** ~80KB
- **Risk:** Zero - component not used anywhere

---

## ⚠️ Conflicting/Duplicative Dependencies

### Medium Priority - Requires Validation

#### 1. `sonner` vs Custom Toast System (v1.7.4)
- **Current State:** Dual toast systems in use
  - **Sonner:** Used in 8 files (`BatchPromptRunner`, `BrandClassificationStatus`, etc.)
  - **Custom Toast:** Used in 20+ files via `@/hooks/use-toast`
- **Evidence:**
  ```typescript
  // Mixed usage patterns:
  import { toast } from 'sonner';           // 8 files
  import { useToast } from '@/hooks/use-toast'; // 20+ files
  ```
- **Bundle Impact:** ~30KB (sonner) + complexity overhead
- **Risk:** Medium - requires migration plan
- **Recommendation:** Standardize on one system (prefer custom toast for consistency)

---

## 📦 Heavy Dependencies - Optimization Candidates

### 1. `recharts` (v2.15.4) - **KEEP**
- **Usage:** Active in 5 files (charts, dashboard, analytics)
- **Bundle Impact:** ~180KB
- **Optimization:** Implement lazy loading for chart components
- **Status:** Essential for data visualization

### 2. `framer-motion` (v12.23.12) - **OPTIMIZE**
- **Usage:** Only in `RecentPromptsWidget.tsx` for simple animations
- **Bundle Impact:** ~120KB
- **Evidence:** Only 3 imports used: `motion`, `AnimatePresence`
- **Optimization:** Replace with CSS animations or lightweight alternative
- **Status:** Heavy for minimal animation needs

### 3. `@radix-ui/*` (Multiple packages) - **AUDIT**
- **Bundle Impact:** ~300KB combined
- **Usage:** Mixed - some heavily used, others minimal
- **Optimization:** Audit individual Radix packages for actual usage
- **Status:** Core to design system but may have unused components

---

## 🧪 Development Dependencies - Low Priority

### Testing Libraries
- `@testing-library/jest-dom` (v6.6.4) - **KEEP** (essential)
- `@testing-library/react` (v16.3.0) - **KEEP** (essential)
- `@vitest/coverage-v8` (v3.2.4) - **KEEP** (testing coverage)
- `@vitest/ui` (v3.2.4) - **EVALUATE** (dev convenience)

### Build Tools
- `tsx` (v4.20.4) - **KEEP** (essential for TS execution)
- `jsdom` (v26.1.0) - **KEEP** (testing environment)

---

## 🚀 Implementation Plan

### Phase 1: Zero-Risk Removals (Immediate)
```bash
# Remove completely unused UI components and their dependencies
npm uninstall cmdk embla-carousel-react input-otp vaul react-day-picker

# Remove corresponding UI component files
rm src/components/ui/command.tsx
rm src/components/ui/carousel.tsx  
rm src/components/ui/input-otp.tsx
rm src/components/ui/drawer.tsx
rm src/components/ui/calendar.tsx
```

### Phase 2: Toast System Consolidation (Week 1)
```bash
# Step 1: Audit sonner usage
grep -r "from 'sonner'" src/

# Step 2: Create migration script to replace sonner with custom toast
# Step 3: Test all toast notifications
# Step 4: Remove sonner
npm uninstall sonner
rm src/components/ui/sonner.tsx
```

### Phase 3: Bundle Optimization (Week 2)
```bash
# Analyze framer-motion usage
npm run build -- --analyze

# Replace framer-motion with CSS animations or lighter alternative
# Implement lazy loading for recharts components
```

---

## 📋 PR-Ready Commands

### Immediate Execution (Phase 1)
```bash
#!/bin/bash
# DEPS-CLEAN-PHASE1.sh

set -e

echo "🧹 Phase 1: Removing unused dependencies..."

# Remove unused npm packages
npm uninstall cmdk embla-carousel-react input-otp vaul react-day-picker

# Remove unused UI component files
rm -f src/components/ui/command.tsx
rm -f src/components/ui/carousel.tsx
rm -f src/components/ui/input-otp.tsx  
rm -f src/components/ui/drawer.tsx
rm -f src/components/ui/calendar.tsx

echo "✅ Phase 1 complete. Bundle size should be reduced by ~250KB"
echo "🔄 Run tests: npm test"
echo "🔍 Verify build: npm run build"
```

### Rollback Script
```bash
#!/bin/bash
# DEPS-CLEAN-ROLLBACK.sh

set -e

echo "🔄 Rolling back dependency cleanup..."

# Reinstall packages
npm install cmdk@^1.1.1 embla-carousel-react@^8.6.0 input-otp@^1.4.2 vaul@^0.9.9 react-day-picker@^8.10.1

# Restore UI component files from git
git checkout HEAD -- src/components/ui/command.tsx
git checkout HEAD -- src/components/ui/carousel.tsx
git checkout HEAD -- src/components/ui/input-otp.tsx
git checkout HEAD -- src/components/ui/drawer.tsx
git checkout HEAD -- src/components/ui/calendar.tsx

echo "✅ Rollback complete"
```

---

## 🔍 Validation Checklist

### Pre-Cleanup
- [ ] Run full test suite: `npm test`
- [ ] Verify build: `npm run build`
- [ ] Check bundle size: `npm run build -- --analyze`
- [ ] Document current dependency tree: `npm ls`

### Post-Cleanup  
- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] UI components render correctly
- [ ] No broken imports or missing dependencies
- [ ] Bundle size reduced as expected

### Verification Commands
```bash
# Check for any remaining references to removed packages
grep -r "cmdk\|embla-carousel\|input-otp\|vaul\|react-day-picker" src/ || echo "✅ Clean"

# Verify no broken imports
npm run type-check

# Test critical user flows
npm run test:e2e
```

---

## 📊 Expected Impact

### Bundle Size Reduction
- **Immediate (Phase 1):** ~250KB reduction
- **Phase 2 (Toast consolidation):** ~30KB reduction  
- **Phase 3 (Optimization):** ~50-100KB reduction
- **Total Estimated:** ~330-380KB reduction

### Performance Gains
- Faster initial page load
- Reduced JavaScript parsing time
- Smaller vendor bundle chunks
- Improved Lighthouse scores

### Maintenance Benefits
- Fewer security vulnerabilities to monitor
- Simpler dependency updates
- Reduced build complexity
- Cleaner `package.json`

---

## 🎯 Success Metrics

### Technical Metrics
- Bundle size reduction: Target 300KB+ reduction
- Build time improvement: Target 10%+ faster
- Dependency count reduction: 5 packages removed
- Zero broken functionality

### Quality Metrics  
- All tests pass post-cleanup
- No accessibility regressions
- UI/UX remains unchanged
- Performance scores maintained or improved

---

## ⚠️ Risk Assessment

### Low Risk (Phase 1)
- **Unused UI components:** Zero application impact
- **Easy rollback:** Simple git revert + npm install

### Medium Risk (Phase 2)  
- **Toast system migration:** Requires careful testing
- **User-facing impact:** Notification behavior changes

### High Risk (Phase 3)
- **Animation replacement:** Visual regression potential
- **Chart lazy loading:** Complex implementation

---

## 📅 Timeline

| Phase | Duration | Effort | Risk |
|-------|----------|--------|------|
| Phase 1: Unused deps | 1 day | Low | Low |
| Phase 2: Toast consolidation | 3-5 days | Medium | Medium |  
| Phase 3: Bundle optimization | 1-2 weeks | High | Medium |

**Total Timeline:** 2-3 weeks for complete dependency cleanup and optimization.