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

    // Fetch website content
    let websiteContent = ''
    try {
      const websiteUrl = orgData.domain.startsWith('http') ? orgData.domain : `https://${orgData.domain}`
      const websiteResponse = await fetch(websiteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BusinessContextBot/1.0)'
        }
      })
      
      if (websiteResponse.ok) {
        const html = await websiteResponse.text()
        // Extract text content from HTML (simple approach)
        websiteContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 8000) // Limit content size
      }
    } catch (error) {
      console.error('Error fetching website:', error)
      throw new Error('Unable to fetch website content')
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