/**
 * Simple, effective brand analysis for AI responses
 * Uses hardcoded competitor list for consistency
 */

interface BrandAnalysis {
  score: number;
  orgBrandPresent: boolean;
  orgBrandProminence: number | null;
  brands: string[];
  competitors: string[];
}

const COMPETITOR_KEYWORDS = [
  'salesforce','marketo','pardot','mailchimp','hootsuite','buffer',
  'sprout social','semrush','ahrefs','buzzsumo','getresponse',
  'activecampaign','convertkit','monday.com','trello','asana','notion',
  'intercom','zendesk','pipedrive','freshsales','hubspot','klaviyo',
  'constant contact','aweber','drip','omnisend','sendinblue','brevo',
  'mailerlite','campaign monitor','emma','benchmark email'
];

/**
 * Clean, simple brand analysis that actually works
 */
export async function analyzeResponse(
  supabase: any, 
  orgId: string, 
  responseText: string
): Promise<BrandAnalysis> {
  try {
    // Get organization info to get the brand name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    if (!org || !org.name) {
      return {
        score: 1,
        orgBrandPresent: false,
        orgBrandProminence: null,
        brands: [],
        competitors: []
      };
    }

    const text = responseText?.toLowerCase() || '';
    const orgName = org.name.toLowerCase().trim();
    
    // Create org brand variants
    const orgVariants = Array.from(new Set([
      orgName,
      orgName.replace(/\s+/g, ''),
      orgName.replace(/\s+/g, '-'),
      `${orgName} crm`,
      `${orgName} marketing hub`,
    ]));

    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const makeBoundaryRegex = (term: string) => new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, 'gi');

    // Find org brand mentions
    let orgBrandFound = false;
    let orgFirstPosition: number | null = null;
    
    for (const variant of orgVariants) {
      const re = makeBoundaryRegex(variant);
      const match = re.exec(text);
      if (match) {
        orgBrandFound = true;
        if (orgFirstPosition === null || match.index < orgFirstPosition) {
          orgFirstPosition = match.index;
        }
      }
    }

    // Find competitor mentions
    const foundCompetitors: string[] = [];
    const competitorPositions: Array<{ name: string; pos: number }> = [];
    
    for (const comp of COMPETITOR_KEYWORDS) {
      // Skip if this competitor matches any org brand variant
      const isOrgBrand = orgVariants.some(variant => 
        variant.toLowerCase() === comp.toLowerCase() ||
        comp.toLowerCase().includes(variant.toLowerCase()) ||
        variant.toLowerCase().includes(comp.toLowerCase())
      );
      
      if (isOrgBrand) continue;
      
      const re = makeBoundaryRegex(comp);
      re.lastIndex = 0;
      const match = re.exec(text);
      if (match && !foundCompetitors.includes(comp)) {
        foundCompetitors.push(comp);
        competitorPositions.push({ name: comp, pos: match.index });
      }
    }

    // Calculate prominence
    let orgBrandProminence: number | null = null;
    if (orgBrandFound && orgFirstPosition !== null) {
      const allPositions = [
        ...competitorPositions.map(c => ({ type: 'comp' as const, pos: c.pos })),
        { type: 'org' as const, pos: orgFirstPosition }
      ].sort((a, b) => a.pos - b.pos);
      
      const orgIndex = allPositions.findIndex(x => x.type === 'org');
      orgBrandProminence = orgIndex + 1; // 1-based position
    }

    // Calculate score
    let score = 1;
    if (orgBrandFound) {
      score = 6;
      if (orgBrandProminence === 1) score += 3;
      else if (orgBrandProminence && orgBrandProminence <= 3) score += 2;
      else if (orgBrandProminence && orgBrandProminence <= 6) score += 1;

      if (foundCompetitors.length > 8) score -= 2;
      else if (foundCompetitors.length > 4) score -= 1;
    } else {
      score = responseText.length > 500 ? 2 : 1;
    }

    return {
      score: Math.max(1, Math.min(10, Math.round(score))),
      orgBrandPresent: orgBrandFound,
      orgBrandProminence,
      brands: orgBrandFound ? [org.name] : [],
      competitors: foundCompetitors
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