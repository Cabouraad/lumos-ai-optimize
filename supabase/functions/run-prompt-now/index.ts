import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { detectCompetitors } from '../_shared/enhanced-competitor-detector.ts';
import { getUserOrgId } from '../_shared/auth.ts';
import { checkPromptQuota, createQuotaExceededResponse } from '../_shared/quota-enforcement.ts';
import { PromptUsageTracker } from '../_shared/usage-tracker.ts';

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    // Verify authentication and get user's org ID (ignore orgId from request for security)
    const orgId = await getUserOrgId(supabase);

    // Enhanced quota enforcement
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      throw new Error('Authentication required');
    }

    // Get enabled providers to determine quota needs
    const { data: providers } = await supabase
      .from('llm_providers')
      .select('id, name')
      .eq('enabled', true);

    if (!providers || providers.length === 0) {
      throw new Error('No enabled providers');
    }

    // Check quota limits before execution
    const quotaCheck = await checkPromptQuota(supabase, userId, orgId, providers.length);
    if (!quotaCheck.allowed) {
      return createQuotaExceededResponse(quotaCheck);
    }

    const { promptId } = await req.json();
    console.log('Running single prompt:', { promptId, orgId });

    if (!promptId) {
      throw new Error('Missing promptId');
    }

    // Get prompt
    const { data: prompt } = await supabase
      .from('prompts')
      .select('text')
      .eq('id', promptId)
      .eq('org_id', orgId)
      .single();

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    // Get organization info for brand analysis
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle();
    const orgName = org?.name || '';


    // Initialize usage tracker
    const usageTracker = new PromptUsageTracker(supabase, orgId, promptId);

    let totalRuns = 0;
    let successfulRuns = 0;

    // Run prompt on each provider
    for (const provider of providers) {
      try {
        console.log(`Running prompt on ${provider.name}`);
        
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

        // Analyze brand presence and competitors using enhanced detector
        console.log(`🔍 Running enhanced competitor detection for ${provider.name}...`);
        const detectionResult = await detectCompetitors(supabase, orgId, response.text, {
          useNERFallback: true,
          maxCandidates: 10,
          confidenceThreshold: 0.7
        });

        // Convert to legacy analysis format for compatibility
        const analysis = {
          score: detectionResult.orgBrands.length > 0 ? 7 : 2, // Simple scoring
          orgBrandPresent: detectionResult.orgBrands.length > 0,
          orgBrandProminence: detectionResult.orgBrands.length > 0 
            ? Math.round((1 - detectionResult.orgBrands[0].first_pos_ratio) * 10) 
            : null,
          brands: detectionResult.orgBrands.map(b => b.name),
          competitors: detectionResult.competitors.map(c => c.name)
        };

        console.log(`✅ ${provider.name} analysis:`, {
          score: analysis.score,
          brands: analysis.brands.length,
          competitors: analysis.competitors.length
        });

        // Store run (keep existing logging table)
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

        // Also store normalized provider response used by the UI
        const providerModel = provider.name === 'openai' 
          ? 'gpt-4o-mini' 
          : provider.name === 'perplexity' 
            ? 'sonar' 
            : 'gemini-2.0-flash-lite';

          const { error: pprError } = await supabase
            .from('prompt_provider_responses')
            .insert({
              org_id: orgId,
              prompt_id: promptId,
              provider: provider.name,
              status: 'success',
              score: analysis.score,
              org_brand_present: analysis.orgBrandPresent,
              org_brand_prominence: analysis.orgBrandProminence,
              brands_json: analysis.brands,
              competitors_json: analysis.competitors,
              competitors_count: analysis.competitors.length,
              token_in: response.tokenIn || 0,
              token_out: response.tokenOut || 0,
              raw_ai_response: response.text,
              model: providerModel,
              run_at: new Date().toISOString(),
              metadata: { 
                analysis_method: 'enhanced_v2',
                detection_metadata: detectionResult.metadata
              }
            });
        if (pprError) {
          console.error('Failed to insert prompt_provider_responses:', pprError);
        }

        if (run) {
          // Store visibility result (legacy table)
          await supabase
            .from('visibility_results')
            .insert({
              prompt_run_id: run.id,
              org_brand_present: analysis.orgBrandPresent,
              org_brand_prominence: analysis.orgBrandProminence,
              competitors_count: analysis.competitors.length,
              brands_json: analysis.brands,
              score: analysis.score,
              raw_ai_response: response.text,
              raw_evidence: JSON.stringify({ analysis })
            });

          // Track successful provider execution
          usageTracker.addProvider(provider.name);
          console.log(`Successfully processed prompt ${promptId} on ${provider.name}`);
          successfulRuns++;
        }
        totalRuns++;

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
        totalRuns++;
      }
    }

    // Mark session as successful and persist usage
    if (successfulRuns > 0) {
      usageTracker.markSuccess();
      await usageTracker.persistUsage();
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Prompt executed successfully`,
        totalRuns,
        successfulRuns,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Run prompt error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Provider execution functions
async function executeOpenAI(promptText: string) {
  // Check for fake provider mode in E2E testing
  if (Deno.env.get('E2E_FAKE_PROVIDERS') === 'true') {
    console.log('[E2E] Using fake OpenAI provider (runPromptNow)');
    const { extractBrands } = await import('../../lib/providers/fake.ts');
    const result = await extractBrands(promptText, 'openai');
    return {
      text: result.responseText,
      tokenIn: result.tokenIn,
      tokenOut: result.tokenOut
    };
  }

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
  // Check for fake provider mode in E2E testing
  if (Deno.env.get('E2E_FAKE_PROVIDERS') === 'true') {
    console.log('[E2E] Using fake Perplexity provider (runPromptNow)');
    const { extractBrands } = await import('../../lib/providers/fake.ts');
    const result = await extractBrands(promptText, 'perplexity');
    return {
      text: result.responseText,
      tokenIn: result.tokenIn,
      tokenOut: result.tokenOut
    };
  }

  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) throw new Error('Perplexity API key not found');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
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
  console.log('[Gemini] Starting standardized execution');
  
  // Check for fake provider mode in E2E testing
  if (Deno.env.get('E2E_FAKE_PROVIDERS') === 'true') {
    console.log('[E2E] Using fake Gemini provider (runPromptNow)');
    const { extractBrands } = await import('../../lib/providers/fake.ts');
    const result = await extractBrands(promptText, 'gemini');
    return {
      text: result.responseText,
      tokenIn: result.tokenIn,
      tokenOut: result.tokenOut
    };
  }
  
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GOOGLE_GENAI_API_KEY') || Deno.env.get('GENAI_API_KEY');
  
  console.log('[Gemini] API Key Check:', {
    hasGeminiKey: !!Deno.env.get('GEMINI_API_KEY'),
    hasGoogleApiKey: !!Deno.env.get('GOOGLE_API_KEY'),  
    hasGoogleGenaiKey: !!Deno.env.get('GOOGLE_GENAI_API_KEY'),
    hasGenaiKey: !!Deno.env.get('GENAI_API_KEY'),
    finalKeyFound: !!apiKey,
    keyLength: apiKey ? apiKey.length : 0
  });
  
  if (!apiKey) {
    console.error('[Gemini] No API key found in any environment variable');
    throw new Error('Gemini API key not configured');
  }

  const maxAttempts = 3;
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      console.log(`[Gemini] Attempt ${attempt}/${maxAttempts}`);

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000,
            topK: 40,
            topP: 0.95
          }
        }),
      });

      console.log(`[Gemini] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        console.error(`[Gemini] API Error:`, {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText.substring(0, 300)
        });
        
        // Don't retry on authentication or bad request errors
        if (response.status === 401 || response.status === 403 || response.status === 400) {
          console.error(`[Gemini] Non-retryable error: ${response.status}`);
          throw error;
        }
        
        lastError = error;
        if (attempt < maxAttempts) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.log(`[Gemini] Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usage = data.usageMetadata || {};
      
      console.log(`[Gemini] Success - Content length: ${content.length}, Tokens in: ${usage.promptTokenCount || 0}, Tokens out: ${usage.candidatesTokenCount || 0}`);
      
      return {
        text: content,
        tokenIn: usage.promptTokenCount || 0,
        tokenOut: usage.candidatesTokenCount || 0
      };
      
    } catch (error: any) {
      lastError = error;
      console.error(`[Gemini] Attempt ${attempt}/${maxAttempts} failed:`, error.message);
      
      // Don't retry on auth errors
      if (error.message?.includes('401') || error.message?.includes('403')) {
        console.error('[Gemini] Authentication error detected - stopping retries');
        break;
      }
      
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`[Gemini] Waiting ${delay}ms before next retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const finalError = lastError || new Error('Gemini API failed after all attempts');
  console.error('[Gemini] ALL ATTEMPTS FAILED:', finalError.message);
  throw finalError;
}

