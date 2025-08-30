import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { extractArtifacts, createBrandGazetteer } from '../_shared/visibility/extractArtifacts.ts'
import { detectCompetitors } from '../_shared/enhanced-competitor-detector.ts'

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
  apiKey: string;
  baseURL: string;
  model: string;
  extractResponse: (data: any) => string;
  buildRequest: (prompt: string) => any;
}

// Provider configurations
function getProviderConfigs(): Record<string, ProviderConfig> {
  return {
    openai: {
      apiKey: Deno.env.get('OPENAI_API_KEY') || '',
      baseURL: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      buildRequest: (prompt: string) => ({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that provides comprehensive answers to business questions.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7
      }),
      extractResponse: (data: any) => data.choices?.[0]?.message?.content || ''
    },
    perplexity: {
      apiKey: Deno.env.get('PERPLEXITY_API_KEY') || '',
      baseURL: 'https://api.perplexity.ai/chat/completions',
      model: 'sonar',
      buildRequest: (prompt: string) => ({
        model: 'sonar',
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
      apiKey: Deno.env.get('GEMINI_API_KEY') || '',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
      model: 'gemini-1.5-flash-latest',
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
    }
  };
}

// Enhanced AI response analysis using brand catalog and artifacts
async function analyzeAIResponse(
  supabase: any,
  orgId: string,
  responseText: string,
  orgData?: any
): Promise<any> {
  try {
    console.log('🔍 Starting enhanced AI response analysis...');
    
    // Build org brand variants directly from brand_catalog
    const { data: orgBrandData, error: orgBrandError } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', orgId)
      .eq('is_org_brand', true);
    
    if (orgBrandError) {
      console.error('Error fetching org brands:', orgBrandError);
    }
    
    // Build org brand variants with fallback
    let orgBrandVariants: string[] = [];
    if (orgBrandData && orgBrandData.length > 0) {
      for (const brand of orgBrandData) {
        orgBrandVariants.push(brand.name);
        const variants = brand.variants_json || [];
        orgBrandVariants.push(...variants);
      }
    }
    
    // Fallback to org name if no brands in catalog
    if (orgBrandVariants.length === 0 && orgData?.name) {
      orgBrandVariants = [orgData.name];
    }
    
    // Build competitor gazetteer from brand_catalog only
    const { data: competitorData, error: competitorError } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', orgId)
      .eq('is_org_brand', false);
    
    if (competitorError) {
      console.error('Error fetching competitors:', competitorError);
    }
    
    const competitorGazetteer = createBrandGazetteer(competitorData || []);
    
    console.log('📋 Analysis setup:', {
      orgBrandVariants: orgBrandVariants.length,
      competitorGazetteer: competitorGazetteer.length,
      responseLength: responseText.length
    });
    
    // Use extractArtifacts for primary matching
    const artifacts = extractArtifacts(responseText, orgBrandVariants, competitorGazetteer);
    
    // Determine brand presence and ordinal prominence
    const orgBrandPresent = artifacts.brands.length > 0;
    let orgBrandProminence: number | null = null;
    
    if (orgBrandPresent && artifacts.brands.length > 0) {
      // Calculate ordinal position (1st, 2nd, 3rd, etc.)
      const firstBrand = artifacts.brands[0];
      // Convert first_pos_ratio to ordinal position
      const position = Math.max(1, Math.round(firstBrand.first_pos_ratio * 10) + 1);
      orgBrandProminence = Math.min(position, 10); // Cap at 10th position
    }
    
    // Calculate visibility score aligned with client-side analyzer
    let score = 1; // Base score
    
    if (orgBrandPresent) {
      score = 6; // Brand found baseline
      
      // Position bonus (earlier = better)
      if (orgBrandProminence !== null) {
        if (orgBrandProminence === 1) score += 3; // First position
        else if (orgBrandProminence <= 3) score += 2; // Top 3
        else if (orgBrandProminence <= 6) score += 1; // Top 6
      }
      
      // Competition penalty
      const competitorsCount = artifacts.competitors.length;
      if (competitorsCount > 8) score -= 2;
      else if (competitorsCount > 4) score -= 1;
    }
    
    // Ensure score is within bounds
    score = Math.max(1, Math.min(10, score));
    
    // Use enhanced competitor detection for high-confidence unknowns
    const detectionResult = await detectCompetitors(supabase, orgId, responseText, {
      useNERFallback: true,
      maxCandidates: 10,
      confidenceThreshold: 0.8
    });
    
    // Collect high-confidence competitors not in catalog for brand_candidates
    const normalize = (str: string) => str.toLowerCase().trim();
    const competitorSet = new Set(competitorGazetteer.map(normalize));
    const orgBrandSet = new Set(orgBrandVariants.map(normalize));
    
    const unknownCompetitors = detectionResult.competitors.filter(c => 
      !competitorSet.has(normalize(c.name)) && 
      !orgBrandSet.has(normalize(c.name)) &&
      c.confidence > 0.8 &&
      c.name.length >= 3 &&
      !/^(seo|marketing|social|media|facebook|adobe|google|linkedin|twitter|instagram)$/i.test(c.name)
    );
    
    console.log('🎯 Analysis complete:', {
      orgBrandPresent,
      orgBrandProminence,
      score,
      catalogCompetitors: artifacts.competitors.length,
      unknownCandidates: unknownCompetitors.length
    });

    return {
      score,
      orgBrandPresent,
      orgBrandProminence,
      brands: artifacts.brands.map(b => b.name),
      competitors: artifacts.competitors.map(c => c.name),
      citations: artifacts.citations,
      unknownCompetitors: unknownCompetitors.map(c => ({
        name: c.name,
        confidence: c.confidence,
        mentions: c.mentions
      })),
      analysis_version: '2.1',
      extraction_method: 'enhanced_artifacts',
      industry_used: orgData?.industry || 'unknown',
      competitor_conf_threshold: 0.8
    };
  } catch (error) {
    console.error('❌ Analysis error:', error);
    throw error;
  }
}

// Call provider API with retries and timeout
async function callProviderAPI(
  provider: string,
  config: ProviderConfig,
  prompt: string
): Promise<{ success: boolean; response?: string; error?: string; tokenIn?: number; tokenOut?: number }> {
  
  const maxRetries = 3;
  const timeoutMs = 120000; // 2 minutes
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Calling ${provider} (attempt ${attempt}/${maxRetries})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const requestBody = config.buildRequest(prompt);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Make a copy of the config to avoid mutating the original
      let apiUrl = config.baseURL;
      
      // Set authorization header based on provider
      if (provider === 'openai') {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      } else if (provider === 'perplexity') {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      } else if (provider === 'gemini') {
        // Gemini uses API key as query parameter
        apiUrl += `?key=${config.apiKey}`;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`HTTP ${response.status}: ${errorText}`);
        
        // Fail fast for invalid model errors
        if (response.status === 400 && errorText.includes('Invalid model')) {
          console.error(`❌ ${provider} invalid model - failing immediately`);
          throw error;
        }
        
        throw error;
      }

      const data = await response.json();
      const extractedResponse = config.extractResponse(data);

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
      
    } catch (error: any) {
      console.error(`❌ ${provider} attempt ${attempt} failed:`, error.message);
      
      // Fail fast for configuration errors (don't retry)
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
      
      // Exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`⏳ Waiting ${backoffMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  return {
    success: false,
    error: `${provider} failed after ${maxRetries} attempts`
  };
}

