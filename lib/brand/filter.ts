/**
 * Comprehensive brand filtering system to remove irrelevant brands
 */

export interface FilterContext {
  userIndustry?: string;
  userBusinessType?: string;
  promptText: string;
  responseText: string;
}

/**
 * Comprehensive list of common words to filter out
 */
const COMMON_WORDS = new Set([
  // Articles, prepositions, conjunctions
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  
  // Common adjectives
  'best', 'good', 'better', 'great', 'new', 'old', 'first', 'last', 'next', 'other', 'another',
  'top', 'main', 'major', 'minor', 'big', 'small', 'large', 'huge', 'tiny', 'short', 'long',
  'high', 'low', 'fast', 'slow', 'easy', 'hard', 'simple', 'complex',
  
  // Time/quantity words  
  'some', 'many', 'most', 'all', 'every', 'each', 'few', 'several', 'various',
  'when', 'where', 'what', 'how', 'why', 'who', 'which', 'here', 'there', 'this', 'that',
  'now', 'then', 'today', 'tomorrow', 'yesterday',
  
  // Business generic terms
  'business', 'company', 'corporation', 'enterprise', 'organization', 'firm', 'agency',
  'service', 'solution', 'product', 'platform', 'system', 'tool', 'software',
  'application', 'app', 'website', 'site', 'portal', 'dashboard',
  
  // Action words that appear capitalized
  'create', 'build', 'make', 'develop', 'design', 'manage', 'handle', 'process',
  'analyze', 'review', 'update', 'improve', 'optimize', 'enhance',
  
  // Generic tech terms
  'data', 'database', 'server', 'cloud', 'api', 'interface', 'framework', 'library',
  'code', 'programming', 'development', 'testing', 'deployment',
  
  // False positive brands (generic terms often capitalized)
  'search', 'email', 'mobile', 'web', 'online', 'digital', 'smart', 'pro', 'plus',
  'premium', 'standard', 'basic', 'free', 'paid', 'custom', 'advanced',
]);

/**
 * Industry-specific brand categories for filtering
 */
const INDUSTRY_BRAND_MAP: Record<string, Set<string>> = {
  'software': new Set([
    'microsoft', 'google', 'apple', 'adobe', 'salesforce', 'oracle', 'ibm', 'github',
    'atlassian', 'slack', 'zoom', 'dropbox', 'notion', 'asana', 'trello'
  ]),
  'ecommerce': new Set([
    'shopify', 'woocommerce', 'magento', 'bigcommerce', 'stripe', 'paypal', 'square',
    'amazon', 'ebay', 'etsy'
  ]),
  'marketing': new Set([
    'hubspot', 'mailchimp', 'salesforce', 'marketo', 'pardot', 'klaviyo', 'constant contact',
    'hootsuite', 'buffer', 'sprout social'
  ]),
  'design': new Set([
    'adobe', 'figma', 'sketch', 'canva', 'invision', 'marvel', 'principle', 'framer'
  ]),
  'finance': new Set([
    'quickbooks', 'xero', 'sage', 'freshbooks', 'wave', 'mint', 'ynab'
  ])
};

/**
 * Brands that are commonly mentioned as examples but rarely actual recommendations
 */
const EXAMPLE_BRANDS = new Set([
  'apple', 'google', 'microsoft', 'amazon', 'facebook', 'meta', 'twitter', 'x',
  'coca cola', 'mcdonalds', 'nike', 'disney', 'walmart', 'target'
]);

/**
 * Filter out irrelevant or generic brand mentions
 */
