/**
 * Enhanced artifact extraction utilities with improved brand detection
 */

// Enhanced brand normalization function
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\.com$|\.io$|\.net$|\.org$/i, '') // Remove common TLDs
    .replace(/[^\w\s.-]/g, '') // Keep dots and hyphens for domain names
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

export interface Citation {
  type: 'url' | 'ref';
  value: string;
  hostname?: string; // For URLs, extract hostname for better display
}

export interface BrandArtifact {
  name: string;
  normalized: string;
  mentions: number;
  first_pos_ratio: number;
  confidence: number;
  context: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface ExtractedArtifacts {
  citations: Citation[];
  brands: BrandArtifact[];
  competitors: BrandArtifact[];
  metadata: {
    total_brands_found: number;
    response_length: number;
    analysis_confidence: number;
  };
}

/**
 * Enhanced artifact extraction with improved brand detection
 */
export function extractArtifacts(
  responseText: string, 
  userBrandNorms: string[], 
  gazetteer: string[]
): ExtractedArtifacts {
  const citations = extractEnhancedCitations(responseText);
  const brandArtifacts = extractEnhancedBrands(responseText, gazetteer);
  
  // Separate user brands from competitors with confidence scoring
  const brands: BrandArtifact[] = [];
  const competitors: BrandArtifact[] = [];
  
  for (const brand of brandArtifacts) {
    if (userBrandNorms.includes(brand.normalized)) {
      brands.push(brand);
    } else {
      // Only include competitors with high confidence to reduce false positives
      if (brand.confidence >= 0.75) {
        competitors.push(brand);
      }
    }
  }
  
  return {
    citations,
    brands,
    competitors,
    metadata: {
      total_brands_found: brandArtifacts.length,
      response_length: responseText.length,
      analysis_confidence: calculateAnalysisConfidence(brandArtifacts)
    }
  };
}

/**
 * Enhanced citation extraction with hostname parsing
 */
function extractEnhancedCitations(text: string): Citation[] {
  const citations: Citation[] = [];
  const seenCitations = new Set<string>();
  
  // Extract URLs with better parsing
  const urlRegex = /(https?:\/\/(?:www\.)?[^\s)\]<>"']+)/gi;
  let urlMatch: RegExpExecArray | null;
  
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    const url = urlMatch[1];
    
    // Clean up common trailing punctuation
    const cleanUrl = url.replace(/[.,;!?)\]]+$/, '');
    
    if (!seenCitations.has(cleanUrl)) {
      seenCitations.add(cleanUrl);
      
      try {
        const hostname = new URL(cleanUrl).hostname.replace(/^www\./, '');
        citations.push({
          type: 'url',
          value: cleanUrl,
          hostname
        });
      } catch {
        // If URL parsing fails, still include it
        citations.push({
          type: 'url',
          value: cleanUrl
        });
      }
    }
  }
  
  // Extract bracket references with improved patterns
  const refPatterns = [
    /\[(\d+)\]/g, // [1], [2], etc.
    /\[([A-Za-z][A-Za-z\s]{1,30})\]/g, // [Smith], [OpenAI 2023], etc.
    /\[([A-Za-z]\w*\.?\s*\d{4})\]/g, // [Smith 2023], [A. 2024], etc.
  ];
  
  for (const pattern of refPatterns) {
    let refMatch: RegExpExecArray | null;
    while ((refMatch = pattern.exec(text)) !== null) {
      const refValue = refMatch[1];
      if (!seenCitations.has(refValue)) {
        seenCitations.add(refValue);
        citations.push({
          type: 'ref',
          value: refValue
        });
      }
    }
  }
  
  return citations;
}

/**
 * Catalog-only brand extraction - only matches brands from the provided catalog
 */
function extractEnhancedBrands(text: string, gazetteer: string[]): BrandArtifact[] {
  const brands: Map<string, BrandArtifact> = new Map();
  const textLength = text.length;
  
  // CRITICAL: Only process brands that are in the catalog - no discovery of new brands
  for (const brandName of gazetteer) {
    const normalized = normalize(brandName);
    
    // Create precise regex for exact brand matching with word boundaries
    const brandRegex = createBrandRegex(brandName);
    const matches = Array.from(text.matchAll(brandRegex));
    
    if (matches.length > 0) {
      // Calculate first position ratio
      const firstIndex = matches[0].index || 0;
      const firstPosRatio = textLength > 0 ? firstIndex / textLength : 0;
      
      // Extract context around first mention
      const contextStart = Math.max(0, firstIndex - 50);
      const contextEnd = Math.min(text.length, firstIndex + brandName.length + 50);
      const context = text.slice(contextStart, contextEnd);
      
      // Calculate confidence based on context and match quality
      const confidence = calculateBrandConfidence(brandName, context, matches.length);
      
      // Only include high-confidence matches to reduce false positives
      if (confidence >= 0.6) {
        brands.set(normalized, {
          name: brandName,
          normalized,
          mentions: matches.length,
          first_pos_ratio: firstPosRatio,
          confidence,
          context: context.trim()
        });
      }
    }
  }
  
  // Sort by confidence and return matches
  return Array.from(brands.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15); // Limit to top 15 most confident matches
}

