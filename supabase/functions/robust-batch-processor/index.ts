import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { analyzePromptResponse } from '../_shared/brand-response-analyzer.ts'
import { createEdgeLogger } from '../_shared/observability/structured-logger.ts'
import { corsHeaders, getStrictCorsHeaders, isRateLimited, getRateLimitHeaders } from '../_shared/cors.ts'
import { checkPromptQuota, createQuotaExceededResponse } from '../_shared/quota-enforcement.ts'
import { BatchUsageTracker } from '../_shared/usage-tracker.ts'
import { getOrgSubscriptionTier, filterAllowedProviders, auditProviderFilter, getAllowedProviders } from '../_shared/provider-policy.ts'

// Constants
const CONCURRENCY = 3; // Process up to 3 providers in parallel per prompt
const TIME_BUDGET_MS = 280000; // 280s (4m40s) - leave margin for edge runtime
const MAX_RESUME_ATTEMPTS = 3;
const RESUME_DELAY_MS = 5000;

// Background resume with safety limits
async function scheduleBackgroundResume(
  orgId: string,
  jobId: string,
  correlationId: string,
  attemptNumber = 1
): Promise<void> {
  if (attemptNumber > MAX_RESUME_ATTEMPTS) {
    console.log(`⚠️ Max resume attempts (${MAX_RESUME_ATTEMPTS}) reached for job ${jobId}`);
    return;
  }

  const isCronContext = Deno.env.get('x-cron-secret') !== undefined;
  if (!isCronContext) {
    console.log('⚠️ Not in cron context, skipping background resume schedule');
    return;
  }

  console.log(`🔄 Scheduling background resume for job ${jobId}, attempt ${attemptNumber}`);

  try {
    await new Promise(resolve => setTimeout(resolve, RESUME_DELAY_MS));

    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/robust-batch-processor`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify({
          action: 'resume',
          resumeJobId: jobId,
          orgId,
          correlationId,
          attemptNumber: attemptNumber + 1,
        }),
      }
    );

    if (!response.ok) {
      console.error(`❌ Background resume failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      
      if (attemptNumber < MAX_RESUME_ATTEMPTS) {
        await scheduleBackgroundResume(orgId, jobId, correlationId, attemptNumber + 1);
      }
    } else {
      const result = await response.json();
      console.log(`✅ Background resume response:`, result);
      
      if (result.action === 'in_progress') {
        await scheduleBackgroundResume(orgId, jobId, correlationId, attemptNumber + 1);
      }
    }
  } catch (error) {
    console.error('❌ Background resume scheduling error:', error);
    if (attemptNumber < MAX_RESUME_ATTEMPTS) {
      await scheduleBackgroundResume(orgId, jobId, correlationId, attemptNumber + 1);
    }
  }

  console.log(`✅ Background resume scheduled for job ${jobId}, attempt ${attemptNumber}`);
}

const getClientIP = (req: Request): string => {
  return req.headers.get('x-forwarded-for')?.split(',')[0] ||
         req.headers.get('x-real-ip') ||
         'unknown';
};

function getTodayKeyNY(d = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  
  const parts = formatter.formatToParts(d);
  const yyyy = parts.find((part: any) => part.type === 'year')?.value || '1970';
  const mm = parts.find((part: any) => part.type === 'month')?.value || '01';
  const dd = parts.find((part: any) => part.type === 'day')?.value || '01';
  
  return `${yyyy}-${mm}-${dd}`;
}

