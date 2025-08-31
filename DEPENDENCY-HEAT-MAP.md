# Dependency Heat Map & Risk Analysis

## Environment Variable Risk Matrix

### 🔥🔥🔥 CRITICAL (Application Breaking)
```
┌─────────────────────────────────────────────────────────────────┐
│ SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY                       │
│ Impact: Complete application failure                            │
│ Functions: All 32 edge functions                              │
│ Fallback: None                                                 │
│ Risk: Database access, authentication, core functionality      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ OPENAI_API_KEY                                                 │
│ Impact: Primary AI processing pipeline failure                 │
│ Functions: 15+ functions (analyze-ai-response, run-prompt-now) │
│ Fallback: Perplexity/Gemini (limited)                        │
│ Risk: Core business logic broken                               │
└─────────────────────────────────────────────────────────────────┘
```

### 🔥🔥 HIGH (Major Feature Breaking)
```
┌─────────────────────────────────────────────────────────────────┐
│ STRIPE_SECRET_KEY                                              │
│ Impact: Payment processing, subscription management            │
│ Functions: 5 functions (checkout, portal, subscription check)  │
│ Fallback: Manual subscription management                       │
│ Risk: Revenue loss, customer churn                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PERPLEXITY_API_KEY                                             │
│ Impact: Search-enhanced AI responses                           │
│ Functions: 3 functions (enhanced suggestions, visibility)      │
│ Fallback: OpenAI-only processing                              │
│ Risk: Reduced response quality                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 🔥 MEDIUM (Feature Degradation)
```
┌─────────────────────────────────────────────────────────────────┐
│ GEMINI_API_KEY (+ variants)                                    │
│ Impact: Alternative AI processing                              │
│ Functions: 4 functions (batch processing, recommendations)     │
│ Fallback: OpenAI/Perplexity                                   │
│ Risk: Reduced processing capacity, cost increase               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FIRECRAWL_API_KEY                                              │
│ Impact: LLMs.txt generation functionality                      │
│ Functions: 1 function (llms-generate)                         │
│ Fallback: Manual content creation                              │
│ Risk: Feature unavailable, manual workaround required         │
└─────────────────────────────────────────────────────────────────┘
```

## Bundle Size Heat Map

### 🟥 HEAVY IMPACT (>100KB)
```
Radix UI Ecosystem          ████████████████████ ~400KB
  ├─ Components used: 28/40
  ├─ Tree shaking: ✅ Good
  └─ Optimization: Route-based lazy loading

Recharts                    ████████████ ~180KB  
  ├─ Usage: Dashboard only
  ├─ Tree shaking: ⚠️ Limited
  └─ Optimization: HIGH priority for code splitting

Supabase Client            ██████████ ~180KB
  ├─ Usage: Core application
  ├─ Tree shaking: ✅ Good
  └─ Optimization: Not applicable (essential)

Framer Motion              ████████ ~120KB
  ├─ Usage: Animations throughout
  ├─ Tree shaking: ⚠️ Moderate
  └─ Optimization: Lazy load per component
```

### 🟨 MEDIUM IMPACT (25-100KB)
```
Form Libraries (RHF+Zod)   █████ ~78KB
React + React DOM          █████ ~150KB (essential)
Utility Libraries          ██ ~35KB
Date-fns                   ███ ~45KB
```

### 🟩 LOW IMPACT (<25KB)
```
Lucide React Icons         █ ~15KB (tree-shaken)
Embla Carousel            ██ ~25KB  
Class Utilities           █ ~10KB
Tailwind CSS              ██ ~25KB (purged)
```

## Function-to-Dependency Mapping

### Edge Functions Dependency Matrix
```
                          │ O │ P │ G │ S │ F │ SB│
                          │ A │ E │ E │ T │ I │ PP│
Function                  │ I │ R │ M │ R │ R │ BA│
                          │   │ P │ I │ I │ E │ SE│
──────────────────────────┼───┼───┼───┼───┼───┼───┤
analyze-ai-response       │ ● │   │   │   │   │ ●││
run-prompt-now           │ ● │ ● │ ● │   │   │ ●││  
batch-processor          │ ● │ ● │ ● │   │   │ ●││
enhanced-suggestions     │ ● │ ● │   │   │   │ ●││
llms-generate           │   │   │   │   │ ● │ ●││
create-checkout         │   │   │   │ ● │   │ ●││
check-subscription      │   │   │   │ ● │   │ ●││
customer-portal         │   │   │   │ ● │   │ ●││
brand-enrich            │ ● │   │   │   │   │ ●││
daily-batch-trigger     │   │   │   │   │   │ ●││
fix-brand-classification│   │   │   │   │   │ ●││
delete-account          │   │   │   │ ● │   │ ●││
──────────────────────────┼───┼───┼───┼───┼───┼───┤
Total Functions:         │15 │ 4 │ 3 │ 5 │ 1 │32 │

