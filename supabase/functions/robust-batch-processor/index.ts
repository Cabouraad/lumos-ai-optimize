import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchJob {
  id: string;
  org_id: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  last_heartbeat?: string;
  runner_id?: string;
  cancellation_requested?: boolean;
  metadata?: any;
}

interface BatchTask {
  id: string;
  batch_job_id: string;
  prompt_id: string;
  provider: string;
  status: string;
  attempts: number;
  error_message?: string;
}

// Provider configuration
const PROVIDER_CONFIG = {
  'openai': { envVar: 'OPENAI_API_KEY', name: 'OpenAI' },
  'perplexity': { envVar: 'PERPLEXITY_API_KEY', name: 'Perplexity' }, 
  'gemini': { envVar: 'GEMINI_API_KEY', name: 'Google Gemini' }
};

function getAvailableProviders(): string[] {
  return Object.entries(PROVIDER_CONFIG)
    .filter(([_, config]) => Deno.env.get(config.envVar))
    .map(([provider, _]) => provider);
}

function getMissingProviders(): string[] {
  return Object.entries(PROVIDER_CONFIG)
    .filter(([_, config]) => !Deno.env.get(config.envVar))
    .map(([_, config]) => config.name);
}

// FIXED: Pass supabase instance to avoid scope issues
async function callProviderAPI(supabase: any, provider: string, prompt: string): Promise<any> {
  const apiKey = Deno.env.get(PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG]?.envVar);
  if (!apiKey) {
    throw new Error(`API key not configured for ${provider}`);
  }

  console.log(`🔄 Calling ${provider} for prompt: ${prompt.substring(0, 100)}...`);

  try {
    const { data, error } = await supabase.functions.invoke('test-single-provider', {
      body: { 
        provider, 
        prompt,
        requireBrandClassification: true 
      }
    });

    if (error) {
      console.error(`❌ ${provider} API error:`, error);
      throw new Error(`${provider} API error: ${error.message}`);
    }

    if (!data || data.error) {
      console.error(`❌ ${provider} returned error:`, data?.error);
      throw new Error(`${provider} error: ${data?.error || 'Unknown error'}`);
    }

    console.log(`✅ ${provider} successful response`);
    return data;

  } catch (err) {
    console.error(`💥 ${provider} call failed:`, err);
    throw err;
  }
}

// IMPROVED: Atomic task claiming and robust error handling
async function processTask(
  supabase: any, 
  task: BatchTask, 
  promptsCache: Map<string, any>,
  runnerId: string
): Promise<void> {
  const startTime = Date.now();
  
  try {
    console.log(`🎯 Processing task ${task.id} (${task.provider})`);
    
    // Atomically claim the task (prevents duplicate processing)
    const { data: claimResult, error: claimError } = await supabase
      .from('batch_tasks')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString(),
        attempts: task.attempts + 1
      })
      .eq('id', task.id)
      .eq('status', 'pending') // Only update if still pending
      .select()
      .single();

    if (claimError || !claimResult) {
      console.log(`⏭️ Task ${task.id} already claimed or not found, skipping`);
      return;
    }

    // Get prompt from cache
    const prompt = promptsCache.get(task.prompt_id);
    if (!prompt) {
      throw new Error(`Prompt ${task.prompt_id} not found in cache`);
    }

    // Call the provider API (FIXED: pass supabase instance)
    const response = await callProviderAPI(supabase, task.provider, prompt.text);
    
    // Store the response in the database
    const { error: responseError } = await supabase
      .from('prompt_provider_responses')
      .insert({
        org_id: prompt.org_id,
        prompt_id: task.prompt_id,
        provider: task.provider,
        model: response.model || 'unknown',
        status: 'success',
        score: response.score || 0,
        org_brand_present: response.org_brand_present || false,
        org_brand_prominence: response.org_brand_prominence || null,
        competitors_count: response.competitors_count || 0,
        competitors_json: response.competitors_json || [],
        brands_json: response.brands_json || [],
        token_in: response.token_usage?.input || 0,
        token_out: response.token_usage?.output || 0,
        raw_ai_response: response.raw_response,
        raw_evidence: response.raw_evidence,
        metadata: {
          batch_job_id: task.batch_job_id,
          batch_task_id: task.id,
          runner_id: runnerId,
          processing_time_ms: Date.now() - startTime
        },
        run_at: new Date().toISOString()
      });

    if (responseError) {
      throw new Error(`Failed to store response: ${responseError.message}`);
    }

    // Mark task as completed
    await supabase
      .from('batch_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: { success: true, score: response.score }
      })
      .eq('id', task.id);

    // Increment job completed count
    await supabase.rpc('increment_completed_tasks', { job_id: task.batch_job_id });
    
    console.log(`✅ Task ${task.id} completed successfully`);

  } catch (error) {
    console.error(`❌ Task ${task.id} failed:`, error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Mark task as failed
    await supabase
      .from('batch_tasks')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        result: { success: false, error: errorMessage }
      })
      .eq('id', task.id);

    // Increment job failed count
    await supabase.rpc('increment_failed_tasks', { job_id: task.batch_job_id });
  }
}

async function updateHeartbeat(supabase: any, jobId: string, runnerId: string): Promise<void> {
  try {
    await supabase
      .from('batch_jobs')
      .update({ 
        last_heartbeat: new Date().toISOString(),
        runner_id: runnerId
      })
      .eq('id', jobId);
  } catch (error) {
    console.warn('Failed to update heartbeat:', error);
  }
}

async function checkCancellation(supabase: any, jobId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('batch_jobs')
      .select('cancellation_requested, status')
      .eq('id', jobId)
      .single();
    
    return data?.cancellation_requested === true || !['pending', 'processing'].includes(data?.status);
  } catch {
    return true; // Assume cancelled if we can't check
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { orgId, resumeJobId } = await req.json();
    
    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    const runnerId = `runner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🚀 Starting robust batch processing for org: ${orgId}`);
    if (resumeJobId) {
      console.log(`🔄 Resuming batch job: ${resumeJobId}`);
    }

    // Check available providers
    const availableProviders = getAvailableProviders();
    if (availableProviders.length === 0) {
      const missingProviders = getMissingProviders();
      throw new Error(`No provider API keys configured. Missing: ${missingProviders.join(', ')}`);
    }

    console.log(`✅ Available providers: ${availableProviders.join(', ')}`);

    let currentJob: BatchJob;
    let promptsCache: Map<string, any> = new Map();

    if (resumeJobId) {
      // Resume existing job
      console.log(`🔄 Attempting to resume job: ${resumeJobId}`);
      
      const { data: existingJob } = await supabase
        .from('batch_jobs')
        .select('*')
        .eq('id', resumeJobId)
        .eq('org_id', orgId)
        .single();

      if (!existingJob) {
        throw new Error(`Job ${resumeJobId} not found or doesn't belong to org ${orgId}`);
      }

      currentJob = existingJob;
      
      // Use the reconciler to properly resume the job
      const { data: resumeResult } = await supabase.rpc('resume_stuck_batch_job', {
        p_job_id: resumeJobId
      });

      console.log(`📊 Resume result:`, resumeResult);

      if (!resumeResult?.success) {
        throw new Error(`Failed to resume job: ${resumeResult?.error || 'Unknown error'}`);
      }

      if (resumeResult.action === 'finalized') {
        return new Response(JSON.stringify({
          success: true,
          action: 'finalized',
          message: `Job ${resumeJobId} was already complete`,
          completedTasks: resumeResult.completed_tasks,
          failedTasks: resumeResult.failed_tasks
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Load prompts cache for resumed job
      const { data: jobPrompts } = await supabase
        .from('batch_tasks')
        .select('prompt_id')
        .eq('batch_job_id', resumeJobId)
        .eq('status', 'pending');

      if (jobPrompts && jobPrompts.length > 0) {
        const promptIds = [...new Set(jobPrompts.map(t => t.prompt_id))];
        const { data: prompts } = await supabase
          .from('prompts')
          .select('id, text, org_id')
          .in('id', promptIds);
        
        if (prompts) {
          prompts.forEach(prompt => promptsCache.set(prompt.id, prompt));
        }
      }

    } else {
      // Start new job - IMPROVED: Single-job enforcement
      console.log(`🛑 Cancelling any existing active jobs for org: ${orgId}`);
      
      const { data: cancelResult } = await supabase.rpc('cancel_active_batch_jobs', {
        p_org_id: orgId,
        p_reason: 'preempted by new batch job'
      });

      if (cancelResult?.cancelled_jobs > 0) {
        console.log(`✅ Cancelled ${cancelResult.cancelled_jobs} existing jobs and ${cancelResult.cancelled_tasks} tasks`);
      }

      // FIXED: Get active prompts separately (no complex joins)
      const { data: prompts, error: promptsError } = await supabase
        .from('prompts')
        .select('id, text, org_id')
        .eq('org_id', orgId)
        .eq('active', true);

      if (promptsError) {
        throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
      }

      if (!prompts || prompts.length === 0) {
        throw new Error('No active prompts found for this organization');
      }

      // Build prompts cache
      prompts.forEach(prompt => promptsCache.set(prompt.id, prompt));

      console.log(`📝 Processing ${prompts.length} prompts across ${availableProviders.length} providers`);

      // Create batch job
      const totalTasks = prompts.length * availableProviders.length;
      const { data: newJob, error: jobError } = await supabase
        .from('batch_jobs')
        .insert({
          org_id: orgId,
          status: 'processing',
          total_tasks: totalTasks,
          started_at: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
          runner_id: runnerId,
          metadata: {
            prompt_count: prompts.length,
            provider_count: availableProviders.length,
            provider_names: availableProviders
          }
        })
        .select()
        .single();

      if (jobError) {
        throw new Error(`Failed to create batch job: ${jobError.message}`);
      }

      currentJob = newJob;
      console.log(`✅ Created batch job: ${currentJob.id}`);

      // Create batch tasks
      const tasks = [];
      for (const prompt of prompts) {
        for (const provider of availableProviders) {
          tasks.push({
            batch_job_id: currentJob.id,
            prompt_id: prompt.id,
            provider: provider,
            status: 'pending'
          });
        }
      }

      const { error: tasksError } = await supabase
        .from('batch_tasks')
        .insert(tasks);

      if (tasksError) {
        throw new Error(`Failed to create batch tasks: ${tasksError.message}`);
      }

      console.log(`✅ Created ${tasks.length} batch tasks`);
    }

    // ROBUST: Start processing with controlled concurrency and heartbeats
    console.log(`🎯 Starting task processing for job: ${currentJob.id}`);

    const heartbeatInterval = setInterval(async () => {
      await updateHeartbeat(supabase, currentJob.id, runnerId);
    }, 30000); // Every 30 seconds

    try {
      const concurrency = 3; // Process 3 tasks concurrently
      const activePromises = new Set<Promise<void>>();
      let consecutiveEmptyFetches = 0;
      const maxEmptyFetches = 5; // Stop after 5 consecutive empty fetches

      while (true) {
        // Check for cancellation
        if (await checkCancellation(supabase, currentJob.id)) {
          console.log(`🛑 Job ${currentJob.id} cancelled, stopping processing`);
          break;
        }

        // Clean up completed promises
        for (const promise of activePromises) {
          if (await Promise.race([promise, Promise.resolve('incomplete')]) !== 'incomplete') {
            activePromises.delete(promise);
          }
        }

        // Get pending tasks if we have capacity (FIXED: No complex joins)
        if (activePromises.size < concurrency) {
          const { data: pendingTasks, error: fetchError } = await supabase
            .from('batch_tasks')
            .select('id, batch_job_id, prompt_id, provider, status, attempts, error_message')
            .eq('batch_job_id', currentJob.id)
            .eq('status', 'pending')
            .limit(concurrency - activePromises.size);

          if (fetchError) {
            console.error('❌ Error fetching pending tasks:', fetchError);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
            continue;
          }

          if (!pendingTasks || pendingTasks.length === 0) {
            consecutiveEmptyFetches++;
            console.log(`⏳ No pending tasks found (${consecutiveEmptyFetches}/${maxEmptyFetches})`);
            
            if (activePromises.size === 0) {
              if (consecutiveEmptyFetches >= maxEmptyFetches) {
                console.log(`✅ All tasks completed for job: ${currentJob.id}`);
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before next check
              continue;
            }
            // Wait for active tasks to complete
            await Promise.race(activePromises);
            continue;
          }

          consecutiveEmptyFetches = 0; // Reset counter

          // Start processing available tasks
          for (const task of pendingTasks) {
            const taskPromise = processTask(
              supabase, 
              task, 
              promptsCache,
              runnerId
            );
            activePromises.add(taskPromise);

            // Clean up promise when done
            taskPromise.finally(() => {
              activePromises.delete(taskPromise);
            });
          }
        } else {
          // Wait for at least one task to complete
          await Promise.race(activePromises);
        }
      }

      // Wait for all remaining tasks to complete
      if (activePromises.size > 0) {
        console.log(`⏳ Waiting for ${activePromises.size} remaining tasks to complete...`);
        await Promise.all(activePromises);
      }

    } finally {
      clearInterval(heartbeatInterval);
    }

    // IMPROVED: Finalize job status with accurate counts
    const { data: finalStats } = await supabase
      .from('batch_tasks')
      .select('status')
      .eq('batch_job_id', currentJob.id);

    const completed = finalStats?.filter(t => t.status === 'completed').length || 0;
    const failed = finalStats?.filter(t => t.status === 'failed').length || 0;
    const cancelled = finalStats?.filter(t => t.status === 'cancelled').length || 0;
    const totalProcessed = completed + failed + cancelled;

    // Update final job status
    const jobStatus = (totalProcessed === currentJob.total_tasks) ? 'completed' : 'failed';
    
    await supabase
      .from('batch_jobs')
      .update({
        status: jobStatus,
        completed_tasks: completed,
        failed_tasks: failed,
        completed_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        metadata: {
          ...currentJob.metadata,
          final_stats: { completed, failed, cancelled },
          runner_id: runnerId,
          processing_completed_at: new Date().toISOString()
        }
      })
      .eq('id', currentJob.id);

    console.log(`🎉 Job ${currentJob.id} ${jobStatus}: ${completed} success, ${failed} failed, ${cancelled} cancelled`);

    return new Response(JSON.stringify({
      success: true,
      batchJobId: currentJob.id,
      action: resumeJobId ? 'resumed' : 'completed',
      status: jobStatus,
      totalTasks: currentJob.total_tasks,
      completedTasks: completed,
      failedTasks: failed,
      cancelledTasks: cancelled,
      availableProviders: availableProviders,
      message: `Batch processing ${jobStatus} successfully`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Batch processor error:', error);
    
    // Determine appropriate error message and status
    let statusCode = 500;
    let errorMessage = error.message;
    
    if (error.message.includes('No provider API keys')) {
      statusCode = 400;
      errorMessage = `Configuration Error: ${error.message}`;
    } else if (error.message.includes('No active prompts')) {
      statusCode = 400;
      errorMessage = 'No active prompts found. Please add and activate some prompts first.';
    } else if (error.message.includes('Organization ID is required')) {
      statusCode = 400;
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      action: 'error',
      message: 'Batch processing failed'
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});