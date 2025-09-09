/**
 * Domain-to-brand resolver for citation enrichment
 * Maps domains to normalized brand names with competitor detection
 */

export interface ResolvedBrand {
  brand: string;
  canonicalDomain: string;
  type: 'known' | 'heuristic' | 'unknown';
}

// Curated mapping of known industry players and major brands
const KNOWN_DOMAIN_MAPPINGS = new Map<string, string>([
  // Automotive marketplace
  ['cars.com', 'Cars.com'],
  ['cargurus.com', 'CarGurus'],
  ['autotrader.com', 'Autotrader'],
  ['kbb.com', 'Kelley Blue Book'],
  ['edmunds.com', 'Edmunds'],
  ['carvana.com', 'Carvana'],
  ['carmax.com', 'CarMax'],
  ['truecar.com', 'TrueCar'],
  ['carsdirect.com', 'CarsDirect'],
  ['vroom.com', 'Vroom'],
  ['shift.com', 'Shift'],
  ['beepi.com', 'Beepi'],
  
  // Tech & software
  ['hubspot.com', 'HubSpot'],
  ['salesforce.com', 'Salesforce'],
  ['marketo.com', 'Marketo'],
  ['pardot.com', 'Pardot'],
  ['mailchimp.com', 'Mailchimp'],
  ['constantcontact.com', 'Constant Contact'],
  ['klaviyo.com', 'Klaviyo'],
  ['sendgrid.com', 'SendGrid'],
  ['intercom.com', 'Intercom'],
  ['zendesk.com', 'Zendesk'],
  ['freshworks.com', 'Freshworks'],
  ['pipedrive.com', 'Pipedrive'],
  ['zoho.com', 'Zoho'],
  
  // Major tech companies
  ['google.com', 'Google'],
  ['microsoft.com', 'Microsoft'],
  ['apple.com', 'Apple'],
  ['amazon.com', 'Amazon'],
  ['meta.com', 'Meta'],
  ['facebook.com', 'Meta'],
  ['twitter.com', 'X'],
  ['x.com', 'X'],
  ['linkedin.com', 'LinkedIn'],
  ['youtube.com', 'YouTube'],
  ['instagram.com', 'Instagram'],
  ['tiktok.com', 'TikTok'],
  
  // News & media
  ['cnn.com', 'CNN'],
  ['bbc.com', 'BBC'],
  ['reuters.com', 'Reuters'],
  ['bloomberg.com', 'Bloomberg'],
  ['wsj.com', 'Wall Street Journal'],
  ['nytimes.com', 'New York Times'],
  ['washingtonpost.com', 'Washington Post'],
  ['guardian.com', 'The Guardian'],
  ['techcrunch.com', 'TechCrunch'],
  ['venturebeat.com', 'VentureBeat'],
  ['wired.com', 'Wired'],
  ['arstechnica.com', 'Ars Technica'],
  
  // E-commerce & retail
  ['shopify.com', 'Shopify'],
  ['magento.com', 'Magento'],
  ['woocommerce.com', 'WooCommerce'],
  ['bigcommerce.com', 'BigCommerce'],
  ['squarespace.com', 'Squarespace'],
  ['wix.com', 'Wix'],
  ['wordpress.com', 'WordPress'],
  
  // Marketing & analytics
  ['googleanalytics.com', 'Google Analytics'],
  ['adobe.com', 'Adobe'],
  ['mixpanel.com', 'Mixpanel'],
  ['segment.com', 'Segment'],
  ['amplitude.com', 'Amplitude'],
  ['hotjar.com', 'Hotjar'],
  ['crazyegg.com', 'Crazy Egg'],
  
  // Common domain variations
  ['www.cars.com', 'Cars.com'],
  ['www.cargurus.com', 'CarGurus'],
  ['www.autotrader.com', 'Autotrader'],
  ['www.kbb.com', 'Kelley Blue Book'],
  ['www.edmunds.com', 'Edmunds'],
]);

/**
 * Resolve a domain to a normalized brand name
 */
export function resolveDomainToBrand(domain: string): ResolvedBrand {
  if (!domain || typeof domain !== 'string') {
    return {
      brand: domain || 'Unknown',
      canonicalDomain: domain || 'unknown',
      type: 'unknown'
    };
  }

  // Normalize domain (remove protocol, www, trailing slash)
  const normalizedDomain = normalizeDomain(domain);
  
  // Check known mappings first
  const knownBrand = KNOWN_DOMAIN_MAPPINGS.get(normalizedDomain);
  if (knownBrand) {
    return {
      brand: knownBrand,
      canonicalDomain: normalizedDomain,
      type: 'known'
    };
  }
  
  // Check without www prefix
  const withoutWww = normalizedDomain.replace(/^www\./, '');
  const knownBrandWithoutWww = KNOWN_DOMAIN_MAPPINGS.get(withoutWww);
  if (knownBrandWithoutWww) {
    return {
      brand: knownBrandWithoutWww,
      canonicalDomain: withoutWww,
      type: 'known'
    };
  }
  
  // Apply heuristic mapping
  const heuristicBrand = applyHeuristicMapping(withoutWww);
  if (heuristicBrand !== withoutWww) {
    return {
      brand: heuristicBrand,
      canonicalDomain: withoutWww,
      type: 'heuristic'
    };
  }
  
  // Fallback to unknown
  return {
    brand: normalizedDomain,
    canonicalDomain: normalizedDomain,
    type: 'unknown'
  };
}

