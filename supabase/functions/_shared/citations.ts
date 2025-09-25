/**
 * Citation extraction from AI responses
 */

export function extractCitations(aiResponse: string): Array<{ url: string; title?: string; domain?: string }> {
  const citations: Array<{ url: string; title?: string; domain?: string }> = [];
  
  // Extract URLs from the response
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const urls = aiResponse.match(urlRegex) || [];
  
  // Extract markdown-style links [title](url)
  const markdownRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let match;
  while ((match = markdownRegex.exec(aiResponse)) !== null) {
    const title = match[1];
    const url = match[2];
    citations.push({
      url,
      title,
      domain: extractDomain(url)
    });
  }
  
  // Add standalone URLs
  urls.forEach((url: any) => {
    if (!citations.some(c => c.url === url)) {
      citations.push({
        url,
        domain: extractDomain(url)
      });
    }
  });
  
  return citations.slice(0, 20); // Limit to top 20 citations
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

export function categorizeCitations(citations: Array<{ url: string; title?: string; domain?: string }>) {
  const categories = {
    news: [] as Array<{ url: string; title?: string; domain?: string }>,
    social: [] as Array<{ url: string; title?: string; domain?: string }>,
    official: [] as Array<{ url: string; title?: string; domain?: string }>,
    research: [] as Array<{ url: string; title?: string; domain?: string }>,
    other: [] as Array<{ url: string; title?: string; domain?: string }>
  };
  
  const newsDomains = ['cnn.com', 'bbc.com', 'reuters.com', 'ap.org', 'nytimes.com', 'wsj.com', 'guardian.com'];
  const socialDomains = ['twitter.com', 'facebook.com', 'linkedin.com', 'instagram.com', 'youtube.com', 'reddit.com'];
  const researchDomains = ['arxiv.org', 'pubmed.ncbi.nlm.nih.gov', 'scholar.google.com', 'researchgate.net'];
  
  citations.forEach((citation: any) => {
    const domain = citation.domain || '';
    
    if (newsDomains.some(d => domain.includes(d))) {
      categories.news.push(citation);
    } else if (socialDomains.some(d => domain.includes(d))) {
      categories.social.push(citation);
    } else if (researchDomains.some(d => domain.includes(d))) {
      categories.research.push(citation);
    } else if (domain.endsWith('.gov') || domain.endsWith('.edu') || domain.endsWith('.org')) {
      categories.official.push(citation);
    } else {
      categories.other.push(citation);
    }
  });
  
  return categories;
}