/**
 * V2 Brand Response Analyzer
 * Enhanced analyzer with 4-stage pipeline, per-org isolation, and improved accuracy
 */

import { normalizeBrandName, isValidBrandName } from './normalizer.ts';
import { getOrgOverlay as fetchOrgOverlay, getCrossProviderConsensus } from './org-overlay.ts';
import stopwords from './stopwords.json';
import brandCues from './brand_cues.json';
import automotiveMarketplaces from './automotive_marketplaces.json';

export interface AnalyzerV2Result {
  org_brand_present: boolean;
  org_brand_prominence: number | null;
  competitors_json: string[];
  brands_json: string[];
  score: number;
  metadata: {
    org_brands_found: string[];
    catalog_competitors: number;
    global_competitors: number;
    discovered_competitors: number;
    ner_organizations: string[];
    analysis_method: 'v2_enhanced';
    confidence_score: number;
    analysis_hash?: string;
    ruleset_version: 'v2';
    processing_time_ms?: number;
    pipeline_stages: {
      candidates_extracted: number;
      candidates_normalized: number;
      candidates_filtered: number;
      final_classified: number;
    };
    consensus_boost_applied?: boolean;
  };
}

export interface OrgOverlay {
  org_id: string;
  competitor_overrides: string[]; // Manual competitor additions
  competitor_exclusions: string[]; // Manual competitor removals
  brand_variants: string[]; // Additional org brand variants
}

export interface AnalyzerV2Context {
  orgData: {
    name: string;
    domain?: string;
    keywords?: string[];
    competitors?: string[];
    products_services?: string[];
  };
  brandCatalog: Array<{
    name: string;
    is_org_brand: boolean;
    variants_json?: string[];
  }>;
  orgOverlay?: OrgOverlay;
  crossProviderContext?: {
    prompt_id: string;
    recent_competitors: string[];
  };
}

// Per-org cache for function lifetime only
const orgOverlayCache = new Map<string, OrgOverlay>();

/**
 * Main V2 Analysis Function
 * Implements 4-stage pipeline with per-org isolation
 */
export async function analyzeResponseV2(
  responseText: string,
  context: AnalyzerV2Context
): Promise<AnalyzerV2Result> {
  const startTime = performance.now();
  console.log('🔍 Starting V2 brand analysis...');

  // Fetch org overlay and cross-provider context if not provided
  const orgOverlay = context.orgOverlay || await fetchOrgOverlay(context.orgData.name);
  const crossProviderContext = context.crossProviderContext || {
    prompt_id: 'unknown',
    recent_competitors: []
  };

  // Update context with fetched data
  const enhancedContext = {
    ...context,
    orgOverlay,
    crossProviderContext
  };

  // Stage 1: Extract candidates
  const candidates = extractCandidates(responseText);
  console.log(`📋 Stage 1: Extracted ${candidates.length} candidates`);

  // Stage 2: Normalize candidates  
  const normalized = normalizeCandidates(candidates);
  console.log(`🔧 Stage 2: Normalized to ${normalized.length} candidates`);

  // Stage 3: Filter candidates
  const filtered = filterCandidates(normalized, responseText);
  console.log(`🎯 Stage 3: Filtered to ${filtered.length} candidates`);

  // Stage 4: Classify and score
  const classified = await classifyAndScore(
    filtered,
    enhancedContext.orgData,
    enhancedContext.brandCatalog,
    enhancedContext.orgOverlay,
    enhancedContext.crossProviderContext
  );
  console.log(`✅ Stage 4: Final classification complete`);

  const processingTime = performance.now() - startTime;

  // Build result in same format as v1
  const result: AnalyzerV2Result = {
    org_brand_present: classified.orgBrands.length > 0,
    org_brand_prominence: classified.orgBrands.length > 0 
      ? calculateProminence(responseText, classified.orgBrands)
      : null,
    competitors_json: classified.competitors,
    brands_json: classified.orgBrands,
    score: calculateVisibilityScore(
      classified.orgBrands.length > 0,
      classified.orgBrands.length > 0 ? calculateProminence(responseText, classified.orgBrands) : null,
      classified.competitors.length,
      responseText.length
    ),
    metadata: {
      org_brands_found: classified.orgBrands,
      catalog_competitors: classified.catalogMatches,
      global_competitors: classified.industryMatches,
      discovered_competitors: classified.discoveredMatches,
      ner_organizations: classified.competitors, // For backward compatibility
      analysis_method: 'v2_enhanced',
      confidence_score: classified.confidence,
      analysis_hash: generateAnalysisHash(responseText, classified.orgBrands, classified.competitors),
      ruleset_version: 'v2',
      processing_time_ms: Math.round(processingTime),
      pipeline_stages: {
        candidates_extracted: candidates.length,
        candidates_normalized: normalized.length,
        candidates_filtered: filtered.length,
        final_classified: classified.competitors.length + classified.orgBrands.length
      },
      consensus_boost_applied: classified.consensusBoostApplied
    }
  };

  console.log(`🎯 V2 Analysis complete: ${result.org_brand_present ? 'Brand found' : 'No brand'}, ${result.competitors_json.length} competitors, score: ${result.score}`);
  return result;
}

