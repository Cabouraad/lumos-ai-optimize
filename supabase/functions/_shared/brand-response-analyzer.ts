/**
 * Comprehensive Brand Response Analyzer
 * Produces EXACT same results as manual analysis by using:
 * 1. V1: Org brand variants + global competitors gazetteer + NER discovery
 * 2. V2: Enhanced 4-stage pipeline with per-org isolation (behind feature flag)
 */

import { GLOBAL_COMPETITORS, findGlobalCompetitor } from './global-competitors-gazetteer.ts';
import { analyzeResponseV2, type AnalyzerV2Result, type AnalyzerV2Context } from './analyzer-v2.ts';

export interface BrandAnalysisResult {
  org_brand_present: boolean;
  org_brand_prominence: number | null; // 1-10, position-based score
  competitors_json: string[];
  brands_json: string[];
  score: number; // 0-10 visibility score
  metadata: {
    org_brands_found: string[];
    catalog_competitors: number;
    global_competitors: number; 
    discovered_competitors: number;
    ner_organizations: string[];
    analysis_method: 'comprehensive' | 'deterministic' | 'v2_enhanced';
    confidence_score: number;
    analysis_hash?: string; // For deduplication
    deterministic_mode?: boolean;
    processing_time_ms?: number;
    // V2-specific fields
    ruleset_version?: 'v2';
    pipeline_stages?: {
      candidates_extracted: number;
      candidates_normalized: number;
      candidates_filtered: number;
      final_classified: number;
    };
    consensus_boost_applied?: boolean;
  };
}

export interface OrgData {
  name: string;
  domain?: string;
  keywords?: string[];
  competitors?: string[];
  products_services?: string[];
}

export interface BrandCatalogEntry {
  name: string;
  is_org_brand: boolean;
  variants_json?: string[];
}

/**
 * Main analysis function - chooses v1 or v2 based on feature flag
 */
export async function analyzePromptResponse(
  responseText: string,
  orgData: OrgData,
  brandCatalog: BrandCatalogEntry[],
  options: { deterministicMode?: boolean; enableNER?: boolean; useV2?: boolean } = {}
): Promise<BrandAnalysisResult> {
  // Check if V2 analyzer should be used
  const useV2 = options.useV2 || Deno.env.get('FEATURE_ANALYZER_V2') === 'true';
  
  if (useV2) {
    console.log('🚀 Using V2 Enhanced Analyzer');
    return await analyzeWithV2(responseText, orgData, brandCatalog, options);
  } else {
    console.log('📊 Using V1 Legacy Analyzer');
    return await analyzeWithV1(responseText, orgData, brandCatalog, options);
  }
}

/**
 * V2 Enhanced Analysis Pipeline
 */
async function analyzeWithV2(
  responseText: string,
  orgData: OrgData,
  brandCatalog: BrandCatalogEntry[],
  options: { deterministicMode?: boolean; enableNER?: boolean } = {}
): Promise<BrandAnalysisResult> {
  // Build V2 context
  const context: AnalyzerV2Context = {
    orgData: {
      name: orgData.name,
      domain: orgData.domain,
      keywords: orgData.keywords,
      competitors: orgData.competitors,
      products_services: orgData.products_services
    },
    brandCatalog: brandCatalog.map(bc => ({
      name: bc.name,
      is_org_brand: bc.is_org_brand,
      variants_json: bc.variants_json
    })),
    // TODO: In production, fetch org overlay from database
    orgOverlay: {
      org_id: orgData.name, // Use org name as temp ID
      competitor_overrides: [],
      competitor_exclusions: [],
      brand_variants: []
    },
    // TODO: In production, fetch cross-provider consensus data
    crossProviderContext: {
      prompt_id: 'unknown', // Would be passed from calling function
      recent_competitors: []
    }
  };

  // Run V2 analysis
  const v2Result = await analyzeResponseV2(responseText, context);

  // Convert V2 result to V1 format for API compatibility
  const result: BrandAnalysisResult = {
    org_brand_present: v2Result.org_brand_present,
    org_brand_prominence: v2Result.org_brand_prominence,
    competitors_json: v2Result.competitors_json,
    brands_json: v2Result.brands_json,
    score: v2Result.score,
    metadata: {
      org_brands_found: v2Result.metadata.org_brands_found,
      catalog_competitors: v2Result.metadata.catalog_competitors,
      global_competitors: v2Result.metadata.global_competitors,
      discovered_competitors: v2Result.metadata.discovered_competitors,
      ner_organizations: v2Result.metadata.ner_organizations,
      analysis_method: v2Result.metadata.analysis_method,
      confidence_score: v2Result.metadata.confidence_score,
      analysis_hash: v2Result.metadata.analysis_hash,
      deterministic_mode: options.deterministicMode || false,
      processing_time_ms: v2Result.metadata.processing_time_ms,
      // V2-specific metadata
      ruleset_version: v2Result.metadata.ruleset_version,
      pipeline_stages: v2Result.metadata.pipeline_stages,
      consensus_boost_applied: v2Result.metadata.consensus_boost_applied
    }
  };

  return result;
}

