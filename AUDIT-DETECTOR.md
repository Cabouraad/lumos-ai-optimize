# Detection System Audit Guide

This guide covers auditing and evaluating the brand/competitor detection system.

## Overview

The detection system has two modes:
- **Current**: Production detection logic using existing algorithms
- **V2 Shadow**: New detection pipeline (v2.ts) that runs alongside for comparison

## Evaluation Script

### Basic Usage

```bash
# Evaluate last 50 runs across all organizations
deno run --allow-all scripts/eval-detection.ts

# Evaluate last 100 runs
deno run --allow-all scripts/eval-detection.ts --runs=100

# Evaluate specific organization
deno run --allow-all scripts/eval-detection.ts --org-id=12345678-1234-1234-1234-123456789012
```

### Output Format

The script outputs CSV data to stdout with these columns:

| Column | Description |
|--------|-------------|
| `runId` | Unique identifier for the AI response run |
| `provider` | AI provider (perplexity, openai, gemini) |
| `orgId` | Organization UUID |
| `currentBrands` | Brands detected by current system |
| `v2Brands` | Brands detected by V2 system |
| `currentCompetitors` | Competitors detected by current system |
| `v2Competitors` | Competitors detected by V2 system |
| `brandAdds` | Number of brands V2 added |
| `brandDrops` | Number of brands V2 removed |
| `competitorAdds` | Number of competitors V2 added |
| `competitorDrops` | Number of competitors V2 removed |
| `textSample` | First 200 chars of AI response (for spot checks) |

### Analysis Examples

```bash
# Save to file for analysis
deno run --allow-all scripts/eval-detection.ts > detection-eval.csv

# Count differences by provider
cat detection-eval.csv | tail -n +2 | cut -d, -f2,8,9,10,11 | sort | uniq -c

# Find runs with high competitor differences
cat detection-eval.csv | awk -F, '$10+$11 > 5 {print $1,$2,$10,$11}'
```

## Shadow Mode Logs

When `FEATURE_DETECTOR_SHADOW` is enabled, the system logs real-time comparison data.

### Log Format

```json
{
  "type": "detection_shadow",
  "timestamp": "2024-01-15T10:30:00Z",
  "context": {
    "provider": "perplexity",
    "promptId": "uuid",
    "runId": "uuid",
    "method": "enhanced-detector"
  },
  "changes": {
    "hasChanges": true,
    "totalChanges": 3,
    "brands": {
      "adds": 1,
      "drops": 0,
      "added": ["HubSpot"],
      "dropped": []
    },
    "competitors": {
      "adds": 2,
      "drops": 0,
      "added": ["Mailchimp", "Buffer"],
      "dropped": []
    }
  },
  "sample": {
    "responseLength": 1524,
    "confidence": 0.85
  }
}
```

### Monitoring Shadow Logs

```bash
# View recent shadow logs from Supabase Edge Functions
supabase functions logs --project-ref=cgocsffxqyhojtyzniyz

# Filter for detection shadow logs
supabase functions logs --project-ref=cgocsffxqyhojtyzniyz | grep "detection_shadow"
```

## Key Metrics to Monitor

### 1. Precision/Recall Changes
- **High competitor adds**: V2 may be over-detecting
- **High competitor drops**: V2 may be under-detecting
- **Brand recognition**: V2 should better identify user's own brand

### 2. Provider Differences
- **Perplexity**: Should handle markdown links and citations better
- **OpenAI/Gemini**: Should have consistent behavior across providers

### 3. False Positive Reduction
- Monitor for generic terms being eliminated: "marketing automation", "customer data"
- Check domain-to-brand mapping: "hubspot.com" → "HubSpot"

## Troubleshooting

### No Results
```bash
# Check if responses exist
deno run --allow-all -e "
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient('https://cgocsffxqyhojtyzniyz.supabase.co', 'ANON_KEY');
const { count } = await supabase.from('prompt_provider_responses').select('*', { count: 'exact', head: true });
console.log('Total responses:', count);
"
```

### Performance Issues
- Reduce `--runs` parameter for faster execution
- Focus on specific org with `--org-id` parameter
- Check for memory usage with large datasets

### Validation
- Spot-check `textSample` column for context
- Verify brand recognition using known test cases
- Compare results across different time periods

## Feature Flags

