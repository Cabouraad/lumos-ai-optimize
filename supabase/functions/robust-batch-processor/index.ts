import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchJobRequest {
  orgId: string;
  promptIds?: string[];
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
    apiKey: Deno.env.get('GEMINI_API_KEY')!,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    model: 'gemini-1.5-flash'
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

    const { orgId, promptIds }: BatchJobRequest = await req.json();

    console.log('🚀 Starting robust batch processing for org:', orgId);

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

    // Create batch job
    const totalTasks = prompts.length * providers.length;
    const { data: batchJob, error: jobError } = await supabase
      .from('batch_jobs')
      .insert({
        org_id: orgId,
        status: 'processing',
        total_tasks: totalTasks,
        started_at: new Date().toISOString(),
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

    // Process tasks in batches
    for (let i = 0; i < batchTasks.length; i += concurrencyLimit) {
      const batch = batchTasks.slice(i, i + concurrencyLimit);
      await processBatch(batch);
      
      // Small delay between batches to avoid overwhelming APIs
      if (i + concurrencyLimit < batchTasks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Get final job status
    const { data: finalJob } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', batchJob.id)
      .single();

    console.log('🎉 Batch processing completed:', {
      jobId: batchJob.id,
      totalTasks: totalTasks,
      completed: finalJob?.completed_tasks || 0,
      failed: finalJob?.failed_tasks || 0
    });

    return new Response(JSON.stringify({
      success: true,
      batchJobId: batchJob.id,
      totalTasks: totalTasks,
      completed: finalJob?.completed_tasks || 0,
      failed: finalJob?.failed_tasks || 0,
      status: finalJob?.status || 'completed'
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
  const orgName = orgData?.organizations?.name;

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
    
    // Now analyze the real response for brands using proper brand matching
    const analysis = await analyzeBrandsInResponse(supabase, orgId, orgName, result.responseText);
    
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
        raw_ai_response: result.responseText, // This is now the real user-facing response
        model: provider.model,
        run_at: new Date().toISOString(),
        metadata: {
          analysis_method: 'catalog_boundary_match_v2',
          org_name: orgName
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
      response = await fetch(`${provider.endpoint}?key=${provider.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

async function analyzeBrandsInResponse(supabase: any, orgId: string, orgName: string, responseText: string) {
  try {
    // Fetch brand catalog for org
    const { data: brandCatalog } = await supabase
      .from('brand_catalog')
      .select('name, variants_json, is_org_brand')
      .eq('org_id', orgId);

    const text = responseText || '';
    const textLower = text.toLowerCase();

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const findFirstIndex = (needle: string) => {
      const pattern = new RegExp(`\\b${escapeRegex(needle.toLowerCase())}\\b`, 'i');
      const match = textLower.match(pattern);
      if (!match) return -1;
      return textLower.indexOf((match as any)[0].toLowerCase());
    };

    const orgBrands = (brandCatalog || []).filter((b: any) => b.is_org_brand);
    const competitors = (brandCatalog || []).filter((b: any) => !b.is_org_brand);

    // Build org brand patterns (names + variants)
    const orgPatterns: string[] = [];
    if (orgName) orgPatterns.push(orgName);
    for (const b of orgBrands) {
      if (b?.name) orgPatterns.push(b.name);
      if (Array.isArray(b?.variants_json)) {
        for (const v of b.variants_json) if (v) orgPatterns.push(v);
      }
    }
    // Special-case safety for HubSpot
    if (/hubspot/i.test(orgPatterns.join(' '))) {
      orgPatterns.push('marketing hub', 'hub spot', 'hubspot.com');
    }

    // Detect org brand presence and first position among all brands
    const mentions: { name: string; index: number; isOrg: boolean }[] = [];
    let orgBrandPresent = false;
    for (const p of orgPatterns) {
      const idx = p ? findFirstIndex(p) : -1;
      if (idx !== -1) {
        orgBrandPresent = true;
        mentions.push({ name: p, index: idx, isOrg: true });
      }
    }

    // Competitor filtering – expanded generic terms to avoid false positives
    const generic = new Set<string>([
      'seo','marketing','social','media','facebook','google','advertising','analytics','automation','content','digital',
      'platform','tool','tools','software','solution','service','services','company','business','website','online','internet','web',
      'app','application','system','technology','data','insights','reporting','dashboard','management','customer','lead','sales',
      'email','campaign','strategy','optimization','integration','api','cloud','mobile','desktop','browser','plugins','plugin',
      // extra noise we observed in your cards:
      'creation','combines','part','budget','your budget'
    ]);

    const foundCompetitors: string[] = [];
    for (const c of competitors) {
      const nameRaw = (c?.name || '').toString().trim();
      const name = nameRaw.toLowerCase();
      if (!nameRaw || name.length < 3 || generic.has(name)) continue;

      let idx = findFirstIndex(nameRaw);
      if (idx !== -1) {
        foundCompetitors.push(nameRaw);
        mentions.push({ name: nameRaw, index: idx, isOrg: false });
        continue;
      }

      if (Array.isArray(c?.variants_json)) {
        for (const v of c.variants_json) {
          const vRaw = (v || '').toString().trim();
          const vl = vRaw.toLowerCase();
          if (!vl || vl.length < 3 || generic.has(vl)) continue;
          idx = findFirstIndex(vRaw);
          if (idx !== -1) {
            foundCompetitors.push(nameRaw);
            mentions.push({ name: nameRaw, index: idx, isOrg: false });
            break;
          }
        }
      }
    }

    // Compute org brand prominence (rank among all brand mentions)
    let orgBrandProminence: number | null = null;
    if (orgBrandPresent && mentions.length > 0) {
      mentions.sort((a, b) => a.index - b.index);
      const firstOrg = mentions.findIndex(m => m.isOrg);
      orgBrandProminence = firstOrg >= 0 ? firstOrg + 1 : null;
    }

    // Unique competitor list
    const competitorsUnique = Array.from(new Set(foundCompetitors));

    // Score (same scale used elsewhere)
    let score = 0;
    if (orgBrandPresent) {
      score = 6;
      if (orgBrandProminence && orgBrandProminence <= 3) score += 2;
      else if (orgBrandProminence && orgBrandProminence <= 5) score += 1;
      const penalty = Math.min(2, competitorsUnique.length * 0.3);
      score -= penalty;
    } else if (competitorsUnique.length === 0) {
      score = 2;
    }
    score = Math.max(0, Math.min(10, score));

    return {
      score,
      orgBrandPresent,
      orgBrandProminence,
      brands: orgBrandPresent ? orgPatterns.slice(0, 3) : [],
      competitors: competitorsUnique
    };
  } catch (error) {
    console.error('Brand analysis failed (batch):', error);
    // Fallback to simple text analysis
    return analyzeTextForBrands(responseText);
  }
}

function analyzeTextForBrands(text: string) {
  // Simple fallback analysis
  const words = text.toLowerCase().split(/\s+/);
  const potentialBrands = words.filter(word => 
    word.length > 2 && 
    /^[a-z]+$/i.test(word) &&
    !['the', 'and', 'for', 'with', 'this', 'that', 'can', 'you', 'are', 'have'].includes(word)
  ).slice(0, 3);

  return {
    score: 1,
    orgBrandPresent: false,
    orgBrandProminence: null,
    brands: [],
    competitors: potentialBrands
  };
}
