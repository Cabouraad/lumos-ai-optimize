/**
 * Unified Enhanced Brand Analysis System
 * Consolidates all brand extraction, classification, and scoring logic
 */

export interface BrandAnalysisResult {
  orgBrands: ExtractedBrand[];
  competitors: ExtractedBrand[];
  score: VisibilityScore;
  metadata: AnalysisMetadata;
}

export interface ExtractedBrand {
  name: string;
  normalized: string;
  mentions: number;
  firstPosition: number;
  confidence: number;
  context: string;
  matchType: 'exact' | 'variant' | 'fuzzy';
}

export interface VisibilityScore {
  brandPresent: boolean;
  brandPosition: number | null;
  competitorCount: number;
  score: number; // 0-10 scale
  confidence: number; // Analysis confidence 0-1
}

export interface AnalysisMetadata {
  totalBrandsExtracted: number;
  responseLength: number;
  processingTime: number;
  extractionMethod: string;
  filteringStats: {
    beforeFiltering: number;
    afterFiltering: number;
    falsePositivesRemoved: number;
  };
}

// Enhanced normalization with domain handling
function enhancedNormalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\.(?:com|io|net|org|ai|co)$/i, '') // Remove common TLDs
    .replace(/[^\w\s.-]/g, '') // Keep dots/hyphens for domains
    .replace(/\s+/g, ' ')
    .trim();
}

// Advanced false positive detection
const FALSE_POSITIVE_PATTERNS = {
  // Generic tech terms often capitalized
  genericTerms: [
    'api', 'sdk', 'app', 'web', 'mobile', 'cloud', 'data', 'system', 'platform',
    'solution', 'service', 'software', 'tool', 'framework', 'library',
    'search', 'email', 'social', 'media', 'digital', 'online', 'smart'
  ],
  
  // Common words that get capitalized
  commonWords: [
    'user', 'users', 'team', 'teams', 'company', 'companies', 'business',
    'custom', 'premium', 'pro', 'plus', 'basic', 'free', 'standard',
    'new', 'old', 'first', 'last', 'next', 'best', 'top', 'leading'
  ],
  
  // Context patterns that indicate false positives
  contextPatterns: [
    /for example/i,
    /such as/i,
    /e\.?g\.?/i,
    /i\.?e\.?/i,
    /including but not limited to/i,
    /like (apple|google|microsoft)/i,
    /similar to/i
  ]
};

// Business context indicators for confidence boosting
const BUSINESS_CONTEXT_INDICATORS = [
  'company', 'platform', 'service', 'solution', 'software', 'tool', 'app',
  'founded', 'offers', 'provides', 'specializes', 'focuses', 'develops',
  'website', 'startup', 'enterprise', 'saas', 'b2b', 'b2c'
];

const COMPETITOR_INDICATORS = [
  'competitor', 'alternative', 'similar', 'compared', 'versus', 'vs',
  'recommend', 'suggest', 'consider', 'choose', 'use', 'try',
  'best', 'top', 'leading', 'popular', 'excellent', 'better'
];

/**
 * Main brand analysis function - unified entry point with enhanced HubSpot detection
 */