- `FEATURE_DETECTOR_SHADOW`: Enable shadow mode logging (default: false)
- `FEATURE_STRICT_COMPETITOR_DETECT`: Use strict detection in production

## Test Suite

Run comprehensive detection tests:

```bash
# V2 detection unit tests
npm test src/__tests__/detect.v2.spec.ts

# Integration tests
npm test src/__tests__/competitor-detection.test.ts
```

---

# Original System Architecture

This document maps the complete brand/competitor extraction system, analyzing detection patterns, heuristics, and provider-specific processing quirks.

## Detection Architecture

### Primary Detection Entry Points

1. **Main Analysis Function**: `supabase/functions/analyze-ai-response/index.ts`
   - **Entry**: Lines 118-119 via `extractArtifacts(responseText, orgBrandVariants, competitorGazetteer)`
   - **Flow**: Brand catalog → Gazetteer → Artifact extraction → Validation
   - **Output**: Competitor list filtered against `brand_catalog` only

2. **Enhanced Competitor Detector**: `supabase/functions/_shared/enhanced-competitor-detector.ts`
   - **Entry**: Lines 193-336 via `detectCompetitors(text, orgId, options)`
   - **Flow**: Account gazetteer → Proper noun extraction → Global gazetteer → NER fallback
   - **Output**: Competitors + org brands with confidence scores

3. **Integration Layer**: `supabase/functions/_shared/competitor-detection/integration.ts`
   - **Entry**: Lines 10-33 via `detectCompetitorsWithFallback(text, orgId, supabase)`
   - **Flow**: Feature flag check → Enhanced detector → Fallback handling

### Detection Methods Hierarchy

#### 1. **Strict Detection** (`competitor-detection/strict-detector.ts`)
- **Trigger**: Feature flag `FEATURE_STRICT_COMPETITOR_DETECT` = true
- **Method**: Lines 121-270 - Organization-specific gazetteer matching
- **Validation**: Word boundaries, stopword filtering, business context
- **Sources**: `brand_catalog` + organization metadata + historical responses

#### 2. **Legacy Detection** (`competitor-detection/legacy-detector.ts`)
- **Trigger**: Feature flag disabled OR strict detection yields no results
- **Method**: Lines 37-108 - Regex-based broad extraction
- **Patterns**: Multiple regex patterns for competitor discovery
- **Validation**: Basic length/format checks, minimal filtering

#### 3. **Enhanced Detection** (`enhanced-competitor-detector.ts`)
- **Method**: Lines 341-432 - Proper noun candidate extraction
- **Patterns**:
  - Proper nouns: `/\b[A-Z][a-zA-Z]{1,29}(?:\s+[A-Z][a-zA-Z]+)*\b/g`
  - PascalCase: `/\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b/g`
  - Domains: `/\b([a-zA-Z0-9-]+)\.(com|io|net|org|co|ai)\b/g`

#### 4. **NER Fallback** (`ner-service.ts`)
- **Trigger**: `useNERFallback = true` and unmatched candidates exist
- **Method**: Lines 23-155 - OpenAI-powered organization entity extraction
- **Model**: `gpt-5-nano-2025-08-07`
- **Validation**: Organization-specific stopwords, confidence thresholds

## Provider-Specific Processing

### OpenAI Processing (`lib/providers/openai.ts`)
- **Pre-processing**: None (raw text analysis)
- **Brand Extraction**: System prompt requests JSON output with brands array
- **Fallback Patterns**:
  - Two-word brands: `/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g`
  - Single words: `/\b[A-Z][a-z]{2,}\b/g`
- **Common Word Filter**: 13 generic terms (The, This, Best, etc.)

### Perplexity Processing (`lib/providers/perplexity.ts`)
- **Pre-processing**: None (raw text analysis)
- **Model**: `sonar` (official Perplexity model)
- **Retry Logic**: 3 attempts with exponential backoff
- **Brand Extraction**: Same patterns as OpenAI
- **Error Handling**: Authentication errors bypass retries

### Gemini Processing (`lib/providers/gemini.ts`)
- **Pre-processing**: None identified in current implementation
- **Brand Extraction**: Standardized v2 API
- **Fallback**: Same regex patterns as other providers

## Gazetteer Sources and Hierarchies

