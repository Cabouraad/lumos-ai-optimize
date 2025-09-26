/**
 * Enhanced citation extraction and analysis for AI responses
 */

import { extractCitations, extractDomain } from './citations.ts';

export type Citation = {
  url: string;
  domain: string;
  title?: string;
  source_type: 'page' | 'pdf' | 'video' | 'unknown';
  from_provider: boolean;
  brand_mention: 'unknown' | 'yes' | 'no';
  brand_mention_confidence: number;
};

export type CitationsData = {
  provider: string;
  citations: Citation[];
  collected_at: string;
  ruleset_version: string;
};

/**
 * Extract citations from Perplexity response with provider-supplied citations
 */
export function extractPerplexityCitations(response: any, responseText: string): CitationsData {
  const citations: Citation[] = [];
  
  // First try to get provider-supplied citations
  if (response.citations && Array.isArray(response.citations)) {
    response.citations.forEach(citation => {
      if (citation.url || citation.link) {
        const url = citation.url || citation.link;
        citations.push({
          url,
          domain: extractDomain(url),
          title: citation.title || citation.text || undefined,
          source_type: guessSourceType(url),
          from_provider: true,
          brand_mention: 'unknown',
          brand_mention_confidence: 0.0
        });
      }
    });
  }
  
  // Also check for related sources
  if (response.related_sources && Array.isArray(response.related_sources)) {
    response.related_sources.forEach(source => {
      if (source.url && !citations.some(c => c.url === source.url)) {
        citations.push({
          url: source.url,
          domain: extractDomain(source.url),
          title: source.title || undefined,
          source_type: guessSourceType(source.url),
          from_provider: true,
          brand_mention: 'unknown',
          brand_mention_confidence: 0.0
        });
      }
    });
  }
  
  // Fallback: extract URLs from text if no provider citations
  if (citations.length === 0) {
    const extractedCitations = extractCitations(responseText);
    extractedCitations.forEach(citation => {
      citations.push({
        url: citation.url,
        domain: citation.domain || extractDomain(citation.url),
        title: citation.title,
        source_type: guessSourceType(citation.url),
        from_provider: false,
        brand_mention: 'unknown',
        brand_mention_confidence: 0.0
      });
    });
  }
  
  return {
    provider: 'perplexity',
    citations: deduplicateCitations(citations).slice(0, 10),
    collected_at: new Date().toISOString(),
    ruleset_version: 'cite-v1'
  };
}

/**
 * Extract citations from Gemini response with grounding attributions
 */
export function extractGeminiCitations(response: any, responseText: string): CitationsData {
  const citations: Citation[] = [];
  
  // Try to get grounding attributions from Gemini
  if (response.candidates?.[0]?.groundingAttributions) {
    response.candidates[0].groundingAttributions.forEach(attr => {
      if (attr.web?.uri) {
        citations.push({
          url: attr.web.uri,
          domain: extractDomain(attr.web.uri),
          title: attr.web.title || undefined,
          source_type: guessSourceType(attr.web.uri),
          from_provider: true,
          brand_mention: 'unknown',
          brand_mention_confidence: 0.0
        });
      }
    });
  }
  
  // Fallback: extract URLs from text if no grounding attributions
  if (citations.length === 0) {
    const extractedCitations = extractCitations(responseText);
    extractedCitations.forEach(citation => {
      citations.push({
        url: citation.url,
        domain: citation.domain || extractDomain(citation.url),
        title: citation.title,
        source_type: guessSourceType(citation.url),
        from_provider: false,
        brand_mention: 'unknown',
        brand_mention_confidence: 0.0
      });
    });
  }
  
  return {
    provider: 'gemini',
    citations: deduplicateCitations(citations).slice(0, 10),
    collected_at: new Date().toISOString(),
    ruleset_version: 'cite-v1'
  };
}

/**
 * Extract citations from OpenAI response (text-only)
 */
export function extractOpenAICitations(responseText: string): CitationsData {
  const citations: Citation[] = [];
  
  // OpenAI doesn't provide citations, so extract from text
  const extractedCitations = extractCitations(responseText);
  extractedCitations.forEach(citation => {
    citations.push({
      url: citation.url,
      domain: citation.domain || extractDomain(citation.url),
      title: citation.title,
      source_type: guessSourceType(citation.url),
      from_provider: false,
      brand_mention: 'unknown',
      brand_mention_confidence: 0.0
    });
  });
  
  return {
    provider: 'openai',
    citations: deduplicateCitations(citations).slice(0, 10),
    collected_at: new Date().toISOString(),
    ruleset_version: 'cite-v1'
  };
}

/**
 * Guess source type from URL
 */
function guessSourceType(url: string): 'page' | 'pdf' | 'video' | 'unknown' {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    if (pathname.endsWith('.pdf')) return 'pdf';
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) return 'video';
    if (urlObj.hostname.includes('vimeo.com') || pathname.includes('/video/')) return 'video';
    if (pathname.endsWith('.html') || pathname.endsWith('.htm') || pathname === '/' || !pathname.includes('.')) return 'page';
    
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Remove duplicate citations by URL
 */
function deduplicateCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter(citation => {
    if (seen.has(citation.url)) {
      return false;
    }
    seen.add(citation.url);
    return true;
  });
}

/**
 * Check if content mentions org brands using fuzzy matching
 */
export function detectBrandMentions(
  content: string, 
  orgBrands: Array<{ name: string; variants_json: any }>
): { hasMention: boolean; confidence: number } {
  if (!content || !orgBrands || orgBrands.length === 0) {
    return { hasMention: false, confidence: 0.9 };
  }
  
  let totalMatches = 0;
  const contentLower = content.toLowerCase();
  
  for (const brand of orgBrands.filter(b => b.variants_json)) {
    const variants = Array.isArray(brand.variants_json) ? brand.variants_json : [];
    const allNames = [brand.name, ...variants].filter(Boolean);
    
    for (const name of allNames) {
      const nameLower = name.toLowerCase();
      // Use word boundary matching to avoid false positives
      const regex = new RegExp(`\\b${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = (content.match(regex) || []).length;
      totalMatches += matches;
    }
  }
  
  if (totalMatches > 0) {
    // Calculate confidence based on number of matches
    const confidence = Math.min(1.0, Math.log(1 + totalMatches) / 2);
    return { hasMention: true, confidence };
  }
  
  return { hasMention: false, confidence: 0.9 };
}