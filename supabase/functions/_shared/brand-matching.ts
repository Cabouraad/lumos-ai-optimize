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