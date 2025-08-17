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
      // Only include competitors with reasonable confidence
      if (brand.confidence >= 0.6) {
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
  let urlMatch;
  
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
    let refMatch;
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
 * Enhanced brand extraction with context and confidence scoring
 */
function extractEnhancedBrands(text: string, gazetteer: string[]): BrandArtifact[] {
  const brands: Map<string, BrandArtifact> = new Map();
  const textLength = text.length;
  
  // Enhanced brand filtering - remove obviously irrelevant terms
  const filteredGazetteer = gazetteer.filter(brandName => {
    const normalized = normalize(brandName);
    
    // Skip very short brands without clear business context
    if (normalized.length < 3) return false;
    
    // Skip common words that often get capitalized
    const commonWords = [
      'search', 'email', 'mobile', 'web', 'online', 'digital', 'smart',
      'pro', 'plus', 'premium', 'standard', 'basic', 'free', 'custom',
      'data', 'system', 'platform', 'solution', 'service', 'company'
    ];
    
    if (commonWords.includes(normalized)) return false;
    
    return true;
  });
  
  // Process each brand in the filtered gazetteer
  for (const brandName of filteredGazetteer) {
    const normalized = normalize(brandName);
    
    // Create more precise regex for brand matching
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
  
  // Sort by confidence and return top candidates
  return Array.from(brands.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20); // Limit to top 20 most confident matches
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
  const highConfidenceCount = brandArtifacts.filter(b => b.confidence >= 0.8).length;
  const highConfidenceRatio = highConfidenceCount / brandArtifacts.length;
  
  return (avgConfidence * 0.7) + (highConfidenceRatio * 0.3);
}

/**
 * Enhanced brand gazetteer with industry-specific brands
 */
export function createBrandGazetteer(
  brandCatalog: Array<{ name: string; variants_json?: string[] }>,
  userIndustry?: string
): string[] {
  const gazetteer = new Set<string>();
  
  // Add user's brands and variants
  for (const brand of brandCatalog) {
    gazetteer.add(brand.name);
    
    // Add variants if available
    if (brand.variants_json) {
      for (const variant of brand.variants_json) {
        if (variant.trim().length >= 2) { // Filter out empty/short variants
          gazetteer.add(variant);
        }
      }
    }
  }
  
  // Industry-specific brand lists
  const industryBrands: Record<string, string[]> = {
    'software': [
      'Microsoft', 'Google', 'Apple', 'Adobe', 'Salesforce', 'Oracle', 'IBM', 'GitHub',
      'Atlassian', 'Slack', 'Zoom', 'Dropbox', 'Notion', 'Asana', 'Trello', 'Monday.com',
      'ClickUp', 'Basecamp', 'Airtable', 'Figma', 'Sketch', 'InVision', 'Marvel',
      'AWS', 'Azure', 'GCP', 'Heroku', 'Vercel', 'Netlify', 'Cloudflare'
    ],
    'marketing': [
      'HubSpot', 'Mailchimp', 'Marketo', 'Pardot', 'Klaviyo', 'Constant Contact',
      'Hootsuite', 'Buffer', 'Sprout Social', 'Later', 'CoSchedule',
      'Google Analytics', 'Facebook Ads', 'Google Ads', 'LinkedIn Ads'
    ],
    'ecommerce': [
      'Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Squarespace', 'Wix',
      'Stripe', 'PayPal', 'Square', 'Amazon', 'eBay', 'Etsy'
    ],
    'design': [
      'Adobe Creative Cloud', 'Photoshop', 'Illustrator', 'Figma', 'Sketch',
      'Canva', 'InVision', 'Marvel', 'Principle', 'Framer', 'Adobe XD'
    ]
  };
  
  // Add industry-specific brands
  if (userIndustry && industryBrands[userIndustry.toLowerCase()]) {
    for (const brand of industryBrands[userIndustry.toLowerCase()]) {
      gazetteer.add(brand);
    }
  }
  
  // Add common business/tech brands (always relevant)
  const commonBrands = [
    'Microsoft', 'Google', 'Apple', 'Amazon', 'Meta', 'Facebook', 'Instagram', 
    'Twitter', 'X', 'LinkedIn', 'YouTube', 'Netflix', 'Spotify', 'Adobe',
    'Salesforce', 'HubSpot', 'Zoom', 'Slack', 'GitHub', 'Atlassian',
    'AWS', 'Azure', 'Stripe', 'PayPal', 'Shopify'
  ];
  
  for (const brand of commonBrands) {
    gazetteer.add(brand);
  }
  
  return Array.from(gazetteer).filter(brand => brand.length >= 2);
}