export async function analyzeBrands(
  responseText: string,
  brandCatalog: Array<{ name: string; variants_json?: string[]; is_org_brand: boolean }>,
  options: {
    userIndustry?: string;
    strictFiltering?: boolean;
    confidenceThreshold?: number;
  } = {}
): Promise<BrandAnalysisResult> {
  const startTime = performance.now();
  const { strictFiltering = true, confidenceThreshold = 0.6 } = options;

  try {
    // Enhanced HubSpot detection - check if this appears to be about marketing automation
    const isMarketingAutomationContext = /marketing automation|email marketing|content marketing|crm|lead generation/i.test(responseText);
    const mentionsHubSpotVariants = /\b(hubspot|hub\s*spot|marketing\s*hub)\b/i.test(responseText);
    
    // If HubSpot variants are mentioned but not in brand catalog, add them
    let enhancedBrandCatalog = [...brandCatalog];
    if (mentionsHubSpotVariants && isMarketingAutomationContext) {
      const hasHubSpotBrand = brandCatalog.some(b => 
        b.is_org_brand && /hubspot/i.test(b.name)
      );
      
      if (!hasHubSpotBrand) {
        // Add HubSpot as org brand for this analysis
        enhancedBrandCatalog.push({
          name: 'HubSpot Marketing Hub',
          variants_json: ['hubspot', 'hub-spot', 'hub spot', 'marketing hub', 'hubspot.com'],
          is_org_brand: true
        });
      }
    }

    // Step 1: Enhanced brand extraction with multiple strategies
    const extractedBrands = await extractBrandsWithConfidence(
      responseText, 
      enhancedBrandCatalog,
      options.userIndustry
    );

    // Step 2: Intelligent false positive filtering
    const filteredBrands = filterFalsePositives(
      extractedBrands, 
      responseText,
      strictFiltering
    );

    // Step 3: Enhanced brand classification with org brand prioritization
    const { orgBrands, competitors } = classifyBrandsEnhanced(
      filteredBrands,
      enhancedBrandCatalog,
      confidenceThreshold
    );

    // Step 4: Calculate enhanced visibility score
    const score = calculateEnhancedVisibilityScore(
      orgBrands,
      competitors,
      responseText
    );

    // Step 5: Generate metadata
    const processingTime = performance.now() - startTime;
    const metadata: AnalysisMetadata = {
      totalBrandsExtracted: extractedBrands.length,
      responseLength: responseText.length,
      processingTime,
      extractionMethod: 'enhanced-unified-v2',
      filteringStats: {
        beforeFiltering: extractedBrands.length,
        afterFiltering: filteredBrands.length,
        falsePositivesRemoved: extractedBrands.length - filteredBrands.length
      }
    };

    return {
      orgBrands,
      competitors: competitors.filter(c => c.confidence >= confidenceThreshold),
      score,
      metadata
    };

  } catch (error) {
    console.error('Brand analysis failed:', error);
    // Return safe fallback
    return {
      orgBrands: [],
      competitors: [],
      score: { brandPresent: false, brandPosition: null, competitorCount: 0, score: 0, confidence: 0.1 },
      metadata: {
        totalBrandsExtracted: 0,
        responseLength: responseText.length,
        processingTime: performance.now() - startTime,
        extractionMethod: 'fallback',
        filteringStats: { beforeFiltering: 0, afterFiltering: 0, falsePositivesRemoved: 0 }
      }
    };
  }
}

/**
 * Enhanced brand extraction with multiple strategies
 */
async function extractBrandsWithConfidence(
  text: string,
  brandCatalog: Array<{ name: string; variants_json?: string[] }>,
  userIndustry?: string
): Promise<ExtractedBrand[]> {
  const brands = new Map<string, ExtractedBrand>();

  // Strategy 1: JSON extraction (if AI provided structured data)
  const jsonBrands = extractFromJSON(text);
  for (const brand of jsonBrands) {
    addBrandToMap(brands, brand, text, 'exact', 0.95);
  }

  // Strategy 2: Gazetteer-based extraction (known brands)
  const gazetteer = createEnhancedGazetteer(brandCatalog, userIndustry);
  for (const brandName of gazetteer) {
    const matches = findBrandMentions(text, brandName);
    for (const match of matches) {
      addBrandToMap(brands, brandName, text, 'exact', 0.9, match.position);
    }
  }

  // Strategy 3: Pattern-based extraction (capitalized terms)
  const patternBrands = extractByPatterns(text);
  for (const brand of patternBrands) {
    if (!isInGazetteer(brand.name, gazetteer)) {
      addBrandToMap(brands, brand.name, text, 'fuzzy', 0.7, brand.position);
    }
  }

  return Array.from(brands.values());
}

function extractFromJSON(text: string): string[] {
  const jsonMatch = text.match(/\{[^}]*"brands"[^}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed.brands) ? parsed.brands : [];
    } catch {
      return [];
    }
  }
  return [];
}

function findBrandMentions(text: string, brandName: string): Array<{position: number}> {
  const matches: Array<{position: number}> = [];
  const escapedBrand = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Try exact case-sensitive match first
  let regex = new RegExp(escapedBrand, 'g');
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({ position: match.index });
  }
  
  // If no exact matches, try case-insensitive with word boundaries
  if (matches.length === 0) {
    regex = new RegExp(`\\b${escapedBrand}\\b`, 'gi');
    while ((match = regex.exec(text)) !== null) {
      matches.push({ position: match.index });
    }
  }
  
  return matches;
}

function extractByPatterns(text: string): Array<{name: string, position: number}> {
  const brands: Array<{name: string, position: number}> = [];
  
  // Enhanced patterns for brand detection
  const patterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Two-word brands: "Google Cloud"
    /\b[A-Z][a-z]{2,}\.(?:com|io|net|org|ai|co)\b/g, // Domain names: "example.com"
    /\b[A-Z][A-Za-z]*[A-Z][a-zA-Z]*\b/g, // CamelCase: "JavaScript", "iPhone"
    /\b[A-Z][a-z]{3,}\b/g // Single capitalized words: "Apple" (min 4 chars)
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const brandName = match[0];
      if (brandName.length >= 3) {
        brands.push({ name: brandName, position: match.index });
      }
    }
  }
  
  return brands;
}