Legend:
OAI = OPENAI_API_KEY        PER = PERPLEXITY_API_KEY
GEM = GEMINI_API_KEY        STR = STRIPE_SECRET_KEY  
FIR = FIRECRAWL_API_KEY     SBPASE = SUPABASE_*
```

## Risk Cascade Analysis

### Single Points of Failure
```
🔴 SUPABASE Outage Impact:
   ├─ Authentication: Complete failure
   ├─ Data Access: Complete failure  
   ├─ Edge Functions: All 32 functions down
   └─ Recovery Time: Dependent on Supabase SLA

🟠 OPENAI Outage Impact:
   ├─ Core AI Processing: 60% capacity loss
   ├─ Fallback Options: Perplexity + Gemini
   ├─ Affected Functions: 15 functions degraded
   └─ Recovery Time: Immediate (fallback activation)

🟡 STRIPE Outage Impact:
   ├─ New Subscriptions: Blocked
   ├─ Existing Users: Unaffected (cached status)
   ├─ Revenue Impact: High for new signups
   └─ Recovery Time: Manual payment processing
```

### Dependency Redundancy Analysis
```
Service Category     Primary    Secondary   Tertiary   Risk Level
─────────────────   ─────────  ─────────   ────────   ──────────
Database            Supabase   None        None       🔴 Critical
Authentication      Supabase   None        None       🔴 Critical  
AI Processing       OpenAI     Perplexity  Gemini     🟠 Medium
Payments            Stripe     None        Manual     🟠 Medium
Web Scraping        Firecrawl  None        Manual     🟡 Low
```

## Performance Impact Matrix

### Bundle Loading Priority
```
Priority 1 (Critical Path - 0-2s):
├─ React Core (~150KB)
├─ Supabase Client (~180KB)  
├─ Auth Context (~5KB)
└─ Router (~25KB)
   Total: ~360KB ✅ Acceptable

Priority 2 (First Interaction - 2-4s):
├─ UI Components (~200KB subset)
├─ React Query (~45KB)
├─ Form Libraries (~78KB)
└─ Page Components (~50KB)
   Total: ~373KB ✅ Acceptable

Priority 3 (Full Features - 4-8s):
├─ Remaining Radix UI (~200KB)
├─ Recharts (~180KB)
├─ Framer Motion (~120KB)
└─ Utility Libraries (~35KB)
   Total: ~535KB ⚠️ Optimization needed
```

### Network Impact Assessment
```
Connection Type    Critical Path    Full Load    User Impact
─────────────────  ──────────────   ─────────    ───────────
4G/WiFi           <1s              <3s          ✅ Excellent
3G                1-2s             4-6s         ✅ Good  
2G/Slow 3G        3-5s             12-20s       🟠 Poor
Offline           Fail             Fail         🔴 No Support
```

## Optimization Priority Matrix

### High ROI Optimizations (Impact vs Effort)
```
                              High Impact
                                   │
                    Bundle Split   │   Unused Deps
                    (Recharts)     │   Cleanup
                                   │
Low Effort ────────────────────────┼─────────────────── High Effort
                                   │
                    Dependency     │   Component
                    Updates        │   Library Replace
                                   │
                              Low Impact
```

### Implementation Roadmap
```
Week 1-2 (Quick Wins):
├─ Remove unused test dependencies
├─ Update @supabase/supabase-js
├─ Consolidate Gemini API key variants
└─ Add bundle analyzer to CI

Month 1 (Code Splitting):
├─ Split Recharts to dashboard route
├─ Lazy load Framer Motion animations
├─ Implement route-based code splitting  
└─ Add performance budgets

Month 2-3 (Deep Optimization):
├─ Audit Radix UI usage patterns
├─ Consider lighter chart library
├─ Implement service worker caching
└─ Add real-time performance monitoring
```

## Security Risk Heat Map

### API Key Exposure Risk
```
Risk Level    Keys                    Mitigation Strategy
──────────    ──────────────────      ───────────────────
🔴 High       SUPABASE_SERVICE_ROLE   ✅ Edge functions only
🟠 Medium     OPENAI_API_KEY         ✅ Server-side only
🟠 Medium     STRIPE_SECRET_KEY      ✅ Server-side only  
🟡 Low        PERPLEXITY_API_KEY     ✅ Server-side only
🟡 Low        GEMINI_API_KEY         ✅ Server-side only
🟢 None       SUPABASE_ANON_KEY      ✅ Public (intended)
```

This heat map provides visual representation of critical dependencies and optimization opportunities for strategic planning.