/**
 * Competitor cleaning utility for frontend UI display
 * Removes generic terms, org brands, and noise from competitor lists
 */

const GENERIC_TERMS = new Set([
  // Generic business terms
  'company', 'companies', 'business', 'businesses', 'enterprise', 'enterprises',
  'platform', 'platforms', 'service', 'services', 'solution', 'solutions',
  'software', 'tool', 'tools', 'system', 'systems', 'application', 'applications',
  'app', 'apps', 'website', 'websites', 'site', 'sites', 'portal', 'portals',
  
  // Marketing/tech terms
  'marketing', 'sales', 'crm', 'analytics', 'data', 'digital', 'online',
  'automation', 'campaign', 'campaigns', 'content', 'social', 'media',
  'email', 'seo', 'sem', 'ppc', 'advertising', 'ads', 'engagement',
  
  // Generic suffixes
  'pro', 'plus', 'premium', 'basic', 'lite', 'free', 'trial', 'demo',
  'suite', 'hub', 'center', 'studio', 'lab', 'labs', 'group', 'team',
  
  // Common words that get capitalized
  'the', 'and', 'or', 'but', 'for', 'with', 'by', 'in', 'on', 'at', 'to',
  'from', 'up', 'out', 'off', 'over', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
  
  // Tech giants (too generic to be useful competitors)
  'google', 'microsoft', 'apple', 'amazon', 'meta', 'facebook', 'twitter',
  'linkedin', 'youtube', 'instagram', 'tiktok', 'pinterest', 'snapchat',
  
  // File extensions and domains
  'com', 'org', 'net', 'io', 'co', 'uk', 'html', 'php', 'js', 'css',
  'jpg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  
  // Numbers and short strings
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'a', 'an', 'i', 'it'
]);

interface CleaningOptions {
  catalogFilter?: (names: string[]) => string[];
}

/**
 * Clean competitor list by removing org brands, generic terms, and noise
 */
export function cleanCompetitors(
  input: string[], 
  orgBrandVariants: string[], 
  options: CleaningOptions = {}
): string[] {
  if (!input || input.length === 0) return [];
  
  // Step 1: Normalize and deduplicate
  const normalized = new Map<string, string>(); // lowercase -> original
  
  for (const competitor of input) {
    if (!competitor || typeof competitor !== 'string') continue;
    
    const trimmed = competitor.trim();
    if (trimmed.length === 0) continue;
    
    const key = trimmed.toLowerCase();
    
    // Keep the first (or best) version of each unique competitor
    if (!normalized.has(key) || trimmed.length > normalized.get(key)!.length) {
      normalized.set(key, trimmed);
    }
  }
  
  // Step 2: Filter out org brands and generic terms
  const filtered: string[] = [];
  
  for (const [normalizedName, originalName] of normalized) {
    // Skip if it's the org's own brand
    if (isOrgBrand(normalizedName, orgBrandVariants)) {
      continue;
    }
    
    // Skip if it's a generic term or too short
    if (isGenericTerm(normalizedName) || normalizedName.length < 2) {
      continue;
    }
    
    // Skip if it's purely numeric or contains problematic characters
    if (isPurelyNumeric(normalizedName) || hasProblematicCharacters(originalName)) {
      continue;
    }
    
    // Skip if it's too long (likely a sentence fragment)
    if (originalName.length > 50) {
      continue;
    }
    
    // Skip common spam patterns
    if (isSpamPattern(normalizedName)) {
      continue;
    }
    
    filtered.push(originalName);
  }
  
  // Step 3: Apply catalog filter if provided
  let result = filtered;
  if (options.catalogFilter) {
    try {
      const catalogFiltered = options.catalogFilter(filtered);
      // Use catalog filter as a refinement, but don't make it empty if catalog is unavailable
      if (catalogFiltered && catalogFiltered.length > 0) {
        result = catalogFiltered;
      }
    } catch (error) {
      console.warn('Catalog filter failed, using heuristic-only results:', error);
    }
  }
  
  // Step 4: Sort by relevance (shorter, cleaner names first) and limit
  result.sort((a, b) => {
    // Prefer shorter names
    if (a.length !== b.length) return a.length - b.length;
    // Alphabetical as tiebreaker
    return a.localeCompare(b);
  });
  
  return result.slice(0, 20); // Reasonable limit
}

/**
 * Check if a normalized name matches any org brand variant
 */
function isOrgBrand(normalizedName: string, orgBrandVariants: string[]): boolean {
  return orgBrandVariants.some(variant => 
    normalizedName === variant.toLowerCase() ||
    normalizedName.includes(variant.toLowerCase()) ||
    variant.toLowerCase().includes(normalizedName)
  );
}

/**
 * Check if a normalized name is a generic business term
 */
function isGenericTerm(normalizedName: string): boolean {
  // Direct match
  if (GENERIC_TERMS.has(normalizedName)) return true;
  
  // Check for generic patterns
  if (normalizedName.match(/^(get|use|try|learn|find|see|view|click|sign|start|go|new|best|top|most|all|some|more|less|other|another|first|last|next|previous)$/)) {
    return true;
  }
  
  // Check for domain endings without proper brand name
  if (normalizedName.length <= 7 && normalizedName.match(/\.(com|org|net|io|co)$/)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a string is purely numeric
 */
function isPurelyNumeric(text: string): boolean {
  return /^[0-9]+$/.test(text);
}

/**
 * Check if a string has problematic characters that indicate parsing errors
 */
function hasProblematicCharacters(text: string): boolean {
  // Characters that often indicate parsing errors or HTML fragments
  return /[<>{}[\]()"`''""''„"‚'']/.test(text);
}

/**
 * Check for common spam patterns
 */
function isSpamPattern(normalizedName: string): boolean {
  const spamPatterns = [
    'click here', 'learn more', 'sign up', 'get started', 'find out',
    'read more', 'see more', 'view all', 'show all', 'learn how',
    'get help', 'contact us', 'about us', 'privacy policy', 'terms of service'
  ];
  
  return spamPatterns.some(pattern => normalizedName.includes(pattern));
}
