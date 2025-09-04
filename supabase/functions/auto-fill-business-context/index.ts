import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBusinessContextOpenAI, type BusinessContextExtraction } from '../_shared/providers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BusinessContext {
  keywords: string[]
  competitors: string[]
  business_description: string
  products_services: string
  target_audience: string
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
          missingApiKey: true // Backward compatibility alias
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

    // If we don't have a domain from either source, return error
    if (!targetDomain) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No domain available for auto-fill. Please provide a domain.',
          suggestManual: true
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

    // Try to fetch website content with multiple methods
    let websiteContent = ''
    let fetchMethod = 'none'

    // Method 1: Direct fetch with multiple URL attempts
    const urlsToTry = [
      targetDomain.startsWith('http') ? targetDomain : `https://${targetDomain}`,
      targetDomain.startsWith('http') ? targetDomain : `http://${targetDomain}`,
      `https://www.${targetDomain.replace(/^https?:\/\/(www\.)?/, '')}`,
      `http://www.${targetDomain.replace(/^https?:\/\/(www\.)?/, '')}`
    ]

    for (const url of urlsToTry) {
      try {
        console.log(`Attempting to fetch: ${url}`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
        
        const websiteResponse = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
          }
        })
        
        clearTimeout(timeoutId)
        
        if (websiteResponse.ok) {
          const html = await websiteResponse.text()
          if (html && html.length > 100) { // Ensure we got meaningful content
            websiteContent = html
            fetchMethod = `direct-${url}`
            console.log(`Successfully fetched content from: ${url} (${html.length} chars)`)
            break
          }
        } else {
          console.log(`HTTP error ${websiteResponse.status} for ${url}: ${websiteResponse.statusText}`)
        }
      } catch (fetchError) {
        console.log(`Fetch error for ${url}:`, fetchError.message)
      }
    }

    // If direct fetch failed, provide a helpful fallback message
    if (!websiteContent) {
      console.log('All direct fetch attempts failed')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Unable to automatically fetch content from ${targetDomain}. This could be due to:
          
• The website blocking automated requests
• Network connectivity issues  
• The domain not being publicly accessible
• SSL/security restrictions

Please try manually entering your business information in the form fields below, or ensure your website is publicly accessible.`,
          domain: targetDomain,
          suggestManual: true,
          manualFill: true // Backward compatibility alias
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Clean and extract meaningful content from HTML
    const cleanContent = websiteContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/gi, '')
      // Preserve some structure
      .replace(/<\/?(h[1-6]|p|div|section|article|header|main|nav|footer|li)[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()
      .substring(0, 15000) // Increase limit for better analysis

    console.log(`Extracted content: ${cleanContent.length} characters using ${fetchMethod}`)

    if (cleanContent.length < 50) {
      throw new Error('Insufficient content extracted from website')
    }

    console.log('Analyzing content with OpenAI using shared provider...')

    // Use shared provider for consistent OpenAI API calls and token tracking
    const businessContextResult = await extractBusinessContextOpenAI(cleanContent, openaiApiKey);
    
    console.log('Extracted business context:', businessContextResult)
    console.log('Token usage - Input:', businessContextResult.tokenIn, 'Output:', businessContextResult.tokenOut)

    // Convert to expected format (maintaining backward compatibility)
    const businessContext: BusinessContext = {
      keywords: businessContextResult.keywords,
      competitors: businessContextResult.competitors,
      business_description: businessContextResult.business_description,
      products_services: businessContextResult.products_services,
      target_audience: businessContextResult.target_audience
    };

    console.log('Extracted business context:', businessContext)

    // Only update organization if it exists and we have an org_id
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
        console.log('Continuing without database update since this may be during onboarding')
      } else {
        console.log('Successfully updated business context in database')
      }
    } else {
      console.log('No organization found - returning context for onboarding process')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: businessContext,
        businessContext: businessContext, // Backward compatibility alias
        message: orgData 
          ? 'Business context auto-filled successfully from your website!'
          : 'Business context extracted successfully! Complete the onboarding to save it.',
        fetchMethod: fetchMethod,
        hasOrganization: !!orgData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Auto-fill error:', error)
    
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
})