/**
 * V2 Brand/Competitor Detection System
 * Advanced detection with preprocessing, gazetteer, and multi-stage filtering
 * Used in shadow mode for comparative analysis
 */

import { preprocessText, type PreprocessedText } from './preprocess.ts';

export interface AccountBrand {
  canonical: string;
  aliases: string[];
  domain?: string;
}

export interface DetectionInputs {
  rawText: string;
  provider: string;
  accountBrand: AccountBrand;
  competitorsSeed: string[];
}

export interface DetectionResult {
  detectedBrands: string[];
  detectedCompetitors: string[];
  metadata: {
    candidatesGenerated: number;
    candidatesFiltered: number;
    gazetteerSize: number;
    processingTimeMs: number;
    preprocessing: {
      originalLength: number;
      processedLength: number;
      anchorsExtracted: number;
      domainsExtracted: number;
    };
  };
}

/**
 * Curated global competitors list for gazetteer
 */
const GLOBAL_COMPETITORS = [
  'HubSpot', 'Salesforce', 'Zoho', 'Mailchimp', 'Buffer', 'Hootsuite', 'CoSchedule',
  'SEMrush', 'Ahrefs', 'BuzzSumo', 'Crazy Egg', 'Hotjar', 'Marketo', 'Pardot',
  'ActiveCampaign', 'Keap', 'Pipedrive', 'Monday.com', 'Notion', 'Asana',
  'Klaviyo', 'ConvertKit', 'GetResponse', 'Constant Contact', 'AWeber',
  'Intercom', 'Zendesk', 'Slack', 'Microsoft Teams', 'Zoom', 'Trello', 'ClickUp',
  'Canva', 'Figma', 'Adobe Creative Suite', 'Google Workspace', 'Shopify',
  'WooCommerce', 'Magento', 'BigCommerce', 'Squarespace', 'Wix', 'WordPress'
];

/**
 * Known brand tokens for organization detection
 */
const KNOWN_BRAND_TOKENS = [
  'Google', 'Meta', 'Adobe', 'Microsoft', 'Apple', 'Amazon', 'Facebook',
  'Twitter', 'LinkedIn', 'Instagram', 'YouTube', 'TikTok', 'Snapchat',
  'Oracle', 'SAP', 'IBM', 'Cisco', 'Intel', 'NVIDIA', 'Tesla', 'Uber',
  'Netflix', 'Spotify', 'Dropbox', 'GitHub', 'GitLab', 'Atlassian',
  'Stripe', 'PayPal', 'Square', 'Twilio', 'Segment', 'Mixpanel', 'Amplitude'
];

/**
 * Comprehensive stopwords and phrase blacklist
 */
const STOPWORDS = new Set([
  // Generic business terms
  'using', 'choose', 'entry', 'data', 'experience', 'marketing', 'automation',
  'analytics', 'customer', 'platform', 'software', 'tool', 'solution', 'system',
  'service', 'business', 'company', 'organization', 'management', 'development',
  'integration', 'optimization', 'performance', 'workflow', 'process', 'feature',
  'function', 'module', 'component', 'application', 'technology', 'digital',
  'online', 'cloud', 'web', 'mobile', 'app', 'website', 'internet', 'network',
  
  // Action words
  'help', 'support', 'create', 'build', 'make', 'design', 'develop', 'implement',
  'provide', 'offer', 'deliver', 'enable', 'allow', 'ensure', 'improve', 'enhance',
  'optimize', 'streamline', 'automate', 'integrate', 'connect', 'sync', 'track',
  'monitor', 'analyze', 'measure', 'report', 'visualize', 'manage', 'control',
  
  // Generic descriptors
  'best', 'top', 'leading', 'popular', 'advanced', 'professional', 'enterprise',
  'premium', 'standard', 'basic', 'free', 'paid', 'trial', 'demo', 'new', 'latest',
  'updated', 'improved', 'enhanced', 'comprehensive', 'complete', 'full', 'total',
  'simple', 'easy', 'quick', 'fast', 'efficient', 'effective', 'powerful', 'robust'
]);