### 1. **Account-Level Gazetteer** (Enhanced Detector)
**Source Priority**:
1. `brand_catalog` table (competitors + org brands)
2. Organization name and domain extraction
3. `metadata.competitorsSeed` from organizations table
4. Historical competitors (30-day window, 2+ mentions)

**Build Process** (`enhanced-competitor-detector.ts` Lines 50-188):
```typescript
// 1. Load brand_catalog
const { data: brandCatalog } = await this.supabase
  .from('brand_catalog')
  .select('name, variants_json, is_org_brand')
  .eq('org_id', orgId);

// 2. Generate org brand aliases
this.addOrgBrandAliases(org.name);

// 3. Domain-based brand extraction
const domainBrand = org.domain.split('.')[0];
const domainBrandCapitalized = this.capitalizeProperNoun(domainBrand);
```

### 2. **Global Competitors Gazetteer** (`global-competitors-gazetteer.ts`)
**Entries**: 80+ predefined SaaS/business software competitors
**Categories**: CRM, Email Marketing, SEO, Social Media, etc.
**Structure**:
```typescript
{
  name: 'HubSpot',
  normalized: 'hubspot', 
  category: 'crm',
  aliases: ['hubspot', 'hub spot', 'hubspot crm', 'marketing hub']
}
```

### 3. **Artifact Extraction Gazetteer** (`visibility/extractArtifacts.ts`)
**Source**: Catalog-only approach (Lines 283-311)
**Method**: `createBrandGazetteer(brandCatalog, userIndustry)`
**Constraint**: **No automatic industry/common brand addition** - only explicit catalog entries

## Stopword Lists and Blacklists

### 1. **Comprehensive Stopwords** (`stopwords-blacklist.ts`)

**English Stopwords** (Lines 9-130): 500+ common words
- Articles, prepositions, pronouns
- Common verbs (is, am, are, use, make, etc.)
- Process/action words (making, doing, going, etc.)

**Business Generic Terms** (Lines 135-189):
- Technology: solution, platform, software, system, tool
- Business: marketing, automation, analytics, management
- Marketing: campaign, audience, content, email, social
- Sales: lead, prospect, opportunity, pipeline
- Support: ticket, case, help, service

**Generic Category Phrases** (Lines 194-315):
- "marketing automation", "email platform", "crm software"
- Industry-specific terms
- Action phrases ("click here", "learn more")

### 2. **NER Service Stopwords** (`ner-service.ts` Lines 174-182)
**Organization-specific exclusions**:
- Process words: using, making, while, experience
- Generic business terms: solution, platform, service, system
- Descriptive terms: tool, software, application, business

## Generic Word Misclassification Analysis

### Root Causes for Generic Terms as Competitors

1. **Capitalization-Based False Positives**
   - **Pattern**: Proper noun regex matches sentence-starting words
   - **Examples**: "Using HubSpot..." → "Using" flagged as competitor
   - **Location**: `enhanced-competitor-detector.ts` Lines 347-362

2. **Domain Extraction Artifacts**
   - **Pattern**: URL parsing creates false brand names
   - **Examples**: "customer-data.com" → "Customer Data" as brand
   - **Location**: `enhanced-competitor-detector.ts` Lines 382-397

3. **Insufficient Context Validation**
   - **Pattern**: Business terms in business contexts score high confidence
   - **Examples**: "Choose the best solution" → "Choose", "Solution" as brands
   - **Location**: `visibility/extractArtifacts.ts` Lines 208-265

4. **Stopword Gaps**
   - **Missing Terms**: "entry", "customer data", "choose" not in blacklists
   - **Context**: These appear as proper nouns in AI responses
   - **Files**: Multiple stopword lists have gaps for context-specific terms

### Validation Weaknesses

1. **Proper Noun Validation** (`enhanced-competitor-detector.ts` Lines 410-432)
   ```typescript
   private isProperNounCandidate(candidate: string): boolean {
     // Only checks: length, capitalization, numeric, special chars
     // Missing: semantic context, phrase validation
   }
   ```

2. **Business Context Scoring** (`visibility/extractArtifacts.ts` Lines 219-227)
   ```typescript
   // Boosts confidence for generic terms in business context
   const businessIndicators = [
     'company', 'platform', 'service', 'solution', 'software'
   ];
   ```

## Perplexity-Specific Quirks

