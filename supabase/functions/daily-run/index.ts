import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      organizations: any;
      prompts: any;
      prompt_runs: any;
      llm_providers: any;
      brand_catalog: any;
      visibility_results: any;
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  try {
    console.log('Starting daily prompt runs...');

    // Get all organizations with active prompts
    const { data: orgs } = await supabase
      .from('organizations')
      .select(`
        id,
        plan_tier,
        prompts!inner (
          id,
          text,
          active
        )
      `)
      .eq('prompts.active', true);

    if (!orgs || orgs.length === 0) {
      console.log('No organizations with active prompts found');
      return new Response(JSON.stringify({ message: 'No work to do' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    let totalRuns = 0;

    for (const org of orgs) {
      try {
        // Get quota for this org's tier
        const quotas = getQuotasForTier(org.plan_tier);

        // Count today's runs for this org
        const { data: todayRuns } = await supabase
          .from('prompt_runs')
          .select('id')
          .gte('run_at', `${today}T00:00:00Z`)
          .lt('run_at', `${today}T23:59:59Z`)
          .in('prompt_id', (org as any).prompts.map((p: any) => p.id));

        const runsUsed = todayRuns?.length || 0;
        const remainingQuota = quotas.promptsPerDay - runsUsed;

        if (remainingQuota <= 0) {
          console.log(`Org ${org.id} has used daily quota`);
          continue;
        }

        // Select prompts to run (up to remaining quota)
        const promptsToRun = (org as any).prompts.slice(0, remainingQuota);

        for (const prompt of promptsToRun) {
          try {
            const result = await runPrompt(
              prompt.id, 
              org.id, 
              supabase,
              openaiKey,
              perplexityKey
            );
            
            if (result.success) {
              totalRuns += result.runsCreated;
              console.log(`Processed prompt ${prompt.id} - created ${result.runsCreated} runs`);
            } else {
              console.error(`Failed to process prompt ${prompt.id}: ${result.error}`);
            }

            // Small delay between prompts to avoid overwhelming APIs
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (promptError) {
            console.error(`Error processing prompt ${prompt.id}:`, promptError);
          }
        }

      } catch (orgError) {
        console.error(`Error processing org ${org.id}:`, orgError);
      }
    }

    console.log(`Daily run completed. Total runs created: ${totalRuns}`);

    return new Response(JSON.stringify({ 
      success: true, 
      totalRuns,
      message: `Processed daily runs for ${orgs.length} organizations`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Daily run error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions (copied inline to avoid imports)
function getQuotasForTier(planTier: string) {
  switch (planTier) {
    case 'starter':
      return { promptsPerDay: 10, providersPerPrompt: 2 };
    case 'pro':
      return { promptsPerDay: 50, providersPerPrompt: 3 };
    case 'scale':
      return { promptsPerDay: 200, providersPerPrompt: 3 };
    default:
      return { promptsPerDay: 10, providersPerPrompt: 2 };
  }
}

async function runPrompt(
  promptId: string, 
  orgId: string, 
  supabase: any,
  openaiKey?: string,
  perplexityKey?: string
) {
  try {
    // Load prompt and org data
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

    // Get enabled providers
    const { data: providers } = await supabase
      .from('llm_providers')
      .select('*')
      .eq('enabled', true)
      .order('name');

    if (!providers || providers.length === 0) {
      return { success: false, error: 'No enabled providers' };
    }

    // Get org brand catalog
    const { data: brandCatalog } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', orgId);

    if (!brandCatalog) {
      return { success: false, error: 'Could not load brand catalog' };
    }

    const quotas = getQuotasForTier(org.plan_tier);
    let runsCreated = 0;

    // Process each provider with timeout and retry
    for (const provider of providers.slice(0, quotas.providersPerPrompt)) {
      let attempt = 0;
      const maxAttempts = 2;

      while (attempt < maxAttempts) {
        try {
          // Extract brands with 15s timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 15000)
          );

          let extractionPromise;
          if (provider.name === 'openai' && openaiKey) {
            extractionPromise = extractBrandsOpenAI(prompt.text, openaiKey);
          } else if (provider.name === 'perplexity' && perplexityKey) {
            extractionPromise = extractBrandsPerplexity(prompt.text, perplexityKey);
          } else {
            break; // Skip if no API key
          }

          const extraction = await Promise.race([extractionPromise, timeoutPromise]) as any;

          // Process results
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

          // Insert prompt_runs
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
            // Insert visibility_results
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

          break; // Success, exit retry loop

        } catch (providerError: any) {
          attempt++;
          console.error(`Provider ${provider.name} attempt ${attempt} error:`, providerError);
          
          if (attempt === maxAttempts) {
            // Determine error status based on error message
            let status = 'error';
            if (providerError.message === 'Timeout') {
              status = 'timeout';
            } else if (providerError.message?.includes('429')) {
              status = 'rate_limit';
            } else if (providerError.message?.includes('401') || providerError.message?.includes('403')) {
              status = 'auth_error';
            }
            
            // Log failed run after all retries
            await supabase
              .from('prompt_runs')
              .insert({
                prompt_id: promptId,
                provider_id: provider.id,
                status,
                token_in: 0,
                token_out: 0,
                cost_est: 0
              });
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    }

    return { success: true, runsCreated };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Brand matching functions (inline)
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOrgBrand(token: string, catalog: Array<{ name: string; variants_json: string[] }>): boolean {
  const normalizedToken = normalize(token);
  
  if (normalizedToken.length < 4) {
    return false;
  }

  for (const brand of catalog) {
    const normalizedBrandName = normalize(brand.name);
    
    if (normalizedToken === normalizedBrandName) {
      return true;
    }
    
    if (normalizedBrandName.length >= 4) {
      if (normalizedToken.startsWith(normalizedBrandName) || 
          normalizedToken.includes(normalizedBrandName)) {
        return true;
      }
    }

    for (const variant of brand.variants_json || []) {
      const normalizedVariant = normalize(variant);
      
      if (normalizedToken === normalizedVariant) {
        return true;
      }
      
      if (normalizedVariant.length >= 4) {
        if (normalizedToken.startsWith(normalizedVariant) || 
            normalizedToken.includes(normalizedVariant)) {
          return true;
        }
      }
    }
  }

  return false;
}

function computeScore(
  orgPresent: boolean, 
  prominenceIdx: number | null, 
  competitorsCount: number
): number {
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

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

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
  const models = [
    'sonar-pro',
    'sonar', 
    'llama-3.1-sonar-small-128k-online',
    'llama-3.1-8b-instruct'
  ];

  let lastError: any = null;
  
  for (const model of models) {
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
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
            max_tokens: 1000,
            stream: false,
            return_images: false,
            return_related_questions: false,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`Perplexity ${model} error: ${response.status} - ${errorText}`);
          
          // Don't retry on auth/bad request errors
          if (response.status === 401 || response.status === 403 || response.status === 400) {
            throw error;
          }
          
          throw error;
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
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
        
      } catch (error: any) {
        attempt++;
        lastError = error;
        
        // Don't retry on auth errors
        if (error.message?.includes('401') || error.message?.includes('403')) {
          break;
        }
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  throw lastError || new Error('All Perplexity models failed');
}