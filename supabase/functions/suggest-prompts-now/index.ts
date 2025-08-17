import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    // Get organization details
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('name, business_description, products_services, keywords, target_audience, domain')
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

    const systemPrompt = `You are an expert at generating natural search prompts that real users would type into AI assistants like ChatGPT, Claude, or Perplexity when looking for business solutions.

Your task is to create realistic search queries that potential customers of the given business might use. These should sound like genuine questions people ask AI assistants.

Business Context:
- Company: ${orgData.name}
- Industry/Description: ${orgData.business_description || 'Not specified'}
- Products/Services: ${orgData.products_services || 'Not specified'}
- Keywords: ${orgData.keywords?.join(', ') || 'Not specified'}
- Target Audience: ${orgData.target_audience || 'Not specified'}
- Domain: ${orgData.domain}

Generate 15 diverse, natural search prompts that potential customers might use when looking for solutions in this space. Each prompt should:

1. Sound like a real question someone would ask an AI assistant
2. Be relevant to the business context
3. Help monitor brand visibility or competitor analysis
4. Be conversational and natural (not keyword-stuffed)
5. Cover different aspects: comparison, recommendations, best practices, selection criteria

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
    } catch (parseError) {
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

    // Insert suggestions into database
    const insertData = newSuggestions.map(suggestion => ({
      org_id: userData.org_id,
      text: suggestion.text.trim(),
      source: suggestion.source,
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

  } catch (error) {
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