/**
 * Stage 1: Extract Candidates
 * Uses token shape, patterns, and citations
 */
function extractCandidates(text: string): string[] {
  const candidates = new Set<string>();

  // Pattern 1: Competitive context patterns
  const competitivePatterns = [
    /(?:vs|versus|compared to|alternative to|similar to|like|including|such as|alternatives|competitors|options)\s+([A-Z][a-zA-Z0-9\s&.-]{2,30})/gi,
    /([A-Z][a-zA-Z0-9\s&.-]{2,30})\s+(?:vs|versus|compared to|alternative)/gi,
    /(?:instead of|rather than|better than|unlike)\s+([A-Z][a-zA-Z0-9\s&.-]{2,30})/gi
  ];

  for (const pattern of competitivePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        candidates.add(match[1].trim());
      }
    }
  }

  // Pattern 2: Quoted text from citations
  const quotedPattern = /"([A-Z][a-zA-Z0-9\s&.-]{2,30})"/g;
  const quotedMatches = text.matchAll(quotedPattern);
  for (const match of quotedMatches) {
    if (match[1] && !isGenericQuote(match[1])) {
      candidates.add(match[1].trim());
    }
  }

  // Pattern 3: Title case proper nouns with business indicators
  const businessPattern = /\b([A-Z][a-zA-Z0-9]{1,20}(?:\s+[A-Z][a-zA-Z0-9]{1,20}){0,3})\s+(?:offers|provides|specializes|focuses|develops|platform|software|tool|service|solution|company|marketplace|app|website|system)/gi;
  const businessMatches = text.matchAll(businessPattern);
  for (const match of businessMatches) {
    if (match[1]) {
      candidates.add(match[1].trim());
    }
  }

  // Pattern 4: Domain-like references
  const domainPattern = /\b([A-Z][a-zA-Z0-9]{2,20}\.(?:com|io|org|net|co|app))\b/gi;
  const domainMatches = text.matchAll(domainPattern);
  for (const match of domainMatches) {
    if (match[1]) {
      candidates.add(match[1].trim());
    }
  }

  // Pattern 5: CamelCase and compound words
  const camelCasePattern = /\b([A-Z][a-z]+[A-Z][a-zA-Z0-9]*)\b/g;
  const camelMatches = text.matchAll(camelCasePattern);
  for (const match of camelMatches) {
    if (match[1] && match[1].length >= 4) {
      candidates.add(match[1].trim());
    }
  }

  return Array.from(candidates);
}

/**
 * Stage 2: Normalize Candidates  
 * Apply alias mapping and normalization
 */
function normalizeCandidates(candidates: string[]): string[] {
  const normalized = new Set<string>();

  for (const candidate of candidates) {
    const result = normalizeBrandName(candidate);
    if (isValidBrandName(result) && result.confidence >= 0.4) {
      // Use canonical form if available, otherwise normalized form
      normalized.add(result.canonical || result.normalized);
    }
  }

  return Array.from(normalized);
}

