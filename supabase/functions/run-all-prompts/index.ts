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
        // Execute prompt based on provider with enhanced brand extraction
        let brandAnalysis;
        switch (provider.name) {
          case 'openai':
            brandAnalysis = await extractBrandsOpenAI(prompt.text);
            break;
          case 'perplexity':
            brandAnalysis = await extractBrandsPerplexity(prompt.text);
            break;
          case 'gemini':
            brandAnalysis = await extractBrandsGemini(prompt.text);
            break;
          default:
            console.log(`Unknown provider: ${provider.name}`);
            continue;
        }

        if (!brandAnalysis) continue;

        // Get organization's brand catalog for proper identification
        const { data: brandCatalog } = await supabase
          .from('brand_catalog')
          .select('name, variants_json, is_org_brand')
          .eq('org_id', org.id);

        // Classify brands as org brands vs competitors
        const { orgBrands, competitors } = classifyBrands(brandAnalysis.brands, brandCatalog || []);
        
        // Calculate enhanced visibility score
        const score = calculateEnhancedVisibilityScore(orgBrands, competitors, brandAnalysis.responseText);

        // Store run
        const { data: run } = await supabase
          .from('prompt_runs')
          .insert({
            prompt_id: promptId,
            provider_id: provider.id,
            status: 'success',
            token_in: brandAnalysis.tokenIn || 0,
            token_out: brandAnalysis.tokenOut || 0,
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
              brands_json: brandAnalysis.brands,
              score: score.score,
              raw_ai_response: brandAnalysis.responseText,
              raw_evidence: JSON.stringify({ 
                allBrands: brandAnalysis.brands,
                orgBrands,
                competitors,
                analysis: score 
              })
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

// Enhanced provider execution functions with brand extraction
async function extractBrandsOpenAI(promptText: string) {
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
      max_tokens: 1000,
      temperature: 0.7
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

  const data = await response.json();
  const content = data.choices[0].message.content;
  const usage = data.usage || {};

  const brands = extractBrandsFromResponse(content);

  return {
    brands,
    responseText: content,
    tokenIn: usage.prompt_tokens || 0,
    tokenOut: usage.completion_tokens || 0,
  };
}

async function extractBrandsPerplexity(promptText: string) {
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
      messages: [
        {
          role: 'user',
          content: promptText + '\n\nAfter your response, include a JSON object with a single key "brands" containing an array of brand or company names you mentioned.'
        }
      ],
      max_tokens: 1000,
      temperature: 0.2
    }),
  });

  if (!response.ok) throw new Error(`Perplexity API error: ${response.status}`);

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  const brands = extractBrandsFromResponse(content);

  return {
    brands,
    responseText: content,
    tokenIn: 0,
    tokenOut: 0
  };
}

async function extractBrandsGemini(promptText: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not found');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: promptText + '\n\nAfter your response, include a JSON object with a single key "brands" containing an array of brand or company names you mentioned.'
        }]
      }]
    }),
  });

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  const brands = extractBrandsFromResponse(content);

  return {
    brands,
    responseText: content,
    tokenIn: 0,
    tokenOut: 0
  };
}

// Shared utility functions
function extractBrandsFromResponse(text: string): string[] {
  const jsonMatch = text.match(/\{[^}]*"brands"[^}]*\}/);
  let brands: string[] = [];
  
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      brands = Array.isArray(parsed.brands) ? parsed.brands : [];
    } catch {
      // JSON parsing failed
    }
  }
  
  if (brands.length === 0) {
    brands = extractBrandsFromText(text);
  }
  
  return brands;
}

function extractBrandsFromText(text: string): string[] {
  const brandPatterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    /\b[A-Z][a-z]{2,}\b/g,
  ];
  
  const brands = new Set<string>();
  
  for (const pattern of brandPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (!isCommonWord(match) && match.length > 2) {
          brands.add(match);
        }
      });
    }
  }
  
  return Array.from(brands).slice(0, 15);
}

function isCommonWord(word: string): boolean {
  const commonWords = [
    'The', 'This', 'That', 'Here', 'There', 'When', 'Where', 'What', 'How',
    'Some', 'Many', 'Most', 'All', 'Best', 'Good', 'Better', 'Great',
    'First', 'Last', 'Next', 'New', 'Old', 'Other', 'Another', 'Each', 'Every'
  ];
  return commonWords.includes(word);
}

function classifyBrands(extractedBrands: string[], brandCatalog: any[]) {
  const orgBrands: string[] = [];
  const competitors: string[] = [];
  
  for (const brand of extractedBrands) {
    const normalizedBrand = normalize(brand);
    
    const isOrgBrand = brandCatalog.some(catalogBrand => {
      if (catalogBrand.is_org_brand) {
        const normalizedCatalogBrand = normalize(catalogBrand.name);
        
        if (normalizedBrand === normalizedCatalogBrand) return true;
        if (normalizedBrand.includes(normalizedCatalogBrand)) return true;
        
        for (const variant of catalogBrand.variants_json || []) {
          const normalizedVariant = normalize(variant);
          if (normalizedBrand === normalizedVariant || normalizedBrand.includes(normalizedVariant)) {
            return true;
          }
        }
      }
      return false;
    });
    
    if (isOrgBrand) {
      orgBrands.push(brand);
    } else {
      competitors.push(brand);
    }
  }
  
  return { orgBrands, competitors };
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateEnhancedVisibilityScore(orgBrands: string[], competitors: string[], responseText: string) {
  const orgBrandPresent = orgBrands.length > 0;
  const competitorCount = competitors.length;
  
  let brandPosition = null;
  if (orgBrandPresent) {
    const responseWords = responseText.toLowerCase().split(/\s+/);
    for (const orgBrand of orgBrands) {
      const brandWords = orgBrand.toLowerCase().split(/\s+/);
      for (let i = 0; i <= responseWords.length - brandWords.length; i++) {
        const match = brandWords.every((word, index) => 
          responseWords[i + index]?.includes(word.substring(0, Math.min(word.length, 4)))
        );
        if (match) {
          brandPosition = i;
          break;
        }
      }
      if (brandPosition !== null) break;
    }
  }
  
  let score = 0;
  
  if (orgBrandPresent) {
    score = 5;
    
    if (brandPosition !== null) {
      const positionBonus = Math.max(0, 3 - Math.floor(brandPosition / 10));
      score += positionBonus;
    }
    
    const competitorPenalty = Math.min(3, competitorCount * 0.5);
    score -= competitorPenalty;
    
    score = Math.max(1, score);
  }
  
  score = Math.min(10, Math.round(score));
  
  return {
    brandPresent: orgBrandPresent,
    brandPosition,
    competitorCount,
    score
  };
}