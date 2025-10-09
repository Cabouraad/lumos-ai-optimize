import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

// Standard CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CrawlResult {
  success: boolean;
  data?: any;
  error?: string;
  pages?: any[];
  source?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting llms.txt generation process');

    // Create client with service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create another client for user authentication
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get current user using the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Authentication error:', userError);
      throw new Error('Authentication failed');
    }

    console.log('User authenticated:', user.id);

    // Get user's org
    const { data: userData, error: orgError } = await supabaseClient
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (orgError || !userData?.org_id) {
      throw new Error('No organization found');
    }

    const orgId = userData.org_id;

    // Get organization data
    const { data: orgData, error: orgDataError } = await supabaseClient
      .from('organizations')
      .select('domain, name, keywords, business_description, products_services, target_audience')
      .eq('id', orgId)
      .single();

    if (orgDataError || !orgData?.domain) {
      throw new Error('Organization domain not found');
    }

    const domain = orgData.domain;
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    
    console.log(`Processing domain: ${domain}`);

    // Step 1: Discover pages via sitemap and robots.txt
    const discoveredPages = await discoverPages(baseUrl);
    console.log(`Discovered ${discoveredPages.length} pages from sitemap`);

    // Step 2: Use Firecrawl to scrape key pages
    const crawlResult = await crawlWithFirecrawl(baseUrl, discoveredPages);
    console.log(`Crawl completed with source: ${crawlResult.source}`);

    if (!crawlResult.success) {
      throw new Error(crawlResult.error || 'Crawling failed');
    }

    // Step 3: Extract content and generate llms.txt
    const generatedData = await generateLLMsContent(orgData, crawlResult, baseUrl);

    // Step 4: Store in database
    const { error: updateError } = await supabaseClient
      .from('organizations')
      .update({
        llms_txt: generatedData.content,
        llms_last_generated_at: new Date().toISOString(),
        llms_pages: crawlResult.pages || [],
        llms_generation_source: crawlResult.source
      })
      .eq('id', orgId);

    if (updateError) {
      console.error('Failed to update organization:', updateError);
    }

    // Store generation history
    await supabaseClient
      .from('llms_generations')
      .insert({
        org_id: orgId,
        source: crawlResult.source,
        pages_found: crawlResult.pages?.length || 0,
        content_extracted: crawlResult.success,
        llms_txt_content: generatedData.content,
        metadata: {
          discovered_pages: discoveredPages.length,
          crawled_pages: crawlResult.pages?.length || 0,
          extraction_method: crawlResult.source
        }
      });

    return new Response(JSON.stringify({
      success: true,
      content: generatedData.content,
      source: crawlResult.source,
      pagesFound: crawlResult.pages?.length || 0,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in llms-generate function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function discoverPages(baseUrl: string): Promise<string[]> {
  const pages = new Set<string>();
  
  try {
    // Try to get sitemap
    const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LLMsBot/1.0)' }
    });
    
    if (sitemapResponse.ok) {
      const sitemapText = await sitemapResponse.text();
      const urlMatches = sitemapText.match(/<loc>(.*?)<\/loc>/g);
      
      if (urlMatches) {
        urlMatches.forEach((match: string) => {
          const url = match.replace('<loc>', '').replace('</loc>', '');
          if (url.startsWith(baseUrl)) {
            pages.add(url);
          }
        });
      }
    }
  } catch (error: unknown) {
    console.log('Sitemap fetch failed:', error.message);
  }

  // Add common pages if none found
  if (pages.size === 0) {
    const commonPages = ['/', '/about', '/contact', '/services', '/products', '/pricing'];
    commonPages.forEach((page: any) => pages.add(`${baseUrl}${page}`));
  }

  return Array.from(pages).slice(0, 20); // Limit to 20 pages
}

