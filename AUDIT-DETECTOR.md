# Brand/Competitor Detection System Audit

## Overview
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