const STOPWORD_PHRASES = new Set([
  'marketing automation', 'customer data', 'analytics tool', 'data analytics',
  'business intelligence', 'customer relationship', 'email marketing',
  'social media', 'content management', 'project management', 'task management',
  'time tracking', 'lead generation', 'sales funnel', 'conversion rate',
  'user experience', 'customer experience', 'customer support', 'help desk',
  'knowledge base', 'live chat', 'email support', 'phone support',
  'search engine', 'search optimization', 'keyword research', 'link building',
  'content marketing', 'inbound marketing', 'outbound marketing', 'digital marketing'
]);

/**
 * Main V2 detection function
 */
export function detectBrandsV2(inputs: DetectionInputs): DetectionResult {
  const startTime = performance.now();
  
  // Step 1: Preprocess text (Perplexity-aware)
  const preprocessed = preprocessText(inputs.rawText);
  
  // Step 2: Build gazetteer
  const gazetteer = buildGazetteer(inputs.accountBrand, inputs.competitorsSeed);
  
  // Step 3: Generate candidates
  const candidates = generateCandidates(preprocessed, inputs.rawText);
  
  // Step 4: Apply filters
  const filteredCandidates = filterCandidates(candidates);
  
  // Step 5: Type gate (gazetteer + org detection)
  const validBrands = typeGate(filteredCandidates, gazetteer);
  
  // Step 6: Brand recognition (separate user brand from competitors)
  const { detectedBrands, detectedCompetitors } = recognizeBrands(validBrands, inputs.accountBrand);
  
  const processingTime = performance.now() - startTime;
  
  return {
    detectedBrands,
    detectedCompetitors,
    metadata: {
      candidatesGenerated: candidates.length,
      candidatesFiltered: filteredCandidates.length,
      gazetteerSize: gazetteer.size,
      processingTimeMs: Math.round(processingTime),
      preprocessing: {
        originalLength: inputs.rawText.length,
        processedLength: preprocessed.plainText.length,
        anchorsExtracted: preprocessed.anchors.length,
        domainsExtracted: preprocessed.domains.length
      }
    }
  };
}

/**
 * Build normalized gazetteer from various sources
 */
function buildGazetteer(accountBrand: AccountBrand, competitorsSeed: string[]): Set<string> {
  const gazetteer = new Set<string>();
  
  // Add global competitors
  GLOBAL_COMPETITORS.forEach(brand => {
    gazetteer.add(normalizeBrand(brand));
  });
  
  // Add account brand and aliases
  gazetteer.add(normalizeBrand(accountBrand.canonical));
  accountBrand.aliases.forEach(alias => {
    gazetteer.add(normalizeBrand(alias));
  });
  
  // Add competitors seed
  competitorsSeed.forEach(competitor => {
    gazetteer.add(normalizeBrand(competitor));
  });
  
  return gazetteer;
}

/**
 * Normalize brand name with Unicode NFC, case-folding, suffix stripping
 */
function normalizeBrand(brand: string): string {
  return brand
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+(inc|llc|ltd|co|company|corp|corporation|international|intl)\.?$/i, '')
    .trim();
}

/**
 * Generate candidates from multiple sources
 */
function generateCandidates(preprocessed: PreprocessedText, originalText: string): string[] {
  const candidates = new Set<string>();
  
  // From anchor text tokens (Title Case or PascalCase)
  preprocessed.anchors.forEach(anchor => {
    extractTitleCaseTokens(anchor).forEach(token => candidates.add(token));
  });
  
  // From domains -> brand conversion
  preprocessed.domains.forEach(domain => {
    const brand = hostToBrand(domain);
    if (brand) candidates.add(brand);
  });
  
  // From Title Case n-grams in plain text (1-3 tokens)
  extractTitleCaseNGrams(preprocessed.plainText, 3).forEach(ngram => {
    candidates.add(ngram);
  });
  
  // Also check original text for patterns that might be lost in preprocessing
  extractTitleCaseNGrams(originalText, 3).forEach(ngram => {
    candidates.add(ngram);
  });
  
  return Array.from(candidates);
}