// Process a single task
async function processTask(
  supabase: any,
  task: any,
  configs: Record<string, ProviderConfig>
): Promise<TaskResult> {
  try {
    console.log(`🎯 Processing task ${task.id} (${task.provider})`);
    
    // Update task status to processing
    await supabase
      .from('batch_tasks')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        attempts: (task.attempts || 0) + 1
      })
      .eq('id', task.id);

    // Get prompt details
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('text, org_id')
      .eq('id', task.prompt_id)
      .single();

    if (promptError) {
      throw new Error(`Failed to fetch prompt: ${promptError.message}`);
    }

    // Get organization data
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('name, domain, industry: business_description')
      .eq('id', prompt.org_id)
      .single();

    if (orgError) {
      console.warn('Could not fetch org data:', orgError);
    }

    const config = configs[task.provider];
    if (!config || !config.apiKey) {
      throw new Error(`Missing configuration or API key for provider: ${task.provider}`);
    }

    console.log(`🔄 Calling ${task.provider} for prompt: ${prompt.text.substring(0, 80)}...`);
    
    // Call the provider API
    const result = await callProviderAPI(task.provider, config, prompt.text);
    
    if (!result.success) {
      throw new Error(result.error || 'API call failed');
    }

    // Analyze the AI response
    const analysis = await analyzeAIResponse(supabase, prompt.org_id, result.response!, orgData);

    // Queue unknown competitors as brand candidates for review
    for (const candidate of analysis.unknownCompetitors) {
      try {
        const { error: candidateError } = await supabase
          .from('brand_candidates')
          .upsert({
            org_id: prompt.org_id,
            candidate_name: candidate.name,
            detection_count: candidate.mentions,
            confidence_score: candidate.confidence,
            status: 'pending'
          });
        
        if (candidateError) {
          console.error('Error queuing brand candidate:', candidateError);
        }
      } catch (error) {
        console.error('Error processing brand candidate:', error);
      }
    }

    // Store the response and analysis results
    const { data: responseData, error: responseError } = await supabase
      .from('prompt_provider_responses')
      .insert({
        org_id: prompt.org_id,
        prompt_id: task.prompt_id,
        provider: task.provider,
        model: config.model,
        status: 'success',
        raw_ai_response: result.response,
        score: analysis.score,
        org_brand_present: analysis.orgBrandPresent,
        org_brand_prominence: analysis.orgBrandProminence,
        competitors_count: analysis.competitors.length,
        competitors_json: analysis.competitors,
        brands_json: analysis.brands,
        token_in: result.tokenIn || 0,
        token_out: result.tokenOut || 0,
        metadata: {
          analysis_version: analysis.analysis_version,
          extraction_method: analysis.extraction_method,
          industry_used: analysis.industry_used,
          competitor_conf_threshold: analysis.competitor_conf_threshold,
          unknown_candidates_queued: analysis.unknownCompetitors.length
        }
      })
      .select()
      .single();

    if (responseError) {
      throw new Error(`Failed to store response: ${responseError.message}`);
    }

    // Update task as completed
    await supabase
      .from('batch_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: {
          response_id: responseData.id,
          score: analysis.score,
          brand_present: analysis.orgBrandPresent,
          competitors_count: analysis.competitors.length
        }
      })
      .eq('id', task.id);

    // Update job progress
    await supabase.rpc('increment_completed_tasks', { job_id: task.batch_job_id });

    console.log(`✅ Task ${task.id} completed successfully`);
    
    return { success: true, data: responseData };

  } catch (error: any) {
    console.error(`❌ Task ${task.id} failed:`, error.message);
    
    // Update task as failed
    await supabase
      .from('batch_tasks')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', task.id);

    // Update job progress
    await supabase.rpc('increment_failed_tasks', { job_id: task.batch_job_id });

    return { success: false, error: error.message };
  }
}