/**
 * Stage 3: Filter Candidates
 * Apply stopwords, POS/shape heuristics, and evidence rules
 */
function filterCandidates(candidates: string[], text: string): string[] {
  const filtered: string[] = [];

  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase();

    // Filter 1: Stopwords check
    if (isStopword(candidateLower)) {
      continue;
    }

    // Filter 2: POS/Shape heuristics
    if (!passesShapeHeuristics(candidate)) {
      continue;
    }

    // Filter 3: Minimum evidence rules
    if (!hasMinimumEvidence(candidate, text)) {
      continue;
    }

    // Filter 4: Negative context filter
    if (hasNegativeContext(candidate, text)) {
      continue;
    }

    filtered.push(candidate);
  }

  return filtered;
}

/**
 * Stage 4: Classify and Score
 * Label user brand vs competitor, compute confidence
 */
async function classifyAndScore(
  candidates: string[],
  orgData: AnalyzerV2Context['orgData'],
  brandCatalog: AnalyzerV2Context['brandCatalog'],
  orgOverlay: OrgOverlay,
  crossProviderContext?: AnalyzerV2Context['crossProviderContext']
): Promise<{
  orgBrands: string[];
  competitors: string[];
  catalogMatches: number;
  industryMatches: number; 
  discoveredMatches: number;
  confidence: number;
  consensusBoostApplied: boolean;
}> {
  const orgBrands: string[] = [];
  const competitors: string[] = [];
  let catalogMatches = 0;
  let industryMatches = 0;
  let discoveredMatches = 0;
  let consensusBoostApplied = false;

  // Build org brand variants
  const orgBrandVariants = buildOrgBrandVariants(orgData, brandCatalog, orgOverlay);
  
  // Build competitor sets
  const catalogCompetitors = buildCatalogCompetitors(brandCatalog);
  const industryCompetitors = buildIndustryCompetitors();

  for (const candidate of candidates) {
    const confidence = calculateCandidateConfidence(candidate, orgData, crossProviderContext);
    
    // Skip low confidence candidates
    if (confidence < 0.6) {
      continue;
    }

    // Classify as org brand or competitor
    if (isOrgBrand(candidate, orgBrandVariants)) {
      orgBrands.push(candidate);
    } else if (isCompetitor(candidate, catalogCompetitors, industryCompetitors, orgOverlay)) {
      // Apply cross-provider consensus boost
      if (crossProviderContext?.recent_competitors.includes(candidate)) {
        consensusBoostApplied = true;
      }

      competitors.push(candidate);
      
      // Track source
      if (catalogCompetitors.includes(candidate)) catalogMatches++;
      else if (industryCompetitors.some(c => c.name === candidate)) industryMatches++;
      else discoveredMatches++;
    }
  }

  // Limit results and calculate overall confidence
  const finalCompetitors = competitors.slice(0, 20);
  const overallConfidence = calculateOverallConfidence(orgBrands, finalCompetitors, catalogMatches, industryMatches);

  return {
    orgBrands,
    competitors: finalCompetitors,
    catalogMatches,
    industryMatches,
    discoveredMatches,
    confidence: overallConfidence,
    consensusBoostApplied
  };
}

/**
 * Helper Functions
 */

function isStopword(word: string): boolean {
  return stopwords.includes(word) || word.length <= 2;
}

function passesShapeHeuristics(candidate: string): boolean {
  // Must be TitleCase or contain domain or special chars
  return /^[A-Z]/.test(candidate) || 
         candidate.includes('.') || 
         candidate.includes('&') ||
         /[A-Z]/.test(candidate.slice(1));
}

