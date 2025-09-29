import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  // No body needed - we'll get org data from auth
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Set auth for subsequent requests
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Authentication failed');
    }

    // Get user's org information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('User data error:', userError);
      throw new Error('Could not get user organization');
    }

    // First, check if localization is enabled for this org
    const { data: orgSettings, error: settingsError } = await supabase
      .from('organizations')
      .select('enable_localized_prompts')
      .eq('id', userData.org_id)
      .single();

    if (settingsError || !orgSettings) {
      console.error('Organization settings error:', settingsError);
      throw new Error('Could not get organization settings');
    }

    // Get organization details - conditionally include location fields
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

    // Get existing prompts to avoid duplicates
    const { data: existingPrompts, error: promptsError } = await supabase
      .from('prompts')
      .select('text')
      .eq('org_id', userData.org_id);

    if (promptsError) {
      console.error('Error fetching existing prompts:', promptsError);
    }

    const existingPromptTexts = existingPrompts?.map(p => p.text.toLowerCase()) || [];

    // Get existing suggestions to avoid duplicates
    const { data: existingSuggestions, error: suggestionsError } = await supabase
      .from('suggested_prompts')
      .select('text')
      .eq('org_id', userData.org_id)
      .eq('accepted', false);

    if (suggestionsError) {
      console.error('Error fetching existing suggestions:', suggestionsError);
    }

    const existingSuggestionTexts = existingSuggestions?.map(s => s.text.toLowerCase()) || [];

    // Generate AI-powered suggestions using OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Add location context and instructions based on localization setting
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
LOCALIZATION ENABLED: This business has enabled localized prompts. Include their location (${location}) in some prompts where it makes sense. Mix localized and non-localized prompts (about 40% localized, 60% general).

Examples of localized prompts:
- "best [service] in ${orgData.business_state || orgData.business_city}"
- "top [industry] companies in ${orgData.business_city || orgData.business_state}"
- "[service type] near ${orgData.business_city || orgData.business_state}"
- "where to find [solution] in ${locationParts.join(' ')}"

Make sure localized prompts sound natural and are relevant to the business type.`;
        
        console.log(`Generated localized prompts for location: ${location}`);
      }
    } else {
      locationInstructions = `
LOCALIZATION DISABLED: This business has DISABLED localized prompts. You MUST NOT include any location-specific terms, city names, state names, geographic references, or "near me" type queries.

STRICTLY AVOID:
- "best [service] in [city/state]"
- "top [industry] companies in [location]" 
- "[service type] near [location]"
- "where to find [solution] in [place]"
- Any mention of specific cities, states, regions, or countries
- Terms like "local", "nearby", "in my area", "near me"

ONLY generate completely generic, location-neutral prompts that could apply to any business anywhere in the world.`;
      
      console.log(`Generating NON-LOCALIZED prompts for org ${userData.org_id} - localization is DISABLED`);
    }

    const systemPrompt = `You are an expert at generating natural search prompts that real users would type into AI assistants like ChatGPT, Claude, or Perplexity when looking for business solutions.

Your task is to create realistic search queries that potential customers might use when looking for solutions in this business space. These should sound like genuine questions people ask AI assistants.

CRITICAL: NEVER include the company name "${orgData.name}" or domain "${orgData.domain}" in any of the generated prompts. Focus on the industry, problems, and solutions without mentioning the specific company.
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

Examples of good prompts:
- "What are the best available AI search tools"
- "What software should I use for tracking my brand on AI search?"
- "Which project management tools integrate with AI assistants?"
- "How do I choose the right marketing automation platform for a small business?"
- "What's the difference between popular CRM systems?"

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

    // Parse the JSON response
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
      .slice(0, 10); // Limit to 10 new suggestions

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

    // Map AI-generated sources to valid database values
    const mapSourceToDatabase = (aiSource: string): string => {
      const mapping = {
        'competitor_analysis': 'competitors',
        'brand_visibility': 'industry', 
        'market_research': 'trends'
      };
      return mapping[aiSource as keyof typeof mapping] || 'gap';
    };

    // Insert suggestions into database
    const insertData = newSuggestions.map(suggestion => ({
      org_id: userData.org_id,
      text: suggestion.text.trim(),
      source: mapSourceToDatabase(suggestion.source),
    }));

    const { error: insertError } = await supabase
      .from('suggested_prompts')
      .insert(insertData);

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Failed to save suggestions to database');
    }

    console.log(`Successfully created ${newSuggestions.length} new suggestions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestionsCreated: newSuggestions.length,
        suggestions: newSuggestions.map(s => ({ text: s.text, source: s.source }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in suggest-prompts-now function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});