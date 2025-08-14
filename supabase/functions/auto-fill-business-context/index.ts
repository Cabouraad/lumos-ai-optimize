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

    console.log('Fetching website content for:', orgData.domain)

    // Try multiple approaches to fetch website content
    let websiteContent = ''
    let websiteUrl = ''
    
    try {
      // Try different URL formats
      const urlsToTry = [
        orgData.domain.startsWith('http') ? orgData.domain : `https://${orgData.domain}`,
        orgData.domain.startsWith('http') ? orgData.domain : `http://${orgData.domain}`,
        `https://www.${orgData.domain.replace(/^https?:\/\/(www\.)?/, '')}`,
        `http://www.${orgData.domain.replace(/^https?:\/\/(www\.)?/, '')}`
      ]

      for (const url of urlsToTry) {
        try {
          console.log(`Trying to fetch: ${url}`)
          websiteUrl = url
          
          const websiteResponse = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
          })
          
          if (websiteResponse.ok) {
            const html = await websiteResponse.text()
            websiteContent = html
            console.log(`Successfully fetched content from: ${url}`)
            break
          } else {
            console.log(`Failed to fetch ${url}: ${websiteResponse.status} ${websiteResponse.statusText}`)
          }
        } catch (fetchError) {
          console.log(`Error fetching ${url}:`, fetchError.message)
          continue
        }
      }
      
      if (websiteContent) {
        // Extract text content from HTML (improved approach)
        websiteContent = websiteContent
          // Remove script and style tags
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
          // Remove HTML comments
          .replace(/<!--[\s\S]*?-->/gi, '')
          // Remove HTML tags but keep some structure
          .replace(/<\/?(h[1-6]|p|div|section|article|header|main|nav|footer)[^>]*>/gi, '\n')
          .replace(/<[^>]*>/g, ' ')
          // Clean up whitespace
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim()
          .substring(0, 12000) // Increased limit for better context
      }
    } catch (error) {
      console.error('Error during website fetching:', error)
    }

    if (!websiteContent) {
      throw new Error('No content found on website')
    }

    console.log('Analyzing website content with OpenAI')

    // Use OpenAI to analyze the website content
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const prompt = `Analyze the following website content and extract business information. Return a JSON object with the following structure:

{
  "keywords": ["keyword1", "keyword2", "keyword3", ...], // 5-10 relevant industry/product keywords
  "business_description": "Brief description of what the business does",
  "products_services": "Description of main products and services offered",
  "target_audience": "Description of ideal customers and target market"
}

Website content:
${websiteContent}

Make sure the response is valid JSON and the keywords are specific to the industry/products/services mentioned on the website.`

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
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI API error:', error)
      throw new Error('Failed to analyze website content')
    }

    const openaiResult = await openaiResponse.json()
    const analysisText = openaiResult.choices[0]?.message?.content

    if (!analysisText) {
      throw new Error('No analysis received from OpenAI')
    }

    console.log('OpenAI analysis result:', analysisText)

    // Parse the JSON response
    let businessContext: BusinessContext
    try {
      // Clean the response to ensure it's valid JSON
      const cleanedResponse = analysisText.replace(/```json\n?|\n?```/g, '').trim()
      businessContext = JSON.parse(cleanedResponse)
    } catch (error) {
      console.error('Failed to parse OpenAI response:', analysisText)
      throw new Error('Failed to parse AI analysis results')
    }

    // Validate the parsed data
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
      throw new Error('Failed to save business context')
    }

    console.log('Successfully updated business context')

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: businessContext,
        message: 'Business context auto-filled successfully'
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
        status: 400
      }
    )
  }
})