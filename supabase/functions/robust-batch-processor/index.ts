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

// Provider executors and analysis inlined to remove fragile cross-function dependency
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    // @ts-ignore - consumers pass fetch promises
    const res: T = await promise;
    return res;
  } catch (e) {
    throw new Error(`${label} timeout or abort: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timeout);
  }
}

function computeVisibilityScoreInline(orgPresent: boolean, prominenceIdx: number | null, competitorsCount: number): number {
  if (!orgPresent) return 1;
  let score = 6;
  if (prominenceIdx !== null) {
    if (prominenceIdx === 0) score += 3;
    else if (prominenceIdx <= 2) score += 2;
    else if (prominenceIdx <= 5) score += 1;
  }
  if (competitorsCount > 8) score -= 2; else if (competitorsCount > 4) score -= 1;
  return Math.max(1, Math.min(10, score));
}

async function fetchOrgNameAndBrands(supabase: any, orgId: string): Promise<{ orgName: string | null; orgBrandVariants: string[]; competitorNames: string[]; }>{
  const [{ data: org }, { data: brands }] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', orgId).single(),
    supabase.from('brand_catalog').select('name,is_org_brand,variants_json').eq('org_id', orgId)
  ]);
  const orgName = org?.name ?? null;
  const orgBrandVariants: string[] = [];
  const competitorNames: string[] = [];
  (brands || []).forEach((b: any) => {
    if (b.is_org_brand) {
      orgBrandVariants.push(b.name);
      if (Array.isArray(b.variants_json)) orgBrandVariants.push(...b.variants_json);
    } else {
      competitorNames.push(b.name);
    }
  });
  return { orgName, orgBrandVariants, competitorNames };
}

function simpleAnalyze(responseText: string, orgName: string | null, orgVariants: string[], competitorNames: string[]) {
  const text = (responseText || '').toLowerCase();
  const allOrgTerms = [ ...(orgName ? [orgName] : []), ...orgVariants ].map(s => String(s).toLowerCase()).filter(Boolean);
  const orgMatches = allOrgTerms
    .map(term => ({ term, idx: text.indexOf(term) }))
    .filter(m => m.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  const orgPresent = orgMatches.length > 0;
  const orgProminence = orgPresent ? (orgMatches[0].idx === 0 ? 0 : Math.max(0, Math.floor(orgMatches[0].idx / 80))) : null;
  const competitorsFound = competitorNames
    .map(c => String(c))
    .filter(c => c && text.includes(c.toLowerCase()));
  const competitorsCount = competitorsFound.length;
  const score = computeVisibilityScoreInline(orgPresent, orgProminence, competitorsCount);
  return {
    score,
    org_brand_present: orgPresent,
    org_brand_prominence: orgProminence,
    competitors_count: competitorsCount,
    competitors: Array.from(new Set(competitorsFound)),
    brands: orgPresent ? [orgName || (allOrgTerms[0] || 'Brand')] : [],
    token_usage: { input: 0, output: 0 }
  };
}

async function executeOpenAI(promptText: string): Promise<{ model: string; response: string; token_usage: { input: number; output: number } }>{
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  const res = await withTimeout(fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Be precise and concise.' },
        { role: 'user', content: promptText }
      ]
    })
  }), 60000, 'openai');
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(json)}`);
  const text = json.choices?.[0]?.message?.content ?? '';
  const usage = json.usage || {};
  return { model: json.model || 'gpt-4o-mini', response: text, token_usage: { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 } };
}

