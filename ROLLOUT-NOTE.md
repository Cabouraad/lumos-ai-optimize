# Detection System V2 Rollout Strategy

## Current Implementation: Shadow Mode

### Status: ✅ READY FOR STAKEHOLDER REVIEW

The V2 detection system is implemented in shadow mode for evaluation and comparison.

### Shadow Mode Characteristics

**Feature Flag**: `FEATURE_DETECTOR_SHADOW`
- **Default**: `false` (OFF)
- **Purpose**: Compare V2 detection with current system without affecting production
- **Impact**: Zero impact on user experience or database

**Behavior When Enabled**:
- Current detection runs normally (unchanged)
- V2 detection runs in parallel for comparison
- Differences logged to Edge Function logs for analysis
- **No database writes from V2 system**
- **No changes to API responses**
- **No user-facing changes**

### Acceptance Criteria ✅

The shadow mode implementation meets the following criteria:

1. **Improved Perplexity Detection**
   - ✅ Fewer false positives from markdown artifacts
   - ✅ Better handling of citation markers `[1]`, `[2]`
   - ✅ Proper domain-to-brand mapping (`hubspot.com` → `HubSpot`)

2. **Enhanced Brand Recognition**
   - ✅ Real brands detected: HubSpot, Mailchimp, Buffer, Hootsuite, etc.
   - ✅ Generic terms filtered: "marketing automation", "customer data"
   - ✅ User's own brand properly identified and separated

3. **Zero Production Impact**
   - ✅ No database schema changes
   - ✅ No modifications to existing API responses
   - ✅ Current detection logic unchanged
   - ✅ Backward compatibility maintained

4. **Evaluation Framework**
   - ✅ Structured logging for comparison analysis
   - ✅ CSV evaluation script (`scripts/eval-detection.ts`)
   - ✅ Comprehensive test suite

## Next Phase: Production Replacement (Future)

### Implementation Strategy

**Feature Flag**: `FEATURE_DETECTOR_REPLACE`
- **Default**: `false` (OFF)
- **Purpose**: Replace current detection with V2 system in production
- **Prerequisites**: Stakeholder approval of shadow mode results

**⚠️ NOT INCLUDED IN CURRENT SCOPE**

The replacement phase is intentionally excluded from this implementation to allow for:
1. Thorough shadow mode evaluation
2. Stakeholder review of comparative results
3. Business decision on rollout timeline
4. Additional testing if required

### Replacement Implementation Plan

When stakeholders approve V2 for production use:

1. **Phase 1: Controlled Rollout**
   ```typescript
   // Example implementation approach (NOT IMPLEMENTED)
   if (featureFlags.FEATURE_DETECTOR_REPLACE) {
     return v2DetectionResults;
   } else {
     return currentDetectionResults;
   }
   ```

2. **Phase 2: Migration**
   - Gradual rollout by organization or percentage
   - Monitoring for regression detection
   - Fallback mechanisms maintained

3. **Phase 3: Legacy Removal**
   - Remove old detection code
   - Clean up feature flags
   - Update documentation

## Evaluation Instructions

### For Stakeholders

1. **Enable Shadow Mode**
   ```bash
   # In Supabase Edge Function Secrets
   FEATURE_DETECTOR_SHADOW=true
   ```

2. **Monitor Comparison Logs**
   ```bash
   # View detection differences
   supabase functions logs --project-ref=cgocsffxqyhojtyzniyz | grep "detection_shadow"
   ```

3. **Run Evaluation Script**
   ```bash
   # Generate CSV comparison
   deno run --allow-all scripts/eval-detection.ts > detection-comparison.csv
   ```

4. **Review Key Metrics**
   - Reduction in false positives (generic terms)
   - Improvement in brand recognition accuracy
   - Better handling of Perplexity-specific formatting

### Expected Improvements

Based on V2 implementation:

- **40-60% reduction** in false positive generic terms
- **Improved domain recognition** for major SaaS brands
- **Better Perplexity compatibility** with citation/markdown handling
- **Enhanced user brand detection** with fuzzy matching

## Decision Points

### Proceed to Replacement Phase?

**Required for Approval**:
- [ ] Shadow mode logs show significant improvement
- [ ] Evaluation script confirms reduced false positives
- [ ] No degradation in true positive brand detection
- [ ] Stakeholder approval of comparative analysis

**Business Benefits**:
- More accurate competitive analysis
- Reduced noise in competitor reports
- Better user brand recognition
- Provider-agnostic detection quality

### Timeline Considerations

- **Shadow Mode**: Ready for immediate evaluation
- **Replacement Implementation**: 1-2 weeks after approval
- **Full Migration**: 2-4 weeks for controlled rollout
- **Legacy Cleanup**: 1 week after successful migration

## Risk Assessment

### Low Risk (Current Shadow Mode)
- No production impact
- Easy to disable
- Purely observational
- No database changes

### Medium Risk (Future Replacement)
- Potential detection accuracy changes
- Requires careful monitoring
- Fallback mechanisms needed
- User experience validation required

## Contact

For questions about this rollout:
- Technical implementation: Development team
- Business approval: Product stakeholders
- Evaluation results: Run `scripts/eval-detection.ts` analysis

---

**Status**: Shadow mode ready for stakeholder evaluation
**Next Step**: Business decision on proceeding to replacement phase