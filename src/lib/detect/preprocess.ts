/**
 * Text Preprocessing for Detection Analysis
 * Used in shadow mode for comparative analysis only
 */

export interface PreprocessedText {
  plainText: string;
  anchors: string[];
  domains: string[];
}

/**
 * Normalize whitespace - collapse multiple spaces, tabs, newlines
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Collapse multiple whitespace to single space
    .replace(/\n\s*\n/g, '\n') // Collapse multiple newlines
    .trim();
}

/**
 * Extract markdown links and return anchor text
 * Pattern: [anchor text](url) -> returns "anchor text"
 */
export function extractLinksWithAnchors(text: string): Array<{ anchor: string; url: string }> {
  const links: Array<{ anchor: string; url: string }> = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(text)) !== null) {
    const anchor = match[1].trim();
    const url = match[2].trim();
    
    if (anchor && url) {
      links.push({ anchor, url });
    }
  }

  return links;
}

/**
 * Extract domains from URLs in text
 */
export function extractDomains(text: string): string[] {
  const domains = new Set<string>();
  
  // Extract from markdown links [text](url)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = linkPattern.exec(text)) !== null) {
    const url = match[2].trim();
    const domain = extractDomainFromUrl(url);
    if (domain) {
      domains.add(domain);
    }
  }
  
  // Extract from plain URLs
  const urlPattern = /(https?:\/\/(?:www\.)?[^\s)\]<>"']+)/gi;
  const urlMatches = text.match(urlPattern);
  
  if (urlMatches) {
    urlMatches.forEach(url => {
      const domain = extractDomainFromUrl(url);
      if (domain) {
        domains.add(domain);
      }
    });
  }
  
  return Array.from(domains);
}

/**
 * Extract domain from URL string
 */
function extractDomainFromUrl(url: string): string | null {
  try {
    // Clean up trailing punctuation
    const cleanUrl = url.replace(/[.,;!?)\]]+$/, '');
    const parsedUrl = new URL(cleanUrl);
    return parsedUrl.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Strip markdown formatting but preserve link anchor text
 */
export function stripMarkdown(text: string): string {
  let processed = text;
  
  // Extract anchor text from links before removing them
  const linkAnchors: string[] = [];
  const linkPattern = /\[([^\]]+)\]\([^)]+\)/g;
  let match;
  
  while ((match = linkPattern.exec(text)) !== null) {
    linkAnchors.push(match[1]);
  }
  
  // Replace markdown links with anchor text
  processed = processed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove other markdown formatting
  processed = processed
    // Headers
    .replace(/^#{1,6}\s+/gm, '')
    // Bold and italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Lists
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Blockquotes
    .replace(/^>\s+/gm, '')
    // Horizontal rules
    .replace(/^---+$/gm, '')
    .replace(/^\*\*\*+$/gm, '');
  
  return processed;
}

/**
 * Remove citation markers of various formats
 */
export function removeCitationMarkers(text: string): string {
  return text
    // Bracket citations: [1], [2], [Smith 2023]
    .replace(/\[\d+\]/g, '')
    .replace(/\[[A-Za-z][A-Za-z\s]*\d{4}\]/g, '')
    .replace(/\[[A-Za-z][A-Za-z\s]{1,20}\]/g, '')
    // Parenthetical citations: (1), (Smith, 2023)
    .replace(/\(\d+\)/g, '')
    .replace(/\([A-Za-z][^)]*\d{4}[^)]*\)/g, '')
    // Footnote markers: [^1], [^note]
    .replace(/\[\^\w+\]/g, '')
    // Clean up double spaces from removed citations
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Main preprocessing function
 */
export function preprocessText(text: string): PreprocessedText {
  // Extract links and domains before processing
  const links = extractLinksWithAnchors(text);
  const anchors = links.map(link => link.anchor);
  const domains = extractDomains(text);
  
  // Process text step by step
  let processed = text;
  
  // 1. Strip markdown but preserve anchor text
  processed = stripMarkdown(processed);
  
  // 2. Remove citation markers
  processed = removeCitationMarkers(processed);
  
  // 3. Normalize whitespace
  processed = normalizeWhitespace(processed);
  
  return {
    plainText: processed,
    anchors,
    domains
  };
}

/**
 * Advanced preprocessing with options
 */
export function preprocessTextAdvanced(
  text: string,
  options: {
    preserveAnchors?: boolean;
    extractDomains?: boolean;
    removeCitations?: boolean;
    normalizeWhitespace?: boolean;
  } = {}
): PreprocessedText {
  const {
    preserveAnchors = true,
    extractDomains: extractDomainsFlag = true,
    removeCitations = true,
    normalizeWhitespace: normalizeWhitespaceFlag = true
  } = options;
  
  let processed = text;
  const anchors: string[] = [];
  const domains: string[] = [];
  
  // Extract anchors if requested
  if (preserveAnchors) {
    const links = extractLinksWithAnchors(text);
    anchors.push(...links.map(link => link.anchor));
  }
  
  // Extract domains if requested
  if (extractDomainsFlag) {
    domains.push(...extractDomains(text));
  }
  
  // Strip markdown
  processed = stripMarkdown(processed);
  
  // Remove citations if requested
  if (removeCitations) {
    processed = removeCitationMarkers(processed);
  }
  
  // Normalize whitespace if requested
  if (normalizeWhitespaceFlag) {
    processed = normalizeWhitespace(processed);
  }
  
  return {
    plainText: processed,
    anchors,
    domains
  };
}