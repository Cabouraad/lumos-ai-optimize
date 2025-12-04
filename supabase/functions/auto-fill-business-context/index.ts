import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to safely convert errors to messages
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

interface BusinessContext {
  keywords: string[]
  competitors: string[]
  business_description: string
  products_services: string
  target_audience: string
}

// Content acquisition pipeline - multiple sources with fallbacks
async function acquireWebsiteContent(targetDomain: string): Promise<{
  content: string;
  html: string;
  method: string;
  success: boolean;
}> {
  console.log(`=== CONTENT ACQUISITION PIPELINE STARTED FOR: ${targetDomain} ===`)
  
  let websiteContent = ''
  let rawHtml = ''
  let fetchMethod = 'none'
  
  // Clean domain for consistent processing
  const cleanDomain = targetDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const urls = [
    `https://${cleanDomain}`,
    `http://${cleanDomain}`,
    `https://www.${cleanDomain}`,
    `http://www.${cleanDomain}`
  ]
  
  // STEP 1: Direct fetch attempts
  console.log('STEP 1: Attempting direct fetch...')
  for (const url of urls) {
    try {
      console.log(`Attempting to fetch: ${url}`)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BusinessContextBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        rawHtml = await response.text()
        websiteContent = cleanHtmlContent(rawHtml)
        
        if (websiteContent.length > 100) {
          fetchMethod = 'direct-fetch'
          console.log(`✅ Direct fetch successful (${websiteContent.length} chars)`)
          break
        }
      }
    } catch (error: unknown) {
      console.log(`Direct fetch failed for ${url}: ${toErrorMessage(error)}`)
    }
  }
  
  // STEP 2: Firecrawl if direct fetch insufficient
  if (websiteContent.length < 100) {
    console.log('STEP 2: Attempting Firecrawl...')
    const firecrawlResult = await tryFirecrawl(cleanDomain)
    if (firecrawlResult.success) {
      websiteContent = firecrawlResult.content
      rawHtml = firecrawlResult.html
      fetchMethod = firecrawlResult.method
    }
  }
  
  // STEP 3: LLMS.txt fallback
  if (websiteContent.length < 100) {
    console.log('STEP 3: Attempting LLMS.txt fallback...')
    const llmsTxtResult = await tryLLMSTxt(cleanDomain)
    if (llmsTxtResult.success) {
      websiteContent = llmsTxtResult.content
      fetchMethod = 'llms-txt'
    }
  }
  
  // STEP 4: Readability proxy
  if (websiteContent.length < 100) {
    console.log('STEP 4: Attempting readability proxy...')
    const readabilityResult = await tryReadabilityProxy(cleanDomain)
    if (readabilityResult.success) {
      websiteContent = readabilityResult.content
      fetchMethod = 'readability-proxy'
    }
  }
  
  // STEP 5: Sitemap discovery
  if (websiteContent.length < 100) {
    console.log('STEP 5: Attempting sitemap discovery...')
    const sitemapResult = await trySitemapDiscovery(cleanDomain)
    if (sitemapResult.success) {
      websiteContent = sitemapResult.content
      fetchMethod = 'sitemap-discovery'
    }
  }
  
  return {
    content: websiteContent,
    html: rawHtml,
    method: fetchMethod,
    success: websiteContent.length > 50
  }
}

