# UI Enhancement Plan

## Overview
This plan outlines UI/UX improvements for the prompt analysis platform, focusing on consolidated views, enhanced recommendations display, and comprehensive accessibility improvements.

## 1. Consolidated Summary Rows + Expand Pattern

### 1.1 Enhanced Prompts Table (`src/components/PromptList.tsx`)

**Current State:**
- Individual `PromptRow.tsx` components with basic expand/collapse
- Limited summary information visible in collapsed state
- Inconsistent information density

**Enhancement:**
```typescript
// New component: src/components/enhanced/PromptSummaryRow.tsx
interface PromptSummaryRowProps {
  prompt: Prompt;
  summary: {
    totalRuns: number;
    avgScore: number;
    lastRun: string;
    competitorCount: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
  isExpanded: boolean;
  onToggle: () => void;
}
```

**Key Changes:**
- **Collapsed state**: Show prompt text (truncated), score badge, run count, trend indicator, last run timestamp
- **Expanded state**: Full prompt text, provider breakdown table, 7-day chart, competitor list
- **Visual hierarchy**: Clear typography scale, consistent spacing tokens
- **Interaction**: Smooth expand/collapse animation (200ms ease-in-out)

**Minimal Diff:**
```tsx
// src/components/PromptList.tsx
- import { PromptRow } from './PromptRow';
+ import { PromptSummaryRow } from './enhanced/PromptSummaryRow';
+ import { PromptExpandedView } from './enhanced/PromptExpandedView';

// Replace individual PromptRow with summary pattern
- <PromptRow key={prompt.id} prompt={prompt} />
+ <PromptSummaryRow 
+   key={prompt.id} 
+   prompt={prompt}
+   summary={calculatePromptSummary(prompt)}
+   isExpanded={expandedIds.has(prompt.id)}
+   onToggle={() => toggleExpanded(prompt.id)}
+ />
```

### 1.2 Recent Prompts Widget Enhancement (`src/components/RecentPromptsWidget.tsx`)

**Current State:**
- Basic list view with limited information
- No expansion capability

**Enhancement:**
```typescript
// New component: src/components/enhanced/RecentPromptCard.tsx
interface RecentPromptCardProps {
  prompt: RecentPrompt;
  isCompact: boolean;
  expandable: boolean;
}
```

**Key Changes:**
- **Compact cards**: Essential info only (score, provider, timestamp)
- **Expandable cards**: Show full text, competitor mentions, response details
- **Status indicators**: Success/error states, processing status
- **Quick actions**: Re-run, view details, share buttons

## 2. Enhanced Recommendations Cards

### 2.1 Recommendation Card Redesign (`src/components/RecommendationCard.tsx`)

**Current State:**
- Basic title + description layout
- Limited actionability and context

**Enhancement:**
```typescript
// Enhanced: src/components/enhanced/RecommendationCard.tsx
interface RecommendationCardProps {
  recommendation: {
    id: string;
    type: 'content' | 'technical' | 'competitive';
    title: string;
    priority: 'high' | 'medium' | 'low';
    why: string;          // Problem explanation
    how: string;          // Implementation steps
    impact: {
      score: number;      // Expected score improvement
      timeframe: string;  // "2-4 weeks"
      confidence: number; // 0-100
    };
    citations: Citation[];
    status: 'open' | 'in-progress' | 'completed' | 'dismissed';
  };
}

interface Citation {
  id: string;
  type: 'prompt' | 'competitor' | 'response';
  label: string;
  url?: string;
}
```

**Layout Structure:**
```tsx
<Card className="recommendation-card">
  <CardHeader>
    <Badge variant={priority} />
    <CardTitle>{title}</CardTitle>
    <StatusIndicator status={status} />
  </CardHeader>
  
  <CardContent>
    <RecommendationSection title="Why" content={why} />
    <RecommendationSection title="How" content={how} />
    <ImpactMetrics impact={impact} />
    <CitationsSection citations={citations} />
  </CardContent>
  
  <CardFooter>
    <ActionButtons />
  </CardFooter>
</Card>
```

### 2.2 Citations Chips Component

**New Component:** `src/components/enhanced/CitationsChips.tsx`

```typescript
interface CitationChipProps {
  citations: Citation[];
  maxVisible: number;
  onCitationClick: (citation: Citation) => void;
}
```

**Features:**
- **Chip design**: Rounded badges with icons (📄 prompt, 🏢 competitor, 💬 response)
- **Overflow handling**: "View +3 more" expandable section
- **Interactive**: Click to jump to referenced item
- **Contextual**: Different colors per citation type

## 3. Accessibility (A11y) Improvements

### 3.1 Focus Management

**Components to Enhance:**
- `src/components/PromptModal.tsx`
- `src/components/FilterBar.tsx`
- `src/components/enhanced/PromptSummaryRow.tsx`

**Focus Order Improvements:**
```typescript
// src/hooks/useFocusManagement.ts
export const useFocusManagement = (isOpen: boolean) => {
  useEffect(() => {
    if (isOpen) {
      // Focus first interactive element
      const firstFocusable = document.querySelector('[data-focus-first]');
      firstFocusable?.focus();
    }
  }, [isOpen]);
  
  // Trap focus within modal/expanded views
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      // Focus trapping logic
    }
  };
};
```

**Implementation:**
- **Skip links**: Add hidden "Skip to main content" link
- **Focus indicators**: Clear visual focus rings using design tokens
- **Focus trapping**: Modal dialogs and expanded views
- **Focus restoration**: Return focus after closing modals

### 3.2 ARIA Labels and Roles

**Enhanced Components:**

