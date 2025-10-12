import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id, x-client-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Micro-batch configuration
const MICRO_BATCH_SIZE = 15;
const SAFETY_TIMEOUT = 30000;
const CONCURRENCY = 3;

interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  authType: 'bearer' | 'google-api-key';
  buildRequest: (prompt: string) => any;
  extractResponse: (data: any) => string;
}

function getProviderConfigs(): ProviderConfig[] {
  const configs: ProviderConfig[] = [];
  
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (openaiKey) {
    configs.push({
      name: 'openai',
      apiKey: openaiKey,
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      authType: 'bearer',
      buildRequest: (prompt) => ({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      }),
      extractResponse: (data) => data.choices?.[0]?.message?.content || ''
    });
  }

  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (perplexityKey) {
    configs.push({
      name: 'perplexity',
      apiKey: perplexityKey,
      baseUrl: 'https://api.perplexity.ai/chat/completions',
      model: 'sonar',
      authType: 'bearer',
      buildRequest: (prompt) => ({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      }),
      extractResponse: (data) => data.choices?.[0]?.message?.content || ''
    });
  }

  // Use multiple fallback environment variable names for Gemini API key
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GOOGLE_GENAI_API_KEY') || Deno.env.get('GENAI_API_KEY');
  if (geminiKey) {
    configs.push({
      name: 'gemini',
      apiKey: geminiKey,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
      model: 'gemini-2.0-flash-lite',
      authType: 'google-api-key',
      buildRequest: (prompt) => ({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
          topK: 40,
          topP: 0.95
        }
      }),
      extractResponse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    });
  }

  const googleAioKey = Deno.env.get('GOOGLE_AIO_API_KEY');
  if (googleAioKey) {
    configs.push({
      name: 'google_ai_overview',
      apiKey: googleAioKey,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      model: 'gemini-1.5-flash',
      authType: 'google-api-key',
      buildRequest: (prompt) => ({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500 }
      }),
      extractResponse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    });
  }

  return configs;
}