async function tryFirecrawl(domain: string): Promise<{ success: boolean; content: string; html: string; method: string }> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')
  if (!firecrawlApiKey) {
    console.log('Firecrawl API key not available')
    return { success: false, content: '', html: '', method: '' }
  }
  
  try {
    const scrapeUrl = `https://${domain}`
    console.log(`Attempting Firecrawl scrape for: ${scrapeUrl}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    
    const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        url: scrapeUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        timeout: 12000
      })
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const data = await response.json()
      const content = Array.isArray(data.data) ? data.data[0] : data.data
      
      if (content?.markdown && content.markdown.length > 100) {
        console.log(`✅ Firecrawl successful (${content.markdown.length} chars)`)
        return {
          success: true,
          content: content.markdown,
          html: content.html || '',
          method: 'firecrawl-scrape'
        }
      }
    }
  } catch (error: unknown) {
    console.log(`Firecrawl failed: ${toErrorMessage(error)}`)
  }
  
  return { success: false, content: '', html: '', method: '' }
}

async function tryLLMSTxt(domain: string): Promise<{ success: boolean; content: string }> {
  try {
    const llmsUrl = `https://${domain}/llms.txt`
    console.log(`Attempting LLMS.txt fetch: ${llmsUrl}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(llmsUrl, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const content = await response.text()
      if (content.length > 100) {
        console.log(`✅ LLMS.txt successful (${content.length} chars)`)
        return { success: true, content }
      }
    }
  } catch (error: unknown) {
    console.log(`LLMS.txt failed: ${toErrorMessage(error)}`)
  }
  
  return { success: false, content: '' }
}

async function tryReadabilityProxy(domain: string): Promise<{ success: boolean; content: string }> {
  try {
    const proxyUrl = `https://r.jina.ai/https://${domain}`
    console.log(`Attempting readability proxy: ${proxyUrl}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(proxyUrl, { 
      signal: controller.signal,
      headers: {
        'Accept': 'text/plain'
      }
    })
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const content = await response.text()
      if (content.length > 100) {
        console.log(`✅ Readability proxy successful (${content.length} chars)`)
        return { success: true, content }
      }
    }
  } catch (error: unknown) {
    console.log(`Readability proxy failed: ${toErrorMessage(error)}`)
  }
  
  return { success: false, content: '' }
}

async function trySitemapDiscovery(domain: string): Promise<{ success: boolean; content: string }> {
  try {
    const sitemapUrl = `https://${domain}/sitemap.xml`
    console.log(`Attempting sitemap discovery: ${sitemapUrl}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(sitemapUrl, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const sitemapContent = await response.text()
      const urls = extractUrlsFromSitemap(sitemapContent)
      
      for (const url of urls.slice(0, 3)) {
        try {
          const pageResponse = await fetch(url, { 
            signal: AbortSignal.timeout(3000),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BusinessContextBot/1.0)' }
          })
          
          if (pageResponse.ok) {
            const pageHtml = await pageResponse.text()
            const pageContent = cleanHtmlContent(pageHtml)
            
            if (pageContent.length > 100) {
              console.log(`✅ Sitemap discovery successful (${pageContent.length} chars)`)
              return { success: true, content: pageContent }
            }
          }
        } catch (pageError: unknown) {
          console.log(`Sitemap page fetch failed for ${url}: ${toErrorMessage(pageError)}`)
        }
      }
    }
  } catch (error: unknown) {
    console.log(`Sitemap discovery failed: ${toErrorMessage(error)}`)
  }
  
  return { success: false, content: '' }
}

function extractUrlsFromSitemap(sitemapXml: string): string[] {
  const urls: string[] = []
  const urlMatches = sitemapXml.match(/<loc>(.*?)<\/loc>/g)
  
  if (urlMatches) {
    for (const match of urlMatches) {
      const url = match.replace(/<\/?loc>/g, '')
      if (url.includes('about') || url.includes('home') || url.includes('index') || urls.length < 5) {
        urls.push(url)
      }
    }
  }
  
  return urls
}

function cleanHtmlContent(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/gi, '')
    .replace(/<\/?(h[1-6]|p|div|section|article|header|main|nav|footer|li)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .substring(0, 15000)
}

// Extract keywords from meta tags
function extractMetaKeywords(html: string): string[] {
  const keywords: string[] = []
  
  // Extract from meta keywords tag
  const keywordsMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i)
  if (keywordsMatch && keywordsMatch[1]) {
    const metaKeywords = keywordsMatch[1]
      .split(/[,;]/)
      .map(k => k.trim())
      .filter(k => k.length > 2 && k.length < 50)
    keywords.push(...metaKeywords)
  }
  
  // Extract from meta description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
  if (descMatch && descMatch[1]) {
    const desc = descMatch[1]
    const descWords = desc
      .split(/\s+/)
      .filter(w => w.length > 4 && w.length < 30)
      .slice(0, 5)
    keywords.push(...descWords)
  }
  
  // Extract from title tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  if (titleMatch && titleMatch[1]) {
    const titleWords = titleMatch[1]
      .split(/[\s-|•]/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && w.length < 40)
    keywords.push(...titleWords.slice(0, 3))
  }
  
  // Remove duplicates and return
  return [...new Set(keywords)].slice(0, 10)
}

// Generate synthetic business context as absolute fallback
function generateSyntheticContext(domain: string, orgName?: string, metaKeywords: string[] = []): BusinessContext {
  console.log(`🔄 Generating synthetic context for domain: ${domain}, org: ${orgName}`)
  
  // Extract meaningful keywords from domain and org name
  const domainKeywords = domain
    .replace(/\.(com|org|net|io|co|app|dev)$/, '')
    .split(/[.-]/)
    .filter(word => word.length > 2)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  
  const orgKeywords = orgName && orgName !== 'Your Business'
    ? orgName.split(/\s+/).filter((word: string) => word.length > 2)
    : []
  
  // Combine domain, org, and meta keywords
  const allKeywords = [...new Set([...domainKeywords, ...orgKeywords, ...metaKeywords])]
  
  // Only add generic keywords if we don't have enough specific ones
  const keywords = allKeywords.length >= 5 
    ? allKeywords.slice(0, 10)
    : [...allKeywords, 'services', 'solutions', 'quality'].slice(0, 10)
  
  const businessName = orgName && orgName !== 'Your Business' ? orgName : domain
  
  return {
    keywords,
    competitors: [], 
    business_description: `${businessName} - Please describe what your business does, your main offerings, and what makes you unique. This information helps generate better AI prompts for your needs.`,
    products_services: `List your key products or services here. For example: ${keywords.slice(0, 3).join(', ')}`,
    target_audience: `Describe your ideal customers or clients. Who do you serve and what problems do you solve for them?`
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('=== AUTO-FILL FUNCTION STARTED ===')
  
  try {
    // Check if Lovable API key is available
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) {
      console.error('Lovable API key not found in environment')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'AI service not configured. Please contact support.',
          needsApiKey: true,
          missingApiKey: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the user's auth token
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')

    // Get user from token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    console.log('Processing auto-fill for user:', user.id)

    // Get request body to check for domain override and brandId
    const requestBody = await req.json().catch(() => ({}))
    const domainOverride = requestBody?.domain
    const brandId = requestBody?.brandId

    console.log('Request body:', { domainOverride, brandId })

    // Try to get user's organization, but don't fail if it doesn't exist
    const { data: userData } = await supabaseClient
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    let orgData = null
    let brandData = null
    let targetDomain = domainOverride

    // If brandId is provided, get brand data first
    if (brandId) {
      const { data: brandResult } = await supabaseClient
        .from('brands')
        .select('id, name, domain, org_id')
        .eq('id', brandId)
        .single()
      
      brandData = brandResult
      if (brandData?.domain && !domainOverride) {
        targetDomain = brandData.domain
      }
    }

    // If we have an org_id, try to get organization data
    if (userData?.org_id) {
      const { data: orgResult } = await supabaseClient
        .from('organizations')
        .select('domain, name')
        .eq('id', userData.org_id)
        .single()
      
      orgData = orgResult
      // Only use org domain if we don't have a brand domain
      if (orgData?.domain && !targetDomain) {
        targetDomain = orgData.domain
      }
    }

    // If we don't have a domain from either source, use synthetic fallback
    if (!targetDomain) {
      console.log('No domain available - generating instructional context')
      const instructionalContext = generateSyntheticContext('your-domain.com', 'Your Company Name', [])
      
      return new Response(
        JSON.stringify({ 
          success: true,
          data: instructionalContext,
          businessContext: instructionalContext,
          message: 'Please enter your business domain above and click Auto-fill again, or manually fill in the information below.',
          source: 'no-domain',
          model_used: 'none',
          durations: { fetch_ms: 0, ai_ms: 0, total_ms: 0 },
          hasOrganization: !!orgData,
          fallbackReason: 'no_domain'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    console.log('Using domain for auto-fill:', { 
      targetDomain, 
      orgName: orgData?.name || 'N/A', 
      hasOrganization: !!orgData 
    })

    const fetchStartTime = Date.now()

    // Use robust content acquisition pipeline
    const contentResult = await acquireWebsiteContent(targetDomain)
    const fetchDuration = Date.now() - fetchStartTime

    console.log(`Content acquisition completed: ${contentResult.method} (${contentResult.content.length} chars)`)

    // If content acquisition failed completely, use synthetic context
    if (!contentResult.success) {
      console.log('All content acquisition methods failed - generating instructional context')
      const instructionalContext = generateSyntheticContext(targetDomain, orgData?.name, [])
      
      // Update brand or organization with fallback context
      if (brandId && brandData) {
        await supabaseClient
          .from('brands')
          .update({
            keywords: instructionalContext.keywords,
            business_description: instructionalContext.business_description,
            products_services: instructionalContext.products_services,
            target_audience: instructionalContext.target_audience
          })
          .eq('id', brandId)
      } else if (userData?.org_id && orgData) {
        await supabaseClient
          .from('organizations')
          .update({
            keywords: instructionalContext.keywords,
            competitors: instructionalContext.competitors,
            business_description: instructionalContext.business_description,
            products_services: instructionalContext.products_services,
            target_audience: instructionalContext.target_audience
          })
          .eq('id', userData.org_id)
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          data: instructionalContext,
          businessContext: instructionalContext,
          message: `Could not access ${targetDomain}. Please manually fill in your business information below to get started.`,
          source: 'content-acquisition-failed',
          model_used: 'none',
          durations: { fetch_ms: fetchDuration, ai_ms: 0, total_ms: fetchDuration },
          hasOrganization: !!orgData,
          fallbackReason: 'content_acquisition_failed'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Extract meta keywords for fallback
    let metaKeywords: string[] = []
    if (contentResult.html) {
      metaKeywords = extractMetaKeywords(contentResult.html)
    }

    console.log('Analyzing content with Lovable AI...')
    const aiStartTime = Date.now()
    
    // Use Lovable AI to analyze content with brand-specific focus
    let businessContext: BusinessContext
    try {
      const analysisPrompt = `You are analyzing the website ${targetDomain}${orgData?.name ? ` (${orgData.name})` : ''}.

CRITICAL RULES:
1. Extract ONLY information that is SPECIFIC and UNIQUE to THIS business
2. NEVER use generic terms like "business solutions", "professional services", "quality", "innovation"
3. NEVER use placeholders like "Your Business", "example.com", "businesses and professionals"
4. Extract CONCRETE, SPECIFIC details about what this exact company does

Website content:
${contentResult.content.substring(0, 12000)}

Analyze the content and return a JSON object with:

1. keywords (array): 6-10 SPECIFIC industry terms, product names, service types, or technical terms this business actually uses
   - Example GOOD: ["skin care", "anti-aging serums", "LED face masks", "microneedling", "dermaplaning"]
   - Example BAD: ["business", "solutions", "services", "quality", "innovation", "technology"]

2. competitors (array): 3-6 ACTUAL competitor company names if mentioned, or specific industry leaders
   - Example GOOD: ["The Ordinary", "CeraVe", "Paula's Choice"]
   - Example BAD: ["other businesses", "competitors", "industry leaders"]
   - If no specific competitors found, return empty array []

3. business_description (string): 2-3 sentences describing EXACTLY what this business does, with specific details
   - Example GOOD: "Skin Ashoba specializes in professional-grade skincare products and at-home beauty treatments. They offer LED therapy devices, microneedling tools, and clinical-strength serums for anti-aging and skin rejuvenation."
   - Example BAD: "Your Business provides professional business solutions and services."

4. products_services (string): Specific product names, service offerings, or categories they sell/provide
   - Example GOOD: "LED face masks, derma rollers, vitamin C serums, retinol treatments, collagen boosters, microcurrent devices"
   - Example BAD: "Professional services, Business solutions, Customer support"

5. target_audience (string): WHO specifically buys from them (demographics, needs, problems they solve)
   - Example GOOD: "Women aged 30-60 seeking professional-grade skincare solutions for wrinkles, fine lines, and skin aging at home"
   - Example BAD: "Businesses and professionals seeking quality solutions"

RESPOND WITH ONLY THE JSON OBJECT - NO MARKDOWN, NO EXPLANATIONS:
{
  "keywords": [],
  "competitors": [],
  "business_description": "",
  "products_services": "",
  "target_audience": ""
}`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [
            {
              role: 'system',
              content: 'You are an expert business analyst specializing in extracting specific, concrete business information from website content. You NEVER use generic terms or placeholders. You always provide detailed, brand-specific insights based on actual website content. Respond ONLY with valid JSON, no markdown formatting.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
      }

      const aiResult = await response.json();
      const analysisText = aiResult.choices[0]?.message?.content?.trim();
      
      console.log('AI analysis response length:', analysisText?.length || 0);

      if (!analysisText) {
        throw new Error('Empty AI response');
      }

      // Parse and validate the JSON response
      let parsed: any;
      try {
        // Clean response
        let cleaned = analysisText.replace(/```json\n?|\n?```/g, '').trim();
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        }
        parsed = JSON.parse(cleaned);
      } catch (parseError) {
        console.error('JSON parse failed:', analysisText);
        throw new Error('Failed to parse AI response as JSON');
      }

      // Extract and validate fields with strict quality checks
      const keywords = Array.isArray(parsed.keywords) ? 
        parsed.keywords
          .filter((k: any) => k && typeof k === 'string' && k.trim().length > 0)
          .map((k: string) => k.trim())
          .filter((k: string) => {
            // Filter out generic business keywords
            const generic = ['business', 'solution', 'service', 'quality', 'innovation', 
                           'professional', 'customer', 'technology', 'digital'];
            const lower = k.toLowerCase();
            return !generic.some(g => lower === g || lower === `${g}s`);
          })
          .slice(0, 10) : [];

      const competitors = Array.isArray(parsed.competitors) ? 
        parsed.competitors
          .filter((c: any) => c && typeof c === 'string' && c.trim().length > 0)
          .map((c: string) => c.trim())
          .filter((c: string) => {
            // Filter out generic competitor terms
            const generic = ['competitor', 'business', 'company', 'industry', 'market'];
            const lower = c.toLowerCase();
            return !generic.some(g => lower.includes(g));
          })
          .slice(0, 8) : [];

      // Validate descriptions are not generic
      const description = typeof parsed.business_description === 'string' ? parsed.business_description : '';
      const products = typeof parsed.products_services === 'string' ? parsed.products_services : '';
      const audience = typeof parsed.target_audience === 'string' ? parsed.target_audience : '';

      // Check for generic content indicators
      const hasGenericContent = 
        description.includes('Your Business') || 
        description.includes('example.com') ||
        description.includes('provides professional business solutions') ||
        products.includes('Professional services from') ||
        audience.includes('Businesses and professionals seeking');

      if (hasGenericContent) {
        console.error('AI returned generic content, rejecting response');
        throw new Error('AI analysis produced generic content instead of specific business information');
      }

      // Add meta keywords ONLY if we have few specific keywords
      let finalKeywords = keywords;
      if (finalKeywords.length < 3 && metaKeywords.length > 0) {
        finalKeywords = [...new Set([...finalKeywords, ...metaKeywords])].slice(0, 10);
      }

      // Require minimum quality threshold
      if (finalKeywords.length < 2 || description.length < 50) {
        console.error('AI analysis below quality threshold', {
          keywordCount: finalKeywords.length,
          descriptionLength: description.length
        });
        throw new Error('AI analysis did not extract sufficient business information');
      }

      businessContext = {
        keywords: finalKeywords,
        competitors,
        business_description: description,
        products_services: products,
        target_audience: audience
      };

      console.log('✅ AI analysis passed quality checks:', {
        keywordCount: finalKeywords.length,
        competitorCount: competitors.length,
        descriptionLength: description.length
      });

    } catch (aiError: unknown) {
      const errorMsg = toErrorMessage(aiError);
      console.error('Lovable AI analysis failed:', errorMsg);
      
      // Use synthetic context with meta keywords as fallback
      const instructionalContext = generateSyntheticContext(targetDomain, orgData?.name, metaKeywords);

      if (brandId && brandData) {
        await supabaseClient
          .from('brands')
          .update({
            keywords: instructionalContext.keywords,
            business_description: instructionalContext.business_description,
            products_services: instructionalContext.products_services,
            target_audience: instructionalContext.target_audience
          })
          .eq('id', brandId);
      } else if (userData?.org_id && orgData) {
        await supabaseClient
          .from('organizations')
          .update({
            keywords: instructionalContext.keywords,
            competitors: instructionalContext.competitors,
            business_description: instructionalContext.business_description,
            products_services: instructionalContext.products_services,
            target_audience: instructionalContext.target_audience
          })
          .eq('id', userData.org_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          data: instructionalContext,
          businessContext: instructionalContext,
          message: `We extracted content from ${targetDomain} but couldn't automatically analyze it. Please review and customize the information below.`,
          source: contentResult.method,
          model_used: 'manual-entry-required',
          durations: { 
            fetch_ms: fetchDuration, 
            ai_ms: Date.now() - aiStartTime, 
            total_ms: Date.now() - fetchStartTime 
          },
          hasOrganization: !!orgData,
          fallbackReason: 'ai_analysis_failed',
          error: errorMsg
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const aiDuration = Date.now() - aiStartTime

    console.log('Final business context:', {
      ...businessContext,
      keywordsCount: businessContext.keywords.length,
      competitorsCount: businessContext.competitors.length,
      source: contentResult.method,
      model: 'gemini-2.5-flash'
    })

    // Update brand if brandId provided, otherwise update organization
    if (brandId && brandData) {
      const { error: updateError } = await supabaseClient
        .from('brands')
        .update({
          keywords: businessContext.keywords,
          business_description: businessContext.business_description,
          products_services: businessContext.products_services,
          target_audience: businessContext.target_audience
        })
        .eq('id', brandId)

      if (updateError) {
        console.error('Brand update error:', updateError)
      } else {
        console.log('Successfully updated brand business context in database')
      }
    } else if (userData?.org_id && orgData) {
      // Fallback to org-level update for backward compatibility
      const { error: updateError } = await supabaseClient
        .from('organizations')
        .update({
          keywords: businessContext.keywords,
          competitors: businessContext.competitors,
          business_description: businessContext.business_description,
          products_services: businessContext.products_services,
          target_audience: businessContext.target_audience
        })
        .eq('id', userData.org_id)

      if (updateError) {
        console.error('Organization update error:', updateError)
      } else {
        console.log('Successfully updated organization business context in database')
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: businessContext,
        businessContext: businessContext,
        message: orgData 
          ? 'Business context auto-filled successfully from your website!'
          : 'Business context extracted successfully! Complete the onboarding to save it.',
        source: contentResult.method,
        model_used: 'gemini-2.5-flash',
        durations: {
          fetch_ms: fetchDuration,
          ai_ms: aiDuration,
          total_ms: Date.now() - fetchStartTime
        },
        hasOrganization: !!orgData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: unknown) {
    const errorMsg = toErrorMessage(error);
    console.error('Auto-fill error:', errorMsg);
    
    // Even in case of unexpected errors, try to return instructional context
    try {
      const instructionalContext = generateSyntheticContext('your-domain.com', 'Your Business Name', []);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          data: instructionalContext,
          businessContext: instructionalContext,
          message: 'An error occurred during auto-fill. Please manually fill in your business information below.',
          source: 'error-fallback',
          model_used: 'manual-entry',
          durations: { fetch_ms: 0, ai_ms: 0, total_ms: 0 },
          hasOrganization: false,
          fallbackReason: 'unexpected_error',
          originalError: errorMsg
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } catch (syntheticError: unknown) {
      // Absolute final fallback
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMsg || 'Auto-fill failed. Please enter your information manually.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
  }
})