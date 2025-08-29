
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { extractArtifacts, createBrandGazetteer } from '../_shared/visibility/extractArtifacts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  headers: Record<string, string>;
  bodyTemplate: (prompt: string) => any;
  extractResponse: (data: any) => string;
}

// Provider configurations with retries and timeouts
const getProviderConfigs = (): Record<string, ProviderConfig> => ({
  openai: {
    name: 'openai',
    apiKey: Deno.env.get('OPENAI_API_KEY') || '',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    headers: { 'Content-Type': 'application/json' },
    bodyTemplate: (prompt: string) => ({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000
    }),
    extractResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  
  perplexity: {
    name: 'perplexity',
    apiKey: Deno.env.get('PERPLEXITY_API_KEY') || '',
    baseUrl: 'https://api.perplexity.ai/chat/completions',
    model: Deno.env.get('PERPLEXITY_MODEL') || 'sonar-small-online',
    headers: { 'Content-Type': 'application/json' },
    bodyTemplate: (prompt: string) => ({
      model: Deno.env.get('PERPLEXITY_MODEL') || 'sonar-small-online',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000
    }),
    extractResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  
  gemini: {
    name: 'gemini',
    apiKey: Deno.env.get('GEMINI_API_KEY') || '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
    model: 'gemini-1.5-flash-latest',
    headers: { 'Content-Type': 'application/json' },
    bodyTemplate: (prompt: string) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0.3,
        maxOutputTokens: 4000
      }
    }),
    extractResponse: (data: any) => data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
});

// Enhanced AI response analysis with artifact extraction
async function analyzeAIResponse(
  supabase: any,
  orgId: string,
  responseText: string,
  brandCatalog: any[],
  orgData?: any
): Promise<any> {
  try {
    // Create brand gazetteer for improved detection
    const gazetteer = createBrandGazetteer(brandCatalog, 'software'); // Default to software industry
    
    // Extract user brand normalizations for comparison - with fallback to org name
    let userBrandNorms = brandCatalog
      .filter(b => b.is_org_brand)
      .flatMap(b => [b.name, ...(b.variants_json || [])])
      .map(name => name.toLowerCase().trim());
    
    // BRAND FALLBACK: If no org brands configured, use organization name
    if (userBrandNorms.length === 0 && orgData?.name) {
      userBrandNorms = [orgData.name.toLowerCase().trim()];
      console.log(`🔄 Using organization name "${orgData.name}" as brand fallback`);
    }
    
    // Use enhanced artifact extraction
    const artifacts = extractArtifacts(responseText, userBrandNorms, gazetteer);
    
    // Determine brand presence and prominence
    const orgBrandPresent = artifacts.brands.length > 0;
    let orgBrandProminence: number | null = null;
    
    if (orgBrandPresent && artifacts.brands.length > 0) {
      // Use first position ratio to determine prominence (1-10 scale)
      const firstBrand = artifacts.brands[0];
      orgBrandProminence = Math.ceil((1 - firstBrand.first_pos_ratio) * 10);
    }
    
    // Calculate score based on brand presence and competition
    let score = 1; // Base score
    
    if (orgBrandPresent) {
      score = 6; // Brand found baseline
      
      // Position bonus
      if (orgBrandProminence) {
        if (orgBrandProminence >= 8) score += 3; // Very early mention
        else if (orgBrandProminence >= 6) score += 2; // Early mention
        else if (orgBrandProminence >= 4) score += 1; // Mid mention
      }
      
      // Competition penalty
      const competitorCount = artifacts.competitors.length;
      if (competitorCount > 8) score -= 2;
      else if (competitorCount > 4) score -= 1;
      
      // Confidence bonus
      if (artifacts.metadata.analysis_confidence > 0.8) score += 0.5;
    } else {
      // No brand found - lower score based on response quality
      score = responseText.length > 500 ? 2 : 1;
    }
    
    // Normalize score to 1-10 range
    score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));
    
    return {
      score,
      orgBrandPresent,
      orgBrandProminence,
      brands: artifacts.brands.map(b => b.name),
      competitors: artifacts.competitors
        .filter(c => c.confidence >= 0.6) // Filter low-confidence competitors
        .map(c => c.name),
      competitorsCount: artifacts.competitors.filter(c => c.confidence >= 0.6).length,
      citations: artifacts.citations,
      metadata: {
        ...artifacts.metadata,
        analysis_version: '2.0',
        extraction_method: 'enhanced_artifacts'
      }
    };
  } catch (error) {
    console.error('Analysis error:', error);
    
    // Fallback to simple analysis if enhanced method fails
    return {
      score: 1,
      orgBrandPresent: false,
      orgBrandProminence: null,
      brands: [],
      competitors: [],
      competitorsCount: 0,
      citations: [],
      metadata: {
        analysis_error: error.message,
        fallback_used: true
      }
    };
  }
}

