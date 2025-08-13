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
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { promptId, orgId } = await req.json();

    if (!promptId || !orgId) {
      return new Response(JSON.stringify({ error: 'promptId and orgId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify org ownership
    const { data: prompt } = await supabase
      .from('prompts')
      .select('org_id')
      .eq('id', promptId)
      .single();

    if (!prompt || prompt.org_id !== orgId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Run the prompt using the same logic as daily-run
    const result = await runPrompt(promptId, orgId, supabase, openaiKey, perplexityKey);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Run prompt now error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Copy the runPrompt function from daily-run (inline to avoid imports)
async function runPrompt(promptId: string, orgId: string, supabase: any, openaiKey?: string, perplexityKey?: string) {
  // ... (same implementation as in daily-run/index.ts)
  // I'll copy the exact same function here
  try {
    const { data: prompt } = await supabase
      .from('prompts')
      .select('text')
      .eq('id', promptId)
      .single();

    if (!prompt) {
      return { success: false, error: 'Prompt not found' };
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('plan_tier')
      .eq('id', orgId)
      .single();

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    const { data: providers } = await supabase
      .from('llm_providers')
      .select('*')
      .eq('enabled', true)
      .order('name');

    if (!providers || providers.length === 0) {
      return { success: false, error: 'No enabled providers' };
    }

    const { data: brandCatalog } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', orgId);

    if (!brandCatalog) {
      return { success: false, error: 'Could not load brand catalog' };
    }

    const quotas = getQuotasForTier(org.plan_tier);
    let runsCreated = 0;

    for (const provider of providers.slice(0, quotas.providersPerPrompt)) {
      try {
        let extraction;
        if (provider.name === 'openai' && openaiKey) {
          extraction = await extractBrandsOpenAI(prompt.text, openaiKey);
        } else if (provider.name === 'perplexity' && perplexityKey) {
          extraction = await extractBrandsPerplexity(prompt.text, perplexityKey);
        } else {
          continue;
        }

        const normalizedBrands = extraction.brands.map((brand: string) => normalize(brand));
        const orgBrands = normalizedBrands.filter((brand: string) => 
          isOrgBrand(brand, brandCatalog)
        );
        
        const orgPresent = orgBrands.length > 0;
        const orgBrandIdx = orgPresent ? normalizedBrands.findIndex((brand: string) => 
          isOrgBrand(brand, brandCatalog)
        ) : null;
        
        const competitorsCount = normalizedBrands.length - orgBrands.length;
        const score = computeScore(orgPresent, orgBrandIdx, competitorsCount);

        const { data: newRun } = await supabase
          .from('prompt_runs')
          .insert({
            prompt_id: promptId,
            provider_id: provider.id,
            status: 'success',
            token_in: extraction.tokenIn,
            token_out: extraction.tokenOut,
            cost_est: 0
          })
          .select()
          .single();

        if (newRun) {
          await supabase
            .from('visibility_results')
            .insert({
              prompt_run_id: newRun.id,
              org_brand_present: orgPresent,
              org_brand_prominence: orgBrandIdx ?? 0,
              brands_json: extraction.brands,
              competitors_count: competitorsCount,
              raw_evidence: JSON.stringify({ normalized: normalizedBrands, orgMatches: orgBrands }),
              score: score
            });
          
          runsCreated++;
        }

      } catch (providerError: any) {
        console.error(`Provider ${provider.name} error:`, providerError);
        
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

// Helper functions (copied inline)
function getQuotasForTier(planTier: string) {
  switch (planTier) {
    case 'starter': return { promptsPerDay: 10, providersPerPrompt: 2 };
    case 'pro': return { promptsPerDay: 50, providersPerPrompt: 3 };
    case 'scale': return { promptsPerDay: 200, providersPerPrompt: 3 };
    default: return { promptsPerDay: 10, providersPerPrompt: 2 };
  }
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function isOrgBrand(token: string, catalog: Array<{ name: string; variants_json: string[] }>): boolean {
  const normalizedToken = normalize(token);
  if (normalizedToken.length < 4) return false;

  for (const brand of catalog) {
    const normalizedBrandName = normalize(brand.name);
    if (normalizedToken === normalizedBrandName) return true;
    if (normalizedBrandName.length >= 4) {
      if (normalizedToken.startsWith(normalizedBrandName) || normalizedToken.includes(normalizedBrandName)) {
        return true;
      }
    }
    for (const variant of brand.variants_json || []) {
      const normalizedVariant = normalize(variant);
      if (normalizedToken === normalizedVariant) return true;
      if (normalizedVariant.length >= 4) {
        if (normalizedToken.startsWith(normalizedVariant) || normalizedToken.includes(normalizedVariant)) {
          return true;
        }
      }
    }
  }
  return false;
}

function computeScore(orgPresent: boolean, prominenceIdx: number | null, competitorsCount: number): number {
  let score = orgPresent ? 100 : 0;
  if (orgPresent && prominenceIdx !== null) {
    const bonus = [30, 20, 10, 0][Math.min(prominenceIdx, 3)] ?? 0;
    score = Math.min(100, score + bonus);
  }
  score = Math.max(0, score - Math.min(20, competitorsCount * 5));
  return score;
}

async function extractBrandsOpenAI(promptText: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: 'You are an extraction API. Given a user prompt, output ONLY a JSON object with a single key brands as an array of brand or company names you would include in your answer. No explanations.'
        },
        {
          role: 'user',
          content: promptText
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

  const data = await response.json();
  const content = data.choices[0].message.content;
  const usage = data.usage || {};

  try {
    const parsed = JSON.parse(content);
    return {
      brands: Array.isArray(parsed.brands) ? parsed.brands : [],
      tokenIn: usage.prompt_tokens || 0,
      tokenOut: usage.completion_tokens || 0,
    };
  } catch (parseError) {
    const match = content.match(/\["[^"]*"(?:,\s*"[^"]*")*\]/);
    if (match) {
      try {
        const brands = JSON.parse(match[0]);
        return {
          brands: Array.isArray(brands) ? brands : [],
          tokenIn: usage.prompt_tokens || 0,
          tokenOut: usage.completion_tokens || 0,
        };
      } catch {
        return { brands: [], tokenIn: 0, tokenOut: 0 };
      }
    }
    return { brands: [], tokenIn: 0, tokenOut: 0 };
  }
}

async function extractBrandsPerplexity(promptText: string, apiKey: string) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [
        {
          role: 'system',
          content: 'You are an extraction API. Given a user prompt, output ONLY a JSON object with a single key brands as an array of brand or company names you would include in your answer. No explanations.'
        },
        {
          role: 'user',
          content: promptText
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
      return_images: false,
      return_related_questions: false,
    }),
  });

  if (!response.ok) throw new Error(`Perplexity API error: ${response.status}`);

  const data = await response.json();
  const content = data.choices[0].message.content;
  const usage = data.usage || {};

  try {
    const parsed = JSON.parse(content);
    return {
      brands: Array.isArray(parsed.brands) ? parsed.brands : [],
      tokenIn: usage.prompt_tokens || 0,
      tokenOut: usage.completion_tokens || 0,
    };
  } catch (parseError) {
    const match = content.match(/\["[^"]*"(?:,\s*"[^"]*")*\]/);
    if (match) {
      try {
        const brands = JSON.parse(match[0]);
        return {
          brands: Array.isArray(brands) ? brands : [],
          tokenIn: usage.prompt_tokens || 0,
          tokenOut: usage.completion_tokens || 0,
        };
      } catch {
        return { brands: [], tokenIn: 0, tokenOut: 0 };
      }
    }
    return { brands: [], tokenIn: 0, tokenOut: 0 };
  }
}