### Response Format Patterns
1. **Structured Headers**: Perplexity responses often include markdown headers
2. **Bullet Lists**: Extensive use of `- Item` format
3. **Citations**: `[n]` numerical references throughout text
4. **Anchor Links**: `[text](url)` format for external references
5. **Domain Mentions**: Frequent bare domain names without context

### Processing Implications
- **Header Parsing**: May extract header text as brand names
- **List Item Extraction**: Bullet points could be misidentified as brands
- **Citation Noise**: Numerical citations `[1]`, `[2]` appear in text
- **URL Artifacts**: Domain-only mentions without business context
- **Markdown Remnants**: Formatting artifacts in text processing

### Current Handling
- **Citation Extraction**: `extractArtifacts.ts` Lines 118-137 handles `[n]` patterns
- **URL Processing**: Lines 88-115 extracts and cleans URLs
- **Domain Parsing**: Hostname extraction for better display
- **No Markdown Processing**: Headers and lists processed as raw text

## Heuristics and Regex Patterns

### Brand Detection Patterns

1. **Proper Noun Pattern** (`enhanced-competitor-detector.ts` Line 348)
   ```regex
   /\b[A-Z][a-zA-Z]{1,29}(?:\s+[A-Z][a-zA-Z]+)*\b/g
   ```

2. **PascalCase Pattern** (Line 365)
   ```regex
   /\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b/g
   ```

3. **Domain Pattern** (Line 382)
   ```regex
   /\b([a-zA-Z0-9-]+)\.(com|io|net|org|co|ai)\b/g
   ```

### Citation Patterns (`extractArtifacts.ts`)

1. **Numerical References** (Line 119)
   ```regex
   /\[(\d+)\]/g
   ```

2. **Author References** (Line 120)
   ```regex
   /\[([A-Za-z][A-Za-z\s]{1,30})\]/g
   ```

3. **Year References** (Line 121)
   ```regex
   /\[([A-Za-z]\w*\.?\s*\d{4})\]/g
   ```

### URL Patterns (Line 88)
```regex
/(https?:\/\/(?:www\.)?[^\s)\]<>"']+)/gi
```

## Brand Confidence Scoring

### Confidence Factors (`extractArtifacts.ts` Lines 208-265)

**Positive Indicators** (+0.2 each):
- Business context: company, platform, service, solution, software
- Action words: recommend, use, try, choose, consider, best
- Multiple mentions: +0.05 per additional mention (max +0.2)
- Domain names: +0.1

**Negative Indicators**:
- Example context: for example, such as, e.g., like apple (-0.3)
- Very long names (>25 chars): -0.2

**Base Confidence**: 0.5
**Range**: 0.0 to 1.0
**Threshold**: 0.6 minimum for inclusion

## Data Flow Summary

```
AI Response Text
      ↓
Provider-Specific Processing (minimal)
      ↓
Feature Flag Check (FEATURE_STRICT_COMPETITOR_DETECT)
      ↓
┌─────────────────┬─────────────────┐
│   Strict Mode   │   Legacy Mode   │
├─────────────────┼─────────────────┤
│ Brand Catalog   │ Regex Patterns  │
│ Org Gazetteer   │ Basic Validation│
│ Global Gazetteer│ Minimal Filter  │
│ NER Fallback    │                 │
└─────────────────┴─────────────────┘
      ↓
Confidence Scoring & Validation
      ↓
Stopword Filtering
      ↓
Final Competitor List (max 15)
```

## Critical Issues Identified

1. **Generic Word Inclusion**: Stopword lists have gaps for context-specific terms
2. **Over-Aggressive Proper Noun Matching**: Sentence-starting words misclassified
3. **Insufficient Context Validation**: Business terms score high in business contexts
4. **Perplexity Format Blindness**: No special handling for markdown/citations
5. **Confidence Score Inflation**: Business context words get unwarranted boosts
6. **NER Fallback Noise**: OpenAI extraction may introduce false positives

## Recommendations for Investigation

1. **Audit specific generic terms**: "using", "entry", "customer data", "choose"
2. **Review confidence scoring logic** for business context inflation
3. **Implement Perplexity-specific preprocessing** for markdown/citations
4. **Expand stopword lists** with context-aware validation
5. **Add phrase-level validation** beyond single word checks
6. **Implement semantic context analysis** for proper noun validation