
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
    model: 'llama-3.1-sonar-small-128k-online',
    headers: { 'Content-Type': 'application/json' },
    bodyTemplate: (prompt: string) => ({
      model: 'llama-3.1-sonar-small-128k-online',
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
  brandCatalog: any[]
): Promise<any> {
  try {
    // Create brand gazetteer for improved detection
    const gazetteer = createBrandGazetteer(brandCatalog, 'software'); // Default to software industry
    
    // Extract user brand normalizations for comparison
    const userBrandNorms = brandCatalog
      .filter(b => b.is_org_brand)
      .flatMap(b => [b.name, ...(b.variants_json || [])])
      .map(name => name.toLowerCase().trim());
    
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
  brandCatalog: any[]
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
      brandCatalog
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
    const { jobId, orgId } = requestBody;
    
    let actualJobId = jobId;
    let jobData;

    // If orgId is provided but no jobId, create a new batch job
    if (orgId && !jobId) {
      console.log(`🚀 Creating new batch job for org: ${orgId}`);
      
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

      if (providersError || !providers || providers.length === 0) {
        throw new Error(`No enabled providers found: ${providersError?.message}`);
      }

      // Create batch job
      const totalTasks = prompts.length * providers.length;
      const { data: newJob, error: jobError } = await supabase
        .from('batch_jobs')
        .insert({
          org_id: orgId,
          total_tasks: totalTasks,
          status: 'pending',
          metadata: {
            created_by: 'robust-batch-processor',
            prompts_count: prompts.length,
            providers_count: providers.length
          }
        })
        .select()
        .single();

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
    } else {
      throw new Error('Either jobId or orgId must be provided');
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
    let maxChecks = 5;
    let currentCheck = 0;

    // Process tasks until completion or timeout
    while (currentCheck < maxChecks) {
      currentCheck++;
      
      // Get pending tasks
      const { data: pendingTasks, error: tasksError } = await supabase
        .from('batch_tasks')
        .select('*')
        .eq('batch_job_id', actualJobId)
        .eq('status', 'pending')
        .limit(5);

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        break;
      }

      if (!pendingTasks || pendingTasks.length === 0) {
        console.log(`⏳ No pending tasks found (${currentCheck}/${maxChecks})`);
        
        // Check if all tasks are completed
        const { data: allTasks } = await supabase
          .from('batch_tasks')
          .select('status')
          .eq('batch_job_id', actualJobId);

        const completedCount = allTasks?.filter(t => t.status === 'completed').length || 0;
        const failedCount = allTasks?.filter(t => t.status === 'failed').length || 0;
        const totalTasks = allTasks?.length || 0;

        if (completedCount + failedCount === totalTasks) {
          console.log(`✅ All tasks completed for job: ${actualJobId}`);
          
          // Update job status to completed
          await supabase
            .from('batch_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', actualJobId);
          
          break;
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // Process tasks concurrently (but limited)
      const taskPromises = pendingTasks.map(task => 
        processTask(supabase, task, brandCatalog || [])
      );

      await Promise.allSettled(taskPromises);
      processedTasks += pendingTasks.length;

      // Update heartbeat
      await supabase
        .from('batch_jobs')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('id', actualJobId);

      console.log(`📊 Processed ${processedTasks} tasks so far`);
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

    return new Response(
      JSON.stringify({
        success: true,
        jobId: actualJobId,
        completedTasks: completedCount,
        failedTasks: failedCount,
        cancelledTasks: cancelledCount,
        totalProcessed: processedTasks
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