// Call provider API with retries and timeout
async function callProviderAPI(
  config: ProviderConfig,
  prompt: string,
  maxRetries: number = 3,
  timeoutMs: number = 60000
): Promise<TaskResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const requestBody = config.bodyTemplate(prompt);
      const url = config.name === 'gemini' 
        ? `${config.baseUrl}?key=${config.apiKey}`
        : config.baseUrl;
      
      const headers = config.name === 'gemini'
        ? config.headers
        : { ...config.headers, Authorization: `Bearer ${config.apiKey}` };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const responseText = config.extractResponse(data);
      
      if (!responseText) {
        throw new Error('No response text extracted from API response');
      }

      return {
        success: true,
        data: {
          responseText,
          rawResponse: data,
          tokenUsage: data.usage || {}
        }
      };

    } catch (error: any) {
      console.error(`${config.name} attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        return {
          success: false,
          error: `Failed after ${maxRetries} attempts: ${error.message}`
        };
      }
      
      // Exponential backoff: 2^attempt seconds
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying ${config.name} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: 'Max retries exceeded'
  };
}

// Process a single task with enhanced analysis
async function processTask(
  supabase: any,
  task: any,
  brandCatalog: any[],
  orgData?: any
): Promise<void> {
  const { id: taskId, batch_job_id, prompt_id, provider: providerName } = task;

  try {
    // Update task status to processing
    await supabase
      .from('batch_tasks')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString(),
        attempts: (task.attempts || 0) + 1
      })
      .eq('id', taskId);

    // Get prompt details
    const { data: promptData, error: promptError } = await supabase
      .from('prompts')
      .select('text, org_id')
      .eq('id', prompt_id)
      .single();

    if (promptError || !promptData) {
      throw new Error(`Failed to fetch prompt: ${promptError?.message}`);
    }

    console.log(`🎯 Processing task ${taskId} (${providerName})`);
    console.log(`🔄 Calling ${providerName} for prompt: ${promptData.text.substring(0, 80)}...`);

    // Get provider configuration
    const providerConfigs = getProviderConfigs();
    const config = providerConfigs[providerName];
    
    if (!config || !config.apiKey) {
      throw new Error(`Provider ${providerName} not configured or missing API key`);
    }

    // Call provider API
    const result = await callProviderAPI(config, promptData.text);
    
    if (!result.success) {
      throw new Error(result.error || 'API call failed');
    }

    console.log(`✅ ${providerName} successful response`);

    // Analyze the response with enhanced extraction
    const analysis = await analyzeAIResponse(
      supabase,
      promptData.org_id,
      result.data.responseText,
      brandCatalog,
      orgData
    );

    // Store response in database
    const { error: insertError } = await supabase
      .from('prompt_provider_responses')
      .insert({
        org_id: promptData.org_id,
        prompt_id: prompt_id,
        provider: providerName,
        model: config.model,
        status: 'success',
        score: analysis.score,
        org_brand_present: analysis.orgBrandPresent,
        org_brand_prominence: analysis.orgBrandProminence,
        brands_json: analysis.brands,
        competitors_json: analysis.competitors,
        competitors_count: analysis.competitorsCount,
        raw_ai_response: result.data.responseText,
        raw_evidence: JSON.stringify(analysis.citations),
        token_in: result.data.tokenUsage.prompt_tokens || 0,
        token_out: result.data.tokenUsage.completion_tokens || 0,
        metadata: analysis.metadata,
        run_at: new Date().toISOString()
      });

    if (insertError) {
      throw new Error(`Failed to store response: ${insertError.message}`);
    }

    // Mark task as completed
    await supabase
      .from('batch_tasks')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: { 
          score: analysis.score,
          competitors_count: analysis.competitorsCount,
          org_brand_present: analysis.orgBrandPresent
        }
      })
      .eq('id', taskId);

    // Increment job completion counter
    await supabase.rpc('increment_completed_tasks', { job_id: batch_job_id });

    console.log(`✅ Task ${taskId} completed successfully`);

  } catch (error: any) {
    console.error(`❌ Task ${taskId} failed:`, error.message);
    
    // Get prompt details for error record
    const { data: promptData } = await supabase
      .from('prompts')
      .select('org_id')
      .eq('id', prompt_id)
      .single();
    
    // INSERT ERROR RECORD: Create a failed response record for UI visibility
    if (promptData) {
      await supabase
        .from('prompt_provider_responses')
        .insert({
          org_id: promptData.org_id,
          prompt_id: prompt_id,
          provider: providerName,
          model: getProviderConfigs()[providerName]?.model || 'unknown',
          status: 'error',
          score: 0,
          org_brand_present: false,
          org_brand_prominence: null,
          brands_json: [],
          competitors_json: [],
          competitors_count: 0,
          raw_ai_response: null,
          raw_evidence: null,
          error: error.message,
          token_in: 0,
          token_out: 0,
          metadata: {
            task_id: taskId,
            error_type: 'provider_failure',
            failed_at: new Date().toISOString()
          },
          run_at: new Date().toISOString()
        });
    }
    
    // Mark task as failed
    await supabase
      .from('batch_tasks')
      .update({ 
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId);

    // Increment job failure counter
    await supabase.rpc('increment_failed_tasks', { job_id: batch_job_id });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    const { jobId, orgId, resumeJobId, replace } = requestBody;
    
    let actualJobId = jobId || resumeJobId;
    let jobData;
    let orgData;

    // If resumeJobId is provided, process existing job
    if (resumeJobId) {
      console.log(`🔄 Resuming existing batch job: ${resumeJobId}`);
      
      const { data: existingJob, error: jobError } = await supabase
        .from('batch_jobs')
        .select('*')
        .eq('id', resumeJobId)
        .single();

      if (jobError || !existingJob) {
        throw new Error(`Resume job not found: ${jobError?.message}`);
      }

      actualJobId = resumeJobId;
      jobData = existingJob;
      
      // Get org data for this job
      const { data: orgInfo } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', existingJob.org_id)
        .single();
      orgData = orgInfo;
      
    } else if (orgId && !jobId) {
      // Create new batch job
      console.log(`🚀 Creating new batch job for org: ${orgId}`);
      
      // CANCEL EXISTING JOBS: Handle replace=true to cancel active jobs 
      if (replace) {
        console.log(`🛑 Cancelling existing active jobs for org ${orgId}`);
        const { data: cancelResult } = await supabase.rpc('cancel_active_batch_jobs', { 
          p_org_id: orgId,
          p_reason: 'replaced by new batch job'
        });
        console.log(`✅ Cancelled ${cancelResult?.cancelled_jobs || 0} existing jobs`);
      }
      
      // Get org data
      const { data: orgInfo, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgError) {
        throw new Error(`Organization not found: ${orgError.message}`);
      }
      orgData = orgInfo;
      
      // Get active prompts for the organization
      const { data: prompts, error: promptsError } = await supabase
        .from('prompts')
        .select('id')
        .eq('org_id', orgId)
        .eq('active', true);

      if (promptsError || !prompts || prompts.length === 0) {
        throw new Error(`No active prompts found for org ${orgId}: ${promptsError?.message}`);
      }

      // Get enabled providers
      const { data: providers, error: providersError } = await supabase
        .from('llm_providers')
        .select('name')
        .eq('enabled', true);
      
      const providerNames = providers?.map(p => p.name) || [];

      if (providersError || !providers || providers.length === 0) {
        throw new Error(`No enabled providers found: ${providersError?.message}`);
      }

      // Create batch job with unique constraint handling
      const totalTasks = prompts.length * providers.length;
      let newJob;
      let jobError;
      
      try {
        const { data, error } = await supabase
          .from('batch_jobs')
          .insert({
            org_id: orgId,
            total_tasks: totalTasks,
            status: 'pending',
            metadata: {
              created_by: 'robust-batch-processor',
              prompt_count: prompts.length,  // FIXED: Match UI field names
              provider_count: providers.length,
              provider_names: providerNames
            }
          })
          .select()
          .single();
          
        newJob = data;
        jobError = error;
        
      } catch (insertError: any) {
        // HANDLE DUPLICATE JOBS: If unique constraint error, try to resume existing job
        if (insertError.message?.includes('duplicate key') || insertError.message?.includes('unique constraint')) {
          console.log(`🔄 Duplicate job detected, attempting to find and resume existing job...`);
          
          const { data: existingJob } = await supabase
            .from('batch_jobs')
            .select('*')
            .eq('org_id', orgId)
            .in('status', ['pending', 'processing'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
          if (existingJob) {
            console.log(`✅ Found existing job ${existingJob.id}, resuming...`);
            newJob = existingJob;
            jobError = null;
          } else {
            throw new Error(`Duplicate job constraint error and no existing job found: ${insertError.message}`);
          }
        } else {
          throw insertError;
        }
      }

      if (jobError || !newJob) {
        throw new Error(`Failed to create batch job: ${jobError?.message}`);
      }

      actualJobId = newJob.id;
      jobData = newJob;
      console.log(`✅ Created batch job ${actualJobId} with ${totalTasks} tasks`);

      // Create batch tasks
      const tasks = [];
      for (const prompt of prompts) {
        for (const provider of providers) {
          tasks.push({
            batch_job_id: actualJobId,
            prompt_id: prompt.id,
            provider: provider.name,
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

    } else if (jobId) {
      console.log(`🚀 Processing existing batch job: ${jobId}`);
      
      // Get existing job details
      const { data: existingJob, error: jobError } = await supabase
        .from('batch_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !existingJob) {
        throw new Error(`Job not found: ${jobError?.message}`);
      }

      actualJobId = jobId;
      jobData = existingJob;
      
      // Get org data for this job
      const { data: orgInfo } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', existingJob.org_id)
        .single();
      orgData = orgInfo;
      
    } else {
      throw new Error('Either jobId, resumeJobId, or orgId must be provided');
    }

    // Update job status and heartbeat
    await supabase
      .from('batch_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        runner_id: 'robust-processor-v2'
      })
      .eq('id', actualJobId);

    // Get brand catalog for the organization
    const { data: brandCatalog } = await supabase
      .from('brand_catalog')
      .select('*')
      .eq('org_id', jobData.org_id);

    let processedTasks = 0;
    let iterationCount = 0;
    const MAX_ITERATIONS = 100; // Safety limit, but much higher
    const TASKS_PER_BATCH = 10; // Process more tasks per iteration

    // ROBUST PROCESSING LOOP: Continue until all tasks complete or max iterations
    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      
      // Check if cancellation was requested
      const { data: jobCheck } = await supabase
        .from('batch_jobs')
        .select('cancellation_requested, status')
        .eq('id', actualJobId)
        .single();
      
      if (jobCheck?.cancellation_requested) {
        console.log('🛑 Cancellation requested, stopping processing');
        break;
      }
      
      // Get pending tasks with larger batch size
      const { data: pendingTasks, error: tasksError } = await supabase
        .from('batch_tasks')
        .select('*')
        .eq('batch_job_id', actualJobId)
        .eq('status', 'pending')
        .limit(TASKS_PER_BATCH);

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        break;
      }

      if (!pendingTasks || pendingTasks.length === 0) {
        console.log(`⏳ No pending tasks found (iteration ${iterationCount})`);
        
        // COMPLETION CHECK: Verify all tasks are truly done
        const { data: allTasks } = await supabase
          .from('batch_tasks')
          .select('status')
          .eq('batch_job_id', actualJobId);

        const completedCount = allTasks?.filter(t => t.status === 'completed').length || 0;
        const failedCount = allTasks?.filter(t => t.status === 'failed').length || 0;
        const cancelledCount = allTasks?.filter(t => t.status === 'cancelled').length || 0;
        const processingCount = allTasks?.filter(t => t.status === 'processing').length || 0;
        const totalTasks = allTasks?.length || 0;

        console.log(`📊 Task status: ${completedCount} completed, ${failedCount} failed, ${cancelledCount} cancelled, ${processingCount} processing, ${totalTasks} total`);

        if (completedCount + failedCount + cancelledCount >= totalTasks && processingCount === 0) {
          console.log(`✅ All tasks finalized for job: ${actualJobId}`);
          
          // Update job status to completed with final counts
          await supabase
            .from('batch_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              completed_tasks: completedCount,
              failed_tasks: failedCount,
              metadata: {
                ...jobData.metadata,
                final_stats: {
                  completed: completedCount,
                  failed: failedCount,
                  cancelled: cancelledCount
                }
              }
            })
            .eq('id', actualJobId);
          
          break;
        }
        
        // STUCK TASK RECOVERY: Reset processing tasks that are stuck
        if (processingCount > 0) {
          console.log(`🔄 Found ${processingCount} potentially stuck processing tasks, resetting...`);
          await supabase
            .from('batch_tasks')
            .update({ 
              status: 'pending',
              started_at: null 
            })
            .eq('batch_job_id', actualJobId)
            .eq('status', 'processing')
            .lt('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Reset tasks older than 5 minutes
        }
        
        // Short wait before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Process tasks concurrently with improved error handling
      console.log(`🚀 Processing ${pendingTasks.length} tasks in iteration ${iterationCount}`);
      
      const taskPromises = pendingTasks.map(task => 
        processTask(supabase, task, brandCatalog || [], orgData)
      );

      const results = await Promise.allSettled(taskPromises);
      processedTasks += pendingTasks.length;
      
      const successfulTasks = results.filter(r => r.status === 'fulfilled').length;
      const failedTasks = results.filter(r => r.status === 'rejected').length;
      
      console.log(`📊 Batch ${iterationCount}: ${successfulTasks} successful, ${failedTasks} failed tasks`);

      // ROBUST HEARTBEAT: Update heartbeat and current progress
      await supabase
        .from('batch_jobs')
        .update({ 
          last_heartbeat: new Date().toISOString(),
          // Update progress counters in real-time
          metadata: {
            ...jobData.metadata,
            last_processed_batch: iterationCount,
            total_processed: processedTasks,
            last_heartbeat_iteration: iterationCount
          }
        })
        .eq('id', actualJobId);

      console.log(`📊 Total processed: ${processedTasks} tasks across ${iterationCount} iterations`);
      
      // Brief pause to prevent overwhelming the system
      if (pendingTasks.length === TASKS_PER_BATCH) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Final job completion check and summary
    const { data: finalTasks } = await supabase
      .from('batch_tasks')
      .select('status')
      .eq('batch_job_id', actualJobId);

    const completedCount = finalTasks?.filter(t => t.status === 'completed').length || 0;
    const failedCount = finalTasks?.filter(t => t.status === 'failed').length || 0;
    const cancelledCount = finalTasks?.filter(t => t.status === 'cancelled').length || 0;

    console.log(`🎉 Job ${actualJobId} completed: ${completedCount} success, ${failedCount} failed, ${cancelledCount} cancelled`);

    // Determine action taken
    const action = resumeJobId ? 'resumed' : (orgId && !jobId) ? 'started' : 'processed';
    
    return new Response(
      JSON.stringify({
        success: true,
        jobId: actualJobId,
        batchJobId: actualJobId, // UI compatibility
        action,
        completedTasks: completedCount,
        failedTasks: failedCount,
        cancelledTasks: cancelledCount,
        totalTasks: jobData.total_tasks,
        totalProcessed: processedTasks,
        message: action === 'started' ? `Batch job created with ${jobData.total_tasks} tasks` :
                 action === 'resumed' ? `Job resumed with ${completedCount + failedCount}/${jobData.total_tasks} completed` :
                 `Job processed: ${completedCount} completed, ${failedCount} failed`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Batch processor error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