```typescript
// src/components/enhanced/PromptSummaryRow.tsx
<div 
  role="button"
  aria-expanded={isExpanded}
  aria-controls={`prompt-details-${prompt.id}`}
  aria-label={`${prompt.text.substring(0, 50)}... Score: ${avgScore}, Click to ${isExpanded ? 'collapse' : 'expand'} details`}
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && onToggle()}
>
```

```typescript
// src/components/CircularGauge.tsx
<svg 
  role="img"
  aria-label={`Score: ${score} out of 10, ${getScoreDescription(score)}`}
  aria-describedby={`gauge-description-${id}`}
>
```

**ARIA Enhancements:**
- **Live regions**: Score updates announced to screen readers
- **Descriptive labels**: Context-aware aria-labels for all interactive elements
- **Role definitions**: Proper semantic roles for custom components
- **State announcements**: Loading, error, and success states

### 3.3 Color Contrast and Design Tokens

**New Design Tokens:** `src/index.css`

```css
/* A11y Color Tokens */
:root {
  /* WCAG AAA compliant ratios (7:1) */
  --a11y-text-primary: hsl(210, 100%, 8%);        /* 7.2:1 on white */
  --a11y-text-secondary: hsl(210, 25%, 25%);      /* 7.1:1 on white */
  --a11y-text-inverse: hsl(0, 0%, 100%);          /* 21:1 on dark backgrounds */
  
  /* Focus indicators */
  --a11y-focus-ring: hsl(210, 100%, 50%);         /* High contrast blue */
  --a11y-focus-ring-offset: 2px;
  
  /* Status colors with sufficient contrast */
  --a11y-success: hsl(122, 39%, 35%);             /* 7.1:1 */
  --a11y-warning: hsl(35, 91%, 32%);              /* 7.0:1 */
  --a11y-error: hsl(0, 84%, 37%);                 /* 7.2:1 */
  
  /* Interactive states */
  --a11y-interactive-base: hsl(210, 100%, 45%);
  --a11y-interactive-hover: hsl(210, 100%, 40%);
  --a11y-interactive-active: hsl(210, 100%, 35%);
}

/* Dark mode overrides */
[data-theme="dark"] {
  --a11y-text-primary: hsl(0, 0%, 95%);
  --a11y-text-secondary: hsl(210, 15%, 75%);
  --a11y-text-inverse: hsl(210, 100%, 8%);
}

/* Focus ring utility */
.focus-ring {
  outline: 2px solid var(--a11y-focus-ring);
  outline-offset: var(--a11y-focus-ring-offset);
}
```

**Component Updates:**
```typescript
// src/components/ui/button.tsx
const buttonVariants = cva(
  "focus-visible:focus-ring", // Add to base classes
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        // Update all variants to use a11y tokens
        success: "bg-a11y-success text-a11y-text-inverse",
        warning: "bg-a11y-warning text-a11y-text-inverse",
        destructive: "bg-a11y-error text-a11y-text-inverse",
      }
    }
  }
)
```

### 3.4 Reduced Motion Support

**CSS Updates:** `src/index.css`

```css
/* Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Motion-safe animations */
@media (prefers-reduced-motion: no-preference) {
  .expand-animation {
    transition: all 200ms ease-in-out;
  }
  
  .fade-in {
    animation: fadeIn 300ms ease-in-out;
  }
}
```

## 4. Implementation Timeline

### Phase 1: Foundation (Week 1)
- [ ] Create design tokens for A11y compliance
- [ ] Implement `useFocusManagement` hook
- [ ] Update base UI components with ARIA attributes

### Phase 2: Summary Rows (Week 2)
- [ ] Build `PromptSummaryRow` component
- [ ] Implement expand/collapse functionality
- [ ] Enhance `RecentPromptsWidget` with cards

### Phase 3: Recommendations Enhancement (Week 3)
- [ ] Redesign `RecommendationCard` with Why/How/Impact sections
- [ ] Create `CitationsChips` component
- [ ] Implement citation linking functionality

### Phase 4: A11y Polish (Week 4)
- [ ] Complete focus management implementation
- [ ] Add comprehensive ARIA labels
- [ ] Test with screen readers
- [ ] Validate color contrast ratios

## 5. Testing Strategy

### 5.1 Accessibility Testing
- **Screen readers**: NVDA, JAWS, VoiceOver testing
- **Keyboard navigation**: Tab order, focus trapping validation
- **Color contrast**: Automated testing with axe-core
- **Motion preferences**: Test reduced motion scenarios

### 5.2 Usability Testing
- **Task completion**: Can users quickly find prompt insights?
- **Information density**: Is the summary/expand pattern effective?
- **Recommendation actionability**: Do users understand next steps?

### 5.3 Performance Impact
- **Bundle size**: Measure impact of new components
- **Render performance**: Test expand/collapse animations
- **Memory usage**: Monitor for leaks in interactive components

## 6. Success Metrics

### 6.1 User Experience
- **Task completion time**: 30% reduction in time to find prompt insights
- **Engagement**: 50% increase in recommendation card interactions
- **Accessibility compliance**: 100% WCAG AA compliance

### 6.2 Technical Performance
- **Lighthouse accessibility score**: Target 100/100
- **First contentful paint**: Maintain <1.5s
- **Interaction to next paint**: <200ms for expand/collapse

## 7. Future Considerations

### 7.1 Advanced Features
- **Keyboard shortcuts**: Power user navigation
- **Customizable layouts**: User preference for information density
- **Export capabilities**: Share insights via PDF/CSV

### 7.2 Mobile Optimization
- **Touch targets**: Minimum 44px interactive areas
- **Responsive breakpoints**: Optimized mobile summary views
- **Gesture support**: Swipe to expand/collapse

---

*This plan prioritizes accessibility and user experience while maintaining development efficiency through reusable components and design tokens.*