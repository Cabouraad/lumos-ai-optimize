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
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

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
    
    const result = await runPrompt(promptId, orgId, supabase, openaiKey, perplexityKey, geminiKey);
    
    // Auto-generate recommendations if prompt runs were successful
    if (result.success && result.runsCreated > 0) {
      try {
        await generateRecommendations(orgId, supabase);
      } catch (error) {
        console.log('Failed to auto-generate recommendations:', error);
        // Don't fail the prompt run if recommendations fail
      }
    }
    
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

async function runPrompt(promptId: string, orgId: string, supabase: any, openaiKey?: string, perplexityKey?: string, geminiKey?: string) {
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
    const providersToUse = enabledProviders.filter((p: any) =>
      (p.name === 'openai' && !!openaiKey) || 
      (p.name === 'perplexity' && !!perplexityKey) ||
      (p.name === 'gemini' && !!geminiKey)
    );

    // Run prompt against each enabled provider
    for (const provider of providersToUse) {
      try {
        console.log(`Running prompt with provider: ${provider.name} (ID: ${provider.id})`);
        
        let extractedBrands = {};
        
        if (provider.name === 'openai' && openaiKey) {
          console.log('Calling OpenAI API...');
          extractedBrands = await extractBrandsOpenAI(prompt.text, openaiKey);
          console.log('OpenAI response received:', extractedBrands.rawResponse ? 'Yes' : 'No');
        } else if (provider.name === 'perplexity' && perplexityKey) {
          console.log('Calling Perplexity API...');
          extractedBrands = await extractBrandsPerplexity(prompt.text, perplexityKey);
          console.log('Perplexity response received:', extractedBrands.rawResponse ? 'Yes' : 'No');
        } else if (provider.name === 'gemini' && geminiKey) {
          console.log('Calling Gemini API...');
          extractedBrands = await extractBrandsGemini(prompt.text, geminiKey);
          console.log('Gemini response received:', extractedBrands.rawResponse ? 'Yes' : 'No');
        } else {
          console.warn(`No API key available for provider: ${provider.name}`);
          continue;
        }

        // Handle the new response format
        const brands = extractedBrands.brands || [];
        const rawResponse = extractedBrands.rawResponse || '';
        const normalizedBrands = brands.map(brand => normalize(brand));
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
            token_out: Math.floor(brands.join(' ').length / 4),
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
            brands_json: brands,
            raw_evidence: brands.join(', '),
            raw_ai_response: rawResponse
          });

        if (resultError) {
          console.error('Error inserting visibility result:', resultError);
        } else {
          // Save competitors to permanent catalog using original brand names (not normalized)
          const competitorBrands = brands.filter(brand => !isOrgBrand(normalize(brand), brandCatalog));
          for (const competitorBrand of competitorBrands) {
            try {
              const { error: upsertError } = await supabase.rpc('upsert_competitor_brand', {
                p_org_id: orgId,
                p_brand_name: competitorBrand, // Use original brand name for display
                p_score: score
              });
              if (upsertError) {
                console.error('Error upserting competitor brand:', upsertError);
              }
            } catch (error) {
              console.error('Error calling upsert_competitor_brand:', error);
            }
          }
          runsCreated++;
        }

      } catch (providerError: any) {
        console.error(`Error running provider ${provider.name}:`, providerError);
        
        // Determine error status
        let status = 'error';
        if (providerError.message?.includes('429')) {
          status = 'rate_limit';
        } else if (providerError.message?.includes('401') || providerError.message?.includes('403')) {
          status = 'auth_error';
        } else if (providerError.message?.includes('timeout')) {
          status = 'timeout';
        }
        
        // Insert failed run
        await supabase
          .from('prompt_runs')
          .insert({
            prompt_id: promptId,
            provider_id: provider.id,
            status,
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
  
  let score = 6; // Base score when org brand is present
  
  // Prominence bonus (earlier = better)
  if (prominenceIdx !== null) {
    if (prominenceIdx === 0) score += 3; // First position gets big bonus
    else if (prominenceIdx <= 2) score += 2; // Top 3 gets good bonus
    else if (prominenceIdx <= 5) score += 1; // Top 6 gets small bonus
  }
  
  // Competitor penalty (more competitors = lower visibility)
  if (competitorsCount > 8) score -= 2;
  else if (competitorsCount > 4) score -= 1;
  
  return Math.max(1, Math.min(10, score));
}

async function extractBrandsOpenAI(promptText: string, apiKey: string): Promise<any> {
  // First, get the actual AI response to the prompt
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
          role: 'user',
          content: promptText
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content || '';
  
  // Store the raw response for evidence
  console.log('OpenAI Response:', aiResponse.substring(0, 200) + '...');

  // Now extract brands from the actual AI response
  const extractResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
          content: 'Extract all brand names, company names, product names, and service names that are specifically mentioned in the provided text. Return only the names, one per line, without explanations. Focus on actual brands mentioned, not generic categories.'
        },
        {
          role: 'user',
          content: `Extract all brand names from this AI response:\n\n${aiResponse}`
        }
      ],
      max_tokens: 300,
      temperature: 0.1,
    }),
  });

  if (!extractResponse.ok) {
    throw new Error(`OpenAI extraction error: ${extractResponse.statusText}`);
  }

  const extractData = await extractResponse.json();
  const extractedContent = extractData.choices[0].message.content || '';
  
  // Extract and clean brand names
  let brands = extractedContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      // Filter out empty lines, numbers, and obvious non-brand text
      if (!line || line.length < 2) return false;
      if (/^\d+\.?\s*$/.test(line)) return false;
      if (line.includes('http') || line.includes('www.')) return false;
      if (line.length > 40) return false;
      
      // Exclude AI tools and common non-competitor brands
      const excludedBrands = [
        'openai', 'claude', 'copilot', 'google', 'chatgpt', 'gpt', 'ai', 'artificial intelligence', 
        'microsoft', 'apple', 'facebook', 'meta', 'twitter', 'linkedin', 'instagram', 'youtube',
        'amazon', 'aws', 'azure', 'github', 'stackoverflow', 'reddit', 'wikipedia', 'bing',
        'search', 'engine', 'platform', 'tool', 'software', 'app', 'website', 'service',
        'technology', 'digital', 'online', 'internet', 'web', 'cloud', 'data', 'analytics'
      ];
      const lowerLine = line.toLowerCase();
      if (excludedBrands.some(excluded => lowerLine.includes(excluded))) return false;
      
      return /^[A-Za-z0-9\s&\-\.\(\)\/]{2,35}$/.test(line);
    })
    .slice(0, 12);

  // Keep only brands that actually appear in the AI response text (case-insensitive, punctuation-insensitive, word-boundary aware)
  const normalizedText = aiResponse.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  brands = brands.filter((b: string) => {
    const nb = b.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!nb) return false;
    const pattern = new RegExp(`(?:^|\\s)${nb.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s|$)`);
    return pattern.test(normalizedText);
  });

  // Return both the brands and the raw response
  return {
    brands: brands,
    rawResponse: aiResponse
  };
}

