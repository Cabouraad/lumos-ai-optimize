/**
 * Client-side response analysis matching the logic in test-single-provider edge function
 */

export interface AnalysisResult {
  score: number;
  brandPresent: boolean;
  brands: string[];
  competitors: string[];
  orgBrands: string[];
  orgBrandPresent: boolean;
  orgBrandPosition: number | null;
  competitorCount: number;
}

export function analyzeResponse(responseText: string, orgName: string): AnalysisResult {
  if (!responseText || !orgName) {
    return {
      score: 0,
      brandPresent: false,
      brands: [],
      competitors: [],
      orgBrands: [],
      orgBrandPresent: false,
      orgBrandPosition: null,
      competitorCount: 0
    };
  }

  const text = responseText.toLowerCase();
  const orgLower = orgName.toLowerCase();
  
  // Simple brand detection
  const brandPresent = text.includes(orgLower) || text.includes(orgName.toLowerCase());
  const orgBrandPosition = brandPresent ? text.indexOf(orgLower) : null;
  
  // Extract brands (simplified)
  const brandPatterns = [orgName, orgLower, `${orgName} CRM`, `${orgName} Marketing Hub`];
  const foundBrands = brandPatterns.filter(brand => text.includes(brand.toLowerCase()));
  
  // Extract competitors (simple keyword extraction)
  const competitorKeywords = [
    'salesforce', 'marketo', 'pardot', 'mailchimp', 'hootsuite', 'buffer', 
    'sprout social', 'semrush', 'ahrefs', 'buzzsumo', 'getresponse', 
    'activecampaign', 'convertkit', 'monday.com', 'trello', 'asana'
  ];
  
  const competitors = competitorKeywords.filter(competitor => 
    text.includes(competitor) && !competitor.includes(orgLower)
  );
  
  // Simple scoring
  let score = 0;
  if (brandPresent) {
    const relativePosition = orgBrandPosition! / text.length;
    if (relativePosition < 0.2) score = 8; // Early mention
    else if (relativePosition < 0.5) score = 6; // Middle mention  
    else score = 4; // Late mention
    
    // Adjust for competition
    score = Math.max(1, score - Math.min(2, competitors.length * 0.2));
  } else {
    score = responseText.length > 500 ? 2 : 1;
  }
  
  return { 
    score: Math.round(score),
    brandPresent,
    brands: foundBrands,
    competitors,
    orgBrands: foundBrands,
    orgBrandPresent: brandPresent,
    orgBrandPosition,
    competitorCount: competitors.length
  };
}

/**
 * Re-analyze provider responses to ensure correct brand detection and scoring
 */
export function reanalyzeProviderResponse(
  rawResponse: string | null, 
  orgName: string,
  storedScore?: number
): AnalysisResult {
  if (!rawResponse) {
    return {
      score: storedScore || 0,
      brandPresent: false,
      brands: [],
      competitors: [],
      orgBrands: [],
      orgBrandPresent: false,
      orgBrandPosition: null,
      competitorCount: 0
    };
  }

  return analyzeResponse(rawResponse, orgName);
}