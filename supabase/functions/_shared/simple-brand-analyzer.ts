/**
 * Simple, effective brand analysis for AI responses
 * Complete rewrite with clean, straightforward logic
 */

interface BrandAnalysis {
  score: number;
  orgBrandPresent: boolean;
  orgBrandProminence: number | null;
  brands: string[];
  competitors: string[];
}

interface BrandCatalogItem {
  name: string;
  variants_json: string[];
  is_org_brand: boolean;
}

/**
 * Clean, simple brand analysis that actually works
 */
export async function analyzeResponse(
  supabase: any, 
  orgId: string, 
  responseText: string
): Promise<BrandAnalysis> {
  try {
    // Get brand catalog
    const { data: brandCatalog } = await supabase
      .from('brand_catalog')
      .select('name, variants_json, is_org_brand')
      .eq('org_id', orgId);

    if (!brandCatalog || brandCatalog.length === 0) {
      return {
        score: 1,
        orgBrandPresent: false,
        orgBrandProminence: null,
        brands: [],
        competitors: []
      };
    }

    const text = responseText || '';
    
    // Get org brands and competitors from catalog
    const orgBrands = brandCatalog.filter(b => b.is_org_brand === true);
    const competitorBrands = brandCatalog.filter(b => b.is_org_brand === false);

    // Find all brand mentions with positions
    const allMentions: Array<{ name: string; position: number; isOrgBrand: boolean }> = [];

    // Check for org brand mentions
    let orgBrandFound = false;
    const foundOrgBrands: string[] = [];

    for (const orgBrand of orgBrands) {
      const brandTerms = [orgBrand.name, ...(orgBrand.variants_json || [])];
      
      for (const term of brandTerms) {
        const positions = findBrandMentions(text, term);
        if (positions.length > 0) {
          orgBrandFound = true;
          foundOrgBrands.push(orgBrand.name);
          positions.forEach(pos => {
            allMentions.push({ name: orgBrand.name, position: pos, isOrgBrand: true });
          });
        }
      }
    }

    // Check for competitor mentions
    const foundCompetitors: string[] = [];
    
    for (const competitor of competitorBrands) {
      const brandTerms = [competitor.name, ...(competitor.variants_json || [])];
      
      for (const term of brandTerms) {
        const positions = findBrandMentions(text, term);
        if (positions.length > 0) {
          if (!foundCompetitors.includes(competitor.name)) {
            foundCompetitors.push(competitor.name);
          }
          positions.forEach(pos => {
            allMentions.push({ name: competitor.name, position: pos, isOrgBrand: false });
          });
        }
      }
    }

    // Calculate org brand prominence (position among all brand mentions)
    let orgBrandProminence: number | null = null;
    
    if (orgBrandFound && allMentions.length > 0) {
      // Sort all mentions by position
      allMentions.sort((a, b) => a.position - b.position);
      
      // Find first org brand mention
      const firstOrgIndex = allMentions.findIndex(m => m.isOrgBrand);
      if (firstOrgIndex >= 0) {
        orgBrandProminence = firstOrgIndex + 1; // 1-based position
      }
    }

    // Calculate score
    let score = 0;
    
    if (orgBrandFound) {
      // Base score for org brand presence
      score = 6;
      
      // Bonus for good prominence (top 3 positions)
      if (orgBrandProminence && orgBrandProminence <= 3) {
        score += 2;
      } else if (orgBrandProminence && orgBrandProminence <= 5) {
        score += 1;
      }
      
      // Penalty for too many competitors
      const competitorPenalty = Math.min(2, foundCompetitors.length * 0.2);
      score -= competitorPenalty;
    } else {
      // No org brand found
      if (foundCompetitors.length === 0) {
        score = 2; // Neutral response
      } else {
        score = 0; // Competitors mentioned but not us
      }
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(10, score));

    return {
      score: Number(score.toFixed(1)),
      orgBrandPresent: orgBrandFound,
      orgBrandProminence,
      brands: foundOrgBrands.slice(0, 3), // Limit to top 3
      competitors: foundCompetitors.slice(0, 10) // Limit to top 10
    };

  } catch (error) {
    console.error('Brand analysis error:', error);
    return {
      score: 1,
      orgBrandPresent: false,
      orgBrandProminence: null,
      brands: [],
      competitors: []
    };
  }
}

/**
 * Simple function to find exact word matches for a brand name
 */
function findBrandMentions(text: string, brandName: string): number[] {
  if (!brandName || brandName.length < 2) return [];
  
  const positions: number[] = [];
  const escapedName = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Use word boundary regex for exact matches
  const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    positions.push(match.index);
    // Prevent infinite loop on zero-length matches
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }
  
  return positions;
}