async function extractBrandsPerplexity(promptText: string, apiKey: string): Promise<any> {
  const endpoint = 'https://api.perplexity.ai/chat/completions';
  // Use official model as per documentation
  const model = 'sonar';

  async function callPerplexity(messages: any[], maxAttempts: number = 3) {
    // Use exact payload structure from Perplexity documentation
    const payload = {
      model,
      messages
    };

    let attempt = 0;
    
    while (attempt < maxAttempts) {
      try {
        console.log(`[Perplexity] Trying model: ${model}, attempt ${attempt + 1}`);
        
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const bodyText = await res.text().catch(() => '');
          console.error(`[Perplexity] Model ${model} failed: ${res.status} ${res.statusText} — Body: ${bodyText?.slice(0, 500)}`);
          throw new Error(`Perplexity ${model} error: ${res.status} ${res.statusText} — ${bodyText}`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content ?? '';
        return { content, modelUsed: model };
        
      } catch (error: any) {
        attempt++;
        if (error.message?.includes('401') || error.message?.includes('403')) {
          throw error; // Don't retry auth errors
        }
        
        if (attempt >= maxAttempts) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // 1) Get the raw AI response with retry logic
  let aiResponse = '';
  let modelUsed = '';
  
  try {
    const result = await callPerplexity([
      { role: 'user', content: promptText }
    ]);
    
    aiResponse = result.content;
    modelUsed = result.modelUsed;
  } catch (error: any) {
    console.error(`[Perplexity] Failed to get AI response:`, error.message);
    throw error;
  }

  if (!aiResponse) {
    throw lastError || new Error('Perplexity error: all models failed');
  }

  console.log(`[Perplexity] Success with model ${modelUsed}:`, aiResponse.substring(0, 200) + '...');

  // 2) Try to extract brands; never fail the whole provider if extraction fails
  let brands: string[] = [];
  try {
    const { content: extraction } = await callPerplexity([
      {
        role: 'system',
        content: 'Extract brand/company/product/service names mentioned in the provided text. Return only the names, one per line, no numbering, no explanations.'
      },
      { role: 'user', content: `Text to extract from:\n\n${aiResponse}` }
    ], modelUsed, 300);

    brands = extraction
      .split('\n')
      .map((l: string) => l.trim())
      .filter((line: string) => {
        if (!line || line.length < 2) return false;
        if (/^\d+\.?\s*$/.test(line)) return false;
        if (line.includes('http') || line.includes('www.') || line.includes('.com')) return false;
        if (line.toLowerCase().includes('text to extract')) return false;
        if (line.length > 40) return false;
        const excluded = [
          'openai','claude','copilot','google','chatgpt','gpt','ai','artificial intelligence',
          'microsoft','apple','facebook','meta','twitter','linkedin','instagram','youtube',
          'amazon','aws','azure','github','stackoverflow','reddit','wikipedia','bing',
          'search','engine','platform','tool','software','app','website','service',
          'technology','digital','online','internet','web','cloud','data','analytics'
        ];
        const lower = line.toLowerCase();
        if (excluded.some(e => lower.includes(e))) return false;
        return /^[A-Za-z0-9\s&\-\.\(\)\/]{2,35}$/.test(line);
      })
      .slice(0, 12);

    // Keep only brands that actually appear in the AI response text (case-insensitive, punctuation-insensitive, word-boundary aware)
    const normalizedText = aiResponse.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    brands = brands.filter((b: string) => {
      const nb = b.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!nb) return false;
      const pattern = new RegExp(`(?:^|\\s)${nb.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s|$)`);
      return pattern.test(normalizedText);
    });
  } catch (extractionError) {
    console.error('[Perplexity] Extraction failed, proceeding with empty brands:', extractionError);
    brands = [];
  }

  return { brands, rawResponse: aiResponse };
}

async function extractBrandsGemini(promptText: string, apiKey: string): Promise<any> {
  const maxAttempts = 3;
  
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt < maxAttempts) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: promptText + '\n\nAfter your response, include a JSON object with a single key "brands" containing an array of brand or company names you mentioned.'
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2000,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        
        // Don't retry on authentication errors
        if (response.status === 401 || response.status === 403) {
          throw error;
        }
        
        // Don't retry on bad request errors
        if (response.status === 400) {
          throw error;
        }
        
        throw error;
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usage = data.usageMetadata || {};

      try {
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
          rawResponse: content,
          tokenIn: usage.promptTokenCount || 0,
          tokenOut: usage.candidatesTokenCount || 0,
        };
        
      } catch (parseError) {
        return { 
          brands: extractBrandsFromText(content), 
          rawResponse: content,
          tokenIn: usage.promptTokenCount || 0,
          tokenOut: usage.candidatesTokenCount || 0
        };
      }
      
    } catch (error: any) {
      attempt++;
      lastError = error;
      
      console.error(`Gemini attempt ${attempt}/${maxAttempts} failed:`, error.message);
      
      // Don't retry on auth errors
      if (error.message?.includes('401') || error.message?.includes('403')) {
        break;
      }
      
      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  // All attempts failed
  throw lastError || new Error('Gemini API failed');
}

/**
 * Fallback brand extraction from text content
 */
function extractBrandsFromText(text: string): string[] {
  // Simple pattern matching for common brand formats
  const brandPatterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Two-word brands like "Google Cloud"
    /\b[A-Z][a-z]{2,}\b/g, // Single capitalized words like "Apple"
  ];
  
  const brands = new Set<string>();
  
  for (const pattern of brandPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Filter out common non-brand words
        if (!isCommonWord(match)) {
          brands.add(match);
        }
      });
    }
  }
  
  return Array.from(brands);
}

