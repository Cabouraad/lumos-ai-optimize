import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { detectCompetitors } from '../_shared/enhanced-competitor-detector.ts';
import { extractPerplexityCitations, extractOpenAICitations, extractGeminiCitations } from '../_shared/citations-enhanced.ts';
import { getUserOrgId } from '../_shared/auth.ts';
import { checkPromptQuota, createQuotaExceededResponse } from '../_shared/quota-enforcement.ts';
import { PromptUsageTracker } from '../_shared/usage-tracker.ts';
import { getOrgSubscriptionTier, filterAllowedProviders, auditProviderFilter } from '../_shared/provider-policy.ts';
import { getStrictCorsHeaders } from '../_shared/cors.ts';
import { 
  createStandardResponse, 
  createSuccessResponse, 
  createErrorResponse, 
  ErrorCode 
} from '../_shared/error-responses.ts';

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://llumos.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const correlationId = crypto.randomUUID();
  const corsHeaders = getStrictCorsHeaders(req.headers.get('origin'), correlationId);
  
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

    // Get organization subscription tier for provider filtering
    const subscriptionTier = await getOrgSubscriptionTier(supabase, orgId);
    
    // Filter providers by subscription tier
    const providerNames = providers.map(p => p.name);
    const allowedProviderNames = filterAllowedProviders(providerNames as any, subscriptionTier);
    const allowedProviders = providers.filter(p => allowedProviderNames.includes(p.name));
    
    // Audit provider filtering
    const blockedProviders = providerNames.filter(name => !allowedProviderNames.includes(name));
    if (blockedProviders.length > 0) {
      auditProviderFilter(orgId, subscriptionTier, providerNames, allowedProviderNames, blockedProviders);
    }

    if (allowedProviders.length === 0) {
      throw new Error('No providers allowed for current subscription tier');
    }

    // Check quota limits before execution
    const quotaCheck = await checkPromptQuota(supabase, userId, orgId, allowedProviders.length);
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

    // Run prompt on each allowed provider
    for (const provider of allowedProviders) {
      try {
        console.log(`Running ${provider.name} on prompt (tier: ${subscriptionTier})`);
        
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
          case 'google_ai_overview':
            response = await executeGoogleAio(prompt.text);
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

        // Store normalized provider response used by the UI
        const providerModel = provider.name === 'openai' 
          ? 'gpt-4o-mini' 
          : provider.name === 'perplexity' 
            ? 'sonar' 
            : provider.name === 'google_ai_overview'
              ? 'google-aio'
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
              },
              citations_json: response.citations || null
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
        const errorMessage = providerError instanceof Error ? providerError.message : String(providerError);
        console.error(`Provider ${provider.name} error:`, errorMessage);
        
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

        // Also store error in prompt_provider_responses so UI can show it
        const providerModel = provider.name === 'openai' 
          ? 'gpt-4o-mini' 
          : provider.name === 'perplexity' 
            ? 'sonar' 
            : provider.name === 'google_ai_overview'
              ? 'google-aio'
              : 'gemini-2.0-flash-lite';

        await supabase
          .from('prompt_provider_responses')
          .insert({
            org_id: orgId,
            prompt_id: promptId,
            provider: provider.name,
            model: providerModel,
            status: 'error',
            error: errorMessage,
            score: 0,
            org_brand_present: false,
            org_brand_prominence: null,
            competitors_count: 0,
            competitors_json: [],
            brands_json: [],
            token_in: 0,
            token_out: 0,
            raw_ai_response: null,
            raw_evidence: null,
            metadata: {
              error_type: providerError instanceof Error ? providerError.constructor.name : 'UnknownError',
              timestamp: new Date().toISOString()
            }
          });
          
        totalRuns++;
      }
    }

    // Mark session as successful and persist usage
    if (successfulRuns > 0) {
      usageTracker.markSuccess();
      await usageTracker.persistUsage();
    }

    return createStandardResponse(
      createSuccessResponse({
        message: `Prompt executed successfully on ${allowedProviders.length}/${providerNames.length} providers (tier: ${subscriptionTier})`,
        totalRuns,
        successfulRuns,
        allowedProviders: allowedProviders.length,
        blockedProviders: blockedProviders.length,
        subscriptionTier
      }, correlationId),
      corsHeaders
    );

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Run prompt error:', err);
    
    // Determine appropriate error code
    let errorCode = ErrorCode.INTERNAL_ERROR;
    if (err.message?.includes('Authentication')) {
      errorCode = ErrorCode.AUTH_REQUIRED;
    } else if (err.message?.includes('No enabled providers') || err.message?.includes('No providers allowed')) {
      errorCode = ErrorCode.SUBSCRIPTION_REQUIRED;
    } else if (err.message?.includes('Missing promptId') || err.message?.includes('Prompt not found')) {
      errorCode = ErrorCode.INVALID_INPUT;
    }
    
    return createStandardResponse(
      createErrorResponse(errorCode, err.message, { stack: err.stack?.split('\n')[0] }, correlationId),
      corsHeaders
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
      tokenOut: result.tokenOut,
      citations: null
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
  const responseText = data.choices[0].message.content;
  
  // Extract citations from OpenAI response (text-only)
  const citations = extractOpenAICitations(responseText);
  
  return {
    text: responseText,
    tokenIn: data.usage?.prompt_tokens || 0,
    tokenOut: data.usage?.completion_tokens || 0,
    citations
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
      tokenOut: result.tokenOut,
      citations: null
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
  const responseText = data.choices[0].message.content;
  
  // Extract citations from Perplexity response
  const citationsData = extractPerplexityCitations(data, responseText);
  
  return {
    text: responseText,
    tokenIn: 0,
    tokenOut: 0,
    citations: citationsData
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
      
      // Extract citations from Gemini response
      const citationsData = extractGeminiCitations(data, content);
      
      return {
        text: content,
        tokenIn: usage.promptTokenCount || 0,
        tokenOut: usage.candidatesTokenCount || 0,
        citations: citationsData
      };
      
    } catch (error) {
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

// Google AI Overview execution function
async function executeGoogleAio(promptText: string) {
  console.log('[Google AIO] Starting execution via edge function');
  
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase configuration for Google AIO');
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/fetch-google-aio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: promptText, gl: 'us', hl: 'en' })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Google AIO] Edge function error:', { status: response.status, error: errorText });
      throw new Error(`Google AIO edge function error: ${response.status}`);
    }

    const data = await response.json();
    
    // Normalize: summary || text || ""
    const text = data.summary ?? data.text ?? "";
    const reason = data.reason || (text ? "ok" : "no_ai_overview");
    
    console.log(`[Google AIO] Success - Text length: ${text.length}, Citations: ${data.citations?.length || 0}, Reason: ${reason}`);

    return {
      text,
      tokenIn: 0, // SerpAPI doesn't provide token counts
      tokenOut: 0,
      citations: data.citations || [],
      metadata: { reason, enabled: data.enabled }
    };

  } catch (error) {
    console.error('[Google AIO] Execution failed:', error.message);
    throw new Error(`Google AI Overview execution failed: ${error.message}`);
  }
}

  const finalError = lastError || new Error('Gemini API failed after all attempts');
  console.error('[Gemini] ALL ATTEMPTS FAILED:', finalError.message);
  throw finalError;
}

