import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { promptId, orgId } = await req.json();

    if (!promptId || !orgId) {
      return new Response(JSON.stringify({ error: 'Missing promptId or orgId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify prompt belongs to org
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', promptId)
      .eq('org_id', orgId)
      .single();

    if (promptError || !prompt) {
      return new Response(JSON.stringify({ error: 'Prompt not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Running prompt ${promptId} for org ${orgId}`);
    
    const result = await runPrompt(promptId, orgId, supabase, openaiKey, perplexityKey);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in run-prompt-now function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Internal server error',
      runsCreated: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function runPrompt(promptId: string, orgId: string, supabase: any, openaiKey?: string, perplexityKey?: string) {
  try {
    // Fetch prompt, organization, and enabled providers
    const [promptResult, orgResult, providersResult] = await Promise.all([
      supabase.from('prompts').select('text, active').eq('id', promptId).single(),
      supabase.from('organizations').select('plan_tier').eq('id', orgId).single(),
      supabase.from('llm_providers').select('id, name').eq('enabled', true)
    ]);

    if (promptResult.error || !promptResult.data) {
      throw new Error('Prompt not found');
    }

    if (orgResult.error || !orgResult.data) {
      throw new Error('Organization not found');
    }

    const prompt = promptResult.data;
    const org = orgResult.data;
    const enabledProviders = providersResult.data || [];

    if (!prompt.active) {
      throw new Error('Prompt is not active');
    }

    // Check quotas
    const quotas = getQuotasForTier(org.plan_tier);
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayRuns } = await supabase
      .from('prompt_runs')
      .select('id')
      .in('prompt_id', [promptId])
      .gte('run_at', `${today}T00:00:00Z`)
      .lt('run_at', `${today}T23:59:59Z`);

    if (todayRuns && todayRuns.length >= quotas.promptsPerDay) {
      return {
        success: false,
        error: 'Daily quota exceeded',
        runsCreated: 0
      };
    }

    // Load brand catalog
    const { data: brands } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', orgId);

    const brandCatalog = brands || [];

    let runsCreated = 0;
    const providersToUse = enabledProviders.slice(0, quotas.providersPerPrompt);

    // Run prompt against each enabled provider
    for (const provider of providersToUse) {
      try {
        console.log(`Running prompt with provider: ${provider.name}`);
        
        let extractedBrands = [];
        
        if (provider.name === 'openai' && openaiKey) {
          extractedBrands = await extractBrandsOpenAI(prompt.text, openaiKey);
        } else if (provider.name === 'perplexity' && perplexityKey) {
          extractedBrands = await extractBrandsPerplexity(prompt.text, perplexityKey);
        } else {
          console.warn(`No API key available for provider: ${provider.name}`);
          continue;
        }

        // Normalize and analyze brands
        const normalizedBrands = extractedBrands.map(brand => normalize(brand));
        const orgBrandPresent = normalizedBrands.some(brand => isOrgBrand(brand, brandCatalog));
        const orgBrandIndex = normalizedBrands.findIndex(brand => isOrgBrand(brand, brandCatalog));
        const competitorsCount = normalizedBrands.filter(brand => !isOrgBrand(brand, brandCatalog)).length;
        
        const score = computeScore(orgBrandPresent, orgBrandIndex >= 0 ? orgBrandIndex : null, competitorsCount);

        // Insert prompt run
        const { data: promptRun, error: runError } = await supabase
          .from('prompt_runs')
          .insert({
            prompt_id: promptId,
            provider_id: provider.id,
            status: 'success',
            run_at: new Date().toISOString(),
            token_in: Math.floor(prompt.text.length / 4), // Rough estimate
            token_out: Math.floor(extractedBrands.join(' ').length / 4),
            cost_est: 0.001 // Rough estimate
          })
          .select('id')
          .single();

        if (runError) {
          console.error('Error inserting prompt run:', runError);
          continue;
        }

        // Insert visibility results
        const { error: resultError } = await supabase
          .from('visibility_results')
          .insert({
            prompt_run_id: promptRun.id,
            score,
            org_brand_present: orgBrandPresent,
            org_brand_prominence: orgBrandIndex >= 0 ? orgBrandIndex : null,
            competitors_count: competitorsCount,
            brands_json: extractedBrands,
            raw_evidence: extractedBrands.join(', ')
          });

        if (resultError) {
          console.error('Error inserting visibility result:', resultError);
        } else {
          runsCreated++;
        }

      } catch (providerError) {
        console.error(`Error running provider ${provider.name}:`, providerError);
        
        // Insert failed run
        await supabase
          .from('prompt_runs')
          .insert({
            prompt_id: promptId,
            provider_id: provider.id,
            status: 'error',
            run_at: new Date().toISOString(),
            token_in: 0,
            token_out: 0,
            cost_est: 0
          });
      }
    }

    return {
      success: true,
      runsCreated,
      error: null
    };

  } catch (error) {
    console.error('Error in runPrompt:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      runsCreated: 0
    };
  }
}

function getQuotasForTier(planTier: string) {
  const quotas = {
    'free': { promptsPerDay: 10, providersPerPrompt: 1 },
    'pro': { promptsPerDay: 100, providersPerPrompt: 2 },
    'enterprise': { promptsPerDay: 1000, providersPerPrompt: 3 }
  };
  
  return quotas[planTier as keyof typeof quotas] || quotas.free;
}

function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/[^\w\s]/g, '');
}

function isOrgBrand(token: string, catalog: Array<{ name: string; variants_json: string[] }>): boolean {
  const normalizedToken = normalize(token);
  
  for (const brand of catalog) {
    if (normalize(brand.name) === normalizedToken) {
      return true;
    }
    
    const variants = Array.isArray(brand.variants_json) ? brand.variants_json : [];
    for (const variant of variants) {
      if (normalize(variant) === normalizedToken) {
        return true;
      }
    }
  }
  
  return false;
}

function computeScore(orgPresent: boolean, prominenceIdx: number | null, competitorsCount: number): number {
  if (!orgPresent) return 1;
  
  let score = 5;
  
  // Prominence bonus (earlier = better)
  if (prominenceIdx !== null) {
    if (prominenceIdx === 0) score += 3;
    else if (prominenceIdx <= 2) score += 2;
    else if (prominenceIdx <= 5) score += 1;
  }
  
  // Competitor penalty
  if (competitorsCount > 5) score -= 2;
  else if (competitorsCount > 2) score -= 1;
  
  return Math.max(1, Math.min(10, score));
}

async function extractBrandsOpenAI(promptText: string, apiKey: string): Promise<string[]> {
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
          content: 'You are a search engine. Provide realistic search results for the given query, then extract all brand names and company names that would appear in those results. Focus on actual brands that would be mentioned in real search results, not just category leaders. Return only the brand names, one per line, without additional text.'
        },
        {
          role: 'user',
          content: `Search for: "${promptText}". First, simulate what the actual search results would look like, then extract all brand names that appear in those results. Include specific product names, company names, and service brands that would realistically appear.`
        }
      ],
      max_tokens: 300,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content || '';
  
  // Extract only lines that look like brand names (filter out search result text)
  const lines = content.split('\n').map(line => line.trim());
  const brandLines = lines.filter(line => {
    // Skip empty lines, explanatory text, or lines with common search result patterns
    if (!line || line.length < 2) return false;
    if (line.includes('Search results:') || line.includes('Results for:')) return false;
    if (line.includes('http') || line.includes('www.')) return false;
    if (line.length > 50) return false; // Skip long descriptions
    if (line.includes('...') || line.includes('search') || line.includes('results')) return false;
    
    // Accept lines that look like brand names
    return /^[A-Za-z0-9\s&\-\.]{2,30}$/.test(line) && !line.includes('  ');
  });
  
  return brandLines.slice(0, 10);
}

async function extractBrandsPerplexity(promptText: string, apiKey: string): Promise<string[]> {
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
          content: 'You have access to real-time search. When given a search query, perform the search and extract all brand names and company names that appear in the actual search results. Return only the brand names, one per line, without additional explanatory text.'
        },
        {
          role: 'user',
          content: `Search for: "${promptText}". Extract all brand names that appear in the search results.`
        }
      ],
      max_tokens: 300,
      temperature: 0.1,
      return_images: false,
      return_related_questions: false,
      search_recency_filter: 'month'
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content || '';
  
  // Extract only lines that look like brand names
  const lines = content.split('\n').map(line => line.trim());
  const brandLines = lines.filter(line => {
    // Skip empty lines, explanatory text, or search result metadata
    if (!line || line.length < 2) return false;
    if (line.includes('Based on') || line.includes('According to') || line.includes('Search results')) return false;
    if (line.includes('http') || line.includes('www.') || line.includes('.com')) return false;
    if (line.length > 40) return false; // Skip long descriptions
    if (line.includes('search') || line.includes('results') || line.includes('include')) return false;
    
    // Accept lines that look like brand names
    return /^[A-Za-z0-9\s&\-\.]{2,25}$/.test(line) && !line.includes('  ');
  });
  
  return brandLines.slice(0, 10);
}