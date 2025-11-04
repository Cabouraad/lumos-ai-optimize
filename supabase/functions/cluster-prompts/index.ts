import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClusterRequest {
  promptIds?: string[];
  orgId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { promptIds, orgId } = await req.json() as ClusterRequest;

    console.log(`[cluster-prompts] Starting clustering for org: ${orgId}`);

    // Fetch prompts to cluster
    let query = supabaseClient
      .from('prompts')
      .select('id, text, cluster_tag')
      .eq('org_id', orgId)
      .eq('active', true);

    if (promptIds && promptIds.length > 0) {
      query = query.in('id', promptIds);
    }

    const { data: prompts, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!prompts || prompts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No prompts to cluster' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[cluster-prompts] Found ${prompts.length} prompts to cluster`);

    // Use Gemini to cluster prompts
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Prepare prompt texts for clustering
    const promptTexts = prompts.map((p, idx) => `${idx + 1}. "${p.text}"`).join('\n');

    const systemPrompt = `You are a semantic clustering expert. Your task is to analyze search queries and group them into concise, clear categories.

Rules:
1. Each category name should be 2-3 words maximum
2. Categories should be business-focused and descriptive
3. Similar queries should get the same category
4. Use title case for categories
5. Examples: "Running Gear", "Tech Reviews", "Travel Tips", "Food Recipes"

Analyze these queries and return a JSON array where each entry has:
- "index": the query number (1-based)
- "tag": the category name

Queries to cluster:
${promptTexts}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: systemPrompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const result = await response.json();
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No response from Gemini');
    }

    console.log(`[cluster-prompts] Gemini response:`, generatedText);

    // Parse JSON from response (handle markdown code blocks)
    let clusteredData;
    try {
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        clusteredData = JSON.parse(jsonMatch[0]);
      } else {
        clusteredData = JSON.parse(generatedText);
      }
    } catch (parseError) {
      console.error('[cluster-prompts] Failed to parse Gemini response:', parseError);
      throw new Error('Failed to parse clustering results');
    }

    // Update prompts with cluster tags
    const updates = [];
    for (const item of clusteredData) {
      const promptIndex = item.index - 1;
      if (promptIndex >= 0 && promptIndex < prompts.length) {
        const prompt = prompts[promptIndex];
        updates.push(
          supabaseClient
            .from('prompts')
            .update({ cluster_tag: item.tag })
            .eq('id', prompt.id)
        );
      }
    }

    await Promise.all(updates);

    console.log(`[cluster-prompts] Successfully clustered ${updates.length} prompts`);

    return new Response(
      JSON.stringify({
        success: true,
        clustered: updates.length,
        tags: [...new Set(clusteredData.map((d: any) => d.tag))],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cluster-prompts] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});