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

// Enhanced false positive detection - comprehensive filtering
const FALSE_POSITIVE_PATTERNS = {
  // Generic tech terms often capitalized
  genericTerms: [
    'api', 'sdk', 'app', 'web', 'mobile', 'cloud', 'data', 'system', 'platform',
    'solution', 'service', 'software', 'tool', 'framework', 'library',
    'search', 'email', 'social', 'media', 'digital', 'online', 'smart',
    // Marketing and SEO terms that are often mistakenly identified as competitors
    'seo', 'sem', 'ppc', 'crm', 'cms', 'erp', 'roi', 'kpi', 'ctr', 'cpc',
    'marketing', 'analytics', 'automation', 'optimization', 'tracking',
    'content', 'advertising', 'campaign', 'strategy', 'engagement',
    // Common misidentified words from AI responses
    'these', 'those', 'some', 'many', 'several', 'various', 'different',
    'other', 'others', 'more', 'most', 'less', 'better', 'best', 'top',
    // Generic action words frequently misclassified as brands
    'provides', 'offers', 'helps', 'making', 'creating', 'choosing', 'consider',
    'understanding', 'when', 'what', 'their', 'also', 'well', 'known',
    'track', 'includes', 'comprehensive', 'research', 'easy', 'help',
    'management', 'scheduling', 'calendar', 'larger', 'focuses', 'widely'
  ],
  
  // Common words that get capitalized (EXPANDED)
  commonWords: [
    'user', 'users', 'team', 'teams', 'company', 'companies', 'business',
    'custom', 'premium', 'pro', 'plus', 'basic', 'free', 'standard',
    'new', 'old', 'first', 'last', 'next', 'best', 'top', 'leading',
    // Additional common words that shouldn't be brands
    'features', 'pricing', 'plans', 'options', 'benefits', 'advantages',
    'capabilities', 'functionality', 'integration', 'dashboard', 'interface',
    'reports', 'insights', 'performance', 'results', 'success', 'growth',
    // CRITICAL: Add the exact terms we see in the screenshot as false positives
    'range', 'affordable', 'pricing range', 'your', 'their', 'these', 'those',
    'when', 'what', 'where', 'which', 'while', 'with', 'without', 'within',
    'content marketing', 'email marketing', 'social media', 'social media management',
    'content performance', 'campaign management', 'automation platforms',
    // Business/pricing terms that commonly get misclassified
    'pricing', 'cost', 'budget', 'value', 'roi', 'investment', 'expense',
    'cheap', 'expensive', 'reasonable', 'competitive', 'premium', 'budget-friendly',
    // Size/scale descriptors
    'small', 'large', 'medium', 'big', 'huge', 'tiny', 'massive', 'enterprise',
    'startup', 'mid-size', 'fortune', 'global', 'local', 'regional',
    // Quality descriptors  
    'good', 'great', 'excellent', 'amazing', 'outstanding', 'superior',
    'quality', 'reliable', 'trusted', 'proven', 'established', 'popular'
  ],
  
  // Comprehensive phrases that are never brands
  genericPhrases: [
    'social media', 'email marketing', 'content marketing', 'digital marketing',
    'search engine', 'content management', 'customer relationship', 'project management',
    'social media management', 'content performance', 'campaign management',
    'automation platforms', 'pricing range', 'your team', 'their platform',
    'marketing automation', 'analytics tools', 'social platforms', 'content tools'
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
    // Use the actual brand catalog - no hardcoded brand logic
    const enhancedBrandCatalog = [...brandCatalog];

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
  // FIXED: Proper JSON extraction that handles nested objects and arrays
  const jsonPatterns = [
    // Try to find complete JSON objects with "brands" key
    /\{\s*"brands"\s*:\s*\[[^\]]*\]\s*\}/g,
    // Try to find just the brands array
    /"brands"\s*:\s*\[([^\]]*)\]/g,
    // Try to find any array that looks like brands
    /\[\s*"[^"]*"(?:\s*,\s*"[^"]*")*\s*\]/g
  ];

  console.log('Attempting JSON extraction from text...');
  
  for (const pattern of jsonPatterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      try {
        let jsonStr = match[0];
        
        // If it's just the brands array, wrap it in an object
        if (jsonStr.startsWith('[')) {
          jsonStr = `{"brands": ${jsonStr}}`;
        }
        
        console.log('Trying to parse JSON:', jsonStr);
        const parsed = JSON.parse(jsonStr);
        
        if (parsed.brands && Array.isArray(parsed.brands)) {
          console.log('Successfully extracted brands from JSON:', parsed.brands);
          return parsed.brands.filter(brand => typeof brand === 'string' && brand.trim().length > 0);
        }
      } catch (error) {
        console.log('JSON parse failed for:', match[0], error);
        continue;
      }
    }
  }
  
  console.log('No valid JSON brands found');
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
  
  // ENHANCED: More selective patterns for brand detection - avoid generic terms
  const patterns = [
    // Two-word brands with business indicators: "Google Cloud", "Adobe Creative"
    /\b[A-Z][a-z]+ (?:Cloud|Analytics|Marketing|Creative|Studio|Pro|Suite|Platform|Hub|Labs|Works|Systems|Solutions)\b/g,
    // Domain names: "example.com" (strong brand indicators)
    /\b[A-Z][a-z]{2,}\.(?:com|io|net|org|ai|co|app)\b/g,
    // CamelCase with 2+ capital letters: "JavaScript", "iPhone", "HubSpot"
    /\b[A-Z][a-z]*[A-Z][a-zA-Z]*\b/g,
    // Brands with numbers: "Office365", "Salesforce1"
    /\b[A-Z][a-z]+\d+\b/g,
    // Longer capitalized words that are more likely to be brands (6+ chars to avoid common words)
    /\b[A-Z][a-z]{5,}\b/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const brandName = match[0];
      
      // ENHANCED: Pre-filter obviously non-brand terms before adding
      const isObviouslyNotBrand = /^(Content|Marketing|Social|Digital|Email|Search|Management|Analytics|Automation|Campaign|Performance|Strategy|Quality|Premium|Standard|Professional|Enterprise|Business|Company|Service|Solution|Platform|System|Software|Application|Framework|Library|Database|Network|Security|Privacy|Support|Training|Learning|Development|Research|Analysis|Report|Insight|Result|Success|Growth|Value|Price|Cost|Budget|Range|Scale|Size|Level|Grade|Rank|Score|Rate|Ratio|Percent|Number|Amount|Total|Count|Sum|Average|Maximum|Minimum|Optimal|Best|Better|Good|Great|Excellent|Outstanding|Superior|Advanced|Basic|Simple|Easy|Quick|Fast|Slow|Large|Small|Big|Little|High|Low|Top|Bottom|First|Last|New|Old|Recent|Latest|Current|Modern|Traditional|Popular|Common|Rare|Unique|Special|General|Specific|Public|Private|Personal|Individual|Custom|Standard|Regular|Normal|Typical|Usual)$/i.test(brandName);
      
      if (!isObviouslyNotBrand && brandName.length >= 3) {
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
 * Intelligent false positive filtering with enhanced generic term detection
 */
function filterFalsePositives(
  extractedBrands: ExtractedBrand[],
  responseText: string,
  strictFiltering: boolean = true
): ExtractedBrand[] {
  console.log(`Filtering ${extractedBrands.length} extracted brands...`);
  
  return extractedBrands.filter(brand => {
    // Enhanced filtering for single words that are clearly not brands
    const normalizedBrand = brand.normalized.toLowerCase().trim();
    
    // Filter out very short terms or common words
    if (normalizedBrand.length <= 2) {
      console.log(`Filtered out (too short): ${brand.name}`);
      return false;
    }
    
    // ENHANCED: Check against comprehensive generic phrases first
    if (FALSE_POSITIVE_PATTERNS.genericPhrases.some(phrase => 
      normalizedBrand === phrase.toLowerCase() || normalizedBrand.includes(phrase.toLowerCase())
    )) {
      console.log(`Filtered out (generic phrase): ${brand.name}`);
      return false;
    }
    
    // Enhanced generic term filtering - exact matches and partial matches
    if (FALSE_POSITIVE_PATTERNS.genericTerms.some(term => 
      normalizedBrand === term || 
      (term.length > 3 && normalizedBrand.includes(term))
    )) {
      console.log(`Filtered out (generic term): ${brand.name}`);
      return false;
    }
    
    // Enhanced common word filtering - exact matches
    if (FALSE_POSITIVE_PATTERNS.commonWords.some(word => 
      normalizedBrand === word.toLowerCase()
    )) {
      console.log(`Filtered out (common word): ${brand.name}`);
      return false;
    }
    
    // Filter single words that are clearly not brand names (verbs, adjectives, etc.)
    const singleWordNonBrands = [
      'helps', 'provides', 'offers', 'creates', 'makes', 'uses', 'includes',
      'focuses', 'specializes', 'delivers', 'enables', 'supports', 'manages',
      'tracks', 'monitors', 'analyzes', 'optimizes', 'integrates', 'automates',
      'comprehensive', 'advanced', 'specific', 'professional', 'enterprise',
      'popular', 'leading', 'effective', 'powerful', 'innovative', 'reliable',
      'management', 'scheduling', 'calendar', 'larger', 'widely', 'known',
      'choosing', 'when', 'what', 'their', 'also', 'well', 'track', 'consider',
      'understanding', 'research', 'easy', 'help', 'range', 'affordable', 'your'
    ];
    
    if (singleWordNonBrands.includes(normalizedBrand)) {
      console.log(`Filtered out (single word non-brand): ${brand.name}`);
      return false;
    }
    
    // Check context patterns
    if (FALSE_POSITIVE_PATTERNS.contextPatterns.some(pattern => 
      pattern.test(brand.context)
    )) {
      console.log(`Filtered out (context pattern): ${brand.name}`);
      return false;
    }
    
    // ENHANCED: Additional business term filtering for pricing/quality terms
    const businessDescriptors = /^(pricing|cost|budget|value|affordable|expensive|cheap|premium|quality|reliable|trusted|proven|established|popular|leading|best|top|good|great|excellent|amazing|outstanding|superior)$/i;
    if (businessDescriptors.test(normalizedBrand)) {
      console.log(`Filtered out (business descriptor): ${brand.name}`);
      return false;
    }
    
    // ENHANCED: Filter out possessive pronouns and determiners
    const pronounsAndDeterminers = /^(your|their|these|those|this|that|some|many|several|various|different|other|others|more|most|less|few|all|every|each)$/i;
    if (pronounsAndDeterminers.test(normalizedBrand)) {
      console.log(`Filtered out (pronoun/determiner): ${brand.name}`);
      return false;
    }
    
    // In strict mode, require minimum confidence and context
    if (strictFiltering) {
      if (brand.confidence < 0.6) {
        console.log(`Filtered out (low confidence): ${brand.name} (${brand.confidence})`);
        return false; 
      }
      
      // Require business context for unknown brands (unless it's a known good pattern)
      const hasBusinessContext = BUSINESS_CONTEXT_INDICATORS.some(indicator => 
        brand.context.toLowerCase().includes(indicator)
      );
      
      const isLikelyBrand = brand.name.includes('.') || // Domain names
                           /^[A-Z][a-z]+[A-Z]/.test(brand.name) || // CamelCase
                           brand.name.length >= 8; // Longer names more likely to be brands
      
      if (!hasBusinessContext && !isLikelyBrand && brand.confidence < 0.8) {
        console.log(`Filtered out (no business context): ${brand.name}`);
        return false;
      }
    }
    
    console.log(`Kept brand: ${brand.name} (confidence: ${brand.confidence})`);
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
  
  console.log(`Classifying ${extractedBrands.length} brands against catalog of ${brandCatalog.length} entries`);
  console.log('Brand catalog:', brandCatalog);
  
  // Create a set of org brand names and variants for fast lookup
  const orgBrandNames = new Set<string>();
  const orgBrandVariants = new Set<string>();
  
  brandCatalog
    .filter(b => b.is_org_brand)
    .forEach(brand => {
      const normalizedName = enhancedNormalize(brand.name);
      orgBrandNames.add(normalizedName);
      console.log(`Added org brand: ${brand.name} -> ${normalizedName}`);
      
      if (brand.variants_json) {
        brand.variants_json.forEach(variant => {
          const normalizedVariant = enhancedNormalize(variant);
          orgBrandVariants.add(normalizedVariant);
          console.log(`Added org variant: ${variant} -> ${normalizedVariant}`);
        });
      }
    });
  
  console.log('Org brand names:', Array.from(orgBrandNames));
  console.log('Org brand variants:', Array.from(orgBrandVariants));
  
  for (const brand of extractedBrands) {
    const matchResult = findBestBrandMatch(brand, brandCatalog);
    
    // Enhanced org brand detection - check multiple patterns
    const normalizedBrand = enhancedNormalize(brand.name);
    console.log(`Checking brand: ${brand.name} -> ${normalizedBrand}`);
    
    const isDefinitelyOrgBrand = matchResult.isOrgBrand || 
      orgBrandNames.has(normalizedBrand) ||
      orgBrandVariants.has(normalizedBrand) ||
      // Additional fuzzy matching for org brands
      Array.from(orgBrandNames).some(orgName => {
        const similarity = calculateSimilarity(normalizedBrand, orgName);
        console.log(`Similarity between ${normalizedBrand} and ${orgName}: ${similarity}`);
        return similarity >= 0.85; // High threshold for org brand matching
      });
    
    if (isDefinitelyOrgBrand) {
      console.log(`✅ IDENTIFIED AS ORG BRAND: ${brand.name}`);
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
        console.log(`➕ IDENTIFIED AS COMPETITOR: ${brand.name}`);
        competitors.push(brand);
      } else {
        console.log(`✅ RESCUED AS ORG BRAND: ${brand.name} (was almost missed)`);
        // This was likely an org brand - add it to org brands with lower confidence
        orgBrands.push({
          ...brand,
          confidence: 0.8, // Lower confidence since it was almost missed
          matchType: 'fuzzy'
        });
      }
    } else {
      console.log(`❌ FILTERED OUT (low confidence): ${brand.name} (${brand.confidence})`);
    }
  }
  
  console.log(`Final classification: ${orgBrands.length} org brands, ${competitors.length} competitors`);
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