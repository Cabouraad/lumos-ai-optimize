/**
 * Artifact extraction utilities for structured data mining from AI responses
 */

export interface Citation {
  type: 'url' | 'ref';
  value: string;
}

export interface BrandArtifact {
  name: string;
  normalized: string;
  mentions: number;
  first_pos_ratio: number;
}

export interface ExtractedArtifacts {
  citations: Citation[];
  brands: BrandArtifact[];
  competitors: BrandArtifact[];
}

/**
 * Extract structured artifacts from AI response text
 */
export function extractArtifacts(
  responseText: string, 
  userBrandNorms: string[], 
  gazetteer: string[]
): ExtractedArtifacts {
  const citations = extractCitations(responseText);
  const brandArtifacts = extractBrands(responseText, gazetteer);
  
  // Separate user brands from competitors
  const brands: BrandArtifact[] = [];
  const competitors: BrandArtifact[] = [];
  
  for (const brand of brandArtifacts) {
    if (userBrandNorms.includes(brand.normalized)) {
      brands.push(brand);
    } else {
      competitors.push(brand);
    }
  }
  
  return {
    citations,
    brands,
    competitors
  };
}

/**
 * Extract URLs and bracket references from text
 */
function extractCitations(text: string): Citation[] {
  const citations: Citation[] = [];
  
  // Extract URLs
  const urlRegex = /(https?:\/\/[^\s)\]]+)/g;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    citations.push({
      type: 'url',
      value: urlMatch[1]
    });
  }
  
  // Extract bracket references like [1], [Smith 2023], [A], etc.
  const refRegex = /\[(?:\d+|[A-Za-z][^\]]{0,30})\]/g;
  let refMatch;
  while ((refMatch = refRegex.exec(text)) !== null) {
    // Store without brackets
    const refValue = refMatch[0].slice(1, -1);
    citations.push({
      type: 'ref',
      value: refValue
    });
  }
  
  return citations;
}

/**
 * Extract brand mentions with positioning and frequency analysis
 */
function extractBrands(text: string, gazetteer: string[]): BrandArtifact[] {
  const brands: Map<string, BrandArtifact> = new Map();
  const textLength = text.length;
  
  // Process each brand in the gazetteer
  for (const brandName of gazetteer) {
    const normalized = brandName.toLowerCase().trim();
    
    // Skip very short brands to avoid false positives
    if (normalized.length < 3) continue;
    
    // Find all mentions of this brand (case-insensitive)
    const brandRegex = new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = Array.from(text.matchAll(brandRegex));
    
    if (matches.length > 0) {
      // Calculate first position ratio
      const firstIndex = matches[0].index || 0;
      const firstPosRatio = textLength > 0 ? firstIndex / textLength : 0;
      
      brands.set(normalized, {
        name: brandName,
        normalized,
        mentions: matches.length,
        first_pos_ratio: firstPosRatio
      });
    }
  }
  
  return Array.from(brands.values());
}

/**
 * Create a comprehensive brand gazetteer from brand catalog and common brands
 */
export function createBrandGazetteer(brandCatalog: Array<{ name: string; variants_json?: string[] }>): string[] {
  const gazetteer = new Set<string>();
  
  // Add user's brands and variants
  for (const brand of brandCatalog) {
    gazetteer.add(brand.name);
    
    // Add variants if available
    if (brand.variants_json) {
      for (const variant of brand.variants_json) {
        gazetteer.add(variant);
      }
    }
  }
  
  // Add common tech brands/companies that frequently appear in AI responses
  const commonBrands = [
    'Apple', 'Google', 'Microsoft', 'Amazon', 'Meta', 'Facebook', 'Instagram', 
    'Twitter', 'X', 'LinkedIn', 'YouTube', 'TikTok', 'Snapchat',
    'Netflix', 'Spotify', 'Adobe', 'Salesforce', 'Oracle', 'IBM', 'Intel',
    'NVIDIA', 'Tesla', 'Uber', 'Airbnb', 'Zoom', 'Slack', 'Dropbox',
    'GitHub', 'GitLab', 'Atlassian', 'Jira', 'Confluence', 'Trello',
    'Notion', 'Airtable', 'Monday.com', 'Asana', 'ClickUp', 'Basecamp',
    'HubSpot', 'Mailchimp', 'Stripe', 'PayPal', 'Square', 'Shopify',
    'AWS', 'Azure', 'GCP', 'Heroku', 'Vercel', 'Netlify', 'Cloudflare'
  ];
  
  for (const brand of commonBrands) {
    gazetteer.add(brand);
  }
  
  return Array.from(gazetteer);
}