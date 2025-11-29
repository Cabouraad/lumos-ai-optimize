import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tier check - only Growth and Pro can use Content Studio
const ALLOWED_TIERS = ['growth', 'pro', 'enterprise'];

interface ContentStudioRequest {
  recommendationId?: string;
  promptId?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client for user context
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's org_id
    const { data: userData, error: userDataError } = await supabaseAuth
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.org_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with an organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = userData.org_id;

    // Check subscription tier
    const { data: orgData, error: orgError } = await supabaseAuth
      .from('organizations')
      .select('subscription_tier, name, domain, products_services, target_audience')
      .eq('id', orgId)
      .single();

    if (orgError) {
      console.error('Error fetching org:', orgError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch organization data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tier = orgData?.subscription_tier || 'free';
    if (!ALLOWED_TIERS.includes(tier.toLowerCase())) {
      return new Response(
        JSON.stringify({ 
          error: 'Content Studio is available on Growth & Pro plans.',
          upgradeRequired: true,
          currentTier: tier
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ContentStudioRequest = await req.json();
    const { recommendationId, promptId } = body;

    if (!recommendationId && !promptId) {
      return new Response(
        JSON.stringify({ error: 'Either recommendationId or promptId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch context data
    let topicKey = '';
    let contextData: any = {};

    // Service client for data fetching
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    if (recommendationId) {
      // Try optimizations_v2 first (new table), then fall back to recommendations
      let sourceData: any = null;
      let sourceTable = '';
      
      // Check optimizations_v2 table first
      const { data: optData, error: optError } = await supabaseService
        .from('optimizations_v2')
        .select('*')
        .eq('id', recommendationId)
        .eq('org_id', orgId)
        .maybeSingle();

      if (!optError && optData) {
        sourceData = optData;
        sourceTable = 'optimizations_v2';
        topicKey = optData.title || 'Unknown Topic';
        contextData.optimization = optData;
        contextData.promptContext = optData.prompt_context;
      } else {
        // Fall back to recommendations table
        const { data: recData, error: recError } = await supabaseService
          .from('recommendations')
          .select('*')
          .eq('id', recommendationId)
          .eq('org_id', orgId)
          .maybeSingle();

        if (recError || !recData) {
          console.error('Recommendation not found in either table:', { recommendationId, optError, recError });
          return new Response(
            JSON.stringify({ error: 'Recommendation not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        sourceData = recData;
        sourceTable = 'recommendations';
        topicKey = recData.title || 'Unknown Topic';
        contextData.recommendation = recData;
      }
      
      console.log(`Found source data in ${sourceTable}:`, { id: recommendationId, title: topicKey });
    }

    if (promptId) {
      const { data: promptData, error: promptError } = await supabaseService
        .from('prompts')
        .select('*')
        .eq('id', promptId)
        .eq('org_id', orgId)
        .single();

      if (!promptError && promptData) {
        topicKey = topicKey || promptData.text?.substring(0, 100) || 'Unknown Topic';
        contextData.prompt = promptData;

        // Fetch visibility data for this prompt
        const { data: visibilityData } = await supabaseService
          .from('prompt_provider_responses')
          .select('provider, org_brand_present, score')
          .eq('prompt_id', promptId)
          .eq('org_id', orgId)
          .order('run_at', { ascending: false })
          .limit(20);

        contextData.visibilityData = visibilityData || [];
      }
    }

    // Build LLM prompt
    const systemPrompt = `You are an expert content strategist helping brands improve their visibility in AI search results (ChatGPT, Perplexity, Gemini, Google AI Overviews).

Based on the provided context about a low-visibility topic, generate a detailed content blueprint that will help the brand become more visible when AI models respond to queries about this topic.

The brand context:
- Brand Name: ${orgData.name || 'Unknown'}
- Domain: ${orgData.domain || 'Unknown'}
- Products/Services: ${orgData.products_services || 'Not specified'}
- Target Audience: ${orgData.target_audience || 'Not specified'}

You must respond with a valid JSON object matching this exact structure:
{
  "content_type": "faq_page" | "blog_post" | "landing_page" | "support_article" | "comparison_page",
  "outline": {
    "title": "string",
    "sections": [
      {
        "heading": "string",
        "points": ["string", ...],
        "children": [
          {
            "heading": "string",
            "points": ["string", ...]
          }
        ]
      }
    ]
  },
  "faqs": [
    { "question": "string", "answer_notes": "string" }
  ],
  "key_entities": ["string", ...],
  "schema_suggestions": [
    { "type": "FAQPage" | "Article" | "Product" | "HowTo", "notes": "string" }
  ],
  "tone_guidelines": ["string", ...],
  "llm_targets": ["openai_chatgpt", "perplexity", "gemini"]
}`;

    const userPrompt = `Generate a content blueprint for improving visibility on this topic:

Topic: ${topicKey}

${contextData.recommendation ? `Recommendation Context: ${JSON.stringify(contextData.recommendation.rationale || contextData.recommendation.title)}` : ''}

${contextData.visibilityData?.length ? `
Current Visibility Data:
- Providers checked: ${[...new Set(contextData.visibilityData.map((v: any) => v.provider))].join(', ')}
- Brand presence rate: ${Math.round((contextData.visibilityData.filter((v: any) => v.org_brand_present).length / contextData.visibilityData.length) * 100)}%
- Average score: ${(contextData.visibilityData.reduce((sum: number, v: any) => sum + (v.score || 0), 0) / contextData.visibilityData.length).toFixed(1)}
` : ''}

Create a comprehensive content blueprint that will help this brand become more visible in AI search results for this topic.`;

    // Call Lovable AI
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling Lovable AI for content generation...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_content_blueprint',
              description: 'Create a structured content blueprint for AI visibility optimization',
              parameters: {
                type: 'object',
                properties: {
                  content_type: {
                    type: 'string',
                    enum: ['faq_page', 'blog_post', 'landing_page', 'support_article', 'comparison_page']
                  },
                  outline: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      sections: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            heading: { type: 'string' },
                            points: { type: 'array', items: { type: 'string' } },
                            children: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  heading: { type: 'string' },
                                  points: { type: 'array', items: { type: 'string' } }
                                }
                              }
                            }
                          },
                          required: ['heading', 'points']
                        }
                      }
                    },
                    required: ['title', 'sections']
                  },
                  faqs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        question: { type: 'string' },
                        answer_notes: { type: 'string' }
                      },
                      required: ['question', 'answer_notes']
                    }
                  },
                  key_entities: { type: 'array', items: { type: 'string' } },
                  schema_suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['FAQPage', 'Article', 'Product', 'HowTo'] },
                        notes: { type: 'string' }
                      },
                      required: ['type', 'notes']
                    }
                  },
                  tone_guidelines: { type: 'array', items: { type: 'string' } },
                  llm_targets: { type: 'array', items: { type: 'string' } }
                },
                required: ['content_type', 'outline', 'faqs', 'key_entities', 'schema_suggestions', 'tone_guidelines', 'llm_targets']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'create_content_blueprint' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate content blueprint' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract the tool call result
    let blueprint: any;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        blueprint = JSON.parse(toolCall.function.arguments);
      } else {
        // Fallback: try to parse from content
        const content = aiData.choices?.[0]?.message?.content;
        if (content) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            blueprint = JSON.parse(jsonMatch[0]);
          }
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!blueprint) {
      return new Response(
        JSON.stringify({ error: 'No valid blueprint generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine if recommendationId is from recommendations table (not optimizations_v2)
    // FK constraint only allows IDs from recommendations table
    const isFromRecommendationsTable = contextData.recommendation !== undefined;
    
    // Insert into database
    const { data: insertedItem, error: insertError } = await supabaseService
      .from('content_studio_items')
      .insert({
        org_id: orgId,
        created_by: user.id,
        recommendation_id: isFromRecommendationsTable ? recommendationId : null,
        prompt_id: promptId || null,
        topic_key: topicKey,
        content_type: blueprint.content_type || 'blog_post',
        outline: blueprint.outline || {},
        faqs: blueprint.faqs || [],
        key_entities: blueprint.key_entities || [],
        schema_suggestions: blueprint.schema_suggestions || [],
        tone_guidelines: blueprint.tone_guidelines || [],
        llm_targets: blueprint.llm_targets || ['openai_chatgpt', 'perplexity', 'gemini'],
        status: 'draft'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save content blueprint' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Content Studio item created:', insertedItem.id);

    return new Response(
      JSON.stringify({ success: true, item: insertedItem }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Content Studio error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
