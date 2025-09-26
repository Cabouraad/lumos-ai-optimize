import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBusinessContextOpenAI, generateKeywordsOnly, extractMetaKeywords, extractHeuristicKeywords, type BusinessContextExtraction } from '../_shared/providers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      console.log(`Direct fetch failed for ${url}: ${error.message}`)
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
    console.log(`Firecrawl failed: ${error.message}`)
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
    console.log(`LLMS.txt failed: ${error.message}`)
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
    console.log(`Readability proxy failed: ${error.message}`)
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
          console.log(`Sitemap page fetch failed for ${url}: ${pageError.message}`)
        }
      }
    }
  } catch (error: unknown) {
    console.log(`Sitemap discovery failed: ${error.message}`)
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

// Generate synthetic business context as absolute fallback
function generateSyntheticContext(domain: string, orgName?: string): BusinessContext {
  console.log(`🔄 Generating synthetic context for domain: ${domain}, org: ${orgName}`)
  
  // Extract meaningful keywords from domain and org name
  const domainKeywords = domain
    .replace(/\.(com|org|net|io|co|app|dev)$/, '')
    .split(/[.-]/)
    .filter(word => word.length > 2)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  
  const orgKeywords = orgName 
    ? orgName.split(/\s+/).filter(word => word.length > 2)
    : []
  
  const baseKeywords = [...new Set([...domainKeywords, ...orgKeywords])]
  
  // Industry-agnostic keywords that work for most businesses
  const universalKeywords = [
    'business solutions', 'professional services', 'technology',
    'innovation', 'customer service', 'digital transformation'
  ]
  
  const keywords = [...baseKeywords, ...universalKeywords].slice(0, 8)
  
  return {
    keywords,
    competitors: [], 
    business_description: `${orgName || domain} provides professional business solutions and services. Visit ${domain} to learn more about their offerings and capabilities.`,
    products_services: `Professional services from ${orgName || domain}, Business solutions, Customer support`,
    target_audience: 'Businesses and professionals seeking quality solutions and services'
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('=== AUTO-FILL FUNCTION STARTED ===')
  
  try {
    // Check if OpenAI API key is available
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OpenAI API key not found in environment')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'OpenAI API key not configured. Please add your OpenAI API key in the project settings.',
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

    // Get request body to check for domain override
    const requestBody = await req.json().catch(() => ({}))
    const domainOverride = requestBody?.domain

    console.log('Request body:', { domainOverride })

    // Try to get user's organization, but don't fail if it doesn't exist
    const { data: userData } = await supabaseClient
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    let orgData = null
    let targetDomain = domainOverride

    // If we have an org_id, try to get organization data
    if (userData?.org_id) {
      const { data: orgResult } = await supabaseClient
        .from('organizations')
        .select('domain, name')
        .eq('id', userData.org_id)
        .single()
      
      orgData = orgResult
      if (orgData?.domain && !domainOverride) {
        targetDomain = orgData.domain
      }
    }

    // If we don't have a domain from either source, use synthetic fallback
    if (!targetDomain) {
      console.log('No domain available - generating synthetic context')
      const syntheticContext = generateSyntheticContext('example.com', 'Your Business')
      
      return new Response(
        JSON.stringify({ 
          success: true,
          data: syntheticContext,
          businessContext: syntheticContext,
          message: 'Please enter your business domain and information below to get personalized context.',
          source: 'synthetic-fallback',
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
      console.log('All content acquisition methods failed - generating synthetic context')
      const syntheticContext = generateSyntheticContext(targetDomain, orgData?.name)
      
      // Still try to update organization if it exists
      if (userData?.org_id && orgData) {
        await supabaseClient
          .from('organizations')
          .update({
            keywords: syntheticContext.keywords,
            competitors: syntheticContext.competitors,
            business_description: syntheticContext.business_description,
            products_services: syntheticContext.products_services,
            target_audience: syntheticContext.target_audience
          })
          .eq('id', userData.org_id)
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          data: syntheticContext,
          businessContext: syntheticContext,
          message: `Generated business context based on your domain ${targetDomain}. Please review and customize the information below.`,
          source: 'synthetic-fallback',
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

    console.log('Analyzing content with OpenAI...')
    const aiStartTime = Date.now()
    
    // Use OpenAI to analyze content
    let businessContextResult: BusinessContextExtraction & { model_used: string; source?: string }
    try {
      businessContextResult = await extractBusinessContextOpenAI(contentResult.content, openaiApiKey)
      console.log('Token usage - Input:', businessContextResult.tokenIn, 'Output:', businessContextResult.tokenOut)
    } catch (openaiError: unknown) {
      console.error('OpenAI analysis failed:', openaiError.message)
      
      // Use synthetic context as fallback for AI failure
      const syntheticContext = generateSyntheticContext(targetDomain, orgData?.name)
      
      // Add any meta keywords we found
      if (metaKeywords.length > 0) {
        syntheticContext.keywords = [...new Set([...syntheticContext.keywords, ...metaKeywords])].slice(0, 10)
      }

      if (userData?.org_id && orgData) {
        await supabaseClient
          .from('organizations')
          .update({
            keywords: syntheticContext.keywords,
            competitors: syntheticContext.competitors,
            business_description: syntheticContext.business_description,
            products_services: syntheticContext.products_services,
            target_audience: syntheticContext.target_audience
          })
          .eq('id', userData.org_id)
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          data: syntheticContext,
          businessContext: syntheticContext,
          message: `Successfully extracted content from ${targetDomain} but AI analysis failed. Generated fallback context - please review and customize.`,
          source: contentResult.method,
          model_used: 'synthetic-fallback',
          durations: { 
            fetch_ms: fetchDuration, 
            ai_ms: Date.now() - aiStartTime, 
            total_ms: Date.now() - fetchStartTime 
          },
          hasOrganization: !!orgData,
          fallbackReason: 'ai_analysis_failed'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    const aiDuration = Date.now() - aiStartTime
    
    // Enhance keywords if needed
    let finalKeywords = businessContextResult.keywords || []
    
    if (finalKeywords.length < 3) {
      console.log(`Only ${finalKeywords.length} keywords found, enhancing...`)
      
      // Add meta keywords
      if (metaKeywords.length > 0) {
        finalKeywords = [...finalKeywords, ...metaKeywords]
      }
      
      // Try AI keyword generation
      if (finalKeywords.length < 3) {
        try {
          const aiKeywords = await generateKeywordsOnly(contentResult.content, openaiApiKey)
          finalKeywords = [...finalKeywords, ...aiKeywords]
        } catch (keywordError: unknown) {
          console.log('AI keywords generation failed:', keywordError.message)
        }
      }
      
      // Heuristic keywords as final fallback
      if (finalKeywords.length < 3) {
        const heuristicKeywords = extractHeuristicKeywords(contentResult.content)
        finalKeywords = [...finalKeywords, ...heuristicKeywords]
      }
      
      // Clean and deduplicate
      finalKeywords = [...new Set(finalKeywords)]
        .filter(k => k && k.trim().length > 0)
        .slice(0, 10)
    }

    // Create final business context
    const businessContext: BusinessContext = {
      keywords: finalKeywords,
      competitors: businessContextResult.competitors || [],
      business_description: businessContextResult.business_description || '',
      products_services: businessContextResult.products_services || '',
      target_audience: businessContextResult.target_audience || ''
    }

    console.log('Final business context:', {
      ...businessContext,
      keywordsCount: finalKeywords.length,
      source: contentResult.method,
      model: businessContextResult.model_used
    })

    // Update organization if it exists
    if (userData?.org_id && orgData) {
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
        console.error('Database update error:', updateError)
      } else {
        console.log('Successfully updated business context in database')
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
        model_used: businessContextResult.model_used,
        durations: {
          fetch_ms: fetchDuration,
          ai_ms: aiDuration,
          total_ms: Date.now() - fetchStartTime
        },
        hasOrganization: !!orgData,
        keywordsEnhanced: finalKeywords.length > (businessContextResult.keywords?.length || 0)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: unknown) {
    console.error('Auto-fill error:', error)
    
    // Even in case of unexpected errors, try to return synthetic context
    try {
      const syntheticContext = generateSyntheticContext('example.com', 'Your Business')
      
      return new Response(
        JSON.stringify({ 
          success: true,
          data: syntheticContext,
          businessContext: syntheticContext,
          message: 'An error occurred during auto-fill. Please review and customize the generated context below.',
          source: 'error-fallback',
          model_used: 'synthetic-fallback',
          durations: { fetch_ms: 0, ai_ms: 0, total_ms: 0 },
          hasOrganization: false,
          fallbackReason: 'unexpected_error',
          originalError: error.message
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    } catch (syntheticError: unknown) {
      // Absolute final fallback
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message || 'Failed to auto-fill business context'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }
  }
})