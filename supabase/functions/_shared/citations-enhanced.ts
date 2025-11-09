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
export function extractPerplexityCitations(
  response: any, 
  responseText: string,
  brandCatalog?: Array<{ name: string; variants_json: any; is_org_brand: boolean }>
): CitationsData {
  const citations: Citation[] = [];
  
  console.log('[Perplexity Citations] Response structure:', JSON.stringify(response).substring(0, 200));
  
  // Perplexity API returns citations as a string array in the root response object
  // Example: { "citations": ["https://example.com", "https://example2.com"], "choices": [...] }
  if (response.citations && Array.isArray(response.citations)) {
    response.citations.forEach((citation: any, index: number) => {
      // Handle both string URLs and object citations
      if (typeof citation === 'string') {
        // Citation is a URL string
        const domain = extractDomain(citation);
        const title = `Source ${index + 1}`;
        const analysis = brandCatalog 
          ? analyzeCitationBrandMentions({ url: citation, domain, title }, brandCatalog)
          : { brandMention: 'unknown' as const, confidence: 0.0 };
        
        citations.push({
          url: citation,
          domain,
          title,
          source_type: guessSourceType(citation),
          from_provider: true,
          brand_mention: analysis.brandMention,
          brand_mention_confidence: analysis.confidence
        });
      } else if (typeof citation === 'object' && (citation.url || citation.link)) {
        // Citation is an object with url/link field
        const url = citation.url || citation.link;
        const domain = extractDomain(url);
        const title = citation.title || citation.text || `Source ${index + 1}`;
        const analysis = brandCatalog 
          ? analyzeCitationBrandMentions({ url, domain, title }, brandCatalog)
          : { brandMention: 'unknown' as const, confidence: 0.0 };
        
        citations.push({
          url,
          domain,
          title,
          source_type: guessSourceType(url),
          from_provider: true,
          brand_mention: analysis.brandMention,
          brand_mention_confidence: analysis.confidence
        });
      }
    });
    
    console.log(`[Perplexity Citations] Extracted ${citations.length} citations from response.citations`);
  }
  
  // Also check for related sources
  if (response.related_sources && Array.isArray(response.related_sources)) {
    response.related_sources.forEach((source: any) => {
      if (source.url && !citations.some((c: any) => c.url === source.url)) {
        const domain = extractDomain(source.url);
        const title = source.title || undefined;
        const analysis = brandCatalog 
          ? analyzeCitationBrandMentions({ url: source.url, domain, title: title || '' }, brandCatalog)
          : { brandMention: 'unknown' as const, confidence: 0.0 };
        
        citations.push({
          url: source.url,
          domain,
          title,
          source_type: guessSourceType(source.url),
          from_provider: true,
          brand_mention: analysis.brandMention,
          brand_mention_confidence: analysis.confidence
        });
      }
    });
  }
  
  // Fallback: extract URLs from text if no provider citations
  if (citations.length === 0) {
    const extractedCitations = extractCitations(responseText);
    extractedCitations.forEach((citation: any) => {
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
export function extractGeminiCitations(
  response: any, 
  responseText: string,
  brandCatalog?: Array<{ name: string; variants_json: any; is_org_brand: boolean }>
): CitationsData {
  const citations: Citation[] = [];
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  const citationMetadata = response.candidates?.[0]?.citationMetadata;
  
  console.log(`[Gemini Citations] Metadata Check - groundingMetadata: ${!!groundingMetadata}, citationMetadata: ${!!citationMetadata}`);
  
  // Priority 1: Get citations from citationMetadata (direct API citations)
  if (citationMetadata?.citations && Array.isArray(citationMetadata.citations)) {
    console.log(`[Gemini Citations] Processing ${citationMetadata.citations.length} citationMetadata citations`);
    
    citationMetadata.citations.forEach((citation: any, idx: number) => {
      if (citation.uri) {
        const domain = extractDomain(citation.uri);
        const title = citation.title || `Source ${idx + 1}`;
        const analysis = brandCatalog 
          ? analyzeCitationBrandMentions({ url: citation.uri, domain, title }, brandCatalog)
          : { brandMention: 'unknown' as const, confidence: 0.0 };
        
        const citationObj = {
          url: citation.uri,
          domain,
          title,
          source_type: guessSourceType(citation.uri),
          from_provider: true,
          brand_mention: analysis.brandMention,
          brand_mention_confidence: analysis.confidence
        };
        citations.push(citationObj);
        console.log(`[Gemini Citations] citationMetadata ${idx + 1}: ${citationObj.domain} - "${citationObj.title?.substring(0, 50)}" [Brand: ${analysis.brandMention}]`);
      }
    });
  }
  
  // Priority 2: Get citations from grounding chunks (Google Search retrieval)
  if (groundingMetadata?.groundingChunks) {
    const chunks = groundingMetadata.groundingChunks;
    console.log(`[Gemini Citations] Processing ${chunks.length} grounding chunks`);
    
    chunks.forEach((chunk: any, idx: number) => {
      if (chunk.web?.uri) {
        // Skip if already added from citationMetadata
        if (citations.some(c => c.url === chunk.web.uri)) {
          return;
        }
        
        const domain = extractDomain(chunk.web.uri);
        const title = chunk.web.title || `Source ${idx + 1}`;
        const analysis = brandCatalog 
          ? analyzeCitationBrandMentions({ url: chunk.web.uri, domain, title }, brandCatalog)
          : { brandMention: 'unknown' as const, confidence: 0.0 };
        
        const citation = {
          url: chunk.web.uri,
          domain,
          title,
          source_type: guessSourceType(chunk.web.uri),
          from_provider: true,
          brand_mention: analysis.brandMention,
          brand_mention_confidence: analysis.confidence
        };
        citations.push(citation);
        console.log(`[Gemini Citations] Chunk ${idx + 1}: ${citation.domain} - "${citation.title?.substring(0, 50)}" [Brand: ${analysis.brandMention}]`);
      }
    });
  }
  
  // Log grounding support level for monitoring
  if (groundingMetadata?.groundingSupport) {
    console.log(`[Gemini Citations] Grounding support level: ${JSON.stringify(groundingMetadata.groundingSupport)}`);
  }
  
  // Log search queries used for transparency
  if (groundingMetadata?.webSearchQueries) {
    console.log(`[Gemini Citations] Web search queries: ${groundingMetadata.webSearchQueries.join(', ')}`);
  }
  
  // Priority 3: Extract grounding attributions (inline citations)
  if (groundingMetadata?.groundingAttributions && citations.length < 10) {
    console.log(`[Gemini Citations] Processing ${groundingMetadata.groundingAttributions.length} attribution chunks`);
    groundingMetadata.groundingAttributions.forEach((attr: any) => {
      if (attr.web?.uri && !citations.some(c => c.url === attr.web.uri)) {
        const domain = extractDomain(attr.web.uri);
        const title = attr.web.title || attr.sourceId?.groundingChunkId || undefined;
        const analysis = brandCatalog 
          ? analyzeCitationBrandMentions({ url: attr.web.uri, domain, title: title || '' }, brandCatalog)
          : { brandMention: 'unknown' as const, confidence: 0.0 };
        
        citations.push({
          url: attr.web.uri,
          domain,
          title,
          source_type: guessSourceType(attr.web.uri),
          from_provider: true,
          brand_mention: analysis.brandMention,
          brand_mention_confidence: analysis.confidence
        });
      }
    });
  }
  
  // Priority 4: Fallback to text extraction if no citations found
  if (citations.length === 0) {
    console.log('[Gemini Citations] No citationMetadata or grounding citations found, falling back to text extraction');
    const extractedCitations = extractCitations(responseText);
    extractedCitations.forEach((citation: any) => {
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
  
  const finalCitations = deduplicateCitations(citations).slice(0, 20);
  console.log(`[Gemini Citations] Final result: ${finalCitations.length} unique citations from ${citations.length} total`);
  
  return {
    provider: 'gemini',
    citations: finalCitations,
    collected_at: new Date().toISOString(),
    ruleset_version: 'cite-v2'
  };
}

/**
 * Extract citations from OpenAI response (text-only)
 */
export function extractOpenAICitations(
  responseText: string,
  brandCatalog?: Array<{ name: string; variants_json: any; is_org_brand: boolean }>
): CitationsData {
  const citations: Citation[] = [];
  
  // OpenAI doesn't provide citations, so extract from text
  const extractedCitations = extractCitations(responseText);
  extractedCitations.forEach((citation: any) => {
    const domain = citation.domain || extractDomain(citation.url);
    const title = citation.title;
    const analysis = brandCatalog 
      ? analyzeCitationBrandMentions({ url: citation.url, domain, title: title || '' }, brandCatalog)
      : { brandMention: 'unknown' as const, confidence: 0.0 };
    
    citations.push({
      url: citation.url,
      domain,
      title,
      source_type: guessSourceType(citation.url),
      from_provider: false,
      brand_mention: analysis.brandMention,
      brand_mention_confidence: analysis.confidence
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
  return citations.filter((citation: any) => {
    if (seen.has(citation.url)) {
      return false;
    }
    seen.add(citation.url);
    return true;
  });
}

/**
 * Analyze citation for brand mentions (org brands and competitors)
 */
export interface BrandMentionAnalysis {
  mentionsOrgBrand: boolean;
  mentionsCompetitor: boolean;
  mentionedBrands: string[];
  confidence: number;
  brandMention: 'yes' | 'no' | 'unknown';
}

export function analyzeCitationBrandMentions(
  citation: { url: string; domain: string; title?: string },
  brandCatalog: Array<{ name: string; variants_json: any; is_org_brand: boolean }>
): BrandMentionAnalysis {
  if (!brandCatalog || brandCatalog.length === 0) {
    return {
      mentionsOrgBrand: false,
      mentionsCompetitor: false,
      mentionedBrands: [],
      confidence: 0.0,
      brandMention: 'unknown'
    };
  }

  // Combine all citation text for analysis
  const citationText = [
    citation.url,
    citation.domain,
    citation.title || ''
  ].join(' ').toLowerCase();

  const mentionedBrands: string[] = [];
  let orgBrandMatches = 0;
  let competitorMatches = 0;

  for (const brand of brandCatalog) {
    const variants = Array.isArray(brand.variants_json) ? brand.variants_json : [];
    const allNames = [brand.name, ...variants].filter(Boolean);

    for (const name of allNames) {
      const nameLower = name.toLowerCase();
      // Use word boundary matching for accuracy
      const regex = new RegExp(`\\b${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      
      if (regex.test(citationText)) {
        if (!mentionedBrands.includes(brand.name)) {
          mentionedBrands.push(brand.name);
        }
        
        if (brand.is_org_brand) {
          orgBrandMatches++;
        } else {
          competitorMatches++;
        }
        break; // Found this brand, move to next
      }
    }
  }

  const totalMatches = orgBrandMatches + competitorMatches;
  const mentionsOrgBrand = orgBrandMatches > 0;
  const mentionsCompetitor = competitorMatches > 0;

  // Calculate confidence based on match count and text length
  const confidence = totalMatches > 0 
    ? Math.min(0.95, 0.6 + (totalMatches * 0.15)) 
    : 0.85; // High confidence when no brands found

  // Determine brand_mention field
  let brandMention: 'yes' | 'no' | 'unknown' = 'unknown';
  if (mentionsOrgBrand) {
    brandMention = 'yes'; // Citation mentions org brand
  } else if (totalMatches > 0) {
    brandMention = 'no'; // Citation mentions competitors only
  }

  return {
    mentionsOrgBrand,
    mentionsCompetitor,
    mentionedBrands,
    confidence,
    brandMention
  };
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
  
  for (const brand of orgBrands.filter((b: any) => b.variants_json)) {
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