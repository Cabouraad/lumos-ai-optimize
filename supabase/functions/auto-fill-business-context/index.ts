import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BusinessContext {
  keywords: string[]
  business_description: string
  products_services: string
  target_audience: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Check if OpenAI API key is available
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OpenAI API key not found in environment')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'OpenAI API key not configured. Please add your OpenAI API key in the project settings.',
          needsApiKey: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
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

    // Get user's organization
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (userDataError || !userData?.org_id) {
      throw new Error('User organization not found')
    }

    // Get organization domain
    const { data: orgData, error: orgError } = await supabaseClient
      .from('organizations')
      .select('domain, name')
      .eq('id', userData.org_id)
      .single()

    if (orgError || !orgData?.domain) {
      throw new Error('Organization domain not found')
    }

    console.log('Organization found:', { name: orgData.name, domain: orgData.domain })

    // Try to fetch website content with multiple methods
    let websiteContent = ''
    let fetchMethod = 'none'

    // Method 1: Direct fetch with multiple URL attempts
    const urlsToTry = [
      orgData.domain.startsWith('http') ? orgData.domain : `https://${orgData.domain}`,
      orgData.domain.startsWith('http') ? orgData.domain : `http://${orgData.domain}`,
      `https://www.${orgData.domain.replace(/^https?:\/\/(www\.)?/, '')}`,
      `http://www.${orgData.domain.replace(/^https?:\/\/(www\.)?/, '')}`
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
          error: `Unable to automatically fetch content from ${orgData.domain}. This could be due to:
          
• The website blocking automated requests
• Network connectivity issues  
• The domain not being publicly accessible
• SSL/security restrictions

Please try manually entering your business information in the form fields below, or ensure your website is publicly accessible.`,
          domain: orgData.domain,
          suggestManual: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
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

    console.log('Analyzing content with OpenAI...')

    // Create a more targeted prompt for business analysis
    const analysisPrompt = `Analyze this website content and extract specific business information. Return ONLY a valid JSON object with this exact structure:

{
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "business_description": "Brief description of what the business does",
  "products_services": "Description of main products and services offered", 
  "target_audience": "Description of ideal customers and target market"
}

Instructions:
- Extract 5-8 specific keywords related to the industry, products, or services (avoid generic terms)
- Keep descriptions concise and professional
- Focus on concrete business activities, not marketing language
- If information is unclear, provide reasonable inferences based on context

Website content:
${cleanContent}

Return only the JSON object, no other text:`

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst expert at extracting structured business information from website content. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      })
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API failed: ${openaiResponse.status}`)
    }

    const openaiResult = await openaiResponse.json()
    const analysisText = openaiResult.choices[0]?.message?.content?.trim()

    if (!analysisText) {
      throw new Error('No analysis received from OpenAI')
    }

    console.log('Raw OpenAI response:', analysisText)

    // Parse the JSON response with better error handling
    let businessContext: BusinessContext
    try {
      // Clean the response to ensure it's valid JSON
      let cleanedResponse = analysisText
      // Remove any markdown code blocks
      cleanedResponse = cleanedResponse.replace(/```json\n?|\n?```/g, '').trim()
      // Remove any leading/trailing non-JSON content
      const jsonStart = cleanedResponse.indexOf('{')
      const jsonEnd = cleanedResponse.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1)
      }
      
      businessContext = JSON.parse(cleanedResponse)
      
      // Validate and clean the parsed data
      if (!businessContext.keywords || !Array.isArray(businessContext.keywords)) {
        businessContext.keywords = []
      }
      if (typeof businessContext.business_description !== 'string') {
        businessContext.business_description = ''
      }
      if (typeof businessContext.products_services !== 'string') {
        businessContext.products_services = ''
      }
      if (typeof businessContext.target_audience !== 'string') {
        businessContext.target_audience = ''
      }

      // Filter out empty or invalid keywords
      businessContext.keywords = businessContext.keywords
        .filter(k => k && typeof k === 'string' && k.trim().length > 0)
        .map(k => k.trim())
        .slice(0, 10) // Limit to 10 keywords

    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', analysisText, 'Error:', parseError)
      throw new Error('Failed to parse AI analysis results')
    }

    console.log('Extracted business context:', businessContext)

    // Update the organization with the extracted information
    const { error: updateError } = await supabaseClient
      .from('organizations')
      .update({
        keywords: businessContext.keywords,
        business_description: businessContext.business_description,
        products_services: businessContext.products_services,
        target_audience: businessContext.target_audience
      })
      .eq('id', userData.org_id)

    if (updateError) {
      console.error('Database update error:', updateError)
      throw new Error('Failed to save business context to database')
    }

    console.log('Successfully updated business context in database')

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: businessContext,
        message: 'Business context auto-filled successfully from your website!',
        fetchMethod: fetchMethod
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