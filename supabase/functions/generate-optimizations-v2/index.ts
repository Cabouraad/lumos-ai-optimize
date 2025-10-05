/**
 * Optimizations V2 Generation Engine
 * Uses Lovable AI (Gemini 2.5 Flash) for high-quality, cost-effective generation
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerationRequest {
  scope: 'org' | 'prompt' | 'batch';
  promptIds?: string[];
  category?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[generate-optimizations-v2] Request received");

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const jwt = authHeader.slice(7);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    });

    // Verify user and get org
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Authentication failed" }, 401);
    }

    const { data: userData } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!userData?.org_id) {
      return jsonResponse({ error: "Organization not found" }, 403);
    }

    const body: GenerationRequest = await req.json();
    console.log("[generate-optimizations-v2] Request params:", body);

    // Create generation job
    const inputHash = createInputHash(userData.org_id, body);
    const weekKey = getWeekKey();

    const { data: job, error: jobError } = await supabase
      .from("optimization_generation_jobs")
      .insert({
        org_id: userData.org_id,
        requested_by: user.id,
        scope: body.scope || 'org',
        target_prompt_ids: body.promptIds || [],
        category: body.category || 'visibility',
        status: 'running',
        input_hash: inputHash,
        week_key: weekKey,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.error("[generate-optimizations-v2] Job creation error:", jobError);
      return jsonResponse({ error: "Failed to create job" }, 500);
    }

    console.log("[generate-optimizations-v2] Job created:", job.id);

    // Get organization context
    const { data: org } = await supabase
      .from("organizations")
      .select("name, business_description, keywords, competitors, target_audience")
      .eq("id", userData.org_id)
      .single();

    // Get low visibility prompts
    const { data: lowVisPrompts, error: promptsError } = await supabase
      .rpc("get_low_visibility_prompts", {
        p_org_id: userData.org_id,
        p_limit: body.promptIds?.length || 10
      });

    if (promptsError) {
      console.error("[generate-optimizations-v2] Prompts fetch error:", promptsError);
      await updateJob(supabase, job.id, {
        status: 'failed',
        error_message: `Failed to fetch prompts: ${promptsError.message}`
      });
      return jsonResponse({ error: "Failed to fetch prompts" }, 500);
    }

    if (!lowVisPrompts || lowVisPrompts.length === 0) {
      console.log("[generate-optimizations-v2] No prompts to optimize");
      await updateJob(supabase, job.id, {
        status: 'completed',
        optimizations_created: 0,
        completed_at: new Date().toISOString()
      });
      return jsonResponse({
        message: "No prompts need optimization",
        jobId: job.id,
        optimizationsCreated: 0
      });
    }

    console.log(`[generate-optimizations-v2] Processing ${lowVisPrompts.length} prompts`);

    // Generate optimizations using Lovable AI
    const optimizations = [];
    let totalTokens = 0;

    for (const promptData of lowVisPrompts) {
      try {
        const result = await generateOptimization(
          promptData,
          org,
          LOVABLE_API_KEY
        );

        if (result.success) {
          optimizations.push(...result.optimizations);
          totalTokens += result.tokensUsed || 0;
        }
      } catch (error) {
        console.error(`[generate-optimizations-v2] Error processing prompt ${promptData.prompt_id}:`, error);
      }
    }

    // Insert optimizations into database
    if (optimizations.length > 0) {
      const { error: insertError } = await supabase
        .from("optimizations_v2")
        .insert(optimizations);

      if (insertError) {
        console.error("[generate-optimizations-v2] Insert error:", insertError);
      }
    }

    // Update job status
    const executionTime = Date.now() - startTime;
    await updateJob(supabase, job.id, {
      status: 'completed',
      optimizations_created: optimizations.length,
      total_tokens_used: totalTokens,
      execution_time_ms: executionTime,
      completed_at: new Date().toISOString()
    });

    console.log(`[generate-optimizations-v2] Complete: ${optimizations.length} optimizations in ${executionTime}ms`);

    return jsonResponse({
      success: true,
      jobId: job.id,
      optimizationsCreated: optimizations.length,
      tokensUsed: totalTokens,
      executionTimeMs: executionTime
    });

  } catch (error) {
    console.error("[generate-optimizations-v2] Fatal error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

async function generateOptimization(promptData: any, org: any, apiKey: string) {
  const systemPrompt = `You are an AI optimization strategist helping ${org?.name || 'a business'} improve their visibility in LLM responses.

Business Context:
- Description: ${org?.business_description || 'Not provided'}
- Keywords: ${org?.keywords?.join(', ') || 'Not provided'}
- Competitors: ${org?.competitors?.join(', ') || 'Not provided'}
- Target Audience: ${org?.target_audience || 'Not provided'}

Current Situation:
- Prompt: "${promptData.prompt_text}"
- Visibility Rate: ${promptData.presence_rate}%
- Total Runs: ${promptData.total_runs}
- Average Score: ${promptData.avg_score_when_present || 0}
- Top Citations: ${JSON.stringify(promptData.top_citations || [])}

Task: Generate 2-3 high-impact content recommendations to improve visibility for this prompt. Focus on actionable, specific content that will help the brand appear in LLM responses.

Return JSON array with this structure for each recommendation:
{
  "title": "Clear, actionable title",
  "description": "2-3 sentence description of the content and why it helps",
  "content_type": "blog_post|case_study|guide|video|podcast|reddit_post|quora_answer",
  "priority_score": 1-100 (based on impact potential),
  "estimated_hours": number,
  "content_specs": {
    "word_count": number,
    "key_points": ["point 1", "point 2"],
    "tone": "professional|conversational|technical",
    "must_include": ["specific facts/data to include"]
  },
  "distribution_channels": [
    {"channel": "Reddit", "subreddits": ["r/example"], "posting_tips": "..."},
    {"channel": "Blog", "seo_focus": "...", "internal_linking": "..."}
  ],
  "implementation_steps": [
    {"step": 1, "action": "Research competitors", "time": "2h"},
    {"step": 2, "action": "Create outline", "time": "1h"}
  ],
  "success_metrics": {
    "primary_kpi": "Visibility rate increase to X%",
    "measurement": "Track via prompt monitoring",
    "timeframe": "30-60 days"
  },
  "citations_to_create": [
    {"type": "case_study", "topic": "...", "why": "..."}
  ]
}`;

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
        { role: "user", content: "Generate optimization recommendations:" }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lovable AI error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const recommendations = JSON.parse(content);

  // Convert to database format
  const optimizations = (recommendations.optimizations || recommendations.recommendations || [recommendations]).map((rec: any) => ({
    org_id: promptData.org_id,
    prompt_id: promptData.prompt_id,
    title: rec.title,
    description: rec.description,
    content_type: rec.content_type || 'blog_post',
    optimization_category: 'visibility',
    priority_score: rec.priority_score || 50,
    difficulty_level: rec.estimated_hours > 8 ? 'hard' : rec.estimated_hours > 4 ? 'medium' : 'easy',
    estimated_hours: rec.estimated_hours,
    content_specs: rec.content_specs || {},
    distribution_channels: rec.distribution_channels || [],
    implementation_steps: rec.implementation_steps || [],
    success_metrics: rec.success_metrics || {},
    citations_used: promptData.top_citations || [],
    prompt_context: {
      visibility_rate: promptData.presence_rate,
      total_runs: promptData.total_runs,
      avg_score: promptData.avg_score_when_present
    },
    content_hash: await createContentHash(rec.title + rec.description + rec.content_type),
    llm_model: 'google/gemini-2.5-flash',
    llm_tokens_used: data.usage?.total_tokens || 0,
    generation_confidence: 0.85
  }));

  return {
    success: true,
    optimizations,
    tokensUsed: data.usage?.total_tokens || 0
  };
}

async function createContentHash(input: string): Promise<string> {
  const normalized = input.toLowerCase().trim().replace(/\s+/g, ' ');
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function createInputHash(orgId: string, body: GenerationRequest): string {
  const base = `${orgId}_${body.scope}_${body.promptIds?.join(',') || 'all'}`;
  return base.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil(((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

async function updateJob(supabase: any, jobId: string, updates: any) {
  await supabase
    .from("optimization_generation_jobs")
    .update(updates)
    .eq("id", jobId);
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}