/**
 * Normalize domain string for consistent matching
 */
function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/^www\./, '')       // Remove www prefix  
    .replace(/\/.*$/, '')        // Remove path
    .replace(/\?.*$/, '')        // Remove query params
    .replace(/#.*$/, '')         // Remove hash
    .trim();
}

/**
 * Apply heuristic rules to generate brand name from domain
 */
function applyHeuristicMapping(domain: string): string {
  try {
    // Skip if domain is too short or doesn't look like a domain
    if (!domain || domain.length < 4 || !domain.includes('.')) {
      return domain;
    }
    
    // Extract main part before first dot
    const parts = domain.split('.');
    const mainPart = parts[0];
    
    // Skip if main part is too short
    if (mainPart.length < 2) {
      return domain;
    }
    
    // Skip common subdomains
    const skipSubdomains = ['blog', 'news', 'shop', 'store', 'api', 'app', 'mobile', 'm', 'support', 'help', 'docs'];
    if (skipSubdomains.includes(mainPart)) {
      return domain;
    }
    
    // Convert to title case with some cleanup
    let brand = mainPart
      .replace(/[-_]/g, ' ')     // Replace hyphens/underscores with spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // Add space before capital letters
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Handle special cases
    brand = brand
      .replace(/\bAi\b/g, 'AI')
      .replace(/\bApi\b/g, 'API')
      .replace(/\bUi\b/g, 'UI')
      .replace(/\bIo\b/g, 'IO')
      .replace(/\bSeo\b/g, 'SEO')
      .replace(/\bCrm\b/g, 'CRM')
      .replace(/\bSaas\b/g, 'SaaS');
    
    return brand;
  } catch (error) {
    console.warn('Heuristic mapping failed for domain:', domain, error);
    return domain;
  }
}

/**
 * Check if a resolved brand matches any competitor in the catalog
 */
export function checkCompetitorMatch(
  resolvedBrand: ResolvedBrand, 
  competitorCatalog: Array<{ name: string; variants_json?: any }>
): boolean {
  if (!competitorCatalog || competitorCatalog.length === 0) {
    return false;
  }
  
  const brandLower = resolvedBrand.brand.toLowerCase();
  const domainLower = resolvedBrand.canonicalDomain.toLowerCase();
  
  return competitorCatalog.some(competitor => {
    // Check main name
    if (competitor.name.toLowerCase() === brandLower) {
      return true;
    }
    
    // Check variants if available
    if (competitor.variants_json && Array.isArray(competitor.variants_json)) {
      return competitor.variants_json.some((variant: string) => 
        variant.toLowerCase() === brandLower || 
        variant.toLowerCase() === domainLower
      );
    }
    
    return false;
  });
}

/**
 * Enrich a citation with resolved brand and competitor information
 */
export function enrichCitation(
  citation: any,
  competitorCatalog: Array<{ name: string; variants_json?: any }>
): any {
  if (!citation || !citation.domain) {
    return citation;
  }
  
  const resolvedBrand = resolveDomainToBrand(citation.domain);
  const isCompetitor = checkCompetitorMatch(resolvedBrand, competitorCatalog);
  
  return {
    ...citation,
    resolved_brand: resolvedBrand,
    is_competitor: isCompetitor
  };
}

/**
 * Export the known mappings for admin diagnostics
 */
export function getKnownMappings(): Array<{ domain: string; brand: string }> {
  return Array.from(KNOWN_DOMAIN_MAPPINGS.entries()).map(([domain, brand]) => ({
    domain,
    brand
  }));
}

/**
 * Test the resolver with sample domains (for debugging)
 */
export function testResolver(): Array<{ domain: string; resolved: ResolvedBrand }> {
  const testDomains = [
    'cars.com',
    'www.cargurus.com',
    'https://autotrader.com/listings',
    'example-startup.com',
    'tech-blog.org',
    'unknown-domain',
    'very-long-domain-name.co.uk'
  ];
  
  return testDomains.map(domain => ({
    domain,
    resolved: resolveDomainToBrand(domain)
  }));
}