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
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const makeBoundaryRegex = (term: string) => new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, 'gi');

  const base = orgName.trim().toLowerCase();
  const orgVariants = Array.from(new Set([
    base,
    base.replace(/\s+/g, ''),
    base.replace(/\s+/g, '-'),
    `${base} crm`,
    `${base} marketing hub`,
  ]));

  const findEarliestIndex = (t: string, terms: string[]): number | null => {
    let min: number | null = null;
    for (const term of terms) {
      const re = makeBoundaryRegex(term);
      const m = re.exec(t);
      if (m) {
        const idx = m.index;
        if (min === null || idx < min) min = idx;
      }
    }
    return min;
  };

  const competitorKeywords = [
    'salesforce','marketo','pardot','mailchimp','hootsuite','buffer',
    'sprout social','semrush','ahrefs','buzzsumo','getresponse',
    'activecampaign','convertkit','monday.com','trello','asana','notion',
    'intercom','zendesk','pipedrive','freshsales','hubspot','klaviyo',
    'constant contact','aweber','drip','omnisend','sendinblue','brevo',
    'mailerlite','campaign monitor','emma','benchmark email'
  ];

  const orgPos = findEarliestIndex(text, orgVariants);
  const brandPresent = orgPos !== null;

  const competitorSet = new Set<string>();
  const competitorPositions: number[] = [];
  
  for (const comp of competitorKeywords) {
    const re = makeBoundaryRegex(comp);
    re.lastIndex = 0; // Reset regex state
    const match = re.exec(text);
    if (match && !competitorSet.has(comp)) {
      competitorSet.add(comp);
      competitorPositions.push(match.index);
    }
  }

  let prominenceIdx: number | null = null;
  if (brandPresent) {
    const allPositions = [...competitorPositions, orgPos as number].sort((a,b) => a-b);
    prominenceIdx = allPositions.indexOf(orgPos as number);
  }

  // Compute score similar to unified scoring
  let score = 1;
  if (brandPresent) {
    score = 6;
    if (prominenceIdx === 0) score += 3;
    else if (prominenceIdx !== null && prominenceIdx <= 2) score += 2;
    else if (prominenceIdx !== null && prominenceIdx <= 5) score += 1;

    if (competitorSet.size > 8) score -= 2;
    else if (competitorSet.size > 4) score -= 1;
  } else {
    score = responseText.length > 500 ? 2 : 1;
  }

  const competitors = Array.from(competitorSet);
  const foundBrands = brandPresent ? [orgName] : [];

  return {
    score: Math.max(1, Math.min(10, Math.round(score))),
    brandPresent,
    brands: foundBrands,
    competitors,
    orgBrands: foundBrands,
    orgBrandPresent: brandPresent,
    orgBrandPosition: orgPos,
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