/**
 * Enhanced brand matching with context awareness and fuzzy matching
 */

export interface BrandMatch {
  brand: string;
  confidence: number;
  matchType: 'exact' | 'variant' | 'fuzzy' | 'partial';
  position: number;
  context: string; // surrounding text for context analysis
}

export interface BrandCatalogItem {
  name: string;
  variants_json: string[];
  is_org_brand: boolean;
}

/**
 * Enhanced normalization that handles domain names and special characters
 */
export function enhancedNormalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\.com$|\.io$|\.net$|\.org$/i, '') // Remove common TLDs
    .replace(/[^\w\s.-]/g, '') // Keep dots and hyphens for domain names
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
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
 * Advanced brand matching with multiple strategies
 */
export function findBrandMatches(
  text: string, 
  brandCatalog: BrandCatalogItem[]
): BrandMatch[] {
  const matches: BrandMatch[] = [];
  const processedText = text.toLowerCase();

  for (const brand of brandCatalog) {
    const allBrandTerms = [brand.name, ...(brand.variants_json || [])];
    
    for (const brandTerm of allBrandTerms) {
      const normalizedBrand = enhancedNormalize(brandTerm);
      
      // Skip very short brand names without context
      if (normalizedBrand.length < 2) continue;
      
      // Strategy 1: Exact match
      const exactMatches = findExactMatches(processedText, brandTerm);
      matches.push(...exactMatches.map(match => ({
        brand: brand.name,
        confidence: 1.0,
        matchType: 'exact' as const,
        position: match.position,
        context: match.context
      })));

      // Strategy 2: Case-insensitive with word boundaries
      const boundaryMatches = findBoundaryMatches(processedText, normalizedBrand, text);
      matches.push(...boundaryMatches.map(match => ({
        brand: brand.name,
        confidence: 0.9,
        matchType: 'exact' as const,
        position: match.position,
        context: match.context
      })));

      // Strategy 3: Fuzzy matching for typos/variations
      if (normalizedBrand.length >= 4) {
        const fuzzyMatches = findFuzzyMatches(processedText, normalizedBrand, text);
        matches.push(...fuzzyMatches.map(match => ({
          brand: brand.name,
          confidence: match.confidence,
          matchType: 'fuzzy' as const,
          position: match.position,
          context: match.context
        })));
      }
    }
  }

  // Remove duplicates and sort by confidence
  return deduplicateMatches(matches);
}

function findExactMatches(text: string, brandTerm: string): Array<{position: number, context: string}> {
  const matches: Array<{position: number, context: string}> = [];
  const regex = new RegExp(brandTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const position = match.index;
    const context = extractContext(text, position, brandTerm.length);
    matches.push({ position, context });
  }
  
  return matches;
}

function findBoundaryMatches(
  processedText: string, 
  normalizedBrand: string, 
  originalText: string
): Array<{position: number, context: string}> {
  const matches: Array<{position: number, context: string}> = [];
  const regex = new RegExp(`\\b${normalizedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  let match;
  
  while ((match = regex.exec(processedText)) !== null) {
    const position = match.index;
    const context = extractContext(originalText, position, normalizedBrand.length);
    matches.push({ position, context });
  }
  
  return matches;
}

function findFuzzyMatches(
  text: string, 
  brandTerm: string, 
  originalText: string
): Array<{position: number, context: string, confidence: number}> {
  const matches: Array<{position: number, context: string, confidence: number}> = [];
  const words = text.split(/\s+/);
  let currentPosition = 0;

  for (const word of words) {
    const cleanWord = word.replace(/[^\w.-]/g, '');
    if (cleanWord.length >= 3) {
      const distance = levenshteinDistance(cleanWord, brandTerm);
      const maxDistance = Math.floor(brandTerm.length * 0.2); // Allow 20% error
      
      if (distance <= maxDistance && distance > 0) {
        const confidence = 1 - (distance / brandTerm.length);
        if (confidence >= 0.7) {
          const position = text.indexOf(word, currentPosition);
          const context = extractContext(originalText, position, word.length);
          matches.push({ position, context, confidence });
        }
      }
    }
    currentPosition += word.length + 1;
  }
  
  return matches;
}

function extractContext(text: string, position: number, termLength: number): string {
  const contextSize = 100;
  const start = Math.max(0, position - contextSize);
  const end = Math.min(text.length, position + termLength + contextSize);
  return text.slice(start, end);
}

function deduplicateMatches(matches: BrandMatch[]): BrandMatch[] {
  const seen = new Map<string, BrandMatch>();
  
  for (const match of matches) {
    const key = `${match.brand}-${match.position}`;
    const existing = seen.get(key);
    
    if (!existing || match.confidence > existing.confidence) {
      seen.set(key, match);
    }
  }
  
  return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if a brand match is relevant based on context
 */
export function isRelevantBrandMention(match: BrandMatch, userIndustry?: string): boolean {
  const context = match.context.toLowerCase();
  
  // Filter out generic mentions
  const genericPhrases = [
    'for example',
    'such as',
    'like apple or google',
    'similar to',
    'including but not limited to',
    'e.g.',
    'i.e.',
  ];
  
  if (genericPhrases.some(phrase => context.includes(phrase))) {
    return false;
  }
  
  // Filter out negative/dismissive mentions
  const negativePhrases = [
    'not like',
    'unlike',
    'different from',
    'avoid',
    'worse than',
    'outdated like',
  ];
  
  if (negativePhrases.some(phrase => context.includes(phrase))) {
    return false;
  }
  
  return true;
}

/**
 * Enhanced function to check if a token matches user's brand with confidence scoring
 */
export function matchUserBrand(
  token: string, 
  brandCatalog: BrandCatalogItem[]
): { isMatch: boolean; confidence: number; matchedBrand: string } {
  const userBrands = brandCatalog.filter(b => b.is_org_brand);
  const normalizedToken = enhancedNormalize(token);
  
  for (const brand of userBrands) {
    const allTerms = [brand.name, ...(brand.variants_json || [])];
    
    for (const term of allTerms) {
      const normalizedTerm = enhancedNormalize(term);
      
      // Exact match
      if (normalizedToken === normalizedTerm) {
        return { isMatch: true, confidence: 1.0, matchedBrand: brand.name };
      }
      
      // Partial match for longer brands
      if (normalizedTerm.length >= 4) {
        if (normalizedToken.includes(normalizedTerm) || normalizedTerm.includes(normalizedToken)) {
          const similarity = Math.max(normalizedToken.length, normalizedTerm.length) / 
                           Math.min(normalizedToken.length, normalizedTerm.length);
          const confidence = Math.min(0.8, 1 / similarity);
          if (confidence >= 0.6) {
            return { isMatch: true, confidence, matchedBrand: brand.name };
          }
        }
      }
      
      // Fuzzy match
      if (normalizedTerm.length >= 3) {
        const distance = levenshteinDistance(normalizedToken, normalizedTerm);
        const maxDistance = Math.floor(normalizedTerm.length * 0.25);
        if (distance <= maxDistance && distance > 0) {
          const confidence = Math.max(0.5, 1 - (distance / normalizedTerm.length));
          return { isMatch: true, confidence, matchedBrand: brand.name };
        }
      }
    }
  }
  
  return { isMatch: false, confidence: 0, matchedBrand: '' };
}