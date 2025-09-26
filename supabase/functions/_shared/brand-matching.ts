/**
 * Brand normalization and matching utilities for edge functions
 */

export interface BrandCatalogEntry {
  id?: string;
  name: string;
  variants_json?: string[];
  is_org_brand: boolean;
}

export interface CanonicalBrand {
  canonical: string;
  isOrgBrand: boolean;
  variants: string[];
}

export function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Convert brand catalog to canonical mapping for consistent brand resolution
 */
export function toCanonical(catalog: BrandCatalogEntry[]): Map<string, CanonicalBrand> {
  const canonicalMap = new Map<string, CanonicalBrand>();
  
  for (const brand of catalog) {
    const canonical = brand.name.trim();
    const normalizedCanonical = normalize(canonical);
    const variants = [canonical, ...(brand.variants_json || [])];
    
    const canonicalBrand: CanonicalBrand = {
      canonical,
      isOrgBrand: brand.is_org_brand,
      variants
    };
    
    // Map canonical name and all variants to the same canonical brand
    canonicalMap.set(normalizedCanonical, canonicalBrand);
    
    for (const variant of variants) {
      const normalizedVariant = normalize(variant);
      if (normalizedVariant && normalizedVariant.length >= 3) {
        canonicalMap.set(normalizedVariant, canonicalBrand);
      }
    }
  }
  
  return canonicalMap;
}

/**
 * Resolve a brand name to its canonical form using the catalog
 */
export function resolveCanonical(brandName: string, canonicalMap: Map<string, CanonicalBrand>): CanonicalBrand | null {
  const normalized = normalize(brandName);
  
  if (normalized.length < 3) {
    return null;
  }
  
  return canonicalMap.get(normalized) || null;
}

/**
 * Filter out org brands and noise from competitor list
 */
export function cleanCompetitorList(
  brands: string[], 
  canonicalMap: Map<string, CanonicalBrand>
): Array<{ canonical: string; mentions: number }> {
  const competitorCounts = new Map<string, number>();
  const excludeTerms = ['openai', 'claude', 'copilot', 'google', 'chatgpt', 'ai', 'microsoft', 'meta', 'facebook'];
  
  for (const brand of brands) {
    if (typeof brand !== 'string' || brand.length < 3) continue;
    
    const normalized = normalize(brand);
    
    // Skip generic AI terms
    if (excludeTerms.some((term: string) => normalized.includes(term))) continue;
    
    const canonical = resolveCanonical(brand, canonicalMap);
    
    // Skip org brands
    if (canonical?.isOrgBrand) continue;
    
    const canonicalName = canonical?.canonical || brand.trim();
    competitorCounts.set(canonicalName, (competitorCounts.get(canonicalName) || 0) + 1);
  }
  
  return Array.from(competitorCounts.entries())
    .map(([canonical, mentions]: [string, number]) => ({ canonical, mentions }))
    .sort((a: any, b: any) => b.mentions - a.mentions);
}

export function isOrgBrand(token: string, catalog: Array<{ name: string; variants_json: string[] }>): boolean {
  const normalizedToken = normalize(token);
  
  // Avoid false positives for very short strings (allow 3+ to include IBM, SAP)
  if (normalizedToken.length < 3) {
    return false;
  }

  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const boundaryMatch = (hay: string, needle: string) => {
    const re = new RegExp(`(^|\\s)${escapeRegex(needle)}(\\s|$)`, 'i');
    return re.test(hay);
  };

  for (const brand of catalog) {
    const normalizedBrandName = normalize(brand.name);
    
    // Exact or boundary match with brand name
    if (normalizedToken === normalizedBrandName || boundaryMatch(normalizedToken, normalizedBrandName)) {
      return true;
    }

    // Check variants with boundary safety
    for (const variant of brand.variants_json || []) {
      const normalizedVariant = normalize(variant);
      if (!normalizedVariant || normalizedVariant.length < 3) continue;
      if (normalizedToken === normalizedVariant || boundaryMatch(normalizedToken, normalizedVariant)) {
        return true;
      }
    }
  }

  return false;
}