// Main server
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      console.error('❌ Invalid JSON in request body:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON in request body',
        details: error.message 
      }), {
        status: 200, // Return 200 to avoid edge function errors
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Safely extract parameters with defaults
    const { 
      action = 'create', 
      batchJobId, 
      orgId, 
      prompts, 
      providers, 
      resumeJobId,
      replace = false
    } = requestBody || {};

    console.log(`🚀 Batch processor started:`, {
      action,
      orgId: orgId?.substring(0, 8) + '...',
      providers: providers || 'not provided',
      promptsCount: prompts?.length || 'not provided',
      batchJobId: batchJobId?.substring(0, 8) + '...' || 'none',
      resumeJobId: resumeJobId?.substring(0, 8) + '...' || 'none',
      replace
    });

    // Validate required org_id
    if (!orgId) {
      console.log('⚠️ No orgId provided - nothing to do');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'orgId is required',
        action: 'validation_failed'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get configurations and filter by available API keys
    const configs = getProviderConfigs();
    const availableProviders = Object.keys(configs).filter(p => configs[p]?.apiKey);
    
    if (availableProviders.length === 0) {
      console.log('⚠️ No provider API keys available');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No provider API keys configured',
        action: 'configuration_missing',
        availableProviders: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If providers not specified, fetch from database
    let activeProviders = providers;
    if (!activeProviders || activeProviders.length === 0) {
      console.log('🔍 Fetching enabled providers from database...');
      const { data: providerData, error: providerError } = await supabase
        .from('llm_providers')
        .select('name')
        .eq('enabled', true);

      if (providerError) {
        console.error('❌ Failed to fetch providers:', providerError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch enabled providers',
          details: providerError.message,
          action: 'provider_fetch_failed'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      activeProviders = (providerData || []).map(p => p.name);
    }

    // Filter providers to only those with API keys
    const validProviders = activeProviders.filter(p => availableProviders.includes(p));
    
    if (validProviders.length === 0) {
      console.log('⚠️ No valid providers with API keys found');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No enabled providers have API keys configured',
        action: 'no_valid_providers',
        requestedProviders: activeProviders,
        availableProviders
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If prompts not specified, fetch from database
    let activePrompts = prompts;
    if (!activePrompts || activePrompts.length === 0) {
      console.log('🔍 Fetching active prompts from database...');
      const { data: promptData, error: promptError } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('org_id', orgId)
        .eq('active', true);

      if (promptError) {
        console.error('❌ Failed to fetch prompts:', promptError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch active prompts',
          details: promptError.message,
          action: 'prompt_fetch_failed'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      activePrompts = promptData || [];
    }

    if (activePrompts.length === 0) {
      console.log('⚠️ No active prompts found');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No active prompts found for organization',
        action: 'no_prompts',
        orgId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Processing setup:`, {
      validProviders,
      promptCount: activePrompts.length,
      totalTasks: activePrompts.length * validProviders.length
    });

    let jobId = batchJobId;
    let totalTasks = 0;

    if (action === 'create') {
      // Cancel existing jobs if replace=true
      if (replace) {
        console.log('🗑️ Cancelling existing active jobs for org...');
        const { error: cancelError } = await supabase.rpc('cancel_active_batch_jobs', {
          p_org_id: orgId,
          p_reason: 'preempted by new batch job'
        });

        if (cancelError) {
          console.error('⚠️ Failed to cancel existing jobs:', cancelError);
          // Don't fail the entire operation, just log the warning
        } else {
          console.log('✅ Successfully cancelled existing jobs');
        }
      }

      totalTasks = activePrompts.length * validProviders.length;

      // Create batch job
      const { data: batchJob, error: batchError } = await supabase
        .from('batch_jobs')
        .insert({
          org_id: orgId,
          status: 'pending',
          total_tasks: totalTasks,
          completed_tasks: 0,
          failed_tasks: 0,
          metadata: {
            prompts_count: activePrompts.length,
            providers_count: validProviders.length,
            provider_names: validProviders,
            source: 'robust-batch-processor',
            created_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (batchError) {
        console.error('❌ Failed to create batch job:', batchError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to create batch job',
          details: batchError.message,
          action: 'job_creation_failed'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      jobId = batchJob.id;
      console.log(`✅ Created batch job ${jobId} with ${totalTasks} tasks`);

      // Create individual tasks
      const tasks = [];
      for (const prompt of activePrompts) {
        for (const provider of validProviders) {
          tasks.push({
            batch_job_id: jobId,
            prompt_id: prompt.id,
            provider: provider,
            status: 'pending'
          });
        }
      }

      if (tasks.length > 0) {
        const { error: tasksError } = await supabase
          .from('batch_tasks')
          .insert(tasks);

        if (tasksError) {
          console.error('❌ Failed to create batch tasks:', tasksError);
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Failed to create batch tasks',
            details: tasksError.message,
            action: 'task_creation_failed',
            jobId
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`✅ Created ${tasks.length} batch tasks`);
      }

        // Update job status to processing
        const { error: updateError } = await supabase
          .from('batch_jobs')
          .update({ 
            status: 'processing', 
            started_at: new Date().toISOString(),
            last_heartbeat: new Date().toISOString(),
            runner_id: crypto.randomUUID()
          })
          .eq('id', jobId);

        if (updateError) {
          console.error('❌ Failed to update job status:', updateError);
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Failed to update job status',
            details: updateError.message,
            action: 'job_update_failed',
            jobId
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

    } else if (action === 'resume' && resumeJobId) {
      jobId = resumeJobId;
      
      // Resume stuck job
      const resumeResult = await supabase.rpc('resume_stuck_batch_job', {
        p_job_id: jobId
      });

      if (resumeResult.error) {
        console.error('❌ Failed to resume job:', resumeResult.error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to resume job',
          details: resumeResult.error.message,
          action: 'resume_failed',
          jobId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📋 Resumed batch job ${jobId}: ${JSON.stringify(resumeResult.data)}`);
    }

    // Start processing tasks with robust error handling
    const BATCH_SIZE = 5; // Process 5 tasks concurrently
    let processedCount = 0;
    let failedCount = 0;

    while (true) {
      // Get pending tasks
      const { data: pendingTasks, error: tasksError } = await supabase
        .from('batch_tasks')
        .select('*')
        .eq('batch_job_id', jobId)
        .eq('status', 'pending')
        .limit(BATCH_SIZE);

      if (tasksError) {
        console.error('❌ Failed to fetch pending tasks:', tasksError);
        break;
      }

      if (!pendingTasks || pendingTasks.length === 0) {
        console.log('⏳ No more pending tasks found');
        break;
      }

      console.log(`🚀 Processing ${pendingTasks.length} tasks...`);

      const currentBatch = pendingTasks;

      // Process batch of tasks concurrently with individual error handling
      const results = await Promise.allSettled(
        currentBatch.map(task => processTask(supabase, task, configs))
      );

      results.forEach((result, index) => {
        const taskId = currentBatch[index]?.id || 'unknown';
        if (result.status === 'fulfilled' && result.value.success) {
          processedCount++;
          console.log(`✅ Task ${taskId} completed successfully`);
        } else {
          failedCount++;
          const errorMsg = result.status === 'rejected' ? result.reason?.message || String(result.reason) : result.value?.error;
          console.error(`❌ Task ${taskId} failed:`, errorMsg);
        }
      });

      // Update heartbeat every batch
      await supabase
        .from('batch_jobs')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('id', jobId);
    }

    // Final job completion
    const { error: finalError } = await supabase
      .from('batch_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString()
      })
      .eq('id', jobId);

    if (finalError) {
      console.error('❌ Failed to mark job as completed:', finalError);
    }

    console.log(`🏁 Batch processing completed: ${processedCount} successful, ${failedCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      action: 'completed',
      batchJobId: jobId,
      jobId, // Legacy support
      totalProcessed: processedCount + failedCount,
      totalTasks,
      successful: processedCount,
      failed: failedCount,
      completedTasks: processedCount,
      failedTasks: failedCount,
      message: `Batch processing completed: ${processedCount} successful, ${failedCount} failed`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Batch processor error:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      action: 'error',
      details: error.stack || 'No stack trace available',
      timestamp: new Date().toISOString()
    }), {
      status: 200, // Return 200 to avoid edge function errors
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});