function hasMinimumEvidence(candidate: string, text: string): boolean {
  const mentions = (text.match(new RegExp(candidate, 'gi')) || []).length;
  
  // Check if in allowlist (automotive industry brands)
  const isInAllowlist = automotiveMarketplaces.canonical_brands.some(
    brand => brand.name === candidate || brand.aliases.includes(candidate.toLowerCase())
  );
  
  if (isInAllowlist) return true;
  
  // Must appear multiple times OR have brand cue in same sentence
  if (mentions >= 2) return true;
  
  return hasBrandCueInSentence(candidate, text);
}

function hasBrandCueInSentence(candidate: string, text: string): boolean {
  const sentences = text.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(candidate.toLowerCase())) {
      const sentenceLower = sentence.toLowerCase();
      if (brandCues.some(cue => sentenceLower.includes(cue))) {
        return true;
      }
    }
  }
  
  return false;
}

function hasNegativeContext(candidate: string, text: string): boolean {
  const negativeVerbs = ['allows', 'lets', 'can', 'should', 'enables', 'helps'];
  const contextWindow = 50; // characters around candidate
  
  const candidateIndex = text.toLowerCase().indexOf(candidate.toLowerCase());
  if (candidateIndex === -1) return false;
  
  const start = Math.max(0, candidateIndex - contextWindow);
  const end = Math.min(text.length, candidateIndex + candidate.length + contextWindow);
  const context = text.slice(start, end).toLowerCase();
  
  return negativeVerbs.some(verb => context.includes(verb));
}

function isGenericQuote(text: string): boolean {
  const genericPhrases = [
    'click here', 'learn more', 'sign up', 'get started', 'read more',
    'find out', 'discover', 'explore', 'try now', 'download', 'install'
  ];
  
  return genericPhrases.some(phrase => text.toLowerCase().includes(phrase));
}

function buildOrgBrandVariants(
  orgData: AnalyzerV2Context['orgData'],
  brandCatalog: AnalyzerV2Context['brandCatalog'],
  orgOverlay: OrgOverlay
): string[] {
  const variants = new Set<string>();
  
  // From org data
  variants.add(orgData.name);
  if (orgData.domain) {
    variants.add(orgData.domain.replace(/\.(com|io|org|net)$/i, ''));
  }
  
  // From brand catalog
  for (const brand of brandCatalog) {
    if (brand.is_org_brand) {
      variants.add(brand.name);
      if (brand.variants_json) {
        brand.variants_json.forEach(v => variants.add(v));
      }
    }
  }
  
  // From org overlay
  if (orgOverlay.brand_variants) {
    orgOverlay.brand_variants.forEach(v => variants.add(v));
  }
  
  return Array.from(variants);
}

function buildCatalogCompetitors(brandCatalog: AnalyzerV2Context['brandCatalog']): string[] {
  return brandCatalog
    .filter(brand => !brand.is_org_brand)
    .map(brand => brand.name);
}

function buildIndustryCompetitors(): typeof automotiveMarketplaces.canonical_brands {
  return automotiveMarketplaces.canonical_brands;
}

function isOrgBrand(candidate: string, orgBrandVariants: string[]): boolean {
  const candidateLower = candidate.toLowerCase();
  return orgBrandVariants.some(variant => 
    variant.toLowerCase() === candidateLower ||
    candidateLower.includes(variant.toLowerCase()) ||
    variant.toLowerCase().includes(candidateLower)
  );
}

function isCompetitor(
  candidate: string, 
  catalogCompetitors: string[], 
  industryCompetitors: typeof automotiveMarketplaces.canonical_brands,
  orgOverlay: OrgOverlay
): boolean {
  // Check exclusions first
  if (orgOverlay.competitor_exclusions.includes(candidate)) {
    return false;
  }
  
  // Check manual overrides
  if (orgOverlay.competitor_overrides.includes(candidate)) {
    return true;
  }
  
  // Check catalog
  if (catalogCompetitors.includes(candidate)) {
    return true;
  }
  
  // Check industry list
  return industryCompetitors.some(comp => 
    comp.name === candidate || 
    comp.aliases.includes(candidate.toLowerCase())
  );
}

