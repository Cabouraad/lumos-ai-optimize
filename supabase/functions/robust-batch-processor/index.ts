import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { analyzePromptResponse } from '../_shared/brand-response-analyzer.ts'
import { createEdgeLogger } from '../_shared/observability/structured-logger.ts'
import { corsHeaders, getStrictCorsHeaders, isRateLimited, getRateLimitHeaders } from '../_shared/cors.ts'
import { checkPromptQuota, createQuotaExceededResponse } from '../_shared/quota-enforcement.ts'
import { BatchUsageTracker } from '../_shared/usage-tracker.ts'
import { getOrgSubscriptionTier, filterAllowedProviders, auditProviderFilter, getAllowedProviders } from '../_shared/provider-policy.ts'

// Background resume function with safety limits
async function scheduleBackgroundResume(
  supabase: any, 
  jobId: string, 
  orgId: string, 
  correlationId: string,
  attempt: number = 1
): Promise<void> {
  const MAX_RESUME_ATTEMPTS = 3;
  const RESUME_DELAY_MS = 5000; // 5 second delay between resumes
  
  if (attempt > MAX_RESUME_ATTEMPTS) {
    console.log(`⚠️  Max resume attempts reached for job ${jobId}, correlation_id: ${correlationId}`);
    return;
  }

  try {
    // Wait before attempting resume
    await new Promise(resolve => setTimeout(resolve, RESUME_DELAY_MS));
    
    console.log(`🔄 Attempting background resume ${attempt}/${MAX_RESUME_ATTEMPTS} for job ${jobId}, correlation_id: ${correlationId}`);
    
    // Call ourselves recursively to resume processing with authentication
    // Try environment variable first, fallback to database
    let cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret) {
      const { data: secretData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'cron_secret')
        .single();
      cronSecret = secretData?.value;
    }
    
    const resumeResponse = await supabase.functions.invoke('robust-batch-processor', {
      body: { 
        action: 'resume', 
        resumeJobId: jobId, 
        orgId,
        correlationId,
        resumedBy: 'background-scheduler',
        attemptNumber: attempt
      },
      headers: cronSecret ? {
        'x-cron-secret': cronSecret
      } : {}
    });

    if (resumeResponse.error) {
      throw new Error(resumeResponse.error.message);
    }

    const result = resumeResponse.data;
    console.log(`📋 Background resume result for job ${jobId}: ${result.action}, correlation_id: ${correlationId}`);
    
    // If still in progress, schedule another resume
    if (result.action === 'in_progress') {
      EdgeRuntime.waitUntil(
        scheduleBackgroundResume(supabase, jobId, orgId, correlationId, attempt + 1)
      );
    } else {
      console.log(`✅ Background processing completed for job ${jobId}, correlation_id: ${correlationId}`);
    }
    
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`❌ Background resume failed for job ${jobId}, attempt ${attempt}, correlation_id: ${correlationId}:`, err);
    
    // Retry on failure if we haven't exhausted attempts
    if (attempt < MAX_RESUME_ATTEMPTS) {
      EdgeRuntime.waitUntil(
        scheduleBackgroundResume(supabase, jobId, orgId, correlationId, attempt + 1)
      );
    }
  }
}

// Rate limiting for public endpoint
const getClientIP = (req: Request): string => {
  return req.headers.get('x-forwarded-for')?.split(',')[0] || 
         req.headers.get('x-real-ip') || 
         'unknown';
};

