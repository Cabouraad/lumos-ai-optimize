/**
 * Unified Brand/Competitor Extraction Module
 * Uses only organization's brand_catalog for verification
 */

export interface BrandCatalogEntry {
  id?: string;
  name: string;
  variants_json?: string[];
  is_org_brand: boolean;
}

export interface ExtractedBrands {
  orgBrands: string[];
  competitors: string[];
  rejectedTerms: string[];
}

// Enhanced stopwords list including terms from user's specific case
const STOPWORDS = new Set([
  // Generic terms
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'for', 'and', 'the', 'with', 'you', 'your', 'our', 'their', 'this', 'that',
  'tools', 'tool', 'software', 'platform', 'service', 'solution', 'system',
  'data', 'content', 'marketing', 'business', 'company', 'team', 'user', 'users',
  'customer', 'customers', 'client', 'clients', 'email', 'web', 'mobile', 'app',
  'digital', 'online', 'social', 'media', 'search', 'analytics', 'insights',
  'management', 'automation', 'integration', 'optimization', 'performance',
  'experience', 'strategy', 'campaigns', 'audience', 'engagement', 'conversion',
  // Action words that were being detected as competitors
  'choose', 'focus', 'start', 'implement', 'use', 'create', 'build', 'get',
  'track', 'automate', 'analyze', 'defining', 'clarify', 'mapping', 'identify',
  'consider', 'enhance', 'hinder', 'improve', 'boost', 'increase', 'avoid',
  // Tech giants (too generic to be useful competitors)
  'facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'pinterest',
  'adobe', 'microsoft', 'google', 'apple', 'amazon', 'meta',
  // Common spam/generic patterns
  'here', 'there', 'more', 'less', 'click', 'learn', 'read', 'see', 'find',
  'categories', 'categorize', 'steps', 'breakdown', 'example', 'workflow'
]);

/**
 * Validates if a term could be a legitimate brand name
 */
function isValidBrandCandidate(term: string): boolean {
  const normalized = term.toLowerCase().trim();
  
  // Basic validation
  if (normalized.length < 3 || normalized.length > 50) {
    return false;
  }
  
  // Check stopwords
  if (STOPWORDS.has(normalized)) {
    return false;
  }
  
  // Reject purely numeric
  if (/^[0-9]+$/.test(normalized)) {
    return false;
  }
  
  // Reject terms with problematic characters
  if (/[<>{}[\]()"`''""''„"‚'']/.test(normalized)) {
    return false;
  }
  
  // Reject obvious spam patterns
  if (normalized.includes('click here') || 
      normalized.includes('learn more') ||
      normalized.includes('sign up') ||
      normalized.includes('get started')) {
    return false;
  }
  
  // Reject very generic single words unless they look like brands
  if (!normalized.includes(' ') && 
      !normalized.includes('.') && 
      !normalized.includes('-') && 
      normalized.length < 5) {
    return false;
  }
  
  return true;
}

/**
 * Normalizes brand name for comparison
 */
function normalizeBrandName(name: string): string {
  return name.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

/**
 * Checks if a term matches any brand in the catalog
 */
function findBrandMatch(term: string, catalog: BrandCatalogEntry[]): BrandCatalogEntry | null {
  const normalizedTerm = normalizeBrandName(term);
  
  for (const brand of catalog) {
    const normalizedBrandName = normalizeBrandName(brand.name);
    
    // Exact match with brand name
    if (normalizedTerm === normalizedBrandName) {
      return brand;
    }
    
    // Check variants
    for (const variant of brand.variants_json || []) {
      const normalizedVariant = normalizeBrandName(variant);
      if (normalizedVariant && normalizedTerm === normalizedVariant) {
        return brand;
      }
    }
  }
  
  return null;
}

/**
 * Extracts potential brand mentions from text using various patterns
 */
function extractPotentialBrands(text: string): string[] {
  const brands = new Set<string>();
  
  // Pattern 1: Capitalized words/phrases (brand names are usually capitalized)
  const capitalizedWords = text.match(/\b[A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*\b/g) || [];
  capitalizedWords.forEach(term => brands.add(term.trim()));
  
  // Pattern 2: Common brand patterns with domains
  const domainPatterns = text.match(/\b[a-zA-Z0-9]+(\.com|\.io|\.net|\.org)\b/g) || [];
  domainPatterns.forEach(term => {
    // Extract just the domain name without extension
    const domainName = term.split('.')[0];
    if (domainName.length >= 3) {
      brands.add(domainName.charAt(0).toUpperCase() + domainName.slice(1));
    }
  });
  
  // Pattern 3: Quoted brand names
  const quotedTerms = text.match(/"([^"]+)"/g) || [];
  quotedTerms.forEach(term => {
    const cleaned = term.replace(/["""]/g, '').trim();
    if (cleaned.length >= 3) {
      brands.add(cleaned);
    }
  });
  
  // Pattern 4: Terms after "like", "such as", "including"
  const contextPatterns = [
    /(?:like|such as|including)\s+([A-Z][a-zA-Z0-9\s]+?)(?:[,.;:]|$)/gi,
    /(?:tools like|platforms like|software like)\s+([A-Z][a-zA-Z0-9\s]+?)(?:[,.;:]|$)/gi
  ];
  
  contextPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const terms = match[1].split(/,|\sand\s/).map(t => t.trim());
      terms.forEach(term => {
        if (term.length >= 3) {
          brands.add(term);
        }
      });
    }
  });
  
  return Array.from(brands);
}

/**
 * Main extraction function that uses only brand_catalog for verification
 */
export function extractBrandsFromText(
  text: string, 
  brandCatalog: BrandCatalogEntry[]
): ExtractedBrands {
  const potentialBrands = extractPotentialBrands(text);
  const orgBrands: string[] = [];
  const competitors: string[] = [];
  const rejectedTerms: string[] = [];
  
  for (const term of potentialBrands) {
    // First validate if it could be a brand
    if (!isValidBrandCandidate(term)) {
      rejectedTerms.push(term);
      continue;
    }
    
    // Check against brand catalog
    const match = findBrandMatch(term, brandCatalog);
    
    if (match) {
      if (match.is_org_brand) {
        orgBrands.push(match.name);
      } else {
        competitors.push(match.name);
      }
    } else {
      // Not in catalog - reject (catalog-only approach)
      rejectedTerms.push(term);
    }
  }
  
  // Remove duplicates and maintain original case from catalog
  return {
    orgBrands: [...new Set(orgBrands)],
    competitors: [...new Set(competitors)],
    rejectedTerms: [...new Set(rejectedTerms)]
  };
}

/**
 * Creates a simple brand gazetteer from catalog (for backward compatibility)
 */
export function createBrandGazetteer(brandCatalog: BrandCatalogEntry[]): string[] {
  const gazetteer = new Set<string>();
  
  for (const brand of brandCatalog) {
    gazetteer.add(brand.name);
    for (const variant of brand.variants_json || []) {
      if (variant && variant.length >= 3) {
        gazetteer.add(variant);
      }
    }
  }
  
  return Array.from(gazetteer);
}

/**
 * Utility to get organization brand names from catalog
 */
export function getOrgBrandNames(brandCatalog: BrandCatalogEntry[]): string[] {
  return brandCatalog
    .filter(brand => brand.is_org_brand)
    .map(brand => brand.name);
}

/**
 * Utility to get competitor names from catalog
 */
export function getCompetitorNames(brandCatalog: BrandCatalogEntry[]): string[] {
  return brandCatalog
    .filter(brand => !brand.is_org_brand)
    .map(brand => brand.name);
}