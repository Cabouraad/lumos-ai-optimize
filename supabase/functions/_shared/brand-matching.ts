/**
 * Brand normalization and matching utilities for edge functions
 */

export function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

export function isOrgBrand(token: string, catalog: Array<{ name: string; variants_json: string[] }>): boolean {
  const normalizedToken = normalize(token);
  
  // Avoid false positives for very short strings
  if (normalizedToken.length < 4) {
    return false;
  }

  for (const brand of catalog) {
    const normalizedBrandName = normalize(brand.name);
    
    // Exact match with brand name
    if (normalizedToken === normalizedBrandName) {
      return true;
    }
    
    // Check if token starts with or contains brand name (for longer brands)
    if (normalizedBrandName.length >= 4) {
      if (normalizedToken.startsWith(normalizedBrandName) || 
          normalizedToken.includes(normalizedBrandName)) {
        return true;
      }
    }

    // Check variants
    for (const variant of brand.variants_json || []) {
      const normalizedVariant = normalize(variant);
      
      if (normalizedToken === normalizedVariant) {
        return true;
      }
      
      if (normalizedVariant.length >= 4) {
        if (normalizedToken.startsWith(normalizedVariant) || 
            normalizedToken.includes(normalizedVariant)) {
          return true;
        }
      }
    }
  }

  return false;
}