function calculateCandidateConfidence(
  candidate: string,
  orgData: AnalyzerV2Context['orgData'],
  crossProviderContext?: AnalyzerV2Context['crossProviderContext']
): number {
  let confidence = 0.6; // Base confidence
  
  // Boost for industry recognition
  const industryMatch = automotiveMarketplaces.canonical_brands.find(
    brand => brand.name === candidate || brand.aliases.includes(candidate.toLowerCase())
  );
  if (industryMatch) {
    confidence = Math.max(confidence, industryMatch.confidence);
  }
  
  // Cross-provider consensus boost
  if (crossProviderContext?.recent_competitors.includes(candidate)) {
    confidence += 0.15;
  }
  
  // Penalize very short names
  if (candidate.length <= 3) {
    confidence -= 0.2;
  }
  
  return Math.min(1.0, confidence);
}

function calculateOverallConfidence(
  orgBrands: string[],
  competitors: string[],
  catalogMatches: number,
  industryMatches: number
): number {
  let confidence = 0.8; // Base confidence for v2
  
  // Boost for org brand detection
  if (orgBrands.length > 0) {
    confidence += 0.1;
  }
  
  // Boost for industry/catalog matches vs discovered
  const knownMatches = catalogMatches + industryMatches;
  const totalMatches = competitors.length;
  if (totalMatches > 0) {
    const knownRatio = knownMatches / totalMatches;
    confidence += knownRatio * 0.1;
  }
  
  return Math.min(1.0, confidence);
}

function calculateProminence(text: string, brands: string[]): number {
  if (brands.length === 0) return 0;
  
  let bestScore = 10; // Start with worst possible score
  
  for (const brand of brands) {
    const index = text.toLowerCase().indexOf(brand.toLowerCase());
    if (index >= 0) {
      const position = index / text.length;
      
      // Map position ratios to prominence scores (1=best, 10=worst)
      let prominence;
      if (position <= 0.1) prominence = 1; // Very early (best)
      else if (position <= 0.25) prominence = 2; // Early
      else if (position <= 0.5) prominence = 4; // Middle
      else if (position <= 0.75) prominence = 7; // Late
      else prominence = 9; // Very late (worst)
      
      bestScore = Math.min(bestScore, prominence); // Keep the best (lowest) score
    }
  }
  
  return bestScore === 10 ? 0 : Math.round(bestScore);
}

function calculateVisibilityScore(
  orgBrandPresent: boolean,
  orgBrandProminence: number | null,
  competitorCount: number,
  responseLength: number
): number {
  let score = 0;
  
  // Base score for brand presence
  if (orgBrandPresent && orgBrandProminence) {
    // Brand present: start with good base score
    score = 5.5;
    
    // Position bonus (prominence is 1-10, where 1 is best)
    const positionBonus = (11 - orgBrandProminence) * 0.3; // 0.3 to 3.0
    score += positionBonus;
    
    // Competition penalty
    const competitionPenalty = Math.min(2.5, competitorCount * 0.15);
    score -= competitionPenalty;
    
    // Response length adjustment
    if (responseLength < 500) score += 0.5; // Shorter responses are better
    else if (responseLength > 2000) score -= 0.3; // Very long responses dilute brand
  } else {
    // No brand present: very low score
    score = Math.max(0.5, 2.0 - (competitorCount * 0.2));
  }
  
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

function generateAnalysisHash(responseText: string, orgBrands: string[], competitors: string[]): string {
  const content = `${responseText.slice(0, 200)}|${orgBrands.join(',')}|${competitors.join(',')}`;
  // Simple hash function for deduplication
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

function getOrgOverlay(orgName: string): OrgOverlay {
  // This function is now deprecated - use the imported getOrgOverlay instead
  const defaultOverlay: OrgOverlay = {
    org_id: orgName,
    competitor_overrides: [],
    competitor_exclusions: [],
    brand_variants: []
  };
  
  return orgOverlayCache.get(orgName) || defaultOverlay;
}

export default {
  analyzeResponseV2
};