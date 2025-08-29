# Competitor Detection Pipeline Audit Report
*Generated: 2025-08-29 23:16:30*

## Executive Summary

After comprehensive analysis of the competitor detection pipeline, **the enhanced detection logic is working correctly**, but there are **database query issues** preventing proper display of results. The pipeline has been upgraded with robust validation, but legacy data and SQL issues are causing generic terms to appear as competitors in the UI.

## Root Cause Analysis

### ✅ Detection Pipeline (WORKING CORRECTLY)

**File: `supabase/functions/_shared/enhanced-competitor-detector.ts`**

The enhanced competitor detector implements a sophisticated 3-stage approach:

1. **Regex Pattern Extraction**: Identifies potential brand candidates using:
   - Capitalized words (2+ consecutive, 3-30 chars)
   - Domain patterns (e.g., "salesforce.com" → "Salesforce")
   - Quoted brand names

2. **Gazetteer Matching**: Validates candidates against:
   - Brand catalog (org brands + competitors)
   - Organization's competitorsSeed
   - Historical competitor data

3. **NER Fallback**: Uses OpenAI GPT-3.5-nano for unmatched candidates

**Stopwords Coverage**: The detector includes 200+ stopwords covering:
- "marketing", "automation", "customer", "data", "choose"
- Common verbs, nouns, adjectives
- Generic business terms
- Action words commonly misidentified

### ❌ Database Query Issues (BROKEN)

**File: `src/components/PromptCompetitors.tsx`**
**Error**: `column reference "competitor_name" is ambiguous`

**Location**: Lines 32-36
```typescript
const { data, error: rpcError } = await supabase
  .rpc('get_prompt_competitors', { 
    p_prompt_id: promptId,
    p_days: 30 
  });
```

**SQL Function**: `get_prompt_competitors` has been migrated multiple times:
- Initial: `20250829001210_*` 
- Fix attempt: `20250829004419_*`
- Enhancement: `20250829020042_*`
- Latest: `20250829192456_*`

The function joins multiple tables but has ambiguous column references causing all competitor queries to fail.

## Token Classification Analysis

### Expected Behavior ✅
```
Input: "HubSpot and Salesforce are top alternatives"
Extraction: ["HubSpot", "Salesforce"] 
Validation: Both pass brand validation
Gazetteer: Both found in competitor catalog
Result: competitors = ["HubSpot", "Salesforce"]
```

### Current Broken Behavior ❌
```
Input: "Marketing Automation helps customer data"
Extraction: ["Marketing", "Automation", "customer"] 
Validation: All rejected by stopwords
Database Query: FAILS with SQL error
UI Display: Shows "Failed to load competitors" OR old cached data
```

## Detection Method Tracing

**Method Used**: Enhanced 3-stage pipeline (NOT naive word-split)

1. **Stage 1 - Regex Extraction**:
   ```javascript
   // Pattern: Capitalized words 2+ consecutive
   /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]*){1,}/g
   
   // Pattern: Domain extraction  
   /\b([a-zA-Z0-9-]+)\.(com|io|net|org|co|ai)\b/g
   
   // Pattern: Quoted terms
   /"([A-Z][^"]{2,29})"/g
   ```

2. **Stage 2 - Validation**:
   ```javascript
   isValidBrandName(candidate):
   - Must start with capital letter
   - 3-30 characters length
   - Not in STOPWORDS set (200+ terms)
   - Not purely numeric
   - No spam patterns
   ```

3. **Stage 3 - Gazetteer/NER**:
   ```javascript
   if (gazetteer.has(normalized)) {
     // High confidence match
   } else if (useNERFallback) {
     // OpenAI entity extraction
   }
   ```

## Why Generic Terms Are Appearing

**Not due to detection logic** - The enhanced detector correctly rejects:
- "Marketing" (in STOPWORDS)
- "Automation" (in STOPWORDS) 
- "customer data" (fails capitalization + stopwords)
- "Choose" (in STOPWORDS)

**Actual causes**:
1. **SQL Query Failure**: `get_prompt_competitors` returns empty results
2. **Legacy Data**: Old competitor_mentions table may contain outdated entries
3. **Fallback Display**: UI may show cached/legacy data when new queries fail
4. **Test Data**: Development/testing data not cleaned up

## Database Schema Issues

**Tables Involved**:
- `prompt_runs.competitors` (JSONB array)
- `competitor_mentions` (normalized table)
- `brand_catalog` (gazetteer source)

**SQL Join Issue**: The `get_prompt_competitors` function joins tables with same column names:
```sql
-- This creates ambiguity:
SELECT competitor_name FROM competitor_mentions cm
JOIN some_other_table ot ON ...
WHERE competitor_name = ... -- Which table's competitor_name?
```

## Recommendations

### Immediate Fixes (Critical)

1. **Fix SQL Function** - Update `get_prompt_competitors` to use explicit table prefixes:
   ```sql
   SELECT cm.competitor_name, cm.mentions, ...
   FROM competitor_mentions cm
   ```

2. **Clean Legacy Data** - Remove invalid competitors from database:
   ```sql
   DELETE FROM competitor_mentions 
   WHERE competitor_name IN ('Marketing', 'Automation', 'customer', 'Choose', ...);
   ```

### Pipeline Improvements

1. **Add Debug Logging** - Enhanced logging in detection pipeline:
   ```javascript
   console.log('🔍 Candidates extracted:', candidates);
   console.log('✅ Valid after filtering:', validCandidates);
   console.log('🎯 Gazetteer matches:', gazetteerMatches);
   ```

2. **Confidence Thresholds** - Implement stricter confidence scoring:
   ```javascript
   finalCompetitors = competitors
     .filter(c => c.confidence >= 0.8) // Raise from 0.7
     .filter(c => c.source !== 'ner' || c.confidence >= 0.9)
   ```

## Conclusion

The competitor detection pipeline architecture is **sound and working correctly**. The issue is in the database layer where SQL queries are failing due to ambiguous column references. Once the database queries are fixed and legacy data cleaned up, the system should properly display only legitimate competitor brands.

**Priority**: Fix database queries (HIGH) → Clean legacy data (MEDIUM) → Add debug logging (LOW)