/**
 * Extract Title Case or PascalCase tokens from text
 */
function extractTitleCaseTokens(text: string): string[] {
  const tokens: string[] = [];
  
  // Title Case pattern: words starting with uppercase
  const titleCasePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  let match;
  while ((match = titleCasePattern.exec(text)) !== null) {
    tokens.push(match[0]);
  }
  
  // PascalCase pattern: compound words
  const pascalCasePattern = /\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b/g;
  while ((match = pascalCasePattern.exec(text)) !== null) {
    tokens.push(match[0]);
  }
  
  return tokens;
}

/**
 * Convert hostname to brand name
 */
function hostToBrand(domain: string): string | null {
  try {
    // Remove www and get main domain
    const cleanDomain = domain.replace(/^www\./, '');
    const parts = cleanDomain.split('.');
    
    if (parts.length < 2) return null;
    
    const brandPart = parts[0];
    
    // Skip if too short or generic
    if (brandPart.length < 3 || ['mail', 'email', 'www', 'app', 'api', 'blog'].includes(brandPart)) {
      return null;
    }
    
    // Convert to proper case
    return brandPart.charAt(0).toUpperCase() + brandPart.slice(1).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Extract Title Case n-grams from text
 */
function extractTitleCaseNGrams(text: string, maxN: number): string[] {
  const ngrams: string[] = [];
  const words = text.split(/\s+/);
  
  for (let n = 1; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(' ');
      
      // Check if all words in n-gram start with uppercase
      if (/^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*$/.test(ngram)) {
        ngrams.push(ngram);
      }
    }
  }
  
  return ngrams;
}

/**
 * Filter candidates using stopwords, length, and other criteria
 */
function filterCandidates(candidates: string[]): string[] {
  return candidates.filter(candidate => {
    const normalized = candidate.toLowerCase().trim();
    
    // Length check
    if (normalized.length < 2 || normalized.length > 30) {
      return false;
    }
    
    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(candidate)) {
      return false;
    }
    
    // Stopword check
    if (STOPWORDS.has(normalized)) {
      return false;
    }
    
    // Stopword phrase check
    if (STOPWORD_PHRASES.has(normalized)) {
      return false;
    }
    
    // Disallow all-lowercase generic words if they're common terms
    if (candidate === normalized && isGenericTerm(normalized)) {
      return false;
    }
    
    // Filter out purely numeric or special character strings
    if (/^[0-9\s\-_.,;:!?()[\]{}'"]+$/.test(candidate)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Check if a term is a generic business term
 */
function isGenericTerm(term: string): boolean {
  const genericTerms = [
    'email', 'website', 'platform', 'software', 'application', 'system',
    'service', 'solution', 'tool', 'product', 'business', 'company',
    'marketing', 'sales', 'support', 'customer', 'user', 'data',
    'analytics', 'report', 'dashboard', 'management', 'automation'
  ];
  
  return genericTerms.includes(term);
}

/**
 * Type gate: accept if in gazetteer or passes organization detection
 */
function typeGate(candidates: string[], gazetteer: Set<string>): string[] {
  return candidates.filter(candidate => {
    const normalized = normalizeBrand(candidate);
    
    // Accept if in gazetteer
    if (gazetteer.has(normalized)) {
      return true;
    }
    
    // Lightweight organization detection
    return isLikelyOrganization(candidate);
  });
}

/**
 * Heuristic organization detection
 */
function isLikelyOrganization(candidate: string): boolean {
  // Title Case check
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(candidate)) {
    return true;
  }
  
  // Contains known brand token
  const words = candidate.split(/\s+/);
  if (words.some(word => KNOWN_BRAND_TOKENS.includes(word))) {
    return true;
  }
  
  // PascalCase compound words (likely brand names)
  if (/^[A-Z][a-z]+[A-Z][a-zA-Z]*$/.test(candidate)) {
    return true;
  }
  
  // Domain-derived names (already filtered by hostToBrand)
  if (/^[A-Z][a-z]+$/.test(candidate) && candidate.length >= 4) {
    return true;
  }
  
  return false;
}

/**
 * Brand recognition: separate user brand from competitors
 */
function recognizeBrands(
  validBrands: string[], 
  accountBrand: AccountBrand
): { detectedBrands: string[]; detectedCompetitors: string[] } {
  const detectedBrands: string[] = [];
  const detectedCompetitors: string[] = [];
  
  // Normalize account brand data for matching
  const normalizedCanonical = normalizeBrand(accountBrand.canonical);
  const normalizedAliases = accountBrand.aliases.map(alias => normalizeBrand(alias));
  const normalizedDomain = accountBrand.domain ? 
    hostToBrand(accountBrand.domain) : null;
  
  // Deduplicate with fuzzy matching
  const deduplicatedBrands = fuzzyDeduplicate(validBrands);
  
  deduplicatedBrands.forEach(brand => {
    const normalized = normalizeBrand(brand);
    
    // Check if it's the user's brand
    if (isUserBrand(normalized, normalizedCanonical, normalizedAliases, normalizedDomain)) {
      detectedBrands.push(brand);
    } else {
      detectedCompetitors.push(brand);
    }
  });
  
  return { detectedBrands, detectedCompetitors };
}

/**
 * Check if a brand matches the user's brand
 */
function isUserBrand(
  normalized: string,
  normalizedCanonical: string,
  normalizedAliases: string[],
  normalizedDomain: string | null
): boolean {
  // Exact match with canonical or aliases
  if (normalized === normalizedCanonical || normalizedAliases.includes(normalized)) {
    return true;
  }
  
  // Domain match
  if (normalizedDomain && normalizeBrand(normalizedDomain) === normalized) {
    return true;
  }
  
  // Fuzzy match with small threshold for possessives/plurals
  const threshold = 0.9;
  if (jaroWinklerSimilarity(normalized, normalizedCanonical) >= threshold) {
    return true;
  }
  
  // Check aliases with fuzzy matching
  if (normalizedAliases.some(alias => jaroWinklerSimilarity(normalized, alias) >= threshold)) {
    return true;
  }
  
  // Handle common variations (hyphen/space, possessives, plurals)
  const variations = generateVariations(normalizedCanonical);
  if (variations.includes(normalized)) {
    return true;
  }
  
  return false;
}

/**
 * Generate common variations of a brand name
 */
function generateVariations(brand: string): string[] {
  const variations = [brand];
  
  // Space/hyphen variations
  variations.push(brand.replace(/\s+/g, '-'));
  variations.push(brand.replace(/-/g, ' '));
  variations.push(brand.replace(/\s+/g, ''));
  
  // Possessive forms
  variations.push(brand + "'s");
  variations.push(brand + "s");
  
  // Remove possessives
  variations.push(brand.replace(/'s$/, ''));
  variations.push(brand.replace(/s$/, ''));
  
  return [...new Set(variations)];
}

/**
 * Fuzzy deduplication using Jaro-Winkler similarity
 */
function fuzzyDeduplicate(brands: string[], threshold: number = 0.85): string[] {
  const deduplicated: string[] = [];
  
  for (const brand of brands) {
    let isDuplicate = false;
    
    for (const existing of deduplicated) {
      if (jaroWinklerSimilarity(normalizeBrand(brand), normalizeBrand(existing)) >= threshold) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      deduplicated.push(brand);
    }
  }
  
  return deduplicated;
}

/**
 * Jaro-Winkler similarity implementation
 */
function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0.0;
  
  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  
  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3.0;
  
  // Jaro-Winkler prefix bonus
  let prefix = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  
  return jaro + (0.1 * prefix * (1.0 - jaro));
}