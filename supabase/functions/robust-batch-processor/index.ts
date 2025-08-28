
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { analyzeResponse } from '../_shared/simple-brand-analyzer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchJobRequest {
  orgId: string;
  promptIds?: string[];
  resumeJobId?: string;
}

interface ProviderConfig {
  name: string;
  apiKey: string;
  endpoint: string;
  model: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    name: 'openai',
    apiKey: Deno.env.get('OPENAI_API_KEY')!,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini'
  },
  gemini: {
    name: 'gemini',
    apiKey: Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GOOGLE_GENAI_API_KEY') || Deno.env.get('GENAI_API_KEY'),
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
    model: 'gemini-2.0-flash-lite'
  },
  perplexity: {
    name: 'perplexity',
    apiKey: Deno.env.get('PERPLEXITY_API_KEY')!,
    endpoint: 'https://api.perplexity.ai/chat/completions',
    model: 'sonar'
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { orgId, promptIds, resumeJobId }: BatchJobRequest = await req.json();

    console.log('🚀 Starting robust batch processing for org:', orgId);
    
    // Handle resume mode
    if (resumeJobId) {
      return handleResumeMode(supabase, resumeJobId, orgId);
    }

    // STEP 1: Cancel any existing active jobs for this org (ensures single job per org)
    console.log('🛑 Cancelling any existing active jobs for org:', orgId);
    const { data: cancelResult, error: cancelError } = await supabase.rpc('cancel_active_batch_jobs', {
      p_org_id: orgId,
      p_reason: 'new job started'
    });

    if (cancelError) {
      console.error('❌ Failed to cancel existing jobs:', cancelError);
    } else if (cancelResult) {
      console.log('✅ Cancelled existing jobs:', cancelResult);
    }

    // Get active prompts for the organization
    let promptQuery = supabase
      .from('prompts')
      .select('id, text')
      .eq('org_id', orgId)
      .eq('active', true);

    if (promptIds && promptIds.length > 0) {
      promptQuery = promptQuery.in('id', promptIds);
    }

    const { data: prompts, error: promptError } = await promptQuery;

    if (promptError) {
      throw new Error(`Failed to fetch prompts: ${promptError.message}`);
    }

    if (!prompts || prompts.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No active prompts found'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get enabled providers
    const { data: enabledProviders } = await supabase
      .from('llm_providers')
      .select('name')
      .eq('enabled', true);

    const providers = enabledProviders?.filter(p => PROVIDERS[p.name.toLowerCase()]) || [];
    
    if (providers.length === 0) {
      throw new Error('No enabled providers with valid API keys found');
    }

    console.log(`📝 Processing ${prompts.length} prompts across ${providers.length} providers`);

    // Create batch job with runner ID
    const runnerId = crypto.randomUUID();
    const totalTasks = prompts.length * providers.length;
    const { data: batchJob, error: jobError } = await supabase
      .from('batch_jobs')
      .insert({
        org_id: orgId,
        status: 'processing',
        total_tasks: totalTasks,
        started_at: new Date().toISOString(),
        runner_id: runnerId,
        last_heartbeat: new Date().toISOString(),
        metadata: {
          prompt_count: prompts.length,
          provider_count: providers.length,
          provider_names: providers.map(p => p.name)
        }
      })
      .select()
      .single();

    if (jobError || !batchJob) {
      throw new Error(`Failed to create batch job: ${jobError?.message}`);
    }

    console.log(`✅ Created batch job ${batchJob.id} with ${totalTasks} tasks`);

    // Create batch tasks for each prompt-provider combination
    const batchTasks = [];
    for (const prompt of prompts) {
      for (const provider of providers) {
        batchTasks.push({
          batch_job_id: batchJob.id,
          prompt_id: prompt.id,
          provider: provider.name.toLowerCase(),
          status: 'pending'
        });
      }
    }

    const { error: tasksError } = await supabase
      .from('batch_tasks')
      .insert(batchTasks);

    if (tasksError) {
      console.error('Failed to create batch tasks:', tasksError);
      // Mark job as failed
      await supabase
        .from('batch_jobs')
        .update({ status: 'failed' })
        .eq('id', batchJob.id);
      
      throw new Error(`Failed to create batch tasks: ${tasksError.message}`);
    }

    // Process tasks concurrently with controlled concurrency
    const concurrencyLimit = 5;
    console.log(`🔄 Starting background processing of ${batchTasks.length} tasks`);

    // Use background processing to avoid timeout issues
    EdgeRuntime.waitUntil(
      (async () => {
        let completedTasks = 0;

        const processBatch = async (taskBatch: any[]) => {
          const promises = taskBatch.map(async (task) => {
            try {
              await processTask(supabase, task, prompts, batchJob.id);
              completedTasks++;
              console.log(`✅ Completed task ${completedTasks}/${totalTasks}`);
            } catch (error) {
              console.error(`❌ Task failed:`, error);
              completedTasks++;
            }
          });
          
          await Promise.all(promises);
        };

        try {
          // Process tasks in batches with heartbeat updates
          for (let i = 0; i < batchTasks.length; i += concurrencyLimit) {
            // Check for cancellation before each batch
            const { data: jobCheck } = await supabase
              .from('batch_jobs')
              .select('cancellation_requested')
              .eq('id', batchJob.id)
              .single();

            if (jobCheck?.cancellation_requested) {
              console.log('🛑 Job cancellation detected, stopping processing');
              break;
            }

            // Update heartbeat
            await supabase
              .from('batch_jobs')
              .update({ last_heartbeat: new Date().toISOString() })
              .eq('id', batchJob.id);

            const batch = batchTasks.slice(i, i + concurrencyLimit);
            await processBatch(batch);
            
            // Small delay between batches to avoid overwhelming APIs
            if (i + concurrencyLimit < batchTasks.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          // Final reconciliation - let the database function handle the finalization
          await supabase.rpc('resume_stuck_batch_job', { p_job_id: batchJob.id });

          console.log('🎉 Background batch processing completed for job:', batchJob.id);
        } catch (error) {
          console.error('💥 Background processing failed:', error);
          // Mark job as failed
          await supabase
            .from('batch_jobs')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString()
            })
            .eq('id', batchJob.id);
        }
      })()
    );

    // Return immediate response while processing continues in background
    return new Response(JSON.stringify({
      success: true,
      batchJobId: batchJob.id,
      totalTasks: totalTasks,
      message: 'Batch job started and processing in background',
      status: 'processing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Batch processor error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processTask(supabase: any, task: any, prompts: any[], batchJobId: string) {
  const prompt = prompts.find(p => p.id === task.prompt_id);
  if (!prompt) {
    throw new Error(`Prompt not found: ${task.prompt_id}`);
  }

  const provider = PROVIDERS[task.provider];
  if (!provider) {
    throw new Error(`Provider not found: ${task.provider}`);
  }

  // Get organization details for brand analysis
  const { data: orgData } = await supabase
    .from('prompts')
    .select('org_id, organizations(*)')
    .eq('id', task.prompt_id)
    .single();

  const orgId = orgData?.org_id;

  // Update task status to processing
  await supabase
    .from('batch_tasks')
    .update({ 
      status: 'processing',
      started_at: new Date().toISOString(),
      attempts: 1
    })
    .eq('batch_job_id', batchJobId)
    .eq('prompt_id', task.prompt_id)
    .eq('provider', task.provider);

  try {
    // Get the actual user-facing response
    const result = await callProviderAPI(provider, prompt.text);
    
    // Analyze response using simple brand analyzer
    const analysis = await analyzeResponse(supabase, orgId, result.responseText);
    
    // Store successful result with both raw response and analysis
    const { error: responseError } = await supabase
      .from('prompt_provider_responses')
      .insert({
        org_id: orgId,
        prompt_id: task.prompt_id,
        provider: task.provider,
        status: 'success',
        score: analysis.score,
        org_brand_present: analysis.orgBrandPresent,
        org_brand_prominence: analysis.orgBrandProminence,
        brands_json: analysis.brands,
        competitors_json: analysis.competitors,
        competitors_count: analysis.competitors.length,
        token_in: result.tokenIn,
        token_out: result.tokenOut,
        raw_ai_response: result.responseText,
        model: provider.model,
        run_at: new Date().toISOString(),
        metadata: {
          analysis_method: 'simple_v3',
          processed_at: new Date().toISOString()
        }
      });

    if (responseError) {
      console.error('Failed to store response:', responseError);
    }

    // Update task as completed
    await supabase
      .from('batch_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: { ...analysis, rawResponse: result.responseText }
      })
      .eq('batch_job_id', batchJobId)
      .eq('prompt_id', task.prompt_id)
      .eq('provider', task.provider);

    // Update batch job completed count
    try {
      await supabase.rpc('increment_completed_tasks', { job_id: batchJobId });
    } catch (rpcError) {
      console.warn('RPC increment_completed_tasks failed, using fallback:', rpcError);
      // Fallback: use a select and update approach
      const { data: currentJob } = await supabase
        .from('batch_jobs')
        .select('completed_tasks')
        .eq('id', batchJobId)
        .maybeSingle();
      
      await supabase
        .from('batch_jobs')
        .update({ completed_tasks: (currentJob?.completed_tasks || 0) + 1 })
        .eq('id', batchJobId);
    }

  } catch (error: any) {
    console.error(`Provider ${task.provider} failed for prompt ${task.prompt_id}:`, error);
    
    // Update task as failed
    await supabase
      .from('batch_tasks')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('batch_job_id', batchJobId)
      .eq('prompt_id', task.prompt_id)
      .eq('provider', task.provider);

    // Update batch job failed count
    try {
      await supabase.rpc('increment_failed_tasks', { job_id: batchJobId });
    } catch (rpcError) {
      console.warn('RPC increment_failed_tasks failed, using fallback:', rpcError);
      // Fallback: use a select and update approach
      const { data: currentJob } = await supabase
        .from('batch_jobs')
        .select('failed_tasks')
        .eq('id', batchJobId)
        .maybeSingle();
      
      await supabase
        .from('batch_jobs')
        .update({ failed_tasks: (currentJob?.failed_tasks || 0) + 1 })
        .eq('id', batchJobId);
    }

    // Store failed response
    await supabase
      .from('prompt_provider_responses')
      .insert({
        org_id: orgId,
        prompt_id: task.prompt_id,
        provider: task.provider,
        status: 'error',
        error: error.message,
        run_at: new Date().toISOString()
      });

    throw error;
  }
}

async function callProviderAPI(provider: ProviderConfig, promptText: string) {
  const timeout = 30000; // 30 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    let response;
    
    if (provider.name === 'openai' || provider.name === 'perplexity') {
      response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            {
              role: 'user',
              content: promptText
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        }),
        signal: controller.signal
      });
    } else if (provider.name === 'gemini') {
      if (!provider.apiKey) {
        throw new Error('Gemini API key not configured');
      }
      console.log(`[Batch] Processing Gemini with key length: ${provider.apiKey.length}`);
      response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': provider.apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: promptText
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000
          }
        }),
        signal: controller.signal
      });
    } else {
      throw new Error(`Unsupported provider: ${provider.name}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract response text based on provider format
    let responseText = '';
    let tokenIn = 0;
    let tokenOut = 0;

    if (provider.name === 'openai' || provider.name === 'perplexity') {
      responseText = data.choices?.[0]?.message?.content || '';
      tokenIn = data.usage?.prompt_tokens || 0;
      tokenOut = data.usage?.completion_tokens || 0;
    } else if (provider.name === 'gemini') {
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      tokenIn = data.usageMetadata?.promptTokenCount || 0;
      tokenOut = data.usageMetadata?.candidatesTokenCount || 0;
    }

    return {
      responseText,
      tokenIn,
      tokenOut
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`API call timed out after ${timeout}ms`);
    }
    throw error;
  }
}

async function handleResumeMode(supabase: any, resumeJobId: string, orgId: string) {
  console.log('🔄 Resuming batch job:', resumeJobId);

  try {
    // Use database function to safely resume/finalize job
    const { data: resumeResult, error } = await supabase.rpc('resume_stuck_batch_job', {
      p_job_id: resumeJobId
    });

    if (error) {
      throw new Error(`Resume RPC failed: ${error.message}`);
    }

    console.log('📊 Resume result:', resumeResult);

    if (resumeResult.action === 'finalized') {
      return new Response(JSON.stringify({
        success: true,
        message: resumeResult.message,
        jobId: resumeJobId,
        action: 'finalized',
        completedTasks: resumeResult.completed_tasks,
        failedTasks: resumeResult.failed_tasks
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (resumeResult.action === 'resumed') {
      // Get pending tasks for the resumed job
      const { data: pendingTasks } = await supabase
        .from('batch_tasks')
        .select(`
          id, prompt_id, provider, attempts,
          prompts!inner(id, text, org_id)
        `)
        .eq('batch_job_id', resumeJobId)
        .eq('status', 'pending');

      if (!pendingTasks || pendingTasks.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No pending tasks found, job already complete',
          jobId: resumeJobId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`🔄 Resuming processing for ${pendingTasks.length} pending tasks`);

      // Get enabled providers
      const { data: enabledProviders } = await supabase
        .from('llm_providers')
        .select('name')
        .eq('enabled', true);

      const providers = enabledProviders?.filter(p => PROVIDERS[p.name.toLowerCase()]) || [];
      
      if (providers.length === 0) {
        throw new Error('No enabled providers with valid API keys found');
      }

      // Process remaining tasks with same background logic
      EdgeRuntime.waitUntil(
        (async () => {
          const concurrencyLimit = 5;
          let completedTasks = 0;

          const processBatch = async (taskBatch: any[]) => {
            const promises = taskBatch.map(async (task) => {
              try {
                // Create a proper prompt structure
                const prompt = { id: task.prompt_id, text: task.prompts.text };
                const prompts = [prompt];
                
                await processTask(supabase, task, prompts, resumeJobId);
                completedTasks++;
                console.log(`✅ Resumed task completed ${completedTasks}/${pendingTasks.length}`);
              } catch (error) {
                console.error(`❌ Resumed task failed:`, error);
                completedTasks++;
              }
            });
            
            await Promise.all(promises);
          };

          try {
            // Process tasks in batches with heartbeat
            for (let i = 0; i < pendingTasks.length; i += concurrencyLimit) {
              // Check for cancellation
              const { data: jobCheck } = await supabase
                .from('batch_jobs')
                .select('cancellation_requested')
                .eq('id', resumeJobId)
                .single();

              if (jobCheck?.cancellation_requested) {
                console.log('🛑 Resumed job cancellation detected, stopping');
                break;
              }

              // Update heartbeat
              await supabase
                .from('batch_jobs')
                .update({ last_heartbeat: new Date().toISOString() })
                .eq('id', resumeJobId);

              const batch = pendingTasks.slice(i, i + concurrencyLimit);
              await processBatch(batch);
              
              // Small delay between batches
              if (i + concurrencyLimit < pendingTasks.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }

            // Finalize job after all tasks complete
            await supabase.rpc('resume_stuck_batch_job', { p_job_id: resumeJobId });
            console.log('🎉 Resumed batch processing completed for job:', resumeJobId);
          } catch (error) {
            console.error('💥 Resumed processing failed:', error);
            await supabase
              .from('batch_jobs')
              .update({ status: 'failed', completed_at: new Date().toISOString() })
              .eq('id', resumeJobId);
          }
        })()
      );

      return new Response(JSON.stringify({
        success: true,
        message: 'Batch job resumed successfully',
        jobId: resumeJobId,
        action: 'resumed',
        pendingTasks: pendingTasks.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Unknown resume action'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Resume mode error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function callProviderAPI(provider: ProviderConfig, promptText: string) {
  const timeout = 30000; // 30 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    let response;
    
    if (provider.name === 'openai' || provider.name === 'perplexity') {
      response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            {
              role: 'user',
              content: promptText
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        }),
        signal: controller.signal
      });
    } else if (provider.name === 'gemini') {
      if (!provider.apiKey) {
        throw new Error('Gemini API key not configured');
      }
      console.log(`[Batch] Processing Gemini with key length: ${provider.apiKey.length}`);
      response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': provider.apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: promptText
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000
          }
        }),
        signal: controller.signal
      });
    } else {
      throw new Error(`Unsupported provider: ${provider.name}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract response text based on provider format
    let responseText = '';
    let tokenIn = 0;
    let tokenOut = 0;

    if (provider.name === 'openai' || provider.name === 'perplexity') {
      responseText = data.choices?.[0]?.message?.content || '';
      tokenIn = data.usage?.prompt_tokens || 0;
      tokenOut = data.usage?.completion_tokens || 0;
    } else if (provider.name === 'gemini') {
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      tokenIn = data.usageMetadata?.promptTokenCount || 0;
      tokenOut = data.usageMetadata?.candidatesTokenCount || 0;
    }

    return {
      responseText,
      tokenIn,
      tokenOut
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`API call timed out after ${timeout}ms`);
    }
    throw error;
  }
}
