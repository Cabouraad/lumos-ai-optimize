import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchResult {
  promptId: string;
  promptText: string;
  results: {
    openai?: { success: boolean; score: number; brandPresent: boolean; error?: string };
    gemini?: { success: boolean; score: number; brandPresent: boolean; error?: string };
    perplexity?: { success: boolean; score: number; brandPresent: boolean; error?: string };
  };
}

interface BatchSummary {
  totalPrompts: number;
  successfulPrompts: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
}

// Simple provider execution functions
async function executeOpenAI(promptText: string): Promise<{ responseText: string; tokenIn: number; tokenOut: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    responseText: data.choices[0]?.message?.content || '',
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0,
  };
}

async function executeGemini(promptText: string): Promise<{ responseText: string; tokenIn: number; tokenOut: number }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not configured');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  return {
    responseText: content,
    tokenIn: data.usageMetadata?.promptTokenCount || 0,
    tokenOut: data.usageMetadata?.candidatesTokenCount || 0,
  };
}

async function executePerplexity(promptText: string): Promise<{ responseText: string; tokenIn: number; tokenOut: number }> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) throw new Error('Perplexity API key not configured');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    responseText: data.choices[0]?.message?.content || '',
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0,
  };
}

// Simple analysis function
function analyzeResponse(responseText: string, orgName: string): { score: number; brandPresent: boolean } {
  const text = responseText.toLowerCase();
  const orgLower = orgName.toLowerCase();
  
  // Check if brand is mentioned
  const brandPresent = text.includes(orgLower) || text.includes(orgName.toLowerCase());
  
  // Simple scoring based on brand presence and response quality
  let score = 0;
  if (brandPresent) {
    // Brand found - good score
    const position = text.indexOf(orgLower);
    const relativePosition = position / text.length;
    
    if (relativePosition < 0.2) score = 8; // Early mention
    else if (relativePosition < 0.5) score = 6; // Middle mention  
    else score = 4; // Late mention
  } else {
    // No brand - lower score based on response length/quality
    score = responseText.length > 500 ? 2 : 1;
  }
  
  return { score, brandPresent };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId } = await req.json();
    
    console.log('=== SIMPLE BATCH RUN START ===');
    console.log(`Org ID: ${orgId}`);

    if (!orgId) {
      throw new Error('Missing orgId parameter');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      throw new Error('Organization not found');
    }

    // Get active prompts
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select('id, text')
      .eq('org_id', orgId)
      .eq('active', true)
      .limit(5); // Limit to 5 prompts for reliability

    if (promptsError) {
      throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
    }

    if (!prompts || prompts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active prompts found',
          results: [],
          summary: { totalPrompts: 0, successfulPrompts: 0, totalRuns: 0, successfulRuns: 0, failedRuns: 0, successRate: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${prompts.length} prompts for ${org.name}`);

    const results: BatchResult[] = [];
    const providers = ['openai', 'gemini', 'perplexity'];
    let totalRuns = 0;
    let successfulRuns = 0;
    let failedRuns = 0;

    // Process each prompt
    for (const prompt of prompts) {
      console.log(`\n--- Processing: ${prompt.text.substring(0, 50)}... ---`);
      
      const promptResult: BatchResult = {
        promptId: prompt.id,
        promptText: prompt.text.length > 100 ? prompt.text.substring(0, 100) + '...' : prompt.text,
        results: {}
      };

      // Test each provider
      for (const provider of providers) {
        totalRuns++;
        console.log(`  🚀 Testing ${provider}...`);
        
        try {
          let response;
          switch (provider) {
            case 'openai':
              response = await executeOpenAI(prompt.text);
              break;
            case 'gemini':
              response = await executeGemini(prompt.text);
              break;
            case 'perplexity':
              response = await executePerplexity(prompt.text);
              break;
            default:
              throw new Error(`Unknown provider: ${provider}`);
          }

          const analysis = analyzeResponse(response.responseText, org.name);
          
          promptResult.results[provider as keyof typeof promptResult.results] = {
            success: true,
            score: analysis.score,
            brandPresent: analysis.brandPresent
          };

          // Store result in database
          await supabase
            .from('prompt_provider_responses')
            .insert({
              org_id: orgId,
              prompt_id: prompt.id,
              provider: provider,
              model: provider === 'openai' ? 'gpt-4o-mini' : provider === 'gemini' ? 'gemini-2.0-flash-exp' : 'llama-3.1-sonar-small-128k-online',
              status: 'success',
              raw_ai_response: response.responseText,
              token_in: response.tokenIn,
              token_out: response.tokenOut,
              org_brand_present: analysis.brandPresent,
              score: analysis.score,
              brands_json: analysis.brandPresent ? [org.name] : [],
              competitors_json: [],
              competitors_count: 0,
              metadata: { batch_run: true, simplified_analysis: true }
            });

          successfulRuns++;
          console.log(`  ✅ ${provider} success - Score: ${analysis.score}, Brand: ${analysis.brandPresent ? 'Yes' : 'No'}`);

        } catch (error: any) {
          failedRuns++;
          console.error(`  ❌ ${provider} failed:`, error.message);
          
          promptResult.results[provider as keyof typeof promptResult.results] = {
            success: false,
            score: 0,
            brandPresent: false,
            error: error.message
          };

          // Store error in database
          await supabase
            .from('prompt_provider_responses')
            .insert({
              org_id: orgId,
              prompt_id: prompt.id,
              provider: provider,
              model: '',
              status: 'error',
              error: error.message,
              token_in: 0,
              token_out: 0,
              org_brand_present: false,
              score: 0,
              brands_json: [],
              competitors_json: [],
              competitors_count: 0,
              metadata: { batch_run: true, error: true }
            });
        }

        // Small delay between providers
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      results.push(promptResult);
      
      // Delay between prompts
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Calculate summary
    const successfulPrompts = results.filter(r => 
      Object.values(r.results).filter(result => result?.success).length === 3
    ).length;

    const summary: BatchSummary = {
      totalPrompts: prompts.length,
      successfulPrompts,
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate: totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0
    };

    // Record batch history
    await supabase
      .from('batch_run_history')
      .insert({
        org_id: orgId,
        prompts_processed: prompts.length,
        successful_prompts: successfulPrompts,
        success_rate: summary.successRate,
        total_provider_runs: totalRuns,
        successful_runs: successfulRuns,
        failed_runs: failedRuns
      });

    console.log('\n=== BATCH COMPLETE ===');
    console.log(`Results: ${successfulRuns}/${totalRuns} runs successful (${summary.successRate}%)`);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
        message: `Processed ${prompts.length} prompts with ${summary.successRate}% success rate`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('=== BATCH ERROR ===', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        summary: { totalPrompts: 0, successfulPrompts: 0, totalRuns: 0, successfulRuns: 0, failedRuns: 0, successRate: 0 },
        results: []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});