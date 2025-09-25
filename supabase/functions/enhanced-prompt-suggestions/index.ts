import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getUserOrgId } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://llumos.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } }
  });

  try {
    // Verify authentication and get user's org ID (ignore orgId from request body for security)
    const orgId = await getUserOrgId(supabase);

    console.log(`Generating enhanced prompt suggestions for authenticated user's org: ${orgId}`);

    console.log(`Generating enhanced prompt suggestions for org: ${orgId}`);

    // Get organization context and existing data
    const [orgResult, promptsResult, competitorsResult, visibilityResult] = await Promise.all([
      supabase
        .from('organizations')
        .select('name, business_description, keywords, products_services, target_audience, business_city, business_state, business_country, enable_localized_prompts')
        .eq('id', orgId)
        .single(),
      
      supabase
        .from('prompts')
        .select('text')
        .eq('org_id', orgId)
        .eq('active', true),
      
      // Get top competitors from brand_catalog instead
      supabase
        .from('brand_catalog')
        .select('name, total_appearances')
        .eq('org_id', orgId)
        .eq('is_org_brand', false)
        .gt('total_appearances', 0)
        .order('total_appearances', { ascending: false })
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
    const competitors = competitorsResult.data?.map(comp => comp.name) || [];
    const lowPerformingPrompts = visibilityResult.data || [];

    // Generate nearby locations for localized prompts
    const nearbyLocations = generateNearbyLocations(org.business_city, org.business_state, org.business_country);

    // Build context for AI - exclude organization name if localized prompts are enabled
    const context = org.enable_localized_prompts ? `
Business Type: ${org.business_description || 'Not specified'}
Products/Services: ${org.products_services || 'Not specified'}
Target Audience: ${org.target_audience || 'Not specified'}
Keywords: ${org.keywords?.join(', ') || 'Not specified'}
Location: ${org.business_city || 'Not specified'}, ${org.business_state || 'Not specified'}, ${org.business_country || 'United States'}
Nearby Areas: ${nearbyLocations.join(', ')}

Existing Prompts (${existingPrompts.length}):
${existingPrompts.slice(0, 10).map((p, i) => `${i+1}. ${p.text}`).join('\n')}

Top Competitors (by mentions):
${competitors.map(c => `- ${c} (active)`).join('\n')}

Low Performing Prompts (need attention):
${lowPerformingPrompts.map((p, i) => `${i+1}. ${p.text} (Score: ${p.avg_score_7d})`).join('\n')}
` : `
Organization: ${org.name}
Business: ${org.business_description || 'Not specified'}
Products/Services: ${org.products_services || 'Not specified'}
Target Audience: ${org.target_audience || 'Not specified'}
Keywords: ${org.keywords?.join(', ') || 'Not specified'}

Existing Prompts (${existingPrompts.length}):
${existingPrompts.slice(0, 10).map((p, i) => `${i+1}. ${p.text}`).join('\n')}

Top Competitors (by mentions):
${competitors.map(c => `- ${c} (active)`).join('\n')}

Low Performing Prompts (need attention):
${lowPerformingPrompts.map((p, i) => `${i+1}. ${p.text} (Score: ${p.avg_score_7d})`).join('\n')}
`;

    const systemPrompt = org.enable_localized_prompts ? `You are a visibility expert helping local businesses improve their presence in location-based search results. Based on the business data provided, generate strategic localized prompt suggestions.

IMPORTANT RULES FOR LOCALIZED PROMPTS:
- DO NOT mention any specific business names or brands
- Focus on location-based queries (city, state, nearby areas)
- Use generic business types (e.g., "restaurants", "shops", "services")
- Include variety by incorporating nearby towns and areas
- Make prompts sound natural and conversational

Focus on these categories:
1. **Local Discovery**: "Best [business type] in [location]" style queries
2. **Area Comparison**: Compare services across different nearby locations
3. **Local Recommendations**: Ask for local recommendations without naming brands
4. **Geographic Targeting**: Include nearby cities and neighborhoods for variety
5. **Local Problem-solving**: Location-specific problems that local businesses solve

Generate 15-20 high-quality, location-focused prompts that would help local businesses get discovered WITHOUT mentioning any specific business names. Use the provided location and nearby areas for variety.

Format as JSON array with this structure:
[
  {
    "text": "Specific localized prompt text here (NO brand names)",
    "category": "local-discovery|area-comparison|local-recommendations|geographic-targeting|local-problem-solving",
    "rationale": "Why this prompt would help local businesses",
    "priority": "high|medium|low",
    "expectedMentions": 1-3
  }
]` : `You are a visibility expert helping organizations improve their presence in search responses. Based on the organization data provided, generate strategic prompt suggestions.

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

  } catch (error: unknown) {
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

// Generate nearby locations for localized prompts
function generateNearbyLocations(city: string, state: string, country: string): string[] {
  const locations = [];
  
  // If we have city and state, generate some common nearby variations
  if (city && state) {
    // Add the main city
    locations.push(`${city}, ${state}`);
    
    // Common nearby area patterns for US locations
    if (country === 'United States' || !country) {
      // Metro area variations
      locations.push(`${city} area, ${state}`);
      locations.push(`greater ${city}, ${state}`);
      locations.push(`${city} metro area, ${state}`);
      
      // Directional variations
      locations.push(`north ${city}, ${state}`);
      locations.push(`south ${city}, ${state}`);
      locations.push(`east ${city}, ${state}`);
      locations.push(`west ${city}, ${state}`);
      
      // Downtown/suburb variations
      locations.push(`downtown ${city}, ${state}`);
      locations.push(`${city} suburbs, ${state}`);
      
      // Add state-level queries
      locations.push(state);
      locations.push(`${state} area`);
    }
  } else if (state) {
    // If we only have state, use state-level locations
    locations.push(state);
    locations.push(`${state} area`);
  }
  
  // Remove duplicates and return up to 8 locations
  return [...new Set(locations)].slice(0, 8);
}

// Simple text similarity calculation
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.split(' ').filter(w => w.length > 3); // Filter short words
  const words2 = text2.split(' ').filter(w => w.length > 3);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
}