export function filterRelevantBrands(
  brandMentions: Array<{ brand: string; context: string; position: number }>,
  filterContext: FilterContext
): Array<{ brand: string; context: string; position: number; relevanceScore: number }> {
  return brandMentions
    .map(mention => ({
      ...mention,
      relevanceScore: calculateRelevanceScore(mention, filterContext)
    }))
    .filter(mention => mention.relevanceScore > 0.3) // Minimum relevance threshold
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Calculate relevance score for a brand mention
 */
function calculateRelevanceScore(
  mention: { brand: string; context: string; position: number },
  filterContext: FilterContext
): number {
  let score = 0.5; // Base score
  
  const brandLower = mention.brand.toLowerCase();
  const contextLower = mention.context.toLowerCase();
  
  // Filter out common words
  if (COMMON_WORDS.has(brandLower)) {
    return 0;
  }
  
  // Filter out very short names without context
  if (brandLower.length < 3 && !hasStrongContext(contextLower)) {
    return 0;
  }
  
  // Check if it's an example mention (reduce score)
  if (isExampleMention(contextLower)) {
    score *= 0.4;
  }
  
  // Check if it's in a list context (reduce score slightly)
  if (isInListContext(contextLower)) {
    score *= 0.7;
  }
  
  // Industry relevance boost
  if (filterContext.userIndustry) {
    const industryBrands = INDUSTRY_BRAND_MAP[filterContext.userIndustry.toLowerCase()];
    if (industryBrands?.has(brandLower)) {
      score *= 1.5;
    }
  }
  
  // Contextual relevance indicators
  if (hasPositiveIndicators(contextLower)) {
    score *= 1.3;
  }
  
  if (hasNegativeIndicators(contextLower)) {
    score *= 0.3;
  }
  
  // Position relevance (earlier mentions often more important)
  const positionFactor = 1 - (mention.position / 1000); // Normalize position
  score *= (0.5 + positionFactor * 0.5);
  
  // Domain/URL detection boost
  if (isDomainOrUrl(mention.brand)) {
    score *= 1.2;
  }
  
  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Check if brand has strong context indicators
 */
function hasStrongContext(context: string): boolean {
  const strongIndicators = [
    '.com', '.io', '.net', '.org',
    'company', 'platform', 'service', 'solution',
    'founded', 'based', 'offers', 'provides'
  ];
  
  return strongIndicators.some(indicator => context.includes(indicator));
}

/**
 * Detect if mention is in an example context
 */
function isExampleMention(context: string): boolean {
  const examplePatterns = [
    'for example', 'such as', 'e.g.', 'i.e.', 'including',
    'like apple', 'like google', 'like microsoft',
    'similar to', 'comparable to', 'examples include'
  ];
  
  return examplePatterns.some(pattern => context.includes(pattern));
}

/**
 * Check if mention is in a list context
 */
function isInListContext(context: string): boolean {
  const listIndicators = [
    ', ', ' and ', ' or ', '• ', '- ', '1.', '2.', '3.',
    'options include', 'alternatives are', 'choices are'
  ];
  
  return listIndicators.some(indicator => context.includes(indicator));
}

/**
 * Detect positive context indicators
 */
function hasPositiveIndicators(context: string): boolean {
  const positiveWords = [
    'recommend', 'suggests', 'best', 'top', 'leading', 'preferred',
    'excellent', 'outstanding', 'superior', 'optimal', 'ideal',
    'should use', 'try', 'consider', 'choose'
  ];
  
  return positiveWords.some(word => context.includes(word));
}

/**
 * Detect negative context indicators
 */
function hasNegativeIndicators(context: string): boolean {
  const negativeWords = [
    'avoid', 'not recommend', 'poor', 'bad', 'terrible',
    'outdated', 'deprecated', 'discontinued', 'problematic',
    'unlike', 'different from', 'instead of', 'rather than'
  ];
  
  return negativeWords.some(word => context.includes(word));
}

/**
 * Check if the brand mention looks like a domain or URL
 */
function isDomainOrUrl(brand: string): boolean {
  return /\.(com|io|net|org|co|ai)$/i.test(brand) || 
         /https?:\/\//.test(brand);
}

/**
 * Filter brands that are clearly not business software/services
 */
export function filterNonBusinessBrands(brands: string[]): string[] {
  const nonBusinessCategories = new Set([
    // Food & Beverage
    'mcdonalds', 'coca cola', 'pepsi', 'starbucks', 'dominos', 'kfc',
    // Retail/Fashion
    'nike', 'adidas', 'gucci', 'prada', 'zara', 'h&m',
    // Entertainment
    'disney', 'netflix', 'hulu', 'hbo', 'paramount', 'warner bros',
    // Automotive
    'tesla', 'ford', 'toyota', 'bmw', 'mercedes', 'volkswagen',
    // Airlines
    'delta', 'american airlines', 'united', 'southwest',
  ]);
  
  return brands.filter(brand => !nonBusinessCategories.has(brand.toLowerCase()));
}

/**
 * Main filtering function
 */
export function applyBrandFilters(
  extractedBrands: string[],
  filterContext: FilterContext
): string[] {
  // Step 1: Remove common words
  let filtered = extractedBrands.filter(brand => !COMMON_WORDS.has(brand.toLowerCase()));
  
  // Step 2: Filter non-business brands if in business context
  filtered = filterNonBusinessBrands(filtered);
  
  // Step 3: Remove single character or very generic terms
  filtered = filtered.filter(brand => {
    const normalized = brand.toLowerCase().trim();
    return normalized.length >= 2 && !/^[0-9]+$/.test(normalized);
  });
  
  // Step 4: Deduplicate (case-insensitive)
  const seen = new Set<string>();
  filtered = filtered.filter(brand => {
    const key = brand.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  return filtered;
}