// Helper to get today's date key in NY timezone
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
  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY') || '';
  // Check multiple possible Gemini key names (consistent with other functions)
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || 
                    Deno.env.get('GOOGLE_API_KEY') || 
                    Deno.env.get('GOOGLE_GENAI_API_KEY') || 
                    Deno.env.get('GENAI_API_KEY') || '';
  
  // Google AI Overviews configuration
  const serpApiKey = Deno.env.get('SERPAPI_KEY') || '';
  const enableGoogleAio = Deno.env.get('ENABLE_GOOGLE_AIO') === 'true';
  
  console.log('🔑 API Key Status:', {
    openai: openaiKey ? '✅ Available' : '❌ Missing',
    perplexity: perplexityKey ? '✅ Available' : '❌ Missing', 
    gemini: geminiKey ? '✅ Available' : '❌ Missing',
    google_ai_overview: (enableGoogleAio && serpApiKey) ? '✅ Available' : '❌ Missing/Disabled',
    geminiKeySource: geminiKey ? (
      Deno.env.get('GEMINI_API_KEY') ? 'GEMINI_API_KEY' :
      Deno.env.get('GOOGLE_API_KEY') ? 'GOOGLE_API_KEY' :
      Deno.env.get('GOOGLE_GENAI_API_KEY') ? 'GOOGLE_GENAI_API_KEY' :
      Deno.env.get('GENAI_API_KEY') ? 'GENAI_API_KEY' : 'unknown'
    ) : 'none'
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
        if (!content) {
          console.log('⚠️ OpenAI: No content in response:', JSON.stringify(data.choices?.[0], null, 2));
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
      extractResponse: (data: any) => {
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          console.log('⚠️ Perplexity: No content in response:', JSON.stringify(data.choices?.[0], null, 2));
        }
        return content || '';
      }
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
      apiKey: enableGoogleAio && serpApiKey ? serpApiKey : '', // Only include if enabled
      baseURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/fetch-google-aio`,
      model: 'serp-api',
      buildRequest: (prompt: string) => ({
        query: prompt,
        gl: 'us',
        hl: 'en'
      }),
      extractResponse: (data: any) => {
        // Normalize: summary || text || ""
        const text = data?.summary ?? data?.text ?? "";
        if (!text) {
          console.log('⚠️ Google AIO: No AI overview in response, reason:', data?.reason || 'unknown');
        }
        return text;
      }
    }
  };
}

// Helper function to queue competitor candidates for manual review
async function queueCompetitorCandidates(supabase: any, orgId: string, candidates: string[]) {
  for (const candidate of candidates.slice(0, 5)) { // Limit to top 5
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
      } else if (provider === 'google_ai_overview') {
        // Google AIO uses internal edge function with service role authentication
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

      // Handle rate limiting specifically for Google AIO
      if (!response.ok && response.status === 429 && provider === 'google_ai_overview') {
        const data = await response.json().catch(() => ({}));
        const retryAfter = data.retry_after || 3600;
        console.error(`⚠️ ${provider} rate limited, retry after ${retryAfter}s`);
        throw new Error(`rate_limited: retry after ${retryAfter}s`);
      }

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

      // For Google AIO, empty response with reason is valid (no_ai_overview)
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
      
      // Exponential backoff with jitter
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      const jitter = Math.floor(Math.random() * 300);
      const sleepMs = backoffMs + jitter;
      console.log(`⏳ Waiting ${sleepMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, sleepMs));
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
  configs: Record<string, ProviderConfig>,
  subscriptionTier: string = 'starter'
): Promise<TaskResult> {
  try {
    console.log(`🎯 Processing task ${task.id} (${task.provider}) for tier: ${subscriptionTier}`);
    
    // Task status is already updated by claim_batch_tasks RPC
    // No need for redundant update here

    // Get prompt details
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('text, org_id')
      .eq('id', task.prompt_id)
      .single();

    if (promptError) {
      throw new Error(`Failed to fetch prompt: ${promptError.message}`);
    }

    // Check if provider is allowed for this subscription tier
    const allowedProviders = getAllowedProviders(subscriptionTier as any);
    if (!allowedProviders.includes(task.provider)) {
      auditProviderFilter(prompt.org_id, subscriptionTier as any, [task.provider], allowedProviders, [task.provider]);
      throw new Error(`Provider ${task.provider} not allowed for ${subscriptionTier} tier`);
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

    // Get brand catalog for this org
    const { data: brandCatalog } = await supabase
      .from('brand_catalog')
      .select('name, is_org_brand, variants_json')
      .eq('org_id', prompt.org_id);
    
    // Analyze the AI response
    const analysis = await analyzePromptResponse(result.response!, orgData, brandCatalog || []);

    // Extract unknown competitors from metadata for brand candidates
    const unknownCompetitors = analysis.metadata?.ner_organizations || [];
    for (const candidateName of unknownCompetitors.slice(0, 5)) {
      try {
        const { error: candidateError } = await supabase
          .from('brand_candidates')
          .upsert({
            org_id: prompt.org_id,
            candidate_name: candidateName,
            detection_count: 1,
            confidence_score: 0.8,
            status: 'pending'
          });
        
        if (candidateError) {
          console.error('Error queuing brand candidate:', candidateError);
        }
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('Error processing brand candidate:', err);
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
        org_brand_present: analysis.org_brand_present,
        org_brand_prominence: analysis.org_brand_prominence,
        competitors_count: analysis.competitors_json.length,
        competitors_json: analysis.competitors_json,
        brands_json: analysis.brands_json,
        token_in: result.tokenIn || 0,
        token_out: result.tokenOut || 0,
        metadata: {
          analysis_method: analysis.metadata.analysis_method || 'comprehensive',
          detected_competitors: analysis.metadata.catalog_competitors || 0,
          discovered_competitors: analysis.metadata.global_competitors || 0,
          ner_candidates: unknownCompetitors.length
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
          brand_present: analysis.org_brand_present,
          competitors_count: analysis.competitors_json.length
        }
      })
      .eq('id', task.id);

    // Update job progress using batch_job_id from the task
    await supabase.rpc('increment_completed_tasks', { job_id: task.batch_job_id });

    console.log(`✅ Task ${task.id} completed successfully`);
    
    return { success: true, data: responseData };

  } catch (error) {
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

    // Update job progress using batch_job_id from the task
    await supabase.rpc('increment_failed_tasks', { job_id: task.batch_job_id });

    return { success: false, error: error.message };
  }
}

// Main server
Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);
  
  console.log(`🔍 Request received:`, {
    method: req.method,
    origin: requestOrigin,
    userAgent: req.headers.get('user-agent')?.substring(0, 50) + '...',
    hasAuth: !!req.headers.get('authorization'),
    hasCronSecret: !!req.headers.get('x-cron-secret'),
    isManualCall: req.headers.get('x-manual-call') === 'true'
  });
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting for public endpoint
  const clientIP = getClientIP(req);
  if (isRateLimited(clientIP, 30, 60000)) { // 30 requests per minute
    console.log(`🚫 Rate limit exceeded for IP: ${clientIP}`);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Rate limit exceeded',
      retryAfter: 60
    }), {
      status: 429,
      headers: { 
        ...corsHeaders, 
        ...getRateLimitHeaders(clientIP, 30, 60000),
        'Content-Type': 'application/json' 
      }
    });
  }

  try {
    // SECURITY GUARDRAIL: Check authentication since verify_jwt is disabled
    const authHeader = req.headers.get('authorization');
    const cronSecret = req.headers.get('x-cron-secret');
    
    // Allow either valid JWT or valid cron secret
    let isAuthenticated = false;
    
    if (authHeader) {
      // Check for Bearer token (from UI)
      if (authHeader.startsWith('Bearer ')) {
        isAuthenticated = true; // Basic validation - token presence
        console.log('🔐 Authenticated via Bearer token');
      }
    } else if (cronSecret) {
      // Check for valid cron secret (from scheduler)
      const validCronSecret = Deno.env.get('CRON_SECRET');
      isAuthenticated = validCronSecret && cronSecret === validCronSecret;
      console.log('🔐 Authenticated via cron secret:', isAuthenticated);
    }
    
    if (!isAuthenticated) {
      console.error('❌ Authentication failed: No valid authorization header or cron secret');
      console.log('🔍 Auth Debug:', {
        hasAuthHeader: !!authHeader,
        hasCronSecret: !!cronSecret,
        authHeaderPrefix: authHeader?.substring(0, 10) + '...',
        hasCronSecretEnv: !!Deno.env.get('CRON_SECRET')
      });
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authentication required',
        action: 'auth_failed'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
    } catch (error: unknown) {
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
      replace = false,
      correlationId = crypto.randomUUID()
    } = requestBody || {};

    console.log(`🚀 Batch processor started: [${correlationId}]`, {
      action,
      orgId: orgId?.substring(0, 8) + '...',
      providers: providers || 'not provided',
      promptsCount: prompts?.length || 'not provided',
      batchJobId: batchJobId?.substring(0, 8) + '...' || 'none',
      resumeJobId: resumeJobId?.substring(0, 8) + '...' || 'none',
      replace,
      correlationId
    });

    // Validate org_id and check quotas before processing
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

    // Extract user ID for quota checking if authenticated via JWT
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // Basic JWT parsing to get user ID - for production use proper JWT library
        const token = authHeader.substring(7);
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
        console.log('🔍 Extracted user ID from JWT:', userId?.substring(0, 8) + '...');
      } catch (error: unknown) {
        console.warn('⚠️ Failed to parse JWT for user ID:', error);
        // Don't fail the request, just skip quota checking
      }
    }

    // Get provider configs early to avoid TDZ issues
    const providerConfigs = getProviderConfigs();
    const validProviders = Object.keys(providerConfigs).filter(p => providerConfigs[p].apiKey);
    const activeProviders = providers ? providers.split(',') : validProviders;

    // Quota check bypassed for batch processing
    console.log('🔓 Quota checking bypassed for batch processing');

    // Handle preflight action to check system status
    if (action === 'preflight') {
      console.log(`🔍 Preflight check requested [${correlationId}]`);
      
      const configs = getProviderConfigs();
      const availableProviders = Object.keys(configs).filter(p => configs[p]?.apiKey);
      
      // Quota check bypassed for batch processing
      let quotaStatus = { allowed: true, error: null };
      
      // Get active prompts count
      const { data: promptData, error: promptError } = await supabase
        .from('prompts')
        .select('id')
        .eq('org_id', orgId)
        .eq('active', true);

      if (promptError) {
        console.error(`❌ Failed to fetch prompts for org ${orgId}:`, promptError);
        return new Response(JSON.stringify({
          success: false,
          action: 'preflight',
          correlationId,
          error: 'Failed to fetch prompts: ' + promptError.message,
          providers: {
            available: availableProviders,
            missing: Object.keys(configs).filter(p => !configs[p]?.apiKey),
            total: Object.keys(configs).length
          },
          quota: quotaStatus,
          expectedTasks: 0,
          promptCount: 0
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ Found ${promptData?.length || 0} active prompts for org ${orgId}`);
      const expectedTasks = (promptData?.length || 0) * availableProviders.length;
      
      return new Response(JSON.stringify({
        success: true,
        action: 'preflight',
        correlationId,
        providers: {
          available: availableProviders,
          missing: Object.keys(configs).filter(p => !configs[p]?.apiKey),
          total: Object.keys(configs).length
        },
        quota: quotaStatus,
        expectedTasks,
        promptCount: promptData?.length || 0,
        prompts: {
          count: promptData?.length || 0
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get configurations and filter by available API keys
    const configs = getProviderConfigs();
    const availableProviders = Object.keys(configs).filter(p => configs[p]?.apiKey);
    
    if (availableProviders.length === 0) {
      console.log(`⚠️ No provider API keys available [${correlationId}]`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No provider API keys configured',
        action: 'configuration_missing',
        availableProviders: [],
        correlationId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate provider configurations (already done above to avoid TDZ)
    if (validProviders.length === 0) {
      console.error('❌ No valid provider configurations found');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No valid provider configurations available',
        validProviders: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine which providers to use (already done above)
    
    if (validProviders.length === 0) {
    console.log('⚠️ No valid providers with API keys found');
    console.log('🔍 Provider Debug:', {
      providerConfigs: Object.keys(providerConfigs),
      validProviders,
      activeProviders,
      apiKeyStatus: Object.keys(providerConfigs).map((p: string) => ({
        provider: p,
        hasKey: !!providerConfigs[p].apiKey,
        keyLength: providerConfigs[p].apiKey?.length || 0
      }))
    });
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'No enabled providers have API keys configured',
      action: 'no_valid_providers',
      requestedProviders: activeProviders,
      availableProviders,
      debug: {
        apiKeyStatus: Object.keys(providerConfigs).map((p: string) => ({
          provider: p,
          hasKey: !!providerConfigs[p].apiKey
        }))
      }
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
      // IDEMPOTENCY GUARD: Check for existing daily job unless replace=true
      if (!replace) {
        const todayKeyNY = getTodayKeyNY();
        const { data: existingJob, error: checkError } = await supabase
          .from('batch_jobs')
          .select('id, status, created_at')
          .eq('org_id', orgId)
          .gte('created_at', `${todayKeyNY}T00:00:00`)
          .lt('created_at', `${todayKeyNY}T23:59:59`)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!checkError && existingJob) {
          console.log(`✅ Daily job already exists for org ${orgId} today: ${existingJob.id} (${existingJob.status})`);
          return new Response(JSON.stringify({
            success: true,
            action: 'duplicate_prevented',
            existingJobId: existingJob.id,
            existingJobStatus: existingJob.status,
            message: `Daily job already exists for today (${todayKeyNY})`,
            correlationId
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

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

      // Create batch job with enhanced metadata
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
            correlation_id: correlationId,
            created_at: new Date().toISOString(),
            today_key: getTodayKeyNY()
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

      // NEW: Direct processing without batch_tasks or RPCs
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name, domain, business_description')
        .eq('id', orgId)
        .maybeSingle();

      const { data: brandCatalog } = await supabase
        .from('brand_catalog')
        .select('name, is_org_brand, variants_json')
        .eq('org_id', orgId);

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

      // Initialize usage tracker for batch processing
      const usageTracker = new BatchUsageTracker(supabase, orgId, jobId || 'unknown');

      // Process all prompt x provider combinations sequentially with time-budget
      const TIME_BUDGET_MS = 280000; // 4m40s
      const startTime = Date.now();
      let processedCount = 0;
      let failedCount = 0;

      // Get subscription tier once
      const orgSubscriptionTier = await getOrgSubscriptionTier(supabase, orgId);

      for (const prompt of activePrompts) {
        for (const provider of validProviders) {
          // Time budget guard
          const elapsed = Date.now() - startTime;
          if (elapsed > TIME_BUDGET_MS) {
            const correlation = crypto.randomUUID();
            await supabase
              .from('batch_jobs')
              .update({
                status: 'processing',
                last_heartbeat: new Date().toISOString(),
                metadata: {
                  ...(typeof totalTasks === 'number' ? { total_tasks: totalTasks } : {}),
                  time_budget_exceeded: true,
                  elapsed_time_ms: elapsed,
                  processed_in_this_run: processedCount,
                  failed_in_this_run: failedCount,
                  correlation_id: correlation
                }
              })
              .eq('id', jobId);

            // If called by CRON, schedule background resume
            if (req.headers.get('x-cron-secret')) {
              EdgeRuntime.waitUntil(
                scheduleBackgroundResume(supabase, jobId, orgId, correlation)
              );
            }

            return new Response(JSON.stringify({
              success: true,
              action: 'in_progress',
              batchJobId: jobId,
              totalProcessed: processedCount + failedCount,
              processedSoFar: processedCount,
              failedSoFar: failedCount,
              elapsedTime: elapsed,
              correlationId: correlation,
              message: `Processing continues in background. ${processedCount} completed, ${failedCount} failed so far.`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          try {
            const cfg = providerConfigs[provider];
            if (!cfg || !cfg.apiKey) throw new Error(`Missing configuration or API key for provider: ${provider}`);

            // Call provider
            const result = await callProviderAPI(provider, cfg, prompt.text);
            if (!result.success || !result.response) throw new Error(result.error || 'API call failed');

            // Analyze
            const analysis = await analyzePromptResponse(result.response, orgData || {}, brandCatalog || []);

            // Persist normalized response
            const providerModel = provider === 'openai' ? 'gpt-4o-mini' :
                                  provider === 'perplexity' ? 'sonar' :
                                  provider === 'google_ai_overview' ? 'google-aio' : 'gemini-2.0-flash-lite';

            const { error: insertErr } = await supabase
              .from('prompt_provider_responses')
              .insert({
                org_id: orgId,
                prompt_id: prompt.id,
                provider,
                model: providerModel,
                status: 'success',
                score: analysis.score,
                org_brand_present: analysis.org_brand_present,
                org_brand_prominence: analysis.org_brand_prominence,
                brands_json: analysis.brands_json || analysis.brands || [],
                competitors_json: analysis.competitors_json || analysis.competitors || [],
                competitors_count: (analysis.competitors_json || analysis.competitors || []).length,
                token_in: result.tokenIn || 0,
                token_out: result.tokenOut || 0,
                raw_ai_response: result.response,
                run_at: new Date().toISOString(),
                metadata: { analysis_method: 'enhanced_v2_batch', subscription_tier: orgSubscriptionTier }
              });

            if (insertErr) throw new Error(`Failed to store response: ${insertErr.message}`);

            processedCount++;
            usageTracker.addCompletedTask(1, true);
          } catch (e: any) {
            failedCount++;
            usageTracker.addCompletedTask(1, false);
            // Also persist an error row for visibility in UI
            await supabase
              .from('prompt_provider_responses')
              .insert({
                org_id: orgId,
                prompt_id: prompt.id,
                provider,
                model: provider === 'openai' ? 'gpt-4o-mini' : provider === 'perplexity' ? 'sonar' : provider === 'google_ai_overview' ? 'google-aio' : 'gemini-2.0-flash-lite',
                status: 'error',
                error: e?.message || String(e),
                score: 0,
                org_brand_present: false,
                competitors_count: 0,
                competitors_json: [],
                brands_json: [],
                token_in: 0,
                token_out: 0,
                run_at: new Date().toISOString(),
                metadata: { error_type: e?.name || 'Error', batch: true }
              });
          }

          // Heartbeat/progress update
          await supabase
            .from('batch_jobs')
            .update({
              last_heartbeat: new Date().toISOString(),
              completed_tasks: processedCount,
              failed_tasks: failedCount
            })
            .eq('id', jobId);
        }
      }

      // Persist usage once
      if (processedCount > 0) {
        await usageTracker.persistBatchUsage();
      }

      // Mark completed
      await supabase
        .from('batch_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
          completed_tasks: processedCount,
          failed_tasks: failedCount
        })
        .eq('id', jobId);

      console.log(`🏁 Batch processing completed [${correlationId}]:`, {
        orgId,
        successful: processedCount,
        failed: failedCount,
        totalTasks,
        promptCount: activePrompts?.length || 0,
        providerCount: validProviders?.length || 0
      });

      return new Response(JSON.stringify({
        success: true,
        action: 'completed',
        batchJobId: jobId,
        totalTasks,
        completedTasks: processedCount,
        failedTasks: failedCount,
        successful: processedCount,
        failed: failedCount,
        correlationId,
        orgSummary: {
          orgId,
          promptCount: activePrompts?.length || 0,
          providerCount: validProviders?.length || 0,
          expectedTasks: totalTasks,
          completedTasks: processedCount,
          failedTasks: failedCount
        },
        message: `Batch processing completed: ${processedCount} successful, ${failedCount} failed`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      orgId,
      successful: processedCount,
      failed: failedCount,
      totalTasks: actualTotalTasks,
      promptCount: activePrompts?.length || 0,
      providerCount: validProviders?.length || 0
    });

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
      correlationId,
      orgSummary: {
        orgId,
        promptCount: activePrompts?.length || 0,
        providerCount: validProviders?.length || 0,
        expectedTasks: actualTotalTasks,
        completedTasks: processedCount,
        failedTasks: failedCount
      },
      message: `Batch processing completed: ${processedCount} successful, ${failedCount} failed`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    } catch (processingError: any) {
      console.error('🚨 Processing loop error:', processingError);
      await handleJobError(processingError, jobId);
      throw processingError;
    }

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Batch processor error:', err.message);
    
    // Ensure job is marked as failed if it's not already completed
    if (jobId) {
      try {
        await handleJobError(err, jobId);
      } catch (finalError) {
        console.error('❌ Failed to handle job error:', finalError);
      }
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Unknown error occurred',
      action: 'error',
      details: err.stack || 'No stack trace available',
      timestamp: new Date().toISOString(),
      jobId: jobId || 'unknown'
    }), {
      status: 200, // Return 200 to avoid edge function errors
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});