async function callProviderAPI(config: ProviderConfig, prompt: string): Promise<string> {
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      console.log(`[${config.name}] Attempt ${attempt}/${maxAttempts}`);

      // Build headers based on auth type
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (config.authType === 'bearer') {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      } else if (config.authType === 'google-api-key') {
        headers['X-goog-api-key'] = config.apiKey; // Fixed: uppercase X
      }

      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(config.buildRequest(prompt)),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ${config.name} HTTP ${response.status}:`, errorText);
        
        // Don't retry on authentication or bad request errors
        if (response.status === 401 || response.status === 403 || response.status === 400) {
          throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        }
        
        lastError = new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        
        // Retry with exponential backoff
        if (attempt < maxAttempts) {
          const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          console.log(`[${config.name}] Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw lastError;
      }

      const data = await response.json();
      console.log(`[${config.name}] Success on attempt ${attempt}`);
      return config.extractResponse(data);
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;
      
      // Don't retry on auth errors
      if (error.message?.includes('401') || error.message?.includes('403')) {
        throw error;
      }
      
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`[${config.name}] Error: ${error.message}. Retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

async function processTask(
  supabase: any,
  orgId: string,
  promptId: string,
  promptText: string,
  provider: ProviderConfig
): Promise<boolean> {
  try {
    const rawResponse = await callProviderAPI(provider, promptText);
    
    // Fetch organization data for brand analysis
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();
    
    // Fetch brand catalog for comprehensive analysis
    const { data: brandCatalog } = await supabase
      .from('brand_catalog')
      .select('name, is_org_brand, variants_json')
      .eq('org_id', orgId);
    
    // Perform comprehensive brand analysis
    let analysis;
    try {
      const { analyzePromptResponse } = await import('../_shared/brand-response-analyzer.ts');
      
      analysis = await analyzePromptResponse(
        rawResponse,
        { name: orgData?.name || 'Unknown' },
        brandCatalog || []
      );
      
      console.log(`[${provider.name}] Analysis: Score=${analysis.score}, Brand=${analysis.org_brand_present}, Competitors=${analysis.competitors_json.length}`);
    } catch (analysisError: any) {
      console.error(`[${provider.name}] Analysis failed:`, analysisError.message);
      // Fallback to basic detection
      const orgName = orgData?.name || 'Unknown';
      const brandPresent = rawResponse.toLowerCase().includes(orgName.toLowerCase());
      analysis = {
        score: brandPresent ? 6.0 : 1.0,
        org_brand_present: brandPresent,
        org_brand_prominence: brandPresent ? 1 : 0,
        competitors_count: 0,
        competitors_json: [],
        brands_json: brandPresent ? [orgName] : [],
        metadata: { analysis_error: analysisError.message }
      };
    }
    
    await supabase.from('prompt_provider_responses').insert({
      org_id: orgId,
      prompt_id: promptId,
      provider: provider.name,
      model: provider.model,
      status: 'success',
      raw_ai_response: rawResponse,
      score: analysis.score,
      org_brand_present: analysis.org_brand_present,
      org_brand_prominence: analysis.org_brand_prominence || 0,
      competitors_count: analysis.competitors_count || 0,
      competitors_json: analysis.competitors_json || [],
      brands_json: analysis.brands_json || [],
      token_in: 0,
      token_out: 0,
      metadata: analysis.metadata || {}
    });

    return true;
  } catch (error: any) {
    console.error(`[${provider.name}] Task failed:`, error.message);
    
    await supabase.from('prompt_provider_responses').insert({
      org_id: orgId,
      prompt_id: promptId,
      provider: provider.name,
      model: provider.model,
      status: 'error',
      error: error.message,
      score: 0,
      org_brand_present: false,
      competitors_count: 0,
      competitors_json: [],
      brands_json: [],
      token_in: 0,
      token_out: 0,
      metadata: { 
        error_type: 'processing_error',
        error_details: error.message 
      }
    });

    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { jobId, orgId, replace = false } = await req.json();

    console.log('🚀 Batch processor:', { jobId, orgId, replace });

    // Cancel existing jobs if replace=true
    let cancelledCount = 0;
    if (replace && !jobId) {
      const { data: cancelled } = await supabase
        .from('batch_jobs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          metadata: { cancelled_at: new Date().toISOString() }
        })
        .eq('org_id', orgId)
        .in('status', ['pending', 'processing'])
        .select();

      cancelledCount = cancelled?.length || 0;
      console.log(`✅ Cancelled ${cancelledCount} jobs`);
    }

    // Get or create job
    let job: any;
    if (jobId) {
      const { data } = await supabase.from('batch_jobs').select('*').eq('id', jobId).single();
      job = data;
      
      if (!job || job.status === 'completed' || job.status === 'failed') {
        return new Response(JSON.stringify({
          action: 'completed',
          jobId: job?.id,
          completed: job?.completed_tasks || 0,
          failed: job?.failed_tasks || 0,
          remaining: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      const { data: prompts } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('org_id', orgId)
        .eq('active', true);

      const providers = getProviderConfigs();
      const totalTasks = (prompts?.length || 0) * providers.length;

      const { data: newJob } = await supabase
        .from('batch_jobs')
        .insert({
          org_id: orgId,
          status: 'processing',
          total_tasks: totalTasks,
          completed_tasks: 0,
          failed_tasks: 0,
          providers: providers.map(p => p.name),
          started_at: new Date().toISOString(),
          metadata: {
            provider_names: providers.map(p => p.name),
            correlation_id: crypto.randomUUID(),
            completed_combinations: [],
            failed_combinations: [],
            prompt_failures: {},
            last_known_progress: 0
          }
        })
        .select()
        .single();

      job = newJob;
      console.log('✅ Created job:', job.id);
      
      // Return early after creating job - let driver loop handle processing
      return new Response(JSON.stringify({
        action: 'created',
        jobId: job.id,
        cancelled_previous_count: cancelledCount,
        total_tasks: totalTasks,
        remaining: totalTasks
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch active prompts and providers
    const { data: prompts } = await supabase
      .from('prompts')
      .select('id, text')
      .eq('org_id', orgId)
      .eq('active', true);

    const providers = getProviderConfigs();
    
    if (!prompts || prompts.length === 0 || providers.length === 0) {
      await supabase.from('batch_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', job.id);

      return new Response(JSON.stringify({
        action: 'completed',
        jobId: job.id,
        completed: 0,
        failed: 0,
        remaining: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tasksProcessed = job.completed_tasks + job.failed_tasks;
    const totalTasks = prompts.length * providers.length;
    const remaining = totalTasks - tasksProcessed;

    console.log(`📊 Progress: ${tasksProcessed}/${totalTasks}`);

    if (remaining === 0) {
      await supabase.from('batch_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', job.id);

      return new Response(JSON.stringify({
        action: 'completed',
        jobId: job.id,
        completed: job.completed_tasks,
        failed: job.failed_tasks,
        remaining: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process micro-batch
    const startTime = Date.now();
    const tasksToProcess = Math.min(MICRO_BATCH_SIZE, remaining);
    let completed = 0;
    let failed = 0;

    // Get tracking data
    const completedCombinations = job.metadata?.completed_combinations || [];
    const failedCombinations = job.metadata?.failed_combinations || [];
    const promptFailures = job.metadata?.prompt_failures || {};
    const CIRCUIT_BREAKER_THRESHOLD = 3;

    console.log(`🔄 Processing ${tasksToProcess} tasks (${completedCombinations.length} already done)...`);

    for (let i = 0; i < tasksToProcess; i++) {
      const taskIndex = tasksProcessed + i;
      const promptIndex = Math.floor(taskIndex / providers.length);
      const providerIndex = taskIndex % providers.length;

      if (promptIndex >= prompts.length) break;
      if (Date.now() - startTime > SAFETY_TIMEOUT) {
        console.log('⏱️ Safety timeout reached, returning partial results');
        break;
      }

      const prompt = prompts[promptIndex];
      const provider = providers[providerIndex];
      const taskKey = `${prompt.id}:${provider.name}`;

      // Check if already completed
      if (completedCombinations.includes(taskKey)) {
        console.log(`⏭️ Skipping already-completed: ${taskKey}`);
        continue;
      }

      // Check circuit breaker
      const failureCount = promptFailures[prompt.id] || 0;
      if (failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
        console.log(`🔴 Circuit breaker OPEN for prompt ${prompt.id} (${failureCount} failures)`);
        if (!failedCombinations.includes(taskKey)) {
          failedCombinations.push(taskKey);
        }
        failed++;
        continue;
      }

      const success = await processTask(supabase, orgId, prompt.id, prompt.text, provider);
      
      if (success) {
        completed++;
        completedCombinations.push(taskKey);
        promptFailures[prompt.id] = 0; // Reset on success
      } else {
        failed++;
        failedCombinations.push(taskKey);
        promptFailures[prompt.id] = (promptFailures[prompt.id] || 0) + 1;
      }

      await supabase.from('batch_jobs').update({
        completed_tasks: job.completed_tasks + completed,
        failed_tasks: job.failed_tasks + failed,
        metadata: {
          ...job.metadata,
          last_heartbeat: new Date().toISOString(),
          completed_combinations: completedCombinations,
          failed_combinations: failedCombinations,
          prompt_failures: promptFailures,
          last_known_progress: job.completed_tasks + completed + job.failed_tasks + failed
        }
      }).eq('id', job.id);
    }

    const newCompleted = job.completed_tasks + completed;
    const newFailed = job.failed_tasks + failed;
    const newRemaining = totalTasks - newCompleted - newFailed;

    console.log(`✅ +${completed} completed, +${failed} failed, ${newRemaining} remaining`);

    if (newRemaining === 0) {
      await supabase.from('batch_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', job.id);

      return new Response(JSON.stringify({
        action: 'completed',
        jobId: job.id,
        completed: newCompleted,
        failed: newFailed,
        remaining: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      action: 'in_progress',
      jobId: job.id,
      completed: newCompleted,
      failed: newFailed,
      remaining: newRemaining,
      progress: Math.round((newCompleted + newFailed) / totalTasks * 100)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Error:', error);
    
    // Try to get current job state for partial progress reporting
    let partialProgress = null;
    let correlationId = null;
    try {
      if (job?.id) {
        const { data: currentJob } = await supabase
          .from('batch_jobs')
          .select('completed_tasks, failed_tasks, total_tasks, metadata')
          .eq('id', job.id)
          .single();
        
        if (currentJob) {
          partialProgress = {
            completed: currentJob.completed_tasks,
            failed: currentJob.failed_tasks,
            total: currentJob.total_tasks
          };
          correlationId = currentJob.metadata?.correlation_id;
        }
      }
    } catch (progressError) {
      console.error('Could not fetch partial progress:', progressError);
    }
    
    return new Response(JSON.stringify({
      action: 'error',
      error: error.message,
      errorType: error.name,
      correlationId,
      partialProgress,
      timestamp: new Date().toISOString(),
      retryable: !error.message?.includes('401') && !error.message?.includes('403')
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