async function handleJobError(supabase: any, error: any, jobId: string): Promise<void> {
  try {
    const { data: existingJob } = await supabase
      .from('batch_jobs')
      .select('metadata')
      .eq('id', jobId)
      .single();

    const updatedMetadata = {
      ...(existingJob?.metadata || {}),
      error_details: error.stack || String(error),
      failed_at: new Date().toISOString()
    };

    await supabase
      .from('batch_jobs')
      .update({
        status: 'failed',
        error_message: error.message || String(error),
        metadata: updatedMetadata,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    console.log(`Job ${jobId} marked as failed`);
  } catch (err: any) {
    console.error(`Failed to update job ${jobId}:`, err);
  }
}

interface TaskResult {
  success: boolean;
  status?: string;
  data?: any;
  error?: string;
}

interface ProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  extractResponse: (data: any) => string;
  buildRequest: (prompt: string) => any;
}

function getProviderConfigs(): Record<string, ProviderConfig> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY') || '';
  const geminiKey = Deno.env.get('GEMINI_API_KEY') ||
                    Deno.env.get('GOOGLE_API_KEY') ||
                    Deno.env.get('GOOGLE_GENAI_API_KEY') ||
                    Deno.env.get('GENAI_API_KEY') || '';
  
  const serpApiKey = Deno.env.get('SERPAPI_KEY') || '';
  const enableGoogleAio = Deno.env.get('ENABLE_GOOGLE_AIO') === 'true';
  
  console.log('🔑 API Key Status:', {
    openai: openaiKey ? '✅ Available' : '❌ Missing',
    perplexity: perplexityKey ? '✅ Available' : '❌ Missing', 
    gemini: geminiKey ? '✅ Available' : '❌ Missing',
    google_ai_overview: (enableGoogleAio && serpApiKey) ? '✅ Available' : '❌ Missing/Disabled'
  });
  
  return {
    openai: {
      apiKey: openaiKey,
      baseURL: 'https://api.openai.com/v1/chat/completions',
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
      buildRequest: (prompt: string) => ({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that provides comprehensive answers to business questions.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000
      }),
      extractResponse: (data: any) => {
        const content = data.choices?.[0]?.message?.content;
        if (Array.isArray(content)) {
          return content.map(c => typeof c === 'string' ? c : c.text || '').join('');
        }
        return content || '';
      }
    },
    perplexity: {
      apiKey: perplexityKey,
      baseURL: 'https://api.perplexity.ai/chat/completions',
      model: Deno.env.get('PERPLEXITY_MODEL') || 'sonar',
      buildRequest: (prompt: string) => ({
        model: Deno.env.get('PERPLEXITY_MODEL') || 'sonar',
        messages: [
          { role: 'system', content: 'Be precise and informative in your responses. Focus on providing actionable insights.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3
      }),
      extractResponse: (data: any) => data.choices?.[0]?.message?.content || ''
    },
    gemini: {
      apiKey: geminiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
      model: 'gemini-2.0-flash-lite',
      buildRequest: (prompt: string) => ({
        contents: [{
          parts: [{
            text: `You are a business assistant. Provide comprehensive, actionable answers.\n\nUser question: ${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4000
        }
      }),
      extractResponse: (data: any) => data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    },
    google_ai_overview: {
      apiKey: enableGoogleAio && serpApiKey ? serpApiKey : '',
      baseURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/fetch-google-aio`,
      model: 'serp-api',
      buildRequest: (prompt: string) => ({
        query: prompt,
        gl: 'us',
        hl: 'en'
      }),
      extractResponse: (data: any) => {
        const text = data?.summary ?? data?.text ?? "";
        if (!text) {
          console.log('⚠️ Google AIO: No AI overview in response, reason:', data?.reason || 'unknown');
        }
        return text;
      }
    }
  };
}

async function queueCompetitorCandidates(supabase: any, orgId: string, candidates: string[]) {
  for (const candidate of candidates.slice(0, 5)) {
    try {
      await supabase
        .from('brand_candidates')
        .upsert({
          org_id: orgId,
          candidate_name: candidate,
          detection_count: 1,
          first_detected_at: new Date().toISOString(),
          last_detected_at: new Date().toISOString(),
          status: 'pending'
        }, {
          onConflict: 'org_id,candidate_name',
          ignoreDuplicates: false
        });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Error queueing competitor candidate:', err);
    }
  }
}

async function callProviderAPI(
  provider: string,
  config: ProviderConfig,
  prompt: string
): Promise<{ success: boolean; response?: string; error?: string; tokenIn?: number; tokenOut?: number }> {
  
  const maxRetries = 3;
  const timeoutMs = 120000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Calling ${provider} (attempt ${attempt}/${maxRetries})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const requestBody = config.buildRequest(prompt);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      let apiUrl = config.baseURL;
      
      if (provider === 'openai') {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      } else if (provider === 'perplexity') {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      } else if (provider === 'gemini') {
        apiUrl += `?key=${config.apiKey}`;
      } else if (provider === 'google_ai_overview') {
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (serviceKey) {
          headers['Authorization'] = `Bearer ${serviceKey}`;
        }
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status === 429 && provider === 'google_ai_overview') {
        const data = await response.json().catch(() => ({}));
        const retryAfter = data.retry_after || 3600;
        console.error(`⚠️ ${provider} rate limited, retry after ${retryAfter}s`);
        throw new Error(`rate_limited: retry after ${retryAfter}s`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`HTTP ${response.status}: ${errorText}`);
        
        if (response.status === 400 && errorText.includes('Invalid model')) {
          console.error(`❌ ${provider} invalid model - failing immediately`);
          throw error;
        }
        
        throw error;
      }

      const data = await response.json();
      const extractedResponse = config.extractResponse(data);

      if (!extractedResponse && provider === 'google_ai_overview') {
        const reason = data?.reason || 'no_ai_overview';
        console.log(`ℹ️ Google AIO returned empty response, reason: ${reason}`);
        return {
          success: true,
          response: '',
          tokenIn: 0,
          tokenOut: 0
        };
      }

      if (!extractedResponse) {
        throw new Error('No valid response content extracted');
      }

      console.log(`✅ ${provider} successful response`);
      
      return {
        success: true,
        response: extractedResponse,
        tokenIn: data.usage?.prompt_tokens || requestBody.messages?.reduce((acc: number, msg: any) => acc + (msg.content?.length || 0), 0) || 0,
        tokenOut: data.usage?.completion_tokens || extractedResponse.length || 0
      };
      
    } catch (error) {
      console.error(`❌ ${provider} attempt ${attempt} failed:`, error.message);
      
      if (error.message.includes('Invalid model') || error.message.includes('invalid_model')) {
        return {
          success: false,
          error: `${provider} failed after ${maxRetries} attempts: ${error.message}`
        };
      }
      
      if (attempt === maxRetries) {
        return {
          success: false,
          error: `${provider} failed after ${maxRetries} attempts: ${error.message}`
        };
      }
      
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      const jitter = Math.floor(Math.random() * 300);
      const sleepMs = backoffMs + jitter;
      console.log(`⏳ Waiting ${sleepMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, sleepMs));
    }
  }
  
  return {
    success: false,
    error: `Provider failed after ${maxRetries} attempts`
  };
}

async function processTask(
  supabase: any,
  prompt: any,
  provider: string,
  orgId: string,
  todayKey: string,
  providerConfigs: Record<string, ProviderConfig>,
  userTier: string
): Promise<TaskResult> {
  try {
    console.log(`🎯 Processing: prompt=${prompt.text.substring(0, 40)}..., provider=${provider}`);

    const config = providerConfigs[provider];
    if (!config || !config.apiKey) {
      throw new Error(`Missing configuration or API key for provider: ${provider}`);
    }

    const result = await callProviderAPI(provider, config, prompt.text);
    
    if (!result.success) {
      // Store error response
      await supabase
        .from('prompt_provider_responses')
        .insert({
          org_id: orgId,
          prompt_id: prompt.id,
          provider: provider,
          model: config.model,
          status: 'error',
          error: result.error,
          run_at: new Date().toISOString(),
          metadata: {
            error_type: result.error?.includes('rate_limited') ? 'rate_limited' : 'api_error',
            today_key: todayKey
          }
        });

      return { success: false, status: 'error', error: result.error };
    }

    // Get brand catalog
    const { data: brandCatalog } = await supabase
      .from('brand_catalog')
      .select('name, is_org_brand, variants_json')
      .eq('org_id', orgId);

    const { data: orgData } = await supabase
      .from('organizations')
      .select('name, domain')
      .eq('id', orgId)
      .single();
    
    // Analyze response
    const analysis = await analyzePromptResponse(result.response!, orgData, brandCatalog || []);

    const unknownCompetitors = analysis.metadata?.ner_organizations || [];
    if (unknownCompetitors.length > 0) {
      await queueCompetitorCandidates(supabase, orgId, unknownCompetitors);
    }

    // Store successful response
    await supabase
      .from('prompt_provider_responses')
      .insert({
        org_id: orgId,
        prompt_id: prompt.id,
        provider: provider,
        model: config.model,
        status: 'success',
        run_at: new Date().toISOString(),
        raw_ai_response: result.response,
        score: analysis.score,
        org_brand_present: analysis.brandPresent,
        org_brand_prominence: analysis.brandProminence,
        competitors_count: analysis.competitorsCount,
        competitors_json: analysis.competitorsJson,
        brands_json: analysis.brandsJson,
        citations_json: analysis.citationsJson,
        token_in: result.tokenIn || 0,
        token_out: result.tokenOut || 0,
        metadata: {
          today_key: todayKey,
          analysis_metadata: analysis.metadata
        }
      });

    console.log(`✅ Task complete: ${provider} - score: ${analysis.score}`);
    return { success: true, status: 'success' };

  } catch (error: any) {
    console.error(`❌ Task failed: ${provider}:`, error.message);
    
    // Store error
    await supabase
      .from('prompt_provider_responses')
      .insert({
        org_id: orgId,
        prompt_id: prompt.id,
        provider: provider,
        status: 'error',
        error: error.message,
        run_at: new Date().toISOString(),
        metadata: { today_key: todayKey }
      });

    return { success: false, status: 'error', error: error.message };
  }
}

// Main Deno serve handler
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const clientIP = getClientIP(req);
  const todayKey = getTodayKeyNY();
  const isCronRequest = !!req.headers.get('x-cron-secret');

  // Rate limiting for unauthenticated public requests (not for authenticated or cron)
  const authHeader = req.headers.get('authorization');
  const hasAuth = !!authHeader || isCronRequest;
  
  if (!hasAuth && isRateLimited(clientIP, 60, 300000)) {
    console.log(`⚠️ Rate limit exceeded for IP: ${clientIP}`);
    return new Response(JSON.stringify({
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      action: 'rate_limited'
    }), {
      status: 429,
      headers: { ...corsHeaders, ...getRateLimitHeaders(300), 'Content-Type': 'application/json' }
    });
  }

  const body = await req.json();
  const {
    action = 'create',
    orgId,
    correlationId = crypto.randomUUID(),
    replace = false,
    resumeJobId = null,
  } = body;

  console.log(`📋 Batch processor invoked: action=${action}, orgId=${orgId}, replace=${replace}, resumeJobId=${resumeJobId}, correlationId=${correlationId}`);

  // ========== HANDLE RESUME ACTION ==========
  if (action === 'resume') {
    if (!resumeJobId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'resumeJobId required for resume action',
        action: 'error'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔄 Resuming job ${resumeJobId} for org ${orgId}`);

    const { data: existingJob, error: fetchError } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', resumeJobId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !existingJob) {
      console.error('❌ Failed to fetch job for resume:', fetchError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found',
        action: 'error'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If job is already finalized, return immediately
    if (['completed', 'failed', 'cancelled'].includes(existingJob.status)) {
      console.log(`✅ Job ${resumeJobId} already finalized with status: ${existingJob.status}`);
      return new Response(JSON.stringify({
        success: true,
        action: 'finalized',
        status: existingJob.status,
        batchJobId: resumeJobId,
        completed_tasks: existingJob.completed_tasks,
        failed_tasks: existingJob.failed_tasks,
        total_tasks: existingJob.total_tasks
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Reconstruct job state from metadata
    const metadata = existingJob.metadata || {};
    const promptIds = metadata.prompt_ids || [];
    const providerNames = existingJob.providers || [];
    const cursor = metadata.cursor || { prompt_index: 0, provider_index: 0 };

    console.log(`📊 Resume state: cursor=${JSON.stringify(cursor)}, completed=${existingJob.completed_tasks}/${existingJob.total_tasks}`);

    // Get prompts
    let activePrompts = [];
    if (promptIds.length === 0) {
      // Legacy job - fetch active prompts
      const { data: prompts } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('org_id', orgId)
        .eq('active', true);
      activePrompts = prompts || [];
      
      // Update metadata with prompt_ids
      await supabase
        .from('batch_jobs')
        .update({
          metadata: {
            ...metadata,
            prompt_ids: activePrompts.map((p: any) => p.id),
            version: 2
          }
        })
        .eq('id', resumeJobId);
    } else {
      // Fetch prompts by saved IDs
      const { data: prompts } = await supabase
        .from('prompts')
        .select('id, text')
        .in('id', promptIds);
      activePrompts = prompts || [];
    }

    if (activePrompts.length === 0) {
      console.log('⚠️ No prompts to process');
      await supabase
        .from('batch_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', resumeJobId);

      return new Response(JSON.stringify({
        success: true,
        action: 'completed',
        batchJobId: resumeJobId,
        message: 'No prompts to process'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const providerConfigs = getProviderConfigs();
    const userTier = await getOrgSubscriptionTier(supabase, orgId);
    const startTime = Date.now();
    let completedTasks = existingJob.completed_tasks || 0;
    let failedTasks = existingJob.failed_tasks || 0;

    try {
      // Resume processing from cursor
      for (let pi = cursor.prompt_index; pi < activePrompts.length; pi++) {
        const prompt = activePrompts[pi];
        const startProviderIndex = (pi === cursor.prompt_index) ? cursor.provider_index : 0;

        for (let pri = startProviderIndex; pri < providerNames.length; pri += CONCURRENCY) {
          // Check time budget
          if (Date.now() - startTime > TIME_BUDGET_MS) {
            console.log(`⏰ Time budget exceeded during resume, pausing at prompt ${pi}/${activePrompts.length}, provider ${pri}/${providerNames.length}`);
            
            await supabase
              .from('batch_jobs')
              .update({
                completed_tasks: completedTasks,
                failed_tasks: failedTasks,
                metadata: {
                  ...metadata,
                  cursor: { prompt_index: pi, provider_index: pri },
                  last_heartbeat: new Date().toISOString()
                }
              })
              .eq('id', resumeJobId);

            if (isCronRequest) {
              EdgeRuntime.waitUntil(
                scheduleBackgroundResume(orgId, resumeJobId, correlationId)
              );
            }

            return new Response(JSON.stringify({
              success: true,
              action: 'in_progress',
              batchJobId: resumeJobId,
              completed_tasks: completedTasks,
              failed_tasks: failedTasks,
              total_tasks: existingJob.total_tasks,
              cursor: { prompt_index: pi, provider_index: pri },
              message: 'Time budget exceeded, resume scheduled'
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Process providers in parallel (bounded by CONCURRENCY)
          const providerBatch = providerNames.slice(pri, pri + CONCURRENCY);
          const batchResults = await Promise.allSettled(
            providerBatch.map(provider =>
              processTask(supabase, prompt, provider, orgId, todayKey, providerConfigs, userTier)
            )
          );

          // Update counters
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              if (result.value?.status === 'success') completedTasks++;
              else failedTasks++;
            } else {
              failedTasks++;
            }
          }

          // Update heartbeat every batch
          await supabase
            .from('batch_jobs')
            .update({
              completed_tasks: completedTasks,
              failed_tasks: failedTasks,
              metadata: {
                ...metadata,
                cursor: { prompt_index: pi, provider_index: pri + CONCURRENCY },
                last_heartbeat: new Date().toISOString()
              }
            })
            .eq('id', resumeJobId);
        }
      }

      // All tasks completed
      console.log(`✅ Resume completed all tasks for job ${resumeJobId}`);
      await supabase
        .from('batch_jobs')
        .update({
          status: 'completed',
          completed_tasks: completedTasks,
          failed_tasks: failedTasks,
          completed_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            cursor: { prompt_index: activePrompts.length, provider_index: providerNames.length },
            last_heartbeat: new Date().toISOString()
          }
        })
        .eq('id', resumeJobId);

      return new Response(JSON.stringify({
        success: true,
        action: 'completed',
        batchJobId: resumeJobId,
        completed_tasks: completedTasks,
        failed_tasks: failedTasks,
        total_tasks: existingJob.total_tasks
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (resumeError: any) {
      console.error('🚨 Resume processing error:', resumeError);
      await handleJobError(supabase, resumeError, resumeJobId);
      
      return new Response(JSON.stringify({
        success: false,
        error: resumeError.message || 'Resume processing failed',
        action: 'processing_failed',
        batchJobId: resumeJobId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ========== PREFLIGHT CHECKS ==========
  if (action === 'preflight') {
    console.log('🔍 Running preflight checks...');
    const providerConfigs = getProviderConfigs();
    
    const availableProviders = Object.entries(providerConfigs)
      .filter(([_, config]) => config.apiKey)
      .map(([name, _]) => name);
    
    const missingProviders = Object.entries(providerConfigs)
      .filter(([_, config]) => !config.apiKey)
      .map(([name, _]) => name);

    const quotaCheck = await checkPromptQuota(supabase, orgId);

    return new Response(JSON.stringify({
      success: true,
      action: 'preflight',
      providers: {
        available: availableProviders,
        missing: missingProviders,
        total: Object.keys(providerConfigs).length
      },
      quota: quotaCheck,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ========== CREATE ACTION ==========
  if (action === 'create' || !action) {
    console.log('🚀 Creating new batch job...');

    const { data: activePrompts } = await supabase
      .from('prompts')
      .select('id, text')
      .eq('org_id', orgId)
      .eq('active', true);

    if (!activePrompts || activePrompts.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No active prompts found',
        action: 'error'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const providerConfigs = getProviderConfigs();
    const userTier = await getOrgSubscriptionTier(supabase, orgId);
    const rawProviders = Object.keys(providerConfigs).filter(p => providerConfigs[p].apiKey);
    const providers = filterAllowedProviders(rawProviders, userTier);

    if (providers.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No providers available for your subscription tier',
        action: 'error'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cancel any existing jobs if replace=true
    let cancelledCount = 0;
    if (replace) {
      console.log('🔄 Replacing existing batch jobs...');
      const { data: cancelledJobs, error: cancelError } = await supabase
        .from('batch_jobs')
        .update({
          status: 'cancelled',
          metadata: {
            cancel_reason: 'preempted by new job',
            cancelled_at: new Date().toISOString()
          }
        })
        .eq('org_id', orgId)
        .in('status', ['pending', 'processing'])
        .select('id');

      if (cancelError) {
        console.error('⚠️ Error cancelling existing jobs:', cancelError);
      } else {
        cancelledCount = cancelledJobs?.length || 0;
        console.log(`✅ Cancelled ${cancelledCount} existing jobs`);
      }
    }

    // Check for existing job today (idempotency)
    if (!replace) {
      const { data: existingJob } = await supabase
        .from('batch_jobs')
        .select('id')
        .eq('org_id', orgId)
        .gte('created_at', `${todayKey}T00:00:00Z`)
        .lt('created_at', `${todayKey}T23:59:59Z`)
        .in('status', ['pending', 'processing', 'completed'])
        .maybeSingle();

      if (existingJob) {
        console.log('ℹ️ Batch already exists for today');
        return new Response(JSON.stringify({
          success: true,
          action: 'duplicate_prevented',
          message: 'Batch already exists for today',
          batchJobId: existingJob.id
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Create the batch job with durable state
    const totalTasks = activePrompts.length * providers.length;
    const promptIds = activePrompts.map((p: any) => p.id);
    
    const { data: newJob, error: jobError } = await supabase
      .from('batch_jobs')
      .insert({
        org_id: orgId,
        status: 'processing',
        providers,
        total_tasks: totalTasks,
        completed_tasks: 0,
        failed_tasks: 0,
        started_at: new Date().toISOString(),
        trigger_source: isCronRequest ? 'cron' : 'manual',
        metadata: {
          correlation_id: correlationId,
          client_ip: clientIP,
          created_by: action,
          last_heartbeat: new Date().toISOString(),
          prompt_ids: promptIds,
          provider_names: providers,
          cursor: { prompt_index: 0, provider_index: 0 },
          version: 2,
          cancelled_previous_count: cancelledCount
        }
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ Failed to create job:', jobError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to create batch job',
        action: 'error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const jobId = newJob.id;
    console.log(`✅ Job created: ${jobId}, total tasks: ${totalTasks}`);

    // ========== MAIN PROCESSING LOOP ==========
    const startTime = Date.now();
    let completedTasks = 0;
    let failedTasks = 0;

    try {
      for (let pi = 0; pi < activePrompts.length; pi++) {
        const prompt = activePrompts[pi];

        for (let pri = 0; pri < providers.length; pri += CONCURRENCY) {
          // Check time budget before each batch
          if (Date.now() - startTime > TIME_BUDGET_MS) {
            console.log(`⏰ Time budget exceeded at prompt ${pi}/${activePrompts.length}, provider ${pri}/${providers.length}`);
            console.log(`📊 Progress: ${completedTasks} completed, ${failedTasks} failed out of ${totalTasks} total`);

            await supabase
              .from('batch_jobs')
              .update({
                completed_tasks: completedTasks,
                failed_tasks: failedTasks,
                metadata: {
                  ...newJob.metadata,
                  cursor: { prompt_index: pi, provider_index: pri },
                  time_budget_exceeded: true,
                  exceeded_at: new Date().toISOString(),
                  last_heartbeat: new Date().toISOString()
                }
              })
              .eq('id', jobId);

            if (isCronRequest) {
              console.log('🔄 Scheduling background resume (CRON context)');
              EdgeRuntime.waitUntil(
                scheduleBackgroundResume(orgId, jobId, correlationId)
              );
            }

            return new Response(JSON.stringify({
              success: true,
              action: 'in_progress',
              batchJobId: jobId,
              completed_tasks: completedTasks,
              failed_tasks: failedTasks,
              total_tasks: totalTasks,
              cursor: { prompt_index: pi, provider_index: pri },
              message: 'Time budget exceeded, background resume scheduled',
              cancelled_previous_count: cancelledCount
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Process providers in parallel (bounded by CONCURRENCY)
          const providerBatch = providers.slice(pri, pri + CONCURRENCY);
          const batchResults = await Promise.allSettled(
            providerBatch.map(provider =>
              processTask(supabase, prompt, provider, orgId, todayKey, providerConfigs, userTier)
            )
          );

          // Update counters based on results
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              if (result.value?.status === 'success') {
                completedTasks++;
              } else {
                failedTasks++;
              }
            } else {
              failedTasks++;
              console.error('Task rejected:', result.reason);
            }
          }

          // Update progress and heartbeat after each batch
          await supabase
            .from('batch_jobs')
            .update({
              completed_tasks: completedTasks,
              failed_tasks: failedTasks,
              metadata: {
                ...newJob.metadata,
                cursor: { prompt_index: pi, provider_index: pri + CONCURRENCY },
                last_heartbeat: new Date().toISOString()
              }
            })
            .eq('id', jobId);
        }
      }

      // Mark job as completed
      await supabase
        .from('batch_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_tasks: completedTasks,
          failed_tasks: failedTasks,
          metadata: {
            ...newJob.metadata,
            cursor: { prompt_index: activePrompts.length, provider_index: providers.length },
            last_heartbeat: new Date().toISOString()
          }
        })
        .eq('id', jobId);

      console.log(`✅ Batch processing completed: ${completedTasks} succeeded, ${failedTasks} failed`);

      return new Response(JSON.stringify({
        success: true,
        action: 'completed',
        batchJobId: jobId,
        completed_tasks: completedTasks,
        failed_tasks: failedTasks,
        total_tasks: totalTasks,
        org_id: orgId,
        cancelled_previous_count: cancelledCount
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (processingError: any) {
      console.error('🚨 Processing loop error:', processingError);
      await handleJobError(supabase, processingError, jobId);
      
      return new Response(JSON.stringify({
        success: false,
        error: processingError.message || 'Processing error occurred',
        action: 'processing_failed',
        batchJobId: jobId,
        details: processingError.stack || 'No stack trace available',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Unknown action
  return new Response(JSON.stringify({
    success: false,
    error: `Unknown action: ${action}`,
    action: 'error'
  }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