/**
 * Create optimized regex for brand matching
 */
function createBrandRegex(brandName: string): RegExp {
  // Escape special regex characters
  const escapedBrand = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // For brands with domains, be more flexible
  if (/\.(com|io|net|org)$/i.test(brandName)) {
    return new RegExp(escapedBrand.replace(/\\\.(com|io|net|org)$/i, '(?:\\.$1)?'), 'gi');
  }
  
  // For regular brands, use word boundaries but allow for common variations
  return new RegExp(`\\b${escapedBrand}\\b`, 'gi');
}

/**
 * Calculate confidence score for brand mention
 */
function calculateBrandConfidence(
  brandName: string,
  context: string,
  mentionCount: number
): number {
  let confidence = 0.5; // Base confidence
  
  const contextLower = context.toLowerCase();
  const brandLower = brandName.toLowerCase();
  
  // Boost confidence for business context indicators
  const businessIndicators = [
    'company', 'platform', 'service', 'solution', 'software', 'tool',
    'founded', 'offers', 'provides', 'specializes', 'focuses',
    '.com', '.io', '.net', '.org', 'website', 'app', 'application'
  ];
  
  if (businessIndicators.some(indicator => contextLower.includes(indicator))) {
    confidence += 0.2;
  }
  
  // Boost for specific action words
  const actionWords = [
    'recommend', 'use', 'try', 'choose', 'consider', 'suggests',
    'best', 'top', 'leading', 'popular', 'excellent'
  ];
  
  if (actionWords.some(word => contextLower.includes(word))) {
    confidence += 0.2;
  }
  
  // Reduce confidence for example context
  const exampleIndicators = [
    'for example', 'such as', 'e.g.', 'like apple', 'like google',
    'including but not limited to'
  ];
  
  if (exampleIndicators.some(indicator => contextLower.includes(indicator))) {
    confidence -= 0.3;
  }
  
  // Boost for multiple mentions
  if (mentionCount > 1) {
    confidence += Math.min(0.2, mentionCount * 0.05);
  }
  
  // Domain name bonus
  if (brandName.includes('.')) {
    confidence += 0.1;
  }
  
  // Length penalty for very long potential brand names (likely false positives)
  if (brandName.length > 25) {
    confidence -= 0.2;
  }
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Calculate overall analysis confidence
 */
function calculateAnalysisConfidence(brandArtifacts: BrandArtifact[]): number {
  if (brandArtifacts.length === 0) return 0.5;
  
  const avgConfidence = brandArtifacts.reduce((sum, brand) => sum + brand.confidence, 0) / brandArtifacts.length;
  const highConfidenceCount = brandArtifacts.filter((b: BrandArtifact) => b.confidence >= 0.8).length;
  const highConfidenceRatio = highConfidenceCount / brandArtifacts.length;
  
  return (avgConfidence * 0.7) + (highConfidenceRatio * 0.3);
}

/**
 * CATALOG-ONLY brand gazetteer - only includes brands from the brand_catalog
 */
export function createBrandGazetteer(
  brandCatalog: Array<{ name: string; variants_json?: string[] }>,
  userIndustry?: string
): string[] {
  const gazetteer = new Set<string>();
  
  // CRITICAL: Only add brands and variants from the brand catalog
  // This prevents discovery of new "competitors" from text analysis
  for (const brand of brandCatalog) {
    // Only add legitimate brands (length check prevents generic terms)
    if (brand.name.trim().length >= 3) {
      gazetteer.add(brand.name);
    }
    
    // Add variants if available and valid
    if (brand.variants_json) {
      for (const variant of brand.variants_json) {
        if (variant.trim().length >= 3) { // Stricter filter for variants
          gazetteer.add(variant);
        }
      }
    }
  }
  
  // NO AUTOMATIC ADDITION OF INDUSTRY OR COMMON BRANDS
  // This ensures we only match against explicitly cataloged competitors
  
  return Array.from(gazetteer).filter((brand: any) => brand.length >= 3);
}