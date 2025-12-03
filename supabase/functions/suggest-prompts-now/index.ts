import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch Google Trends interest for a query via SerpAPI
async function getGoogleTrendsInterest(query: string, serpApiKey: string): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      engine: 'google_trends',
      q: query,
      api_key: serpApiKey,
      data_type: 'TIMESERIES',
      date: 'today 3-m',
    });
    
    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) {
      console.warn(`Google Trends API error for "${query}": ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const timelineData = data.interest_over_time?.timeline_data || [];
    if (timelineData.length === 0) return null;
    
    const values = timelineData
      .map((item: any) => item.values?.[0]?.extracted_value)
      .filter((v: any) => typeof v === 'number');
    
    if (values.length === 0) return null;
    
    return Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length);
  } catch (error) {
    console.warn(`Failed to fetch Google Trends for "${query}":`, error);
    return null;
  }
}

// Batch fetch trends data with rate limiting
async function batchGetTrendsData(
  queries: string[], 
  serpApiKey: string
): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>();
  
  const batchSize = 5;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(q => getGoogleTrendsInterest(q, serpApiKey).then(v => ({ query: q, value: v })))
    );
    
    batchResults.forEach(({ query, value }) => results.set(query, value));
    
    if (i + batchSize < queries.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body for brandId
    let brandId: string | null = null;
    try {
      const body = await req.json();
      brandId = body?.brandId || null;
    } catch {
      // Empty body is fine
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Authentication failed');
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('User data error:', userError);
      throw new Error('Could not get user organization');
    }

    // Get brand-specific context if brandId is provided
    let brandContext: any = null;
    if (brandId) {
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('id, name, domain')
        .eq('id', brandId)
        .eq('org_id', userData.org_id)
        .single();
      
      if (!brandError && brand) {
        brandContext = brand;
        console.log(`Using brand context: ${brand.name} (${brand.id})`);
      }
    }

    // Get organization settings
    const { data: orgSettings, error: settingsError } = await supabase
      .from('organizations')
      .select('enable_localized_prompts')
      .eq('id', userData.org_id)
      .single();

    if (settingsError || !orgSettings) {
      console.error('Organization settings error:', settingsError);
      throw new Error('Could not get organization settings');
    }

    // Get organization details
    const locationFields = orgSettings.enable_localized_prompts 
      ? ', business_city, business_state, business_country' 
      : '';
    
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select(`name, business_description, products_services, keywords, target_audience, domain, enable_localized_prompts${locationFields}`)
      .eq('id', userData.org_id)
      .single();

    if (orgError || !orgData) {
      console.error('Organization data error:', orgError);
      throw new Error('Could not get organization details');
    }

    // Use brand context if available, otherwise fall back to org context
    const contextName = brandContext?.name || orgData.name;
    const contextDomain = brandContext?.domain || orgData.domain;

    // Get existing prompts to avoid duplicates - filter by brand if provided
    let promptsQuery = supabase
      .from('prompts')
      .select('text')
      .eq('org_id', userData.org_id);
    
    if (brandId) {
      promptsQuery = promptsQuery.eq('brand_id', brandId);
    }
    
    const { data: existingPrompts, error: promptsError } = await promptsQuery;

    if (promptsError) {
      console.error('Error fetching existing prompts:', promptsError);
    }

    const existingPromptTexts = existingPrompts?.map(p => p.text.toLowerCase()) || [];

    // Get existing suggestions to avoid duplicates - filter by brand if provided
    let suggestionsQuery = supabase
      .from('suggested_prompts')
      .select('text')
      .eq('org_id', userData.org_id)
      .eq('accepted', false);
    
    if (brandId) {
      suggestionsQuery = suggestionsQuery.eq('brand_id', brandId);
    }
    
    const { data: existingSuggestions, error: suggestionsError } = await suggestionsQuery;

    if (suggestionsError) {
      console.error('Error fetching existing suggestions:', suggestionsError);
    }

    const existingSuggestionTexts = existingSuggestions?.map(s => s.text.toLowerCase()) || [];

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build location context
    let locationInstructions = '';
    let locationContext = '';
    
    console.log(`Localization enabled for org ${userData.org_id}: ${orgData.enable_localized_prompts}`);
    
    if (orgData.enable_localized_prompts && (orgData.business_city || orgData.business_state)) {
      const locationParts = [];
      if (orgData.business_city) locationParts.push(orgData.business_city);
      if (orgData.business_state) locationParts.push(orgData.business_state);
      if (orgData.business_country && orgData.business_country !== 'United States') {
        locationParts.push(orgData.business_country);
      }
      
      if (locationParts.length > 0) {
        const location = locationParts.join(', ');
        locationContext = `\n- Business Location: ${location}`;
        locationInstructions = `
LOCALIZATION ENABLED: This business has enabled localized prompts. Include their location (${location}) in some prompts where it makes sense. Mix localized and non-localized prompts (about 40% localized, 60% general).`;
        
        console.log(`Generated localized prompts for location: ${location}`);
      }
    } else {
      locationInstructions = `
LOCALIZATION DISABLED: This business has DISABLED localized prompts. You MUST NOT include any location-specific terms, city names, state names, geographic references, or "near me" type queries.`;
      
      console.log(`Generating NON-LOCALIZED prompts for org ${userData.org_id}`);
    }

    const systemPrompt = `You are an expert at generating natural search prompts that real users would type into AI assistants like ChatGPT, Claude, or Perplexity when looking for business solutions.

Your task is to create realistic search queries that potential customers might use when looking for solutions in this business space. These should sound like genuine questions people ask AI assistants.

CRITICAL: NEVER include the company name "${contextName}" or domain "${contextDomain}" in any of the generated prompts. Focus on the industry, problems, and solutions without mentioning the specific company.
${locationInstructions}

Business Context (for understanding the industry, not for including in prompts):
- Industry/Description: ${orgData.business_description || 'Not specified'}
- Products/Services: ${orgData.products_services || 'Not specified'}
- Keywords: ${orgData.keywords?.join(', ') || 'Not specified'}
- Target Audience: ${orgData.target_audience || 'Not specified'}${locationContext}

Generate 15 diverse, natural search prompts that potential customers might use when looking for solutions in this industry. Each prompt should:

1. Sound like a real question someone would ask an AI assistant
2. Be relevant to the business context and industry
3. Help monitor brand visibility or competitor analysis
4. Be conversational and natural (not keyword-stuffed)
5. Cover different aspects: comparison, recommendations, best practices, selection criteria
6. NEVER mention the company name, brand name, or domain

Categorize each prompt as one of:
- "brand_visibility" (for prompts where their brand should appear)
- "competitor_analysis" (for competitor comparison queries)  
- "market_research" (for industry/solution discovery)

Return ONLY a JSON array with this exact format:
[
  {
    "text": "What are the best project management tools for remote teams?",
    "source": "brand_visibility",
    "reasoning": "Potential customers searching for PM tools would see this company in results"
  }
]`;

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Generate 15 natural, conversational search prompts for this business context. Make them sound like real questions people would ask AI assistants.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.8,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const generatedContent = openAIData.choices[0].message.content;

    console.log('Generated content:', generatedContent);

    let suggestions;
    try {
      suggestions = JSON.parse(generatedContent);
    } catch (parseError: unknown) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Raw response:', generatedContent);
      throw new Error('Failed to parse AI response');
    }

    if (!Array.isArray(suggestions)) {
      console.error('OpenAI response is not an array:', suggestions);
      throw new Error('Invalid AI response format');
    }

    // Filter out duplicates and validate format
    const newSuggestions = suggestions
      .filter(suggestion => {
        const isValid = suggestion.text && suggestion.source && typeof suggestion.text === 'string';
        const isDuplicate = existingPromptTexts.includes(suggestion.text.toLowerCase()) || 
                           existingSuggestionTexts.includes(suggestion.text.toLowerCase());
        return isValid && !isDuplicate;
      })
      .slice(0, 10);

    if (newSuggestions.length === 0) {
      console.log('No new unique suggestions generated');
      return new Response(
        JSON.stringify({ 
          success: true, 
          suggestionsCreated: 0, 
          message: 'No new unique suggestions generated - you already have comprehensive coverage!' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Google Trends data if SerpAPI key is available
    const serpApiKey = Deno.env.get('SERPAPI_KEY');
    let trendsData = new Map<string, number | null>();
    
    if (serpApiKey) {
      console.log(`Fetching Google Trends data for ${newSuggestions.length} suggestions...`);
      const queries = newSuggestions.map((s: any) => s.text);
      trendsData = await batchGetTrendsData(queries, serpApiKey);
      console.log(`Got trends data for ${trendsData.size} queries`);
    } else {
      console.log('SERPAPI_KEY not configured, skipping trends data');
    }

    // Map AI-generated sources to valid database values
    const mapSourceToDatabase = (aiSource: string): string => {
      const mapping: Record<string, string> = {
        'competitor_analysis': 'competitors',
        'brand_visibility': 'industry', 
        'market_research': 'trends'
      };
      return mapping[aiSource] || 'gap';
    };

    // Insert suggestions into database with brand_id and search_volume
    const insertData = newSuggestions.map((suggestion: any) => ({
      org_id: userData.org_id,
      brand_id: brandId || null,
      text: suggestion.text.trim(),
      source: mapSourceToDatabase(suggestion.source),
      search_volume: trendsData.get(suggestion.text) ?? null,
      metadata: {
        reasoning: suggestion.reasoning,
        generated_for_brand: brandContext?.name || null
      }
    }));

    const { error: insertError } = await supabase
      .from('suggested_prompts')
      .insert(insertData);

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Failed to save suggestions to database');
    }

    console.log(`Successfully created ${newSuggestions.length} new suggestions for brand: ${brandContext?.name || 'org-level'}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestionsCreated: newSuggestions.length,
        trendsDataFetched: trendsData.size,
        brandId: brandId,
        suggestions: newSuggestions.map(s => ({ text: s.text, source: s.source }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in suggest-prompts-now function:', error);
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message || 'Internal server error',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
