import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractArtifacts, createBrandGazetteer } from './extractArtifacts.ts';

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
          content: 'You are a helpful AI assistant. Answer the user\'s question comprehensively and naturally. After your response, include a JSON object with a single key "brands" containing an array of brand or company names you mentioned in your answer.'
        },
        {
          role: 'user', 
          content: promptText
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  // Try to extract JSON from the end of the response
  const jsonMatch = content.match(/\{[^}]*"brands"[^}]*\}/);
  let brands: string[] = [];
  
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      brands = Array.isArray(parsed.brands) ? parsed.brands : [];
    } catch {
      // If JSON parsing fails, extract brands from text content
      brands = extractBrandsFromText(content);
    }
  } else {
    // No JSON found, extract from text
    brands = extractBrandsFromText(content);
  }
  
  return {
    brands,
    responseText: content,
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0,
  };
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
                content: 'You are a helpful AI assistant. Answer the user\'s question comprehensively with web search. After your response, include a JSON object with a single key "brands" containing an array of brand or company names you mentioned.'
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
        
        // Try to extract JSON from the end of the response
        const jsonMatch = content.match(/\{[^}]*"brands"[^}]*\}/);
        let brands: string[] = [];
        
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            brands = Array.isArray(parsed.brands) ? parsed.brands : [];
          } catch {
            // If JSON parsing fails, extract brands from text content
            brands = extractBrandsFromText(content);
          }
        } else {
          // No JSON found, extract from text
          brands = extractBrandsFromText(content);
        }
        
        return {
          brands,
          responseText: content,
          tokenIn: data.usage?.prompt_tokens || 0,
          tokenOut: data.usage?.completion_tokens || 0,
        };
        
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

// Fallback brand extraction from text content
function extractBrandsFromText(text: string): string[] {
  const brandPatterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Two-word brands like "Google Cloud"
    /\b[A-Z][a-z]{2,}\b/g, // Single capitalized words like "Apple"
  ];
  
  const brands = new Set<string>();
  
  for (const pattern of brandPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (!isCommonWord(match)) {
          brands.add(match);
        }
      });
    }
  }
  
  return Array.from(brands);
}

function isCommonWord(word: string): boolean {
  const commonWords = [
    'The', 'This', 'That', 'Here', 'There', 'When', 'Where', 'What', 'How',
    'Some', 'Many', 'Most', 'All', 'Best', 'Good', 'Better', 'Great',
    'First', 'Last', 'Next', 'New', 'Old', 'Other', 'Another'
  ];
  return commonWords.includes(word);
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
        
        // Create brand gazetteer and user brand norms for artifact extraction
        const brandGazetteer = createBrandGazetteer(org.brand_catalog);
        const userBrandNorms = org.brand_catalog.map((brand: any) => normalize(brand.name));
        
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
                        cost_est: 0,
                        citations: [],
                        brands: [],
                        competitors: []
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

              // Extract structured artifacts from the full response
              const artifacts = extractArtifacts(extraction.responseText || '', userBrandNorms, brandGazetteer);

              // Normalize and analyze brands (keep existing logic for compatibility)
              // Use enhanced competitor detection from artifacts
              const orgPresent = artifacts.brands.length > 0;
              const orgBrandIdx = orgPresent ? 0 : null; // First org brand position in artifacts
              
              // Get the actual competitor count from enhanced analysis
              const competitorsCount = artifacts.competitors.length;
              const score = computeScore(orgPresent, orgBrandIdx, competitorsCount);

              // Insert prompt_runs with structured artifacts
              const { data: newRun } = await supabase
                .from('prompt_runs')
                .insert({
                  prompt_id: prompt.id,
                  provider_id: provider.id,
                  status: 'success',
                  token_in: extraction.tokenIn,
                  token_out: extraction.tokenOut,
                  cost_est: 0,
                  citations: artifacts.citations,
                  brands: artifacts.brands,
                  competitors: artifacts.competitors
                })
                .select()
                .single();

              if (newRun) {
                  // Insert visibility_results using enhanced competitor analysis
                await supabase
                  .from('visibility_results')
                  .insert({
                    prompt_run_id: newRun.id,
                    org_brand_present: orgPresent,
                    org_brand_prominence: orgBrandIdx ?? 0,
                    brands_json: [...artifacts.brands.map(b => b.name), ...artifacts.competitors.map(c => c.name)],
                    competitors_count: competitorsCount,
                    raw_evidence: JSON.stringify({ 
                      userBrands: artifacts.brands,
                      competitors: artifacts.competitors,
                      citations: artifacts.citations,
                      metadata: artifacts.metadata,
                      fullResponse: extraction.responseText || ''
                    }),
                    score: score,
                    raw_ai_response: extraction.responseText || ''
                  });
                
                successfulRuns++;
                console.log(`Successfully processed prompt ${prompt.id} on ${provider.name}`);
              }

              // Small delay to prevent rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (providerError: any) {
              console.error(`Provider ${provider.name} error for prompt ${prompt.id}:`, providerError);
              
              // Determine error status
              let status = 'error';
              if (providerError.message?.includes('429')) {
                status = 'rate_limit';
              } else if (providerError.message?.includes('401') || providerError.message?.includes('403')) {
                status = 'auth_error';
              } else if (providerError.message?.includes('timeout')) {
                status = 'timeout';
              }
              
              // Log failed run with empty artifacts
              await supabase
                .from('prompt_runs')
                .insert({
                  prompt_id: prompt.id,
                  provider_id: provider.id,
                  status,
                  token_in: 0,
                  token_out: 0,
                  cost_est: 0,
                  citations: [],
                  brands: [],
                  competitors: []
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