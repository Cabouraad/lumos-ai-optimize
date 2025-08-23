import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { manualRun, organizationId } = await req.json();

    console.log('Starting prompt execution run...');

    // Get all organizations (or specific one if provided)
    let orgQuery = supabase.from('organizations').select('id, name');
    if (organizationId) {
      orgQuery = orgQuery.eq('id', organizationId);
    }

    const { data: organizations, error: orgError } = await orgQuery;
    
    if (orgError) {
      throw new Error(`Failed to fetch organizations: ${orgError.message}`);
    }

    if (!organizations || organizations.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No organizations found',
          organizations: 0,
          totalRuns: 0,
          successfulRuns: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalRuns = 0;
    let successfulRuns = 0;

    // Process each organization
    for (const org of organizations) {
      console.log(`Processing org: ${org.name}`);

      // Get active prompts for this org
      const { data: prompts } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('org_id', org.id)
        .eq('active', true);

      if (!prompts || prompts.length === 0) {
        console.log(`No active prompts for ${org.name}`);
        continue;
      }

      console.log(`Found ${prompts.length} active prompts for ${org.name}`);

      // Run each prompt
      for (const prompt of prompts) {
        try {
          const result = await runPrompt(prompt.id, org.id, supabase);
          totalRuns++;
          if (result.success) {
            successfulRuns += result.runsCreated;
            console.log(`Successfully processed prompt ${prompt.id}`);
          } else {
            console.error(`Failed to process prompt ${prompt.id}: ${result.error}`);
          }
        } catch (error) {
          console.error(`Error processing prompt ${prompt.id}:`, error);
          totalRuns++;
        }

        // Small delay between prompts
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const result = {
      success: true,
      organizations: organizations.length,
      totalRuns,
      successfulRuns,
      timestamp: new Date().toISOString()
    };

    console.log('Run completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Run all prompts error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Run a single prompt across all enabled providers
 */
async function runPrompt(promptId: string, orgId: string, supabase: any) {
  try {
    // Get prompt text
    const { data: prompt } = await supabase
      .from('prompts')
      .select('text')
      .eq('id', promptId)
      .single();

    if (!prompt) {
      return { success: false, error: 'Prompt not found' };
    }

    // Get enabled providers
    const { data: providers } = await supabase
      .from('llm_providers')
      .select('id, name')
      .eq('enabled', true);

    if (!providers || providers.length === 0) {
      return { success: false, error: 'No enabled providers' };
    }

    let runsCreated = 0;

    // Run prompt on each provider
    for (const provider of providers) {
      try {
        // Execute prompt based on provider
        let response;
        switch (provider.name) {
          case 'openai':
            response = await executeOpenAI(prompt.text);
            break;
          case 'perplexity':
            response = await executePerplexity(prompt.text);
            break;
          case 'gemini':
            response = await executeGemini(prompt.text);
            break;
          default:
            console.log(`Unknown provider: ${provider.name}`);
            continue;
        }

        if (!response) continue;

        // Extract brands and calculate score
        const brands = extractBrands(response.text);
        const score = calculateVisibilityScore(brands, response.text);

        // Store run
        const { data: run } = await supabase
          .from('prompt_runs')
          .insert({
            prompt_id: promptId,
            provider_id: provider.id,
            status: 'success',
            token_in: response.tokenIn || 0,
            token_out: response.tokenOut || 0,
            cost_est: 0
          })
          .select()
          .single();

        if (run) {
          // Store visibility result
          await supabase
            .from('visibility_results')
            .insert({
              prompt_run_id: run.id,
              org_brand_present: score.brandPresent,
              org_brand_prominence: score.brandPosition,
              competitors_count: score.competitorCount,
              brands_json: brands,
              score: score.score,
              raw_ai_response: response.text,
              raw_evidence: JSON.stringify({ brands, analysis: score })
            });

          runsCreated++;
        }

      } catch (providerError) {
        console.error(`Provider ${provider.name} error:`, providerError);
        
        // Log failed run
        await supabase
          .from('prompt_runs')
          .insert({
            prompt_id: promptId,
            provider_id: provider.id,
            status: 'error',
            token_in: 0,
            token_out: 0,
            cost_est: 0
          });
      }
    }

    return { success: true, runsCreated };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Provider execution functions (same as in execute-prompt)
async function executeOpenAI(promptText: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not found');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: promptText }],
      max_tokens: 1000,
      temperature: 0.7
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

  const data = await response.json();
  return {
    text: data.choices[0].message.content,
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0
  };
}

async function executePerplexity(promptText: string) {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) throw new Error('Perplexity API key not found');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: promptText }],
      max_tokens: 1000,
      temperature: 0.2
    }),
  });

  if (!response.ok) throw new Error(`Perplexity API error: ${response.status}`);

  const data = await response.json();
  return {
    text: data.choices[0].message.content,
    tokenIn: 0,
    tokenOut: 0
  };
}

async function executeGemini(promptText: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not found');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }]
    }),
  });

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

  const data = await response.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokenIn: 0,
    tokenOut: 0
  };
}

function extractBrands(text: string): string[] {
  const brands: string[] = [];
  const words = text.split(/\s+/);
  const brandPattern = /^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*$/;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[.,!?;:]$/, '');
    
    if (brandPattern.test(word) && word.length > 2) {
      brands.push(word);
    }
    
    if (i < words.length - 1) {
      const twoWord = `${word} ${words[i + 1].replace(/[.,!?;:]$/, '')}`;
      if (brandPattern.test(twoWord)) {
        brands.push(twoWord);
        i++;
      }
    }
  }
  
  const commonWords = ['The', 'This', 'That', 'And', 'Or', 'But', 'With', 'For', 'On', 'In', 'At', 'To', 'From'];
  return [...new Set(brands)]
    .filter(brand => !commonWords.includes(brand))
    .filter(brand => brand.length > 1)
    .slice(0, 10);
}

function calculateVisibilityScore(brands: string[], responseText: string) {
  const brandPresent = brands.length > 0;
  const competitorCount = Math.max(0, brands.length - 1);
  const brandPosition = brandPresent ? 0 : null;
  
  let score = 0;
  if (brandPresent) {
    score = Math.max(1, 10 - competitorCount);
  }

  return {
    brandPresent,
    brandPosition,
    competitorCount,
    score
  };
}