/**
 * V1 Legacy Analysis Pipeline (unchanged for backward compatibility)
 */
async function analyzeWithV1(
  responseText: string,
  orgData: OrgData,
  brandCatalog: BrandCatalogEntry[],
  options: { deterministicMode?: boolean; enableNER?: boolean } = {}
): Promise<BrandAnalysisResult> {
  const startTime = Date.now();
  console.log('🔍 Starting V1 brand analysis...');
  console.log(`📊 Response length: ${responseText.length} chars`);
  
  // ... keep existing V1 code (Step 1-5 from original function)
  const orgBrandVariants = extractOrgBrandVariants(brandCatalog);
  const catalogCompetitors = extractCatalogCompetitors(brandCatalog);
  const globalCompetitors = GLOBAL_COMPETITORS.map(c => c.name);
  
  console.log(`🏷️ Org brand variants: ${orgBrandVariants.length}`);
  console.log(`📋 Catalog competitors: ${catalogCompetitors.length}`);
  console.log(`🌍 Global competitors: ${globalCompetitors.length}`);
  
  const orgBrands = findBrandMentions(responseText, orgBrandVariants);
  const catalogMatches = findBrandMentions(responseText, catalogCompetitors);
  const globalMatches = findGlobalCompetitorMentions(responseText);
  
  const discoveredOrgs = options.enableNER !== false 
    ? await extractOrganizationsNER(responseText, [...orgBrandVariants, ...catalogCompetitors, ...globalMatches])
    : [];
  
  console.log(`✅ V1 Analysis results:`);
  console.log(`  - Org brands found: ${orgBrands.length}`);
  console.log(`  - Catalog competitors: ${catalogMatches.length}`);
  console.log(`  - Global competitors: ${globalMatches.length}`);
  console.log(`  - Discovered orgs: ${discoveredOrgs.length}`);
  
  const orgBrandPresent = orgBrands.length > 0;
  const orgBrandProminence = orgBrandPresent ? calculateProminence(responseText, orgBrands) : null;
  
  const allCompetitors = [
    ...catalogMatches,
    ...globalMatches, 
    ...discoveredOrgs
  ];
  
  const uniqueCompetitors = [...new Set(allCompetitors)]
    .filter(comp => !orgBrandVariants.some(org => 
      normalize(comp) === normalize(org)
    ))
    .slice(0, 20);
  
  const score = calculateVisibilityScore(
    orgBrandPresent,
    orgBrandProminence,
    uniqueCompetitors.length,
    responseText.length
  );
  
  const analysisHash = generateAnalysisHash(responseText, orgBrands, uniqueCompetitors, score);
  const processingTime = Date.now() - startTime;

  return {
    org_brand_present: orgBrandPresent,
    org_brand_prominence: orgBrandProminence,
    competitors_json: uniqueCompetitors,
    brands_json: orgBrands,
    score: Math.round(score * 10) / 10,
    metadata: {
      org_brands_found: orgBrands,
      catalog_competitors: catalogMatches.length,
      global_competitors: globalMatches.length,
      discovered_competitors: discoveredOrgs.length,
      ner_organizations: discoveredOrgs,
      analysis_method: options.deterministicMode ? 'deterministic' : 'comprehensive',
      confidence_score: calculateConfidence(orgBrands, uniqueCompetitors),
      analysis_hash: analysisHash,
      deterministic_mode: options.deterministicMode || false,
      processing_time_ms: processingTime
    }
  };
}