async function crawlWithFirecrawl(baseUrl: string, discoveredPages: string[]): Promise<CrawlResult> {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  
  if (!firecrawlKey) {
    console.log('No Firecrawl API key, falling back to direct fetch');
    return await fallbackFetch(baseUrl, discoveredPages);
  }

  try {
    console.log('Attempting Firecrawl crawl');
    
    // Use Firecrawl to crawl the domain
    const response = await fetch('https://api.firecrawl.dev/v0/crawl', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: baseUrl,
        crawlerOptions: {
          limit: 15,
          excludes: ['*.pdf', '*.jpg', '*.png', '*.gif', '*.css', '*.js'],
          includes: ['*'],
        },
        pageOptions: {
          onlyMainContent: true,
          includeHtml: false,
          screenshot: false
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
      return {
        success: true,
        pages: data.data,
        source: 'firecrawl',
        data: data.data
      };
    }

    throw new Error('Firecrawl returned no data');

  } catch (error: unknown) {
    console.error('Firecrawl failed:', error.message);
    return await fallbackFetch(baseUrl, discoveredPages);
  }
}

async function fallbackFetch(baseUrl: string, discoveredPages: string[]): Promise<CrawlResult> {
  console.log('Using fallback direct fetch method');
  
  const pages = [];
  const pagesToTry = discoveredPages.slice(0, 5); // Limit to 5 pages for fallback
  
  for (const pageUrl of pagesToTry) {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LLMsBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        const html = await response.text();
        
        // Extract basic content using simple text extraction
        const textContent = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (textContent.length > 100) {
          pages.push({
            url: pageUrl,
            content: textContent.slice(0, 2000), // Limit content
            title: extractTitle(html)
          });
        }
      }
    } catch (error: unknown) {
      console.log(`Failed to fetch ${pageUrl}:`, error.message);
    }
  }

  return {
    success: pages.length > 0,
    pages,
    source: 'direct-fetch',
    error: pages.length === 0 ? 'No pages could be fetched' : undefined
  };
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : 'Untitled Page';
}

async function generateLLMsContent(orgData: any, crawlResult: CrawlResult, baseUrl: string): Promise<{ content: string }> {
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Extract key information from crawled content
  let extractedInfo = {
    pages: [] as string[],
    description: orgData.business_description || '',
    products: orgData.products_services || '',
    keywords: orgData.keywords || []
  };

  if (crawlResult.pages && crawlResult.pages.length > 0) {
    // Extract page URLs and improve description if needed
    extractedInfo.pages = crawlResult.pages
      .map((page: any) => page.url || page.metadata?.sourceURL)
      .filter(Boolean)
      .map(url => url.replace(baseUrl, '') || '/')
      .slice(0, 10);

    // If we don't have good org description, try to extract from content
    if (!extractedInfo.description || extractedInfo.description.length < 50) {
      const allContent = crawlResult.pages
        .map((page: any) => page.content || page.markdown || '')
        .join(' ')
        .slice(0, 1000);

      if (allContent.length > 100) {
        extractedInfo.description = `Website content includes information about ${orgData.name || 'our company'} and our services.`;
      }
    }
  }

  // Generate llms.txt content
  const content = `# llms.txt

# ${orgData.name || 'Website'}
# Generated on ${currentDate}
# This file provides structured information about our website for Large Language Models (LLMs)

## Site Information
Site Name: ${orgData.name || 'Website'}
Site URL: ${baseUrl}

## Description
${extractedInfo.description || `${orgData.name} website providing information about our services and products.`}

## Products and Services
${extractedInfo.products || 'Please visit our website for detailed information about our offerings.'}

## Target Audience  
${orgData.target_audience || 'Please visit our website to learn more about our target audience.'}

## Key Pages
${extractedInfo.pages.length > 0 ? 
  extractedInfo.pages.map(page => `- ${baseUrl}${page.startsWith('/') ? page : '/' + page}`).join('\n') :
  `- ${baseUrl}/
- ${baseUrl}/about
- ${baseUrl}/contact`}

## Keywords and Topics
${extractedInfo.keywords.length > 0 ? 
  extractedInfo.keywords.map(keyword => `- ${keyword}`).join('\n') :
  '- Please visit our website to learn about our areas of focus'}

## Guidelines for LLMs
- Please reference our content accurately when discussing our products or services
- For the most up-to-date information, please check our website at ${baseUrl}
- This information was automatically generated on ${currentDate}

## About llms.txt
This file follows the llms.txt standard for providing structured information to AI systems.
Learn more at: https://llmstxt.org/

## Generation Details
Generated using: ${crawlResult.source}
Pages analyzed: ${crawlResult.pages?.length || 0}
Last updated: ${new Date().toISOString()}`;

  return { content };
}