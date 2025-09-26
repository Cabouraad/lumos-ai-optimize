/**
 * Brand Name Normalizer
 * Provides NFKC normalization, whitespace collapse, title-casing, and alias mapping
 */

import aliases from './aliases.json' with { type: 'json' };

export interface NormalizationResult {
  normalized: string;
  canonical: string;
  confidence: number;
}

/**
 * Normalize brand name with full processing pipeline
 */
export function normalizeBrandName(input: string): NormalizationResult {
  if (!input || typeof input !== 'string') {
    return {
      normalized: '',
      canonical: '',
      confidence: 0
    };
  }

  // Step 1: NFKC normalization (handles unicode compatibility)
  let normalized = input.normalize('NFKC');
  
  // Step 2: Whitespace collapse and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Step 3: Remove problematic characters
  normalized = normalized.replace(/[\"\"\"\'\'`]/g, '\"');
  normalized = normalized.replace(/[‚„]/g, ',');
  
  // Step 4: Title case conversion (preserve existing capitalization patterns)
  const titleCased = toTitleCase(normalized);
  
  // Step 5: Alias mapping
  const canonical = mapToCanonical(titleCased);
  
  // Step 6: Calculate confidence score
  const confidence = calculateNormalizationConfidence(input, normalized, canonical);
  
  return {
    normalized: titleCased,
    canonical,
    confidence
  };
}

/**
 * Convert to title case while preserving brand-specific patterns
 */
function toTitleCase(input: string): string {
  // Handle special cases that should not be title-cased
  const specialCases: Record<string, string> = {
    'ios': 'iOS',
    'iphone': 'iPhone',
    'ipad': 'iPad',
    'macos': 'macOS',
    'android': 'Android',
    'linkedin': 'LinkedIn',
    'youtube': 'YouTube',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'twitter': 'Twitter',
    'tiktok': 'TikTok',
    'snapchat': 'Snapchat',
    'pinterest': 'Pinterest',
    'whatsapp': 'WhatsApp',
    'gmail': 'Gmail',
    'outlook': 'Outlook',
    'adobe': 'Adobe',
    'microsoft': 'Microsoft',
    'google': 'Google',
    'apple': 'Apple',
    'amazon': 'Amazon',
    'netflix': 'Netflix',
    'spotify': 'Spotify',
    'salesforce': 'Salesforce',
    'hubspot': 'HubSpot',
    'mailchimp': 'Mailchimp',
    'shopify': 'Shopify',
    'wordpress': 'WordPress',
    'woocommerce': 'WooCommerce',
    'magento': 'Magento',
    'bigcommerce': 'BigCommerce',
    'squarespace': 'Squarespace',
    'wix': 'Wix',
    'webflow': 'Webflow',
    'zapier': 'Zapier',
    'slack': 'Slack',
    'discord': 'Discord',
    'zoom': 'Zoom',
    'skype': 'Skype',
    'teams': 'Microsoft Teams',
    'dropbox': 'Dropbox',
    'gdrive': 'Google Drive',
    'onedrive': 'OneDrive',
    'github': 'GitHub',
    'gitlab': 'GitLab',
    'bitbucket': 'Bitbucket',
    'jira': 'Jira',
    'confluence': 'Confluence',
    'trello': 'Trello',
    'asana': 'Asana',
    'monday': 'Monday.com',
    'notion': 'Notion',
    'airtable': 'Airtable',
    'basecamp': 'Basecamp',
    'clickup': 'ClickUp',
    'figma': 'Figma',
    'sketch': 'Sketch',
    'invision': 'InVision',
    'canva': 'Canva',
    'photoshop': 'Photoshop',
    'illustrator': 'Illustrator',
    'indesign': 'InDesign',
    'aftereffects': 'After Effects',
    'premiere': 'Premiere Pro'
  };

  const lowerInput = input.toLowerCase();
  if (specialCases[lowerInput]) {
    return specialCases[lowerInput];
  }

  // Standard title case with some exceptions
  return input.replace(/\w\S*/g, (txt: string) => {
    // Keep small words lowercase in the middle
    const smallWords = ['and', 'or', 'the', 'a', 'an', 'of', 'for', 'in', 'on', 'at', 'to', 'by', 'with', 'from'];
    if (smallWords.includes(txt.toLowerCase()) && txt !== input.split(' ')[0]) {
      return txt.toLowerCase();
    }
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

/**
 * Map normalized name to canonical form using alias dictionary
 */
function mapToCanonical(normalized: string): string {
  // Direct lookup
  if (aliases[normalized as keyof typeof aliases]) {
    return aliases[normalized as keyof typeof aliases];
  }

  // Case-insensitive lookup
  const lowerNorm = normalized.toLowerCase();
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (alias.toLowerCase() === lowerNorm) {
      return canonical;
    }
  }

  // Fuzzy matching for close variants
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (isCloseMatch(normalized, alias)) {
      return canonical;
    }
  }

  // Return original if no mapping found
  return normalized;
}

/**
 * Check if two strings are close matches (for fuzzy alias matching)
 */
function isCloseMatch(str1: string, str2: string): boolean {
  const s1 = str1.toLowerCase().replace(/\s+/g, '');
  const s2 = str2.toLowerCase().replace(/\s+/g, '');
  
  // Exact match without spaces
  if (s1 === s2) return true;
  
  // One is contained in the other (and both are reasonably long)
  if (s1.length >= 4 && s2.length >= 4) {
    if (s1.includes(s2) || s2.includes(s1)) return true;
  }
  
  // Levenshtein distance for typos
  if (s1.length >= 5 && s2.length >= 5) {
    const distance = levenshteinDistance(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    const similarity = 1 - (distance / maxLen);
    return similarity >= 0.85; // 85% similarity threshold
  }
  
  return false;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion  
        matrix[j - 1][i - 1] + indicator  // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate confidence score for normalization result
 */
function calculateNormalizationConfidence(
  original: string, 
  normalized: string, 
  canonical: string
): number {
  let confidence = 1.0;
  
  // Penalize for significant changes
  if (original.toLowerCase() !== normalized.toLowerCase()) {
    confidence -= 0.1;
  }
  
  // Penalize for alias mapping (indicates uncertainty)
  if (normalized !== canonical) {
    confidence -= 0.15;
  }
  
  // Penalize for very short names (likely generic)
  if (original.length <= 2) {
    confidence -= 0.3;
  }
  
  // Bonus for well-formed brand names
  if (/^[A-Z][a-z]+([A-Z][a-z]+)*$/.test(normalized)) {
    confidence += 0.1;
  }
  
  // Bonus for domain-like patterns
  if (/\.(com|io|org|net|co)$/i.test(original)) {
    confidence += 0.05;
  }
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Batch normalize multiple brand names
 */
export function normalizeBrandNames(inputs: string[]): NormalizationResult[] {
  return inputs.map(input => normalizeBrandName(input));
}

/**
 * Check if a normalized name is likely a valid brand
 */
export function isValidBrandName(result: NormalizationResult): boolean {
  const { normalized, confidence } = result;
  
  // Must have minimum confidence
  if (confidence < 0.3) return false;
  
  // Must have reasonable length
  if (normalized.length < 2 || normalized.length > 50) return false;
  
  // Must not be all numbers
  if (/^\d+$/.test(normalized)) return false;
  
  // Must not be common stopwords or generic terms
  const genericTerms = ['the', 'and', 'or', 'but', 'for', 'with', 'by', 'from', 'to', 'in', 'on', 'at'];
  if (genericTerms.includes(normalized.toLowerCase())) return false;
  
  return true;
}

export default {
  normalizeBrandName,
  normalizeBrandNames,
  isValidBrandName
};
