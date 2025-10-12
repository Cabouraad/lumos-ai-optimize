import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
      buildRequest: (prompt) => ({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      }),
      extractResponse: (data) => data.choices?.[0]?.message?.content || ''
    });
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (geminiKey) {
    configs.push({
      name: 'gemini',
      apiKey: geminiKey,
      baseUrl: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      model: 'gemini-1.5-flash',
      buildRequest: (prompt) => ({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500 }
      }),
      extractResponse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    });
  }

  const googleAioKey = Deno.env.get('GOOGLE_AIO_API_KEY');
  if (googleAioKey) {
    configs.push({
      name: 'google_ai_overview',
      apiKey: googleAioKey,
      baseUrl: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleAioKey}`,
      model: 'gemini-1.5-flash',
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(config.buildRequest(prompt)),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return config.extractResponse(data);
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
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
    
    await supabase.from('prompt_provider_responses').insert({
      org_id: orgId,
      prompt_id: promptId,
      provider: provider.name,
      model: provider.model,
      status: 'success',
      raw_ai_response: rawResponse,
      score: 5.0,
      org_brand_present: false,
      competitors_count: 0,
      competitors_json: [],
      brands_json: [],
      token_in: 0,
      token_out: 0,
      metadata: {}
    });

    return true;
  } catch (error: any) {
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
      metadata: { error_type: 'processing_error' }
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

      console.log(`✅ Cancelled ${cancelled?.length || 0} jobs`);
    }

    // Get or create job
    let job: any;
    if (jobId) {
      const { data } = await supabase.from('batch_jobs').select('*').eq('id', jobId).single();
      job = data;
      
      if (!job || job.status === 'completed' || job.status === 'failed') {
        return new Response(JSON.stringify({
          action: 'completed',
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
            correlation_id: crypto.randomUUID()
          }
        })
        .select()
        .single();

      job = newJob;
      console.log('✅ Created job:', job.id);
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

    console.log(`🔄 Processing ${tasksToProcess} tasks...`);

    for (let i = 0; i < tasksToProcess; i++) {
      const taskIndex = tasksProcessed + i;
      const promptIndex = Math.floor(taskIndex / providers.length);
      const providerIndex = taskIndex % providers.length;

      if (promptIndex >= prompts.length) break;
      if (Date.now() - startTime > SAFETY_TIMEOUT) break;

      const prompt = prompts[promptIndex];
      const provider = providers[providerIndex];

      const success = await processTask(supabase, orgId, prompt.id, prompt.text, provider);
      if (success) completed++; else failed++;

      await supabase.from('batch_jobs').update({
        completed_tasks: job.completed_tasks + completed,
        failed_tasks: job.failed_tasks + failed,
        metadata: {
          ...job.metadata,
          last_heartbeat: new Date().toISOString()
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
        completed: newCompleted,
        failed: newFailed,
        remaining: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      action: 'in_progress',
      completed: newCompleted,
      failed: newFailed,
      remaining: newRemaining,
      progress: Math.round((newCompleted + newFailed) / totalTasks * 100)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Error:', error);
    
    return new Response(JSON.stringify({
      action: 'error',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