/**
 * Extract org brand variants from brand catalog
 */
function extractOrgBrandVariants(brandCatalog: BrandCatalogEntry[]): string[] {
  const variants = new Set<string>();
  
  for (const brand of brandCatalog) {
    if (brand.is_org_brand) {
      variants.add(brand.name);
      
      // Add variants if available
      if (brand.variants_json) {
        for (const variant of brand.variants_json) {
          variants.add(variant);
        }
      }
      
      // Generate common variations
      const name = brand.name;
      variants.add(name.toLowerCase());
      variants.add(name.toUpperCase());
      
      // Add domain variations if it looks like a domain
      if (name.includes('.')) {
        variants.add(name.replace(/\.(com|io|org|net)$/i, ''));
      }
      
      // Add hyphenated variations
      if (name.includes(' ')) {
        variants.add(name.replace(/\s+/g, '-'));
        variants.add(name.replace(/\s+/g, ''));
      }
    }
  }
  
  return Array.from(variants).filter(v => v.length >= 2);
}

/**
 * Extract catalog competitors 
 */
function extractCatalogCompetitors(brandCatalog: BrandCatalogEntry[]): string[] {
  return brandCatalog
    .filter(brand => !brand.is_org_brand && brand.name.length >= 3)
    .map(brand => brand.name);
}

/**
 * Find brand mentions in text using fuzzy matching
 */
function findBrandMentions(text: string, brands: string[]): string[] {
  const found = new Set<string>();
  const textLower = text.toLowerCase();
  
  for (const brand of brands) {
    const brandLower = brand.toLowerCase();
    const brandNorm = normalize(brand);
    
    // Exact match
    if (textLower.includes(brandLower)) {
      found.add(brand);
      continue;
    }
    
    // Fuzzy match with word boundaries
    const regex = new RegExp(`\\b${escapeRegex(brandNorm)}\\b`, 'gi');
    if (regex.test(text)) {
      found.add(brand);
    }
  }
  
  return Array.from(found);
}

/**
 * Find global competitor mentions
 */
function findGlobalCompetitorMentions(text: string): string[] {
  const found = new Set<string>();
  
  for (const competitor of GLOBAL_COMPETITORS) {
    // Check main name
    if (text.toLowerCase().includes(competitor.name.toLowerCase())) {
      found.add(competitor.name);
      continue;
    }
    
    // Check aliases
    for (const alias of competitor.aliases) {
      if (text.toLowerCase().includes(alias.toLowerCase())) {
        found.add(competitor.name); // Always use main name
        break;
      }
    }
  }
  
  return Array.from(found);
}

/**
 * Extract organizations using NER (Named Entity Recognition) approach
 * This discovers new organizations that aren't in our gazetteers
 */
async function extractOrganizationsNER(
  text: string, 
  knownBrands: string[]
): Promise<string[]> {
  console.log('🤖 Performing NER extraction...');
  
  // Step 1: Extract proper nouns (capitalized words/phrases)
  const properNouns = extractProperNouns(text);
  console.log(`🔍 Found ${properNouns.length} proper noun candidates`);
  
  // Step 2: Filter out known brands and common words
  const unknownCandidates = properNouns.filter(noun => 
    !knownBrands.some(known => normalize(known) === normalize(noun)) &&
    !isCommonWord(noun) &&
    noun.length >= 3 &&
    noun.length <= 30 &&
    !noun.match(/^(the|a|an|and|or|but|in|on|at|to|for|of|with|by)$/i)
  );
  
  if (unknownCandidates.length === 0) {
    console.log('✅ No unknown candidates for NER analysis');
    return [];
  }
  
  console.log(`🤖 Running NER analysis on ${unknownCandidates.slice(0, 10).join(', ')}...`);
  
  // Step 3: Use AI to classify which proper nouns are organizations
  try {
    const nerResult = await classifyOrganizations(unknownCandidates, text);
    console.log(`✅ NER identified ${nerResult.length} organizations`);
    return nerResult;
  } catch (error) {
    console.log('⚠️ NER classification failed, using pattern-based fallback');
    return unknownCandidates
      .filter(candidate => isLikelyOrganization(candidate, text))
      .slice(0, 10); // Limit fallback results
  }
}

