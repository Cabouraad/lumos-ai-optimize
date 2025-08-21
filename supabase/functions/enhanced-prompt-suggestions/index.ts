import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { orgId } = await req.json();

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Missing orgId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating enhanced prompt suggestions for org: ${orgId}`);

    // Get organization context and existing data
    const [orgResult, promptsResult, competitorsResult, visibilityResult] = await Promise.all([
      supabase
        .from('organizations')
        .select('name, business_description, keywords, products_services, target_audience')
        .eq('id', orgId)
        .single(),
      
      supabase
        .from('prompts')
        .select('text')
        .eq('org_id', orgId)
        .eq('active', true),
      
      supabase
        .from('competitor_mentions')
        .select('competitor_name, mention_count')
        .eq('org_id', orgId)
        .gte('last_seen_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('mention_count', { ascending: false })
        .limit(10),
        
      supabase.rpc('get_prompt_visibility_7d', {
        requesting_org_id: orgId
      })
    ]);

    if (orgResult.error) {
      console.error('Error fetching organization:', orgResult.error);
      throw new Error('Organization not found');
    }

    const org = orgResult.data;
    const existingPrompts = promptsResult.data || [];
    const topCompetitors = competitorsResult.data || [];
    const lowPerformingPrompts = visibilityResult.data || [];

    // Build context for AI
    const context = `
Organization: ${org.name}
Business: ${org.business_description || 'Not specified'}
Products/Services: ${org.products_services || 'Not specified'}
Target Audience: ${org.target_audience || 'Not specified'}
Keywords: ${org.keywords?.join(', ') || 'Not specified'}

Existing Prompts (${existingPrompts.length}):
${existingPrompts.slice(0, 10).map((p, i) => `${i+1}. ${p.text}`).join('\n')}

Top Competitors (by mentions):
${topCompetitors.map(c => `- ${c.competitor_name} (${c.mention_count} mentions)`).join('\n')}

Low Performing Prompts (need attention):
${lowPerformingPrompts.map((p, i) => `${i+1}. ${p.text} (Score: ${p.avg_score_7d})`).join('\n')}
`;

    const systemPrompt = `You are an AI visibility expert helping organizations improve their presence in AI-generated responses. Based on the organization data provided, generate strategic prompt suggestions.

Focus on these categories:
1. **Gap Analysis**: Identify missing coverage areas based on business description and keywords
2. **Competitor Defense**: Create prompts that highlight advantages over mentioned competitors  
3. **Long-tail Opportunities**: Suggest specific, niche prompts related to their industry
4. **Comparison Prompts**: Direct comparison prompts featuring the organization
5. **Problem-solving Prompts**: Prompts where the organization's solution would naturally fit

Generate 15-20 high-quality, strategic prompts that would likely mention the organization. Make them specific, actionable, and tailored to the business context.

Format as JSON array with this structure:
[
  {
    "text": "Specific prompt text here",
    "category": "gap-analysis|competitor-defense|long-tail|comparison|problem-solving",
    "rationale": "Why this prompt would improve visibility",
    "priority": "high|medium|low",
    "expectedMentions": 1-5
  }
]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.statusText);
      throw new Error('Failed to generate prompt suggestions');
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;
    
    let suggestions;
    try {
      suggestions = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI suggestions');
    }

    // Filter out suggestions that are too similar to existing prompts
    const filteredSuggestions = suggestions.filter((suggestion: any) => {
      const newPromptText = suggestion.text.toLowerCase();
      return !existingPrompts.some(existing => {
        const existingText = existing.text.toLowerCase();
        const similarity = calculateTextSimilarity(newPromptText, existingText);
        return similarity > 0.8; // Threshold for considering prompts too similar
      });
    });

    // Store suggestions in database
    const suggestionsToInsert = filteredSuggestions.map((suggestion: any) => ({
      org_id: orgId,
      text: suggestion.text,
      source: `enhanced-ai-${suggestion.category}`,
      metadata: {
        category: suggestion.category,
        rationale: suggestion.rationale,
        priority: suggestion.priority,
        expectedMentions: suggestion.expectedMentions
      }
    }));

    if (suggestionsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('suggested_prompts')
        .insert(suggestionsToInsert);

      if (insertError) {
        console.error('Error inserting suggestions:', insertError);
        throw new Error('Failed to save suggestions');
      }
    }

    return new Response(JSON.stringify({
      success: true,
      generated: suggestions.length,
      filtered: filteredSuggestions.length,
      inserted: suggestionsToInsert.length,
      categories: filteredSuggestions.reduce((acc: any, s: any) => {
        acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
      }, {})
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhanced-prompt-suggestions:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Simple text similarity calculation
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.split(' ').filter(w => w.length > 3); // Filter short words
  const words2 = text2.split(' ').filter(w => w.length > 3);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
}