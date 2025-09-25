/**
 * Server-side domain resolver for Supabase edge functions
 * This is a subset of the main resolver for use in edge functions
 */

export interface ResolvedBrand {
  brand: string;
  canonicalDomain: string;
  type: 'known' | 'heuristic' | 'unknown';
}

// Curated mapping for edge functions (smaller subset for performance)
const KNOWN_MAPPINGS = new Map<string, string>([
  // Automotive
  ['cars.com', 'Cars.com'],
  ['cargurus.com', 'CarGurus'],
  ['autotrader.com', 'Autotrader'],
  ['kbb.com', 'Kelley Blue Book'],
  ['edmunds.com', 'Edmunds'],
  ['carvana.com', 'Carvana'],
  ['carmax.com', 'CarMax'],
  ['truecar.com', 'TrueCar'],
  
  // Tech companies
  ['hubspot.com', 'HubSpot'],
  ['salesforce.com', 'Salesforce'],
  ['google.com', 'Google'],
  ['microsoft.com', 'Microsoft'],
  ['apple.com', 'Apple'],
  ['amazon.com', 'Amazon'],
  ['meta.com', 'Meta'],
  ['facebook.com', 'Meta'],
  
  // Common variations
  ['www.cars.com', 'Cars.com'],
  ['www.cargurus.com', 'CarGurus'],
  ['www.hubspot.com', 'HubSpot'],
]);

export function resolveDomainToBrand(domain: string): ResolvedBrand {
  if (!domain) {
    return { brand: 'Unknown', canonicalDomain: 'unknown', type: 'unknown' };
  }

  const normalized = normalizeDomain(domain);
  const known = KNOWN_MAPPINGS.get(normalized) || KNOWN_MAPPINGS.get(normalized.replace(/^www\./, ''));
  
  if (known) {
    return { brand: known, canonicalDomain: normalized.replace(/^www\./, ''), type: 'known' };
  }

  const heuristic = applyHeuristic(normalized.replace(/^www\./, ''));
  return { 
    brand: heuristic, 
    canonicalDomain: normalized.replace(/^www\./, ''), 
    type: heuristic !== normalized ? 'heuristic' : 'unknown' 
  };
}

function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\?.*$/, '')
    .trim();
}

function applyHeuristic(domain: string): string {
  try {
    if (!domain.includes('.') || domain.length < 4) return domain;
    
    const mainPart = domain.split('.')[0];
    if (mainPart.length < 2) return domain;
    
    return mainPart
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(' ')
      .map((word: any) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return domain;
  }
}

export function checkCompetitorMatch(
  resolvedBrand: ResolvedBrand, 
  competitors: Array<{ name: string; variants_json?: any }>
): boolean {
  if (!competitors?.length) return false;
  
  const brandLower = resolvedBrand.brand.toLowerCase();
  return competitors.some(comp => {
    if (comp.name.toLowerCase() === brandLower) return true;
    if (Array.isArray(comp.variants_json)) {
      return comp.variants_json.some((v: string) => v.toLowerCase() === brandLower);
    }
    return false;
  });
}

export function enrichCitation(citation: any, competitors: Array<{ name: string; variants_json?: any }>): any {
  if (!citation?.domain) return citation;
  
  const resolvedBrand = resolveDomainToBrand(citation.domain);
  const isCompetitor = checkCompetitorMatch(resolvedBrand, competitors);
  
  return {
    ...citation,
    resolved_brand: resolvedBrand,
    is_competitor: isCompetitor
  };
}