/**
 * Extract proper nouns from text
 */
function extractProperNouns(text: string): string[] {
  // Match sequences of capitalized words (potential organization names)
  const patterns = [
    // Multi-word organizations: "Acme Corp", "Big Company Inc"
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc|Corp|LLC|Ltd|Co|Company|Group|Systems|Solutions|Software|Technologies|Services|Platform|Labs|Studio|Ventures|Partners|Associates|Consulting|Agency|Media|Digital|Marketing|Analytics|Tools|Hub|Suite|Pro|Plus|Enterprise|Cloud|Data|Tech|AI|CRM|SEO|SaaS))?)?\b/g,
    // CamelCase: "CompanyName", "BrandName" 
    /\b([A-Z][a-z]+[A-Z][a-z]+[A-Za-z]*)\b/g,
    // Domain-like: "company.com", "brand.io"
    /\b([A-Z][a-z]+\.[a-z]{2,4})\b/g
  ];
  
  const candidates = new Set<string>();
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length >= 3) {
        candidates.add(match[1].trim());
      }
    }
  }
  
  return Array.from(candidates);
}

/**
 * Check if a word is a common English word (not an organization)
 */
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    // Common business terms
    'Marketing', 'Sales', 'Service', 'Support', 'Customer', 'Business', 'Company', 'Team',
    'Platform', 'Software', 'Tool', 'System', 'Solution', 'Application', 'Service',
    'Data', 'Analytics', 'Insights', 'Report', 'Dashboard', 'Campaign', 'Content',
    'Email', 'Social', 'Digital', 'Online', 'Website', 'Mobile', 'App', 'Web',
    
    // Time and dates
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    
    // Generic terms that get capitalized
    'Here', 'There', 'This', 'That', 'These', 'Those', 'Some', 'All', 'Most',
    'Using', 'With', 'For', 'From', 'To', 'In', 'On', 'At', 'By', 'Of',
    'The', 'A', 'An', 'And', 'Or', 'But', 'So', 'Yet', 'However', 'Therefore'
  ]);
  
  return commonWords.has(word) || word.length <= 2;
}

/**
 * Pattern-based check if a proper noun is likely an organization
 */
function isLikelyOrganization(candidate: string, context: string): boolean {
  const candidateLower = candidate.toLowerCase();
  const contextLower = context.toLowerCase();
  
  // Business suffixes strongly indicate organizations
  if (candidateLower.match(/(inc|corp|llc|ltd|co|company|group|systems|solutions|software|technologies|services|platform|labs|studio|ventures|partners|associates|consulting|agency|media|digital|marketing|analytics|tools|hub|suite|pro|plus|enterprise|cloud|data|tech|ai|crm|seo|saas)$/)) {
    return true;
  }
  
  // Context clues around the candidate
  const surroundingText = extractSurroundingText(context, candidate, 100);
  const businessContext = [
    'company', 'platform', 'service', 'solution', 'software', 'tool', 'app', 'website',
    'founded', 'offers', 'provides', 'specializes', 'focuses', 'develops', 'creates',
    'recommend', 'use', 'try', 'consider', 'choose', 'popular', 'leading', 'top'
  ];
  
  return businessContext.some(term => surroundingText.includes(term));
}

/**
 * AI-powered organization classification using simple API call
 */
async function classifyOrganizations(candidates: string[], context: string): Promise<string[]> {
  // Simple prompt for organization classification
  const prompt = `Analyze this text and identify which of these proper nouns are business organizations, companies, or software platforms:

Candidates: ${candidates.slice(0, 20).join(', ')}

Context: ${context.substring(0, 2000)}

Respond with only a JSON array of organization names that are clearly businesses/companies/platforms. Example: ["CompanyA", "PlatformB"]`;

  try {
    // Use OpenAI for classification (reusing existing API key)
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('No OpenAI key available');
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.1
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Try to parse JSON response
    try {
      const organizations = JSON.parse(content);
      if (Array.isArray(organizations)) {
        console.log(`✅ NER extracted ${organizations.length} organizations: ${organizations.slice(0, 5).join(', ')}`);
        return organizations.slice(0, 15); // Limit results
      }
    } catch (parseError) {
      console.log('Failed to parse NER JSON response, attempting fallback extraction');
      // Fallback: extract organization names from response text
      const orgMatches = content.match(/"([^"]+)"/g);
      if (orgMatches) {
        return orgMatches
          .map(match => match.replace(/"/g, ''))
          .filter(org => candidates.some(c => 
            normalize(org) === normalize(c)
          ))
          .slice(0, 10);
      }
    }
    
    return [];
  } catch (error) {
    console.error('NER classification error:', error);
    throw error;
  }
}

/**
 * Calculate brand prominence based on position in text
 */
function calculateProminence(text: string, brands: string[]): number {
  if (brands.length === 0) return 0;
  
  // Check if new prominence calculation is enabled
  const useFixedCalculation = Deno.env.get('FEATURE_PROMINENCE_FIX') === 'true';
  
  if (useFixedCalculation) {
    // FIXED VERSION: Initialize to worst score and use correct mapping
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
  } else {
    // LEGACY VERSION: Preserve existing buggy behavior for backward compatibility
    let bestPosition = 1.0;
    
    for (const brand of brands) {
      const index = text.toLowerCase().indexOf(brand.toLowerCase());
      if (index >= 0) {
        const position = index / text.length;
        
        // Convert position to prominence (1-10, where 1 is early/good)
        let prominence;
        if (position <= 0.1) prominence = 9; // Very early
        else if (position <= 0.25) prominence = 8; // Early  
        else if (position <= 0.5) prominence = 6; // Middle
        else if (position <= 0.75) prominence = 4; // Late
        else prominence = 2; // Very late
        
        bestPosition = Math.min(bestPosition, prominence);
      }
    }
    
    return Math.round(bestPosition);
  }
}

/**
 * Calculate visibility score (0-10)
 */
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
    
  } else {
    // No brand mention: poor score
    if (competitorCount > 0) {
      score = 0.5; // Competitors mentioned but not us = very bad
    } else {
      score = 1.0; // No competitors or us = neutral
    }
  }
  
  // Ensure score is within bounds
  return Math.max(0, Math.min(10, score));
}

/**
 * Calculate analysis confidence
 */
function calculateConfidence(orgBrands: string[], competitors: string[]): number {
  let confidence = 0.5; // Base confidence
  
  // Boost for org brand detection
  if (orgBrands.length > 0) {
    confidence += 0.3;
  }
  
  // Boost for reasonable competitor count
  if (competitors.length > 0 && competitors.length <= 20) {
    confidence += 0.2;
  }
  
  return Math.min(1.0, confidence);
}

/**
 * Utility functions
 */
function normalize(str: string): string {
  return str.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate analysis hash for deduplication
 */
function generateAnalysisHash(
  responseText: string, 
  orgBrands: string[], 
  competitors: string[], 
  score: number
): string {
  const hashInput = [
    responseText.substring(0, 500), // First 500 chars
    orgBrands.sort().join('|'),
    competitors.sort().join('|'),
    Math.round(score * 10).toString()
  ].join('::');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

function extractSurroundingText(text: string, target: string, radius: number): string {
  const index = text.toLowerCase().indexOf(target.toLowerCase());
  if (index === -1) return '';
  
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + target.length + radius);
  return text.slice(start, end).toLowerCase();
}