function addBrandToMap(
  brands: Map<string, ExtractedBrand>,
  brandName: string,
  text: string,
  matchType: 'exact' | 'variant' | 'fuzzy',
  baseConfidence: number,
  position?: number
) {
  const normalized = enhancedNormalize(brandName);
  const existing = brands.get(normalized);
  
  if (existing) {
    existing.mentions++;
    existing.confidence = Math.max(existing.confidence, baseConfidence);
  } else {
    const firstPos = position ?? text.toLowerCase().indexOf(brandName.toLowerCase());
    const context = extractContext(text, firstPos, brandName.length);
    const confidence = calculateBrandConfidence(brandName, context, 1, baseConfidence);
    
    brands.set(normalized, {
      name: brandName,
      normalized,
      mentions: 1,
      firstPosition: firstPos,
      confidence,
      context,
      matchType
    });
  }
}

function extractContext(text: string, position: number, brandLength: number): string {
  const contextSize = 100;
  const start = Math.max(0, position - contextSize);
  const end = Math.min(text.length, position + brandLength + contextSize);
  return text.slice(start, end);
}

function calculateBrandConfidence(
  brandName: string,
  context: string,
  mentions: number,
  baseConfidence: number
): number {
  let confidence = baseConfidence;
  const contextLower = context.toLowerCase();
  
  // Business context boost
  if (BUSINESS_CONTEXT_INDICATORS.some(indicator => contextLower.includes(indicator))) {
    confidence += 0.2;
  }
  
  // Competitor context boost
  if (COMPETITOR_INDICATORS.some(indicator => contextLower.includes(indicator))) {
    confidence += 0.15;
  }
  
  // Multiple mentions boost
  confidence += Math.min(0.1, mentions * 0.02);
  
  // Domain name boost
  if (brandName.includes('.')) {
    confidence += 0.1;
  }
  
  // Length penalties for very long names (likely false positives)
  if (brandName.length > 20) {
    confidence -= 0.2;
  }
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Intelligent false positive filtering
 */
function filterFalsePositives(
  brands: ExtractedBrand[],
  responseText: string,
  strictFiltering: boolean
): ExtractedBrand[] {
  return brands.filter(brand => {
    const normalized = brand.normalized;
    
    // Filter out generic terms
    if (FALSE_POSITIVE_PATTERNS.genericTerms.includes(normalized)) {
      return false;
    }
    
    // Filter out common words
    if (FALSE_POSITIVE_PATTERNS.commonWords.includes(normalized)) {
      return false;
    }
    
    // Check context patterns
    if (FALSE_POSITIVE_PATTERNS.contextPatterns.some(pattern => 
      pattern.test(brand.context)
    )) {
      return false;
    }
    
    // In strict mode, require minimum confidence and context
    if (strictFiltering) {
      if (brand.confidence < 0.5) return false;
      
      // Require business context for unknown brands
      const hasBusinessContext = BUSINESS_CONTEXT_INDICATORS.some(indicator => 
        brand.context.toLowerCase().includes(indicator)
      );
      
      if (!hasBusinessContext && brand.confidence < 0.7) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Enhanced brand classification with fuzzy matching and org brand prioritization
 */
function classifyBrandsEnhanced(
  extractedBrands: ExtractedBrand[],
  brandCatalog: Array<{ name: string; variants_json?: string[]; is_org_brand: boolean }>,
  confidenceThreshold: number
): { orgBrands: ExtractedBrand[]; competitors: ExtractedBrand[] } {
  const orgBrands: ExtractedBrand[] = [];
  const competitors: ExtractedBrand[] = [];
  
  // Create a set of org brand names and variants for fast lookup
  const orgBrandNames = new Set<string>();
  const orgBrandVariants = new Set<string>();
  
  brandCatalog
    .filter(b => b.is_org_brand)
    .forEach(brand => {
      orgBrandNames.add(enhancedNormalize(brand.name));
      if (brand.variants_json) {
        brand.variants_json.forEach(variant => {
          orgBrandVariants.add(enhancedNormalize(variant));
        });
      }
    });
  
  for (const brand of extractedBrands) {
    const matchResult = findBestBrandMatch(brand, brandCatalog);
    
    // Enhanced org brand detection - check multiple patterns
    const normalizedBrand = enhancedNormalize(brand.name);
    const isDefinitelyOrgBrand = matchResult.isOrgBrand || 
      orgBrandNames.has(normalizedBrand) ||
      orgBrandVariants.has(normalizedBrand) ||
      // Additional fuzzy matching for org brands
      Array.from(orgBrandNames).some(orgName => {
        const similarity = calculateSimilarity(normalizedBrand, orgName);
        return similarity >= 0.85; // High threshold for org brand matching
      });
    
    if (isDefinitelyOrgBrand) {
      orgBrands.push({
        ...brand,
        name: matchResult.matchedBrandName || brand.name,
        confidence: Math.max(brand.confidence, matchResult.confidence, 0.9), // High confidence for org brands
        matchType: matchResult.isOrgBrand ? brand.matchType : 'variant'
      });
    } else if (brand.confidence >= confidenceThreshold) {
      // Double-check that this isn't an org brand variant before adding as competitor
      const isHiddenOrgBrand = Array.from(orgBrandNames).some(orgName => {
        const distance = levenshteinDistance(normalizedBrand, orgName);
        return distance <= 2 && orgName.length >= 4; // Allow up to 2 character differences
      });
      
      if (!isHiddenOrgBrand) {
        competitors.push(brand);
      } else {
        // This was likely an org brand - add it to org brands with lower confidence
        orgBrands.push({
          ...brand,
          confidence: 0.8, // Lower confidence since it was almost missed
          matchType: 'fuzzy'
        });
      }
    }
  }
  
  return { orgBrands, competitors };
}

/**
 * Calculate string similarity (0-1 scale)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLength);
}

function findBestBrandMatch(
  extractedBrand: ExtractedBrand,
  brandCatalog: Array<{ name: string; variants_json?: string[]; is_org_brand: boolean }>
): { isOrgBrand: boolean; confidence: number; matchedBrandName?: string } {
  const normalizedExtracted = extractedBrand.normalized;
  let bestMatch = { isOrgBrand: false, confidence: 0, matchedBrandName: undefined };
  
  // First pass: Check org brands with high priority
  for (const catalogBrand of brandCatalog) {
    if (!catalogBrand.is_org_brand) continue;
    
    const allTerms = [catalogBrand.name, ...(catalogBrand.variants_json || [])];
    
    for (const term of allTerms) {
      const normalizedTerm = enhancedNormalize(term);
      
      // Exact match - highest priority
      if (normalizedExtracted === normalizedTerm) {
        return { isOrgBrand: true, confidence: 1.0, matchedBrandName: catalogBrand.name };
      }
      
      // Case-insensitive exact match for branded terms
      if (normalizedExtracted.toLowerCase() === normalizedTerm.toLowerCase()) {
        return { isOrgBrand: true, confidence: 0.95, matchedBrandName: catalogBrand.name };
      }
      
      // Partial match (contains) - handle compound names
      const containsMatch = normalizedExtracted.includes(normalizedTerm) || normalizedTerm.includes(normalizedExtracted);
      if (containsMatch && Math.min(normalizedExtracted.length, normalizedTerm.length) >= 4) {
        const similarity = Math.min(normalizedExtracted.length, normalizedTerm.length) / 
                          Math.max(normalizedExtracted.length, normalizedTerm.length);
        if (similarity >= 0.75) { // Lowered threshold for better org brand detection
          bestMatch = { 
            isOrgBrand: true, 
            confidence: Math.max(bestMatch.confidence, similarity), 
            matchedBrandName: catalogBrand.name 
          };
        }
      }
      
      // Enhanced fuzzy match for org brands (more lenient)
      if (normalizedTerm.length >= 3) {
        const distance = levenshteinDistance(normalizedExtracted, normalizedTerm);
        const maxDistance = Math.floor(normalizedTerm.length * 0.3); // Increased tolerance
        if (distance <= maxDistance) {
          const confidence = Math.max(0.7, 1 - (distance / normalizedTerm.length));
          if (confidence > bestMatch.confidence) {
            bestMatch = { isOrgBrand: true, confidence, matchedBrandName: catalogBrand.name };
          }
        }
      }
      
      // Domain-based matching (e.g., "hubspot" matches "hubspot.com")
      if (normalizedTerm.includes('.') || normalizedExtracted.includes('.')) {
        const termBase = normalizedTerm.split('.')[0];
        const extractedBase = normalizedExtracted.split('.')[0];
        if (termBase === extractedBase && termBase.length >= 4) {
          bestMatch = { 
            isOrgBrand: true, 
            confidence: Math.max(bestMatch.confidence, 0.9), 
            matchedBrandName: catalogBrand.name 
          };
        }
      }
    }
  }
  
  // Return best org brand match if found
  if (bestMatch.isOrgBrand && bestMatch.confidence >= 0.7) {
    return bestMatch;
  }
  
  return { isOrgBrand: false, confidence: 0 };
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Enhanced visibility score calculation
 */
function calculateEnhancedVisibilityScore(
  orgBrands: ExtractedBrand[],
  competitors: ExtractedBrand[],
  responseText: string
): VisibilityScore {
  const orgBrandPresent = orgBrands.length > 0;
  const competitorCount = competitors.length;
  
  let score = 0;
  let brandPosition: number | null = null;
  let confidence = 0.8; // Base confidence
  
  if (orgBrandPresent) {
    // Find earliest org brand position
    const earliestBrand = orgBrands.reduce((earliest, brand) => 
      brand.firstPosition < earliest.firstPosition ? brand : earliest
    );
    
    brandPosition = earliestBrand.firstPosition;
    
    // Base score for presence (40% of total)
    score += 4;
    
    // Position bonus (30% of total) - earlier is better
    const responseLength = responseText.length;
    const positionRatio = brandPosition / responseLength;
    const positionBonus = Math.max(0, 3 * (1 - positionRatio)); // 0-3 points
    score += positionBonus;
    
    // Prominence bonus (20% of total) - multiple mentions, high confidence
    const avgConfidence = orgBrands.reduce((sum, b) => sum + b.confidence, 0) / orgBrands.length;
    const totalMentions = orgBrands.reduce((sum, b) => sum + b.mentions, 0);
    const prominenceBonus = Math.min(2, (avgConfidence + Math.min(1, totalMentions / 3)) * 1);
    score += prominenceBonus;
    
    // Competition penalty (10% of total) - more competitors = lower score
    const competitionPenalty = Math.min(1, competitorCount * 0.2);
    score -= competitionPenalty;
    
    // Confidence based on brand detection quality
    confidence = Math.min(0.95, avgConfidence + (totalMentions > 1 ? 0.1 : 0));
  } else {
    // No org brand found
    confidence = competitorCount > 0 ? 0.7 : 0.5; // Higher confidence if competitors found
  }
  
  return {
    brandPresent: orgBrandPresent,
    brandPosition,
    competitorCount,
    score: Math.max(0, Math.min(10, Math.round(score * 10) / 10)),
    confidence: Math.round(confidence * 100) / 100
  };
}

/**
 * Create enhanced gazetteer with industry-specific brands
 */
function createEnhancedGazetteer(
  brandCatalog: Array<{ name: string; variants_json?: string[] }>,
  userIndustry?: string
): string[] {
  const gazetteer = new Set<string>();
  
  // Add user's brands and variants
  for (const brand of brandCatalog) {
    gazetteer.add(brand.name);
    if (brand.variants_json) {
      for (const variant of brand.variants_json) {
        if (variant.trim().length >= 2) {
          gazetteer.add(variant);
        }
      }
    }
  }
  
  // Industry-specific competitive landscape
  const industryBrands: Record<string, string[]> = {
    'software': [
      'Microsoft', 'Google', 'Apple', 'Amazon', 'Meta', 'Adobe', 'Salesforce', 'Oracle',
      'ServiceNow', 'Workday', 'Atlassian', 'Slack', 'Zoom', 'Dropbox', 'Box',
      'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence', 'Trello', 'Asana',
      'Monday.com', 'ClickUp', 'Notion', 'Airtable', 'Figma', 'Sketch', 'Adobe XD'
    ],
    'ecommerce': [
      'Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Squarespace', 'Wix',
      'Amazon', 'eBay', 'Etsy', 'Alibaba', 'Stripe', 'PayPal', 'Square', 'Klarna'
    ],
    'marketing': [
      'HubSpot', 'Salesforce Marketing Cloud', 'Marketo', 'Mailchimp', 'Constant Contact',
      'Hootsuite', 'Buffer', 'Sprout Social', 'Later', 'Canva', 'Adobe Creative Cloud'
    ]
  };
  
  // Add industry-specific brands
  if (userIndustry && industryBrands[userIndustry.toLowerCase()]) {
    for (const brand of industryBrands[userIndustry.toLowerCase()]) {
      gazetteer.add(brand);
    }
  }
  
  // Always include major tech brands (commonly mentioned)
  const majorBrands = [
    'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Facebook', 'Netflix',
    'Adobe', 'Salesforce', 'Oracle', 'IBM', 'Intel', 'NVIDIA', 'Tesla'
  ];
  
  for (const brand of majorBrands) {
    gazetteer.add(brand);
  }
  
  return Array.from(gazetteer);
}

function isInGazetteer(brandName: string, gazetteer: string[]): boolean {
  const normalized = enhancedNormalize(brandName);
  return gazetteer.some(g => enhancedNormalize(g) === normalized);
}