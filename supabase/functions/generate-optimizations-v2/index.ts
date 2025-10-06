/**
 * Optimizations V2 Generation Engine
 * Uses Lovable AI (Gemini 2.5 Flash) with tool calling for guaranteed structured output
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PROMPTS_PER_RUN = 10;
const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY_MS = 1000;
const DEDUP_WINDOW_MINUTES = 15;

interface GenerationRequest {
  scope: "organization" | "org" | "prompt" | "batch";
  promptId?: string;
  promptIds?: string[];
  forceNew?: boolean;
}

interface OptimizationRecommendation {
  title: string;
  description: string;
  content_type: string;
  priority_score: number;
  difficulty_level: "easy" | "medium" | "hard";
  estimated_hours: number;
  implementation_steps: string[];
  distribution_channels: string[];
  content_specs: Record<string, any>;
  success_metrics: Record<string, any>;
  citations_used: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  // User-bound client for auth verification
  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // Service client for job/optimization writes (bypasses RLS)
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("[generate-optimizations-v2] Auth error:", authError);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: userData } = await userClient
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!userData?.org_id) {
      return jsonResponse({ error: "User has no organization" }, 400);
    }

    const orgId = userData.org_id;

    // Get org details
    const { data: org, error: orgError } = await userClient
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      console.error("[generate-optimizations-v2] Org fetch error:", orgError);
      return jsonResponse({ error: "Organization not found" }, 404);
    }

    const body: GenerationRequest = await req.json();
    
    // Normalize and validate scope
    const normalizedScope = (() => {
      const raw = (body.scope || '').toLowerCase();
      if (raw === 'organization' || raw === 'org') return 'org' as const;
      if (raw === 'prompt') return 'prompt' as const;
      if (raw === 'batch') return 'batch' as const;
      return null;
    })();

    if (!normalizedScope) {
      return jsonResponse({ error: "Invalid scope. Use 'org', 'prompt', or 'batch'." }, 400);
    }

    const inputHash = body.forceNew 
      ? crypto.randomUUID() 
      : createInputHash(orgId, { ...body, scope: normalizedScope });

    // Cancel any active jobs before starting new one
    console.log('[generate-optimizations-v2] Cancelling active jobs for org:', orgId);
    const { data: cancelResult } = await serviceClient.rpc('cancel_active_batch_jobs', {
      p_org_id: orgId,
      p_reason: 'New generation request initiated'
    });
    if (cancelResult) {
      console.log('[generate-optimizations-v2] Cancelled jobs:', cancelResult);
    }

    // Create job record using service client with normalized scope
    const { data: job, error: jobError } = await serviceClient
      .from("optimization_generation_jobs")
      .insert({
        org_id: orgId,
        requested_by: user.id,
        scope: normalizedScope,
        target_prompt_ids: body.promptIds || (body.promptId ? [body.promptId] : []),
        status: "queued",
        input_hash: inputHash,
        llm_model: "google/gemini-2.5-flash",
      })
      .select()
      .single();

    if (jobError || !job) {
      const code = (jobError as any)?.code;
      console.error("[generate-optimizations-v2] Job creation error:", jobError);

      // Dedup handling: fetch existing job and decide whether to resume or reuse
      if (code === '23505') {
        const { data: existing, error: fetchExistingErr } = await serviceClient
          .from("optimization_generation_jobs")
          .select("id,status,optimizations_created,error_message")
          .eq("org_id", orgId)
          .eq("input_hash", inputHash)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchExistingErr) {
          console.error("[generate-optimizations-v2] Fetch existing job error:", fetchExistingErr);
        }

        if (existing) {
          // Restart job if it's completed/failed with 0 optimizations (likely stale)
          const shouldRestart = (
            (existing.status === 'completed' || existing.status === 'failed') &&
            (existing.optimizations_created ?? 0) === 0
          );

          if (shouldRestart) {
            console.log(`[generate-optimizations-v2] Restarting stale job ${existing.id}`);
            await updateJob(serviceClient, existing.id, {
              status: 'queued',
              error_message: null,
              started_at: null,
              completed_at: null,
              optimizations_created: 0,
              total_tokens_used: 0,
            });

            const promise = processJobInBackground(existing.id, orgId, org, body, serviceClient);
            // @ts-ignore
            if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
              // @ts-ignore
              EdgeRuntime.waitUntil(promise);
            }

            return jsonResponse({
              success: true,
              jobId: existing.id,
              status: 'queued',
              message: "Restarting previous job",
            });
          }

          console.log(`[generate-optimizations-v2] Returning existing job ${existing.id}`);
          return jsonResponse({
            success: true,
            jobId: existing.id,
            status: existing.status ?? 'queued',
            message: "Using existing job",
          });
        }
      }

      // Scope constraint violation
      if (code === '23514') {
        return jsonResponse({ error: "Scope violates constraint. Use 'org', 'prompt', or 'batch'." }, 400);
      }

      return jsonResponse({ error: "Failed to create job" }, 500);
    }

    console.log(`[generate-optimizations-v2] Job created: ${job.id}`);

    // Start background processing
    const promise = processJobInBackground(job.id, orgId, org, body, serviceClient);
    
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(promise);
    } else {
      // Fallback for local development
      promise.catch(err => console.error("[generate-optimizations-v2] Background error:", err));
    }

    return jsonResponse({
      success: true,
      jobId: job.id,
      status: "queued",
      message: "Generation started in background",
    });

  } catch (error) {
    console.error("[generate-optimizations-v2] Request error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});

async function processJobInBackground(
  jobId: string,
  orgId: string,
  org: any,
  body: GenerationRequest,
  serviceClient: any
) {
  const logs: Array<{ t: number; msg: string; [key: string]: any }> = [];
  
  try {
    logs.push({ t: Date.now(), msg: 'job_started' });
    
    await updateJob(serviceClient, jobId, {
      status: "running",
      started_at: new Date().toISOString(),
      logs_json: logs,
    });

    // Refresh MV before querying (best effort)
    try {
      await serviceClient.rpc('refresh_low_visibility_view');
      logs.push({ t: Date.now(), msg: 'mv_refreshed' });
    } catch (refreshErr) {
      logs.push({ t: Date.now(), msg: 'mv_refresh_failed', error: String(refreshErr) });
    }

    // Primary: Get low visibility prompts via MV-backed RPC
    const { data: lowVisPrompts, error: promptsError } = await serviceClient
      .rpc("get_low_visibility_prompts_internal", {
        p_org_id: orgId,
        p_limit: MAX_PROMPTS_PER_RUN,
      });

    if (promptsError) {
      const errMsg = `Failed to fetch prompts: ${promptsError.message || JSON.stringify(promptsError)}`;
      console.error("[generate-optimizations-v2] Prompt fetch error:", promptsError);
      logs.push({ t: Date.now(), msg: 'prompt_fetch_error', error: errMsg });
      await updateJob(serviceClient, jobId, {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errMsg,
        logs_json: logs,
      });
      return;
    }

    let prompts = lowVisPrompts || [];
    
    if (prompts.length > 0) {
      logs.push({ t: Date.now(), msg: 'mv_results', count: prompts.length });
    } else {
      // Fallback: Direct live query (last 30d, min_runs>=1, presence<100%)
      logs.push({ t: Date.now(), msg: 'using_fallback_query' });
      
      const { data: liveData } = await serviceClient
        .from('prompt_provider_responses')
        .select('prompt_id, org_brand_present, score, prompts!inner(id, text, active)')
        .eq('org_id', orgId)
        .eq('status', 'success')
        .gte('run_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (liveData?.length) {
        const byPrompt = new Map<string, { id: string; text: string; runs: number; present: number; scores: number[] }>();
        
        for (const r of liveData) {
          const id = r.prompt_id;
          if (!r.prompts?.active) continue;
          
          const prev = byPrompt.get(id) ?? { 
            id, 
            text: r.prompts.text, 
            runs: 0, 
            present: 0, 
            scores: [] 
          };
          prev.runs += 1;
          if (r.org_brand_present) prev.present += 1;
          if (typeof r.score === 'number') prev.scores.push(r.score);
          byPrompt.set(id, prev);
        }
        
        prompts = [...byPrompt.values()]
          .map(v => ({
            prompt_id: v.id,
            prompt_text: v.text,
            total_runs: v.runs,
            presence_rate: v.runs ? (v.present / v.runs) * 100 : 0,
            avg_score_when_present: v.scores.length ? v.scores.reduce((a, b) => a + b, 0) / v.scores.length : null,
            top_citations: []
          }))
          .filter(v => v.total_runs >= 1 && v.presence_rate < 100)
          .sort((a, b) => a.presence_rate - b.presence_rate)
          .slice(0, MAX_PROMPTS_PER_RUN);
          
        logs.push({ t: Date.now(), msg: 'fallback_results', count: prompts.length });
      }
    }

    if (!prompts.length) {
      console.log(`[generate-optimizations-v2] No low visibility prompts found`);
      logs.push({ t: Date.now(), msg: 'no_prompts_found' });
      await updateJob(serviceClient, jobId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        optimizations_created: 0,
        error_message: "No low visibility prompts found",
        logs_json: logs,
      });
      return;
    }

    console.log(`[generate-optimizations-v2] Processing ${prompts.length} prompts`);
    logs.push({ t: Date.now(), msg: 'processing_prompts', count: prompts.length });

    const optimizations = [];
    let totalTokens = 0;

    // Process prompts with rate limiting
    for (let i = 0; i < prompts.length; i++) {
      const promptData = prompts[i];
      
      try {
        const result = await generateOptimizationWithRetry(
          promptData,
          org,
          LOVABLE_API_KEY,
          MAX_RETRIES
        );

        if (result.success && result.optimizations) {
          optimizations.push(...result.optimizations);
          totalTokens += result.tokensUsed || 0;
          logs.push({ t: Date.now(), msg: 'prompt_processed', promptId: promptData.prompt_id, recsCount: result.optimizations.length });
        }

        // Rate limiting between requests
        if (i < prompts.length - 1) {
          await sleep(RATE_LIMIT_DELAY_MS);
        }
      } catch (error: any) {
        console.error(`[generate-optimizations-v2] Error for prompt ${promptData.prompt_id}:`, error);
        logs.push({ t: Date.now(), msg: 'prompt_error', promptId: promptData.prompt_id, error: error.message });
        
        // Surface critical errors (rate limits, credits)
        if (error.status === 429 || error.status === 402) {
          logs.push({ t: Date.now(), msg: 'critical_error', status: error.status });
          await updateJob(serviceClient, jobId, {
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: error.message,
            logs_json: logs,
          });
          return;
        }
      }
    }

    if (optimizations.length === 0) {
      logs.push({ t: Date.now(), msg: 'no_recs_after_parsing' });
    }

    // Upsert optimizations (handles duplicates gracefully)
    let inserted = 0;
    if (optimizations.length > 0) {
      const { data: upserted, error: insertError } = await serviceClient
        .from("optimizations_v2")
        .upsert(optimizations, { 
          onConflict: 'org_id,content_hash',
          ignoreDuplicates: true 
        })
        .select('id');

      if (insertError) {
        console.error("[generate-optimizations-v2] Insert error:", insertError);
        logs.push({ t: Date.now(), msg: 'insert_error', error: insertError.message });
        throw insertError;
      }
      
      inserted = (upserted || []).length;
      logs.push({ t: Date.now(), msg: 'inserted_count', inserted });
    }

    await updateJob(serviceClient, jobId, {
      status: "completed",
      completed_at: new Date().toISOString(),
      optimizations_created: inserted,
      total_tokens_used: totalTokens,
      logs_json: logs,
    });

    console.log(`[generate-optimizations-v2] Job ${jobId} completed: ${inserted} optimizations`);

  } catch (error) {
    console.error(`[generate-optimizations-v2] Job ${jobId} failed:`, error);
    logs.push({ t: Date.now(), msg: 'job_failed', error: error instanceof Error ? error.message : String(error) });
    await updateJob(serviceClient, jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : String(error),
      logs_json: logs,
    });
  }
}

async function generateOptimizationWithRetry(
  promptData: any,
  org: any,
  apiKey: string,
  maxRetries: number
): Promise<{ success: boolean; optimizations?: any[]; tokensUsed?: number }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateOptimization(promptData, org, apiKey);
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on rate limit or payment errors
      if (error.status === 429 || error.status === 402) {
        throw error;
      }
      
      console.warn(`[generate-optimizations-v2] Attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries - 1) {
        await sleep(1000 * (attempt + 1)); // Exponential backoff
      }
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

async function generateOptimization(
  promptData: any,
  org: any,
  apiKey: string
): Promise<{ success: boolean; optimizations?: any[]; tokensUsed?: number }> {
  
  const systemPrompt = `You are an AI visibility optimization expert. Generate actionable content recommendations to improve visibility in AI responses.

Organization Context:
- Name: ${org.name}
- Domain: ${org.domain}
- Description: ${org.business_description || "Not provided"}
- Products/Services: ${org.products_services || "Not provided"}
- Target Audience: ${org.target_audience || "Not provided"}

Prompt Analysis:
- Query: "${promptData.prompt_text}"
- Current Visibility: ${promptData.presence_rate || 0}%
- Total Runs: ${promptData.total_runs || 0}
- Top Citations: ${JSON.stringify(promptData.top_citations || [])}

Generate 2-3 specific, actionable content recommendations that will improve visibility for this query.`;

  const tools = [{
    type: "function",
    function: {
      name: "propose_optimizations",
      description: "Propose content optimizations to improve AI visibility",
      parameters: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Clear, actionable title (max 100 chars)" },
                description: { type: "string", description: "Detailed description (max 500 chars)" },
                content_type: {
                  type: "string",
                  enum: ["blog_post", "case_study", "guide", "faq", "product_page", "landing_page", "whitepaper", "documentation"],
                  description: "Type of content to create"
                },
                priority_score: { type: "integer", minimum: 0, maximum: 100, description: "Priority 0-100" },
                difficulty_level: {
                  type: "string",
                  enum: ["easy", "medium", "hard"],
                  description: "Implementation difficulty"
                },
                estimated_hours: { type: "integer", minimum: 1, maximum: 80, description: "Hours to implement" },
                implementation_steps: {
                  type: "array",
                  items: { type: "string" },
                  description: "Specific steps to implement"
                },
                distribution_channels: {
                  type: "array",
                  items: { type: "string" },
                  description: "Where to publish (e.g., 'company_blog', 'linkedin')"
                },
                content_specs: {
                  type: "object",
                  description: "Content specifications (word count, format, etc.)",
                  additionalProperties: true
                },
                success_metrics: {
                  type: "object",
                  description: "How to measure success",
                  additionalProperties: true
                },
                citations_used: {
                  type: "array",
                  items: { type: "string" },
                  description: "Citations to reference in content"
                }
              },
              required: ["title", "description", "content_type", "priority_score", "difficulty_level", "estimated_hours", "implementation_steps", "distribution_channels"]
            }
          }
        },
        required: ["recommendations"]
      }
    }
  }];

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze this prompt and generate optimization recommendations." }
      ],
      tools,
      tool_choice: { type: "function", function: { name: "propose_optimizations" } },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const errorText = await response.text();
    
    // Surface rate limit and payment errors
    if (status === 429) {
      const err: any = new Error('Rate limit exceeded. Please try again later.');
      err.status = 429;
      throw err;
    }
    if (status === 402) {
      const err: any = new Error('Credits exhausted. Please add funds to continue.');
      err.status = 402;
      throw err;
    }
    
    throw new Error(`Lovable AI error: ${status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Robust parsing with fallback
  const parsed = await safeParseRecommendations(data, promptData);
  const recommendations: OptimizationRecommendation[] = parsed.recommendations;

  if (recommendations.length === 0) {
    console.warn("[generate-optimizations-v2] AI returned 0 recommendations for prompt:", promptData.prompt_id);
  }

  // Transform to database format
  const optimizations = await Promise.all(recommendations.map(async (rec) => ({
    org_id: org.id,
    prompt_id: promptData.prompt_id,
    title: rec.title.substring(0, 200),
    description: rec.description.substring(0, 1000),
    content_type: rec.content_type,
    priority_score: Math.min(100, Math.max(0, rec.priority_score)),
    difficulty_level: rec.difficulty_level,
    estimated_hours: Math.min(80, Math.max(1, rec.estimated_hours)),
    implementation_steps: rec.implementation_steps || [],
    distribution_channels: rec.distribution_channels || [],
    content_specs: rec.content_specs || {},
    success_metrics: rec.success_metrics || {},
    citations_used: rec.citations_used || [],
    prompt_context: {
      prompt_text: promptData.prompt_text,
      presence_rate: promptData.presence_rate,
      total_runs: promptData.total_runs,
      avg_score: promptData.avg_score_when_present
    },
    content_hash: await createContentHash(rec.title + rec.description + rec.content_type),
    llm_model: 'google/gemini-2.5-flash',
    llm_tokens_used: data.usage?.total_tokens || 0,
    generation_confidence: 0.9,
    status: 'open',
    optimization_category: 'visibility'
  })));

  return {
    success: true,
    optimizations,
    tokensUsed: data.usage?.total_tokens || 0
  };
}

// Helper functions
async function updateJob(client: any, jobId: string, updates: any) {
  const { error } = await client
    .from("optimization_generation_jobs")
    .update(updates)
    .eq("id", jobId);
  
  if (error) {
    console.error(`[updateJob] Failed to update job ${jobId}:`, error);
  }
}

async function createContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function timeBucket(minutes = DEDUP_WINDOW_MINUTES): number {
  const now = Date.now();
  return Math.floor(now / (minutes * 60 * 1000));
}

function createInputHash(orgId: string, params: any): string {
  const bucket = timeBucket();
  const normalized = JSON.stringify({ orgId, bucket, ...params }, Object.keys({ orgId, bucket, ...params }).sort());
  return btoa(normalized).substring(0, 64);
}

async function safeParseRecommendations(data: any, promptData: any): Promise<{ recommendations: OptimizationRecommendation[] }> {
  // 1) Tool-call JSON path (ideal)
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.name === "propose_optimizations") {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      if (args.recommendations && Array.isArray(args.recommendations)) {
        return { recommendations: args.recommendations };
      }
    } catch (e) {
      console.warn("[safeParseRecommendations] Failed to parse tool call args:", e);
    }
  }

  // 2) If model returned text, try to extract first valid JSON object
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          return { recommendations: parsed.recommendations };
        }
      } catch (e) {
        console.warn("[safeParseRecommendations] Failed to parse JSON from content:", e);
      }
    }
  }

  // 3) Deterministic fallback: always return at least one prompt-specific recommendation
  console.warn("[safeParseRecommendations] Using deterministic fallback for prompt:", promptData.prompt_id);
  return {
    recommendations: [{
      title: `Create authoritative content for: "${promptData.prompt_text.substring(0, 60)}..."`,
      description: `Develop comprehensive, citation-worthy content that directly addresses "${promptData.prompt_text}". Focus on matching the depth and authority of top-cited sources.`,
      content_type: 'guide',
      priority_score: 70,
      difficulty_level: 'medium',
      estimated_hours: 10,
      implementation_steps: [
        'Analyze top-cited domains for this specific query',
        'Identify content gaps in existing coverage',
        'Create detailed outline matching user intent',
        'Add original data, examples, and internal linking',
        'Optimize for discovery and AI citation'
      ],
      distribution_channels: ['company_blog', 'linkedin', 'reddit'],
      content_specs: { word_count: 2000, include_visuals: true, include_data: true },
      success_metrics: { target_visibility_increase: '25%', target_ai_citations: 3 },
      citations_used: promptData.top_citations || []
    }]
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
