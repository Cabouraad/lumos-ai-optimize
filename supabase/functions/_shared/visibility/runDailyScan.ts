import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Brand normalization functions
function normalize(brand: string): string {
  return brand.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isOrgBrand(brand: string, brandCatalog: any[]): boolean {
  const normalizedBrand = normalize(brand);
  
  return brandCatalog.some(orgBrand => {
    // Check main brand name
    if (normalize(orgBrand.name) === normalizedBrand) return true;
    
    // Check variants
    const variants = Array.isArray(orgBrand.variants_json) 
      ? orgBrand.variants_json 
      : [];
    
    return variants.some((variant: string) => 
      normalize(variant) === normalizedBrand
    );
  });
}

// Scoring function
function computeScore(orgPresent: boolean, orgBrandIdx: number | null, competitorsCount: number): number {
  if (!orgPresent) return Math.max(0, 5 - competitorsCount * 0.5);
  
  const positionPenalty = orgBrandIdx ? Math.min(orgBrandIdx * 0.8, 3) : 0;
  const competitorPenalty = Math.min(competitorsCount * 0.3, 2);
  
  return Math.max(0, Math.min(10, 10 - positionPenalty - competitorPenalty));
}

// Provider extraction functions
async function extractBrandsOpenAI(promptText: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract brand/company names from AI responses. Return only a JSON array of strings, no other text. Example: ["Brand1", "Brand2"]`
        },
        {
          role: 'user', 
          content: promptText
        }
      ],
      max_tokens: 150,
      temperature: 0.1
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '[]';
  
  try {
    const brands = JSON.parse(content);
    return {
      brands: Array.isArray(brands) ? brands : [],
      tokenIn: data.usage?.prompt_tokens || 0,
      tokenOut: data.usage?.completion_tokens || 0,
    };
  } catch (e) {
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
          content: `Extract brand/company names from AI responses. Return only a JSON array of strings, no other text. Example: ["Brand1", "Brand2"]`
        },
        {
          role: 'user',
          content: promptText
        }
      ],
      max_tokens: 150,
      temperature: 0.1
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '[]';
  
  try {
    const brands = JSON.parse(content);
    return {
      brands: Array.isArray(brands) ? brands : [],
      tokenIn: data.usage?.prompt_tokens || 0,
      tokenOut: data.usage?.completion_tokens || 0,
    };
  } catch (e) {
    return { brands: [], tokenIn: 0, tokenOut: 0 };
  }
}

// Quota configurations
function getQuotasForTier(tier: string) {
  switch (tier) {
    case 'pro':
      return { promptsPerDay: 50, providersPerPrompt: 3 };
    case 'enterprise':
      return { promptsPerDay: 200, providersPerPrompt: 5 };
    default: // free tier
      return { promptsPerDay: 10, providersPerPrompt: 2 };
  }
}

export async function runDailyScan(supabase: ReturnType<typeof createClient>) {
  try {
    console.log('Starting daily scan...');
    
    // Get API keys from environment
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiKey && !perplexityKey) {
      console.log('No API keys configured, skipping scan');
      return { success: false, error: 'No API keys configured' };
    }

    // Get all organizations with active prompts
    const { data: organizations } = await supabase
      .from('organizations')
      .select(`
        id, 
        name, 
        plan_tier,
        brand_catalog!inner(name, variants_json)
      `);

    if (!organizations?.length) {
      console.log('No organizations found');
      return { success: true, organizations: 0, totalRuns: 0 };
    }

    // Get enabled providers
    const { data: providers } = await supabase
      .from('llm_providers')
      .select('*')
      .eq('enabled', true)
      .order('name');

    if (!providers?.length) {
      console.log('No enabled providers');
      return { success: false, error: 'No enabled providers' };
    }

    let totalRuns = 0;
    let successfulRuns = 0;

    // Process each organization
    for (const org of organizations) {
      try {
        console.log(`Processing org: ${org.name}`);
        
        const quotas = getQuotasForTier(org.plan_tier);
        
        // Get active prompts for this organization
        const { data: prompts } = await supabase
          .from('prompts')
          .select('id, text')
          .eq('org_id', org.id)
          .eq('active', true)
          .limit(quotas.promptsPerDay);

        if (!prompts?.length) {
          console.log(`No active prompts for ${org.name}`);
          continue;
        }

        console.log(`Found ${prompts.length} active prompts for ${org.name}`);

        // Check today's runs to respect quotas
        const today = new Date().toISOString().split('T')[0];
        const { data: todayRuns } = await supabase
          .from('prompt_runs')
          .select('id')
          .gte('run_at', `${today}T00:00:00Z`)
          .lt('run_at', `${today}T23:59:59Z`)
          .in('prompt_id', prompts.map(p => p.id));

        if (todayRuns && todayRuns.length >= quotas.promptsPerDay) {
          console.log(`Daily quota exceeded for ${org.name}`);
          continue;
        }

        // Process each prompt
        for (const prompt of prompts) {
          const remainingQuota = quotas.promptsPerDay - (todayRuns?.length || 0);
          if (remainingQuota <= 0) break;

          // Process providers for this prompt
          for (const provider of providers.slice(0, quotas.providersPerPrompt)) {
            try {
              totalRuns++;

              // Check caching rule: if last 3 runs had same brand set, skip
              const { data: recentRuns } = await supabase
                .from('prompt_runs')
                .select(`
                  id,
                  visibility_results (brands_json)
                `)
                .eq('prompt_id', prompt.id)
                .eq('provider_id', provider.id)
                .eq('status', 'success')
                .order('run_at', { ascending: false })
                .limit(3);

              if (recentRuns && recentRuns.length === 3) {
                const brandSets = recentRuns.map(run => 
                  JSON.stringify((run.visibility_results as any)[0]?.brands_json || [])
                ).sort();
                
                if (brandSets[0] === brandSets[1] && brandSets[1] === brandSets[2]) {
                  // Use cached result
                  const lastResult = recentRuns[0].visibility_results as any;
                  if (lastResult && lastResult[0]) {
                    const { data: cachedRun } = await supabase
                      .from('prompt_runs')
                      .insert({
                        prompt_id: prompt.id,
                        provider_id: provider.id,
                        status: 'success',
                        token_in: 0,
                        token_out: 0,
                        cost_est: 0
                      })
                      .select()
                      .single();

                    if (cachedRun) {
                      await supabase
                        .from('visibility_results')
                        .insert({
                          prompt_run_id: cachedRun.id,
                          org_brand_present: lastResult[0].org_brand_present,
                          org_brand_prominence: lastResult[0].org_brand_prominence,
                          brands_json: lastResult[0].brands_json,
                          competitors_count: lastResult[0].competitors_count,
                          raw_evidence: 'Cached result',
                          score: lastResult[0].score
                        });
                      successfulRuns++;
                      console.log(`Used cached result for prompt ${prompt.id} on ${provider.name}`);
                    }
                    continue;
                  }
                }
              }

              // Extract brands from provider
              let extraction;
              if (provider.name === 'openai' && openaiKey) {
                extraction = await extractBrandsOpenAI(prompt.text, openaiKey);
              } else if (provider.name === 'perplexity' && perplexityKey) {
                extraction = await extractBrandsPerplexity(prompt.text, perplexityKey);
              } else {
                continue; // Skip if no API key
              }

              // Normalize and analyze brands
              const normalizedBrands = extraction.brands.map(normalize);
              const orgBrands = normalizedBrands.filter(brand => 
                isOrgBrand(brand, org.brand_catalog)
              );
              
              const orgPresent = orgBrands.length > 0;
              const orgBrandIdx = orgPresent ? normalizedBrands.findIndex(brand => 
                isOrgBrand(brand, org.brand_catalog)
              ) : null;
              
              const competitorsCount = normalizedBrands.length - orgBrands.length;
              const score = computeScore(orgPresent, orgBrandIdx, competitorsCount);

              // Insert prompt_runs
              const { data: newRun } = await supabase
                .from('prompt_runs')
                .insert({
                  prompt_id: prompt.id,
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
                
                successfulRuns++;
                console.log(`Successfully processed prompt ${prompt.id} on ${provider.name}`);
              }

              // Small delay to prevent rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (providerError) {
              console.error(`Provider ${provider.name} error for prompt ${prompt.id}:`, providerError);
              
              // Log failed run
              await supabase
                .from('prompt_runs')
                .insert({
                  prompt_id: prompt.id,
                  provider_id: provider.id,
                  status: 'error',
                  token_in: 0,
                  token_out: 0,
                  cost_est: 0
                });
            }
          }
        }

      } catch (orgError) {
        console.error(`Error processing org ${org.id}:`, orgError);
      }
    }

    const result = {
      success: true,
      organizations: organizations.length,
      totalRuns,
      successfulRuns,
      timestamp: new Date().toISOString()
    };

    console.log('Daily scan completed:', result);
    return result;

  } catch (error) {
    console.error('Daily scan error:', error);
    return { success: false, error: error.message };
  }
}