async function executePerplexity(promptText: string): Promise<{ model: string; response: string; token_usage: { input: number; output: number } }>{
  const key = Deno.env.get('PERPLEXITY_API_KEY');
  if (!key) throw new Error('PERPLEXITY_API_KEY not configured');
  const body = {
    model: 'llama-3.1-sonar-small-128k-online',
    messages: [
      { role: 'system', content: 'Be precise and concise.' },
      { role: 'user', content: promptText }
    ],
    max_tokens: 800
  };
  const res = await withTimeout(fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }), 60000, 'perplexity');
  const json = await res.json();
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${JSON.stringify(json)}`);
  const text = json.choices?.[0]?.message?.content ?? '';
  const usage = json.usage || {};
  return { model: json.model || 'llama-3.1-sonar-small-128k-online', response: text, token_usage: { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 } };
}

async function executeGemini(promptText: string): Promise<{ model: string; response: string; token_usage: { input: number; output: number } }>{
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`;
  const payload = { contents: [{ role: 'user', parts: [{ text: promptText }] }] };
  const res = await withTimeout(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }), 60000, 'gemini');
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(json)}`);
  const candidates = json.candidates || [];
  const parts = candidates[0]?.content?.parts || [];
  const text = parts.map((p: any) => p.text).filter(Boolean).join('\n');
  return { model: 'gemini-2.0-flash-lite', response: text, token_usage: { input: 0, output: 0 } };
}

async function callProviderAPI(supabase: any, provider: string, prompt: string, orgId: string): Promise<any> {
  console.log(`🔄 Calling ${provider} directly (inlined)`);
  const maxAttempts = 3;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let execRes;
      if (provider === 'openai') execRes = await executeOpenAI(prompt);
      else if (provider === 'perplexity') execRes = await executePerplexity(prompt);
      else if (provider === 'gemini') execRes = await executeGemini(prompt);
      else throw new Error(`Unknown provider: ${provider}`);

      const { orgName, orgBrandVariants, competitorNames } = await fetchOrgNameAndBrands(supabase, orgId);
      const analysis = simpleAnalyze(execRes.response, orgName, orgBrandVariants, competitorNames);
      return {
        model: execRes.model,
        response: execRes.response,
        analysis: {
          score: analysis.score,
          org_brand_present: analysis.org_brand_present,
          org_brand_prominence: analysis.org_brand_prominence,
          competitors_count: analysis.competitors_count,
          competitors: analysis.competitors,
          brands: analysis.brands,
          token_usage: analysis.token_usage
        }
      };
    } catch (e: any) {
      lastErr = e;
      const msg = e?.message || String(e);
      const retryable = /(timeout|429|5\d\d|rate limit|temporarily unavailable)/i.test(msg);
      console.warn(`⚠️ ${provider} attempt ${attempt}/${maxAttempts} failed: ${msg}${retryable && attempt < maxAttempts ? ' → retrying' : ''}`);
      if (!retryable || attempt === maxAttempts) break;
      const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastErr || new Error(`${provider} call failed`);
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

    // Call the provider API with correct parameters
    const response = await callProviderAPI(supabase, task.provider, prompt.text, prompt.org_id);
    
    // Store the normalized response in the database
    const { error: responseError } = await supabase
      .from('prompt_provider_responses')
      .insert({
        org_id: prompt.org_id,
        prompt_id: task.prompt_id,
        provider: task.provider,
        model: response.analysis?.model || response.model || 'unknown',
        status: 'success',
        score: response.analysis?.score || response.score || 0,
        org_brand_present: response.analysis?.org_brand_present || response.org_brand_present || false,
        org_brand_prominence: response.analysis?.org_brand_prominence || response.org_brand_prominence || null,
        competitors_count: response.analysis?.competitors_count || response.competitors_count || 0,
        competitors_json: response.analysis?.competitors || response.competitors_json || [],
        brands_json: response.analysis?.brands || response.brands_json || [],
        token_in: response.analysis?.token_usage?.input || response.token_usage?.input || 0,
        token_out: response.analysis?.token_usage?.output || response.token_usage?.output || 0,
        raw_ai_response: response.response || response.raw_response || response.raw_ai_response,
        raw_evidence: response.analysis?.evidence || response.raw_evidence,
        metadata: {
          batch_job_id: task.batch_job_id,
          batch_task_id: task.id,
          runner_id: runnerId,
          processing_time_ms: Date.now() - startTime,
          provider_response_format: 'normalized'
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
        result: { 
          success: true, 
          score: response.analysis?.score || response.score || 0,
          provider_response_size: JSON.stringify(response).length
        }
      })
      .eq('id', task.id);

    // Increment job completed count
    await supabase.rpc('increment_completed_tasks', { job_id: task.batch_job_id });
    
    console.log(`✅ Task ${task.id} completed successfully`);

  } catch (error) {
    console.error(`❌ Task ${task.id} failed:`, error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryable = task.attempts < 3 && (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('500') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504')
    );
    
    if (isRetryable) {
      console.log(`🔄 Retrying task ${task.id} (attempt ${task.attempts + 1}/3)`);
      
      // Reset task to pending for retry with exponential backoff
      const backoffDelay = Math.min(1000 * Math.pow(2, task.attempts), 30000); // Max 30s
      
      await supabase
        .from('batch_tasks')
        .update({
          status: 'pending',
          started_at: null,
          error_message: `Retry ${task.attempts + 1}/3: ${errorMessage}`,
          result: { 
            success: false, 
            error: errorMessage, 
            retry_attempt: task.attempts + 1,
            next_retry_after: new Date(Date.now() + backoffDelay).toISOString()
          }
        })
        .eq('id', task.id);
        
      // Wait for backoff delay
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    } else {
      // Mark task as permanently failed
      await supabase
        .from('batch_tasks')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
          result: { 
            success: false, 
            error: errorMessage,
            final_attempt: task.attempts + 1,
            processing_time_ms: Date.now() - startTime,
            diagnostics: {
              provider: task.provider,
              error_type: errorMessage.includes('API') ? 'api_error' : 'processing_error',
              timestamp: new Date().toISOString()
            }
          }
        })
        .eq('id', task.id);

      // Increment job failed count
      await supabase.rpc('increment_failed_tasks', { job_id: task.batch_job_id });
    }
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

// Background job processing function
async function runJob(
  supabase: any, 
  currentJob: BatchJob, 
  promptsCache: Map<string, any>, 
  runnerId: string
): Promise<void> {
  console.log(`🎯 Starting background processing for job: ${currentJob.id}`);

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

      // Get pending tasks if we have capacity
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

  // Finalize job status with accurate counts
  const { data: finalStats } = await supabase
    .from('batch_tasks')
    .select('status')
    .eq('batch_job_id', currentJob.id);

  const completedCount = finalStats?.filter(t => t.status === 'completed').length || 0;
  const failedCount = finalStats?.filter(t => t.status === 'failed').length || 0;
  const cancelledCount = finalStats?.filter(t => t.status === 'cancelled').length || 0;

  const finalStatus = cancelledCount > 0 ? 'cancelled' : 
                     (completedCount === 0 && failedCount > 0) ? 'failed' : 'completed';

  await supabase
    .from('batch_jobs')
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      completed_tasks: completedCount,
      failed_tasks: failedCount,
      metadata: {
        ...currentJob.metadata,
        final_stats: {
          completed: completedCount,
          failed: failedCount,
          cancelled: cancelledCount
        }
      }
    })
    .eq('id', currentJob.id);

  console.log(`🎉 Job ${currentJob.id} completed: ${completedCount} success, ${failedCount} failed, ${cancelledCount} cancelled`);
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

      // Start background processing for resumed job
      EdgeRuntime.waitUntil(runJob(supabase, currentJob, promptsCache, runnerId));
      
      return new Response(JSON.stringify({
        success: true,
        action: 'resumed',
        batchJobId: currentJob.id,
        message: `Resuming job with ${resumeResult.pending_tasks} pending tasks`,
        totalTasks: currentJob.total_tasks,
        completedTasks: currentJob.completed_tasks,
        failedTasks: currentJob.failed_tasks
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      // Start new job - Single-job enforcement
      console.log(`🛑 Cancelling any existing active jobs for org: ${orgId}`);
      
      const { data: cancelResult } = await supabase.rpc('cancel_active_batch_jobs', {
        p_org_id: orgId,
        p_reason: 'preempted by new batch job'
      });

      if (cancelResult?.cancelled_jobs > 0) {
        console.log(`✅ Cancelled ${cancelResult.cancelled_jobs} existing jobs and ${cancelResult.cancelled_tasks} tasks`);
      }

      // Get active prompts
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
      
      // Start background processing for new job
      EdgeRuntime.waitUntil(runJob(supabase, currentJob, promptsCache, runnerId));
      
      // Return immediately with job started
      return new Response(JSON.stringify({
        success: true,
        action: 'started',
        batchJobId: currentJob.id,
        message: `Started processing ${totalTasks} tasks across ${prompts.length} prompts`,
        totalTasks: totalTasks
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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