/**
 * Check if a word is likely a common non-brand term
 */
function isCommonWord(word: string): boolean {
  const commonWords = [
    'The', 'This', 'That', 'Here', 'There', 'When', 'Where', 'What', 'How',
    'Some', 'Many', 'Most', 'All', 'Best', 'Good', 'Better', 'Great',
    'First', 'Last', 'Next', 'New', 'Old', 'Other', 'Another'
  ];
  return commonWords.includes(word);
}


async function generateRecommendations(orgId: string, supabase: any) {
  try {
    // Get recent visibility results (last 30 days)
    const { data: results } = await supabase
      .from('visibility_results')
      .select(`
        *,
        prompt_runs!inner (
          id,
          prompt_id,
          run_at,
          prompts!inner (
            text,
            org_id
          ),
          llm_providers!inner (
            name
          )
        )
      `)
      .eq('prompt_runs.prompts.org_id', orgId)
      .gte('prompt_runs.run_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('prompt_runs.run_at', { ascending: false });

    if (!results || results.length === 0) {
      return { success: true, recommendationsCreated: 0 };
    }

    // Get org info for brand analysis
    const { data: org } = await supabase
      .from('organizations')
      .select('name, business_description, target_audience')
      .eq('id', orgId)
      .single();

    const recommendations = [];
    
    // Analyze patterns and generate recommendations
    const analysis = analyzeVisibilityResults(results, org);
    
    // Generate recommendations based on analysis
    if (analysis.lowVisibilityCount > 0) {
      recommendations.push({
        org_id: orgId,
        type: 'content',
        title: 'Improve Content Strategy',
        rationale: `${analysis.lowVisibilityCount} recent queries showed low brand visibility (score < 5). Consider creating targeted content around these topics to improve brand presence.`,
        status: 'open'
      });
    }

    if (analysis.notMentionedCount > 0) {
      recommendations.push({
        org_id: orgId,
        type: 'knowledge',
        title: 'Increase Brand Awareness',
        rationale: `Your brand wasn't mentioned in ${analysis.notMentionedCount} relevant queries. Focus on thought leadership content and SEO optimization for better discoverability.`,
        status: 'open'
      });
    }

    if (analysis.competitorAdvantage > 0) {
      recommendations.push({
        org_id: orgId,
        type: 'content',
        title: 'Competitive Content Gap',
        rationale: `Competitors appeared ${analysis.competitorAdvantage} more times than your brand. Create comparison content and highlight your unique value propositions.`,
        status: 'open'
      });
    }

    if (analysis.lowProminenceCount > 0) {
      recommendations.push({
        org_id: orgId,
        type: 'site',
        title: 'Improve Search Rankings',
        rationale: `Your brand appeared in ${analysis.lowProminenceCount} queries but with low prominence. Optimize SEO and create authoritative content to rank higher.`,
        status: 'open'
      });
    }

    if (analysis.topCompetitors.length > 0) {
      recommendations.push({
        org_id: orgId,
        type: 'content',
        title: 'Target Key Competitors',
        rationale: `Most mentioned competitors: ${analysis.topCompetitors.slice(0, 3).join(', ')}. Create content that directly addresses why customers should choose you over these alternatives.`,
        status: 'open'
      });
    }

    // Remove existing auto-generated recommendations to avoid duplicates
    await supabase
      .from('recommendations')
      .delete()
      .eq('org_id', orgId)
      .neq('title', 'DOMAIN_TOKEN'); // Keep domain verification tokens

    // Insert new recommendations
    if (recommendations.length > 0) {
      const { error } = await supabase
        .from('recommendations')
        .insert(recommendations);

      if (error) {
        console.error('Error inserting recommendations:', error);
        return { success: false, error: error.message };
      }
    }

    return {
      success: true,
      recommendationsCreated: recommendations.length
    };

  } catch (error: any) {
    console.error('Error in generateRecommendations:', error);
    return { success: false, error: error.message };
  }
}

function analyzeVisibilityResults(results: any[], org: any) {
  let lowVisibilityCount = 0;
  let notMentionedCount = 0;
  let lowProminenceCount = 0;
  const competitorCounts: Record<string, number> = {};
  let orgMentions = 0;

  for (const result of results) {
    const score = result.score || 0;
    const orgPresent = result.org_brand_present;
    const prominence = result.org_brand_prominence;
    const brands = result.brands_json || [];

    // Count low visibility (score < 5)
    if (score < 5) {
      lowVisibilityCount++;
    }

    // Count when org not mentioned
    if (!orgPresent) {
      notMentionedCount++;
    } else {
      orgMentions++;
      
      // Count low prominence when present
      if (prominence !== null && prominence > 2) {
        lowProminenceCount++;
      }
    }

    // Count competitor mentions
    for (const brand of brands) {
      if (typeof brand === 'string' && brand.length > 1) {
        const normalized = brand.toLowerCase().trim();
        
        // Skip if it's the org's brand
        if (org?.name && normalized.includes(org.name.toLowerCase())) {
          continue;
        }
        
        // Skip generic terms and AI tools
        const excludeTerms = ['openai', 'claude', 'copilot', 'google', 'chatgpt', 'ai', 'artificial intelligence', 'microsoft'];
        if (excludeTerms.some(term => normalized.includes(term))) {
          continue;
        }

        competitorCounts[brand] = (competitorCounts[brand] || 0) + 1;
      }
    }
  }

  // Get top competitors
  const topCompetitors = Object.entries(competitorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([name]) => name);

  const totalCompetitorMentions = Object.values(competitorCounts).reduce((sum, count) => sum + count, 0);
  const competitorAdvantage = Math.max(0, totalCompetitorMentions - orgMentions);

  return {
    totalResults: results.length,
    lowVisibilityCount,
    notMentionedCount,
    lowProminenceCount,
    competitorAdvantage,
    topCompetitors,
    orgMentions,
    totalCompetitorMentions
  };
}