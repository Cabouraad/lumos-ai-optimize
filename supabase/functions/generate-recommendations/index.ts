import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AI API timeout in milliseconds - increased for complex prompts
const AI_TIMEOUT_MS = 30000; // 30 seconds

// Helper to call AI with timeout
async function callAIWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI request timed out');
    }
    throw error;
  }
}

interface RecommendationOutput {
  recommendations: Array<{
    title: string;
    description: string;
    content_type: string;
    priority_score: number;
    difficulty_level: string;
    estimated_hours: number;
    implementation_steps: Array<{
      step: number;
      action: string;
      time?: string;
    }>;
    distribution_channels: Array<{
      channel: string;
      posting_tips?: string;
    }>;
    success_metrics: Record<string, string>;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key first
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user and org
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!userData?.org_id) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = userData.org_id;

    // Parse request body - reduce default limit to avoid timeouts
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 5, 10); // Reduced from 10/20 to 5/10 to prevent timeouts
    const specificPromptId = body.promptId; // Optional: generate for specific prompt
    const brandId = body.brandId; // Optional: brand-specific recommendations

    // Get organization details OR brand-specific context
    let businessContext: { name: string; business_description: string | null; keywords: string[] | null; competitors: string[] | null } | null = null;

    if (brandId) {
      // Brand-specific context
      const { data: brand } = await supabase
        .from("brands")
        .select("name, business_description, keywords, target_audience, products_services")
        .eq("id", brandId)
        .eq("org_id", orgId)
        .single();
      
      if (brand) {
        businessContext = {
          name: brand.name,
          business_description: brand.business_description,
          keywords: brand.keywords,
          competitors: null // Brand-level competitors could be fetched from brand_catalog if needed
        };
        console.log(`[GENERATE-RECS] Using brand context for: ${brand.name}`);
      }
    }

    // Fallback to org-level context
    if (!businessContext) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, business_description, keywords, competitors")
        .eq("id", orgId)
        .single();
      businessContext = org;
    }

    let lowVisPrompts;
    let promptError;

    // If specific promptId provided, fetch just that prompt
    if (specificPromptId) {
      console.log(`[GENERATE-RECS] Generating for specific prompt: ${specificPromptId}`);
      
      // Fetch the specific prompt with its stats
      const { data: promptData, error: pError } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('id', specificPromptId)
        .eq('org_id', orgId)
        .single();

      if (pError || !promptData) {
        console.error('[GENERATE-RECS] Error fetching prompt:', pError);
        return new Response(JSON.stringify({ error: 'Prompt not found' }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get prompt stats from last 14 days
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: responses } = await supabase
        .from('prompt_provider_responses')
        .select('org_brand_present, score, citations_json')
        .eq('prompt_id', specificPromptId)
        .gte('run_at', fourteenDaysAgo.toISOString());

      const totalRuns = responses?.length || 0;
      const presentCount = responses?.filter(r => r.org_brand_present).length || 0;
      const presenceRate = totalRuns > 0 ? (presentCount / totalRuns) * 100 : 0;

      // Collect top citations
      const citationCounts: Record<string, number> = {};
      responses?.forEach(r => {
        if (Array.isArray(r.citations_json)) {
          r.citations_json.forEach((c: any) => {
            const url = c.url || c.source;
            if (url) citationCounts[url] = (citationCounts[url] || 0) + 1;
          });
        }
      });

      const topCitations = Object.entries(citationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([url, count]) => ({ url, count }));

      lowVisPrompts = [{
        prompt_id: promptData.id,
        prompt_text: promptData.text,
        total_runs: totalRuns,
        presence_rate: presenceRate,
        avg_score_when_present: null,
        last_checked_at: new Date().toISOString(),
        top_citations: topCitations
      }];
      promptError = null;
    } else {
      // Original behavior: Query for low-visibility prompts with optional brand filter
      console.log(`[GENERATE-RECS] Querying low-visibility prompts, brandId: ${brandId || 'org-level'}`);
      const result = await supabase.rpc(
        "get_low_visibility_prompts",
        { p_org_id: orgId, p_limit: limit, p_brand_id: brandId || null }
      );
      lowVisPrompts = result.data;
      promptError = result.error;
    }

    if (promptError) {
      console.error("Error fetching low visibility prompts:", promptError);
      return new Response(JSON.stringify({ error: "Failed to fetch prompts" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lowVisPrompts || lowVisPrompts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          count: 0,
          processed: 0,
          message: "No low-visibility prompts found",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GENERATE-RECS] Processing ${lowVisPrompts.length} prompts for org ${orgId}`);

    let totalCreated = 0;
    const errors: string[] = [];
    let processed = 0;

    // Process each prompt synchronously
    for (const prompt of lowVisPrompts) {
      processed++;
      console.log(`[GENERATE-RECS] Processing prompt ${processed}/${lowVisPrompts.length}: ${prompt.prompt_text.substring(0, 60)}...`);
      
      try {
        // Build system prompt with business context (brand-specific or org-level)
        const systemPrompt = `You are an AI optimization strategist helping ${businessContext?.name || "a company"} improve their visibility in AI search results.

Business Context:
- Business: ${businessContext?.business_description || "Not provided"}
- Keywords: ${businessContext?.keywords?.join(", ") || "Not provided"}
- Competitors: ${businessContext?.competitors?.join(", ") || "Not provided"}

The user's brand currently has ${prompt.presence_rate?.toFixed(1)}% presence rate for this prompt (based on ${prompt.total_runs} runs).

Generate 2-3 actionable content recommendations to improve visibility for this specific prompt. Focus on:
1. Content that directly addresses the prompt
2. Formats that perform well in AI search (articles, guides, comparisons)
3. Distribution channels that reach AI training data sources

IMPORTANT OUTPUT FORMAT:
- implementation_steps: Provide numbered steps with specific actions and time estimates (e.g., "2 hours", "1 week")
- distribution_channels: List specific channels with tailored posting strategies for each
- success_metrics: Include measurable KPIs with targets and timeframes

Each recommendation should be specific, actionable, and tailored to this prompt.`;

        // Call AI with timeout protection
        console.log(`[GENERATE-RECS] Calling AI for prompt ${processed} with 30s timeout`);
        const openaiResponse = await callAIWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite", // Faster model for quicker responses
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Prompt to optimize: "${prompt.prompt_text}"` },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "generate_recommendations",
                  description: "Generate optimization recommendations",
                  parameters: {
                    type: "object",
                    properties: {
                      recommendations: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            content_type: {
                              type: "string",
                              enum: ["blog_post", "guide", "case_study", "video", "podcast", "infographic", "webinar", "whitepaper", "social_post", "reddit_post", "quora_answer"],
                            },
                            priority_score: { type: "number", minimum: 1, maximum: 100 },
                            difficulty_level: {
                              type: "string",
                              enum: ["easy", "medium", "hard"],
                            },
                            estimated_hours: { type: "number" },
                            implementation_steps: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  step: { type: "number" },
                                  action: { type: "string" },
                                  time: { type: "string" }
                                },
                                required: ["step", "action"]
                              }
                            },
                            distribution_channels: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  channel: { type: "string" },
                                  posting_tips: { type: "string" }
                                },
                                required: ["channel"]
                              }
                            },
                            success_metrics: {
                              type: "object",
                              additionalProperties: { type: "string" },
                            },
                          },
                          required: [
                            "title",
                            "description",
                            "content_type",
                            "priority_score",
                            "difficulty_level",
                            "estimated_hours",
                            "implementation_steps",
                            "distribution_channels",
                            "success_metrics",
                          ],
                        },
                      },
                    },
                    required: ["recommendations"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "generate_recommendations" } },
          }),
        }, AI_TIMEOUT_MS);

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          const status = openaiResponse.status;
          console.error(`[GENERATE-RECS] AI error for prompt ${processed}:`, status, errorText);
          if (status === 429) {
            errors.push("Rate limit exceeded. Please try again later.");
          } else if (status === 402) {
            errors.push("Payment required for AI usage. Please add credits to Lovable AI workspace.");
          } else {
            errors.push(`AI error for: ${prompt.prompt_text.substring(0, 50)}...`);
          }
          continue;
        }

        const data = await openaiResponse.json();
        console.log(`[GENERATE-RECS] AI response received for prompt ${processed}`);
        const toolCall = data.choices[0]?.message?.tool_calls?.[0];

        if (!toolCall) {
          console.error(`[GENERATE-RECS] No tool call in response for prompt ${processed}`);
          errors.push(`No recommendations generated for: ${prompt.prompt_text.substring(0, 50)}...`);
          continue;
        }

        const result: RecommendationOutput = JSON.parse(toolCall.function.arguments);
        console.log(`[GENERATE-RECS] Generated ${result.recommendations.length} recommendations for prompt ${processed}`);

        // Insert recommendations into optimizations_v2
        for (const rec of result.recommendations) {
          const contentHash = await crypto.subtle
            .digest(
              "SHA-256",
              new TextEncoder().encode(rec.title + rec.description + rec.content_type)
            )
            .then((buf) => Array.from(new Uint8Array(buf))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
            );

          // Sanitize numeric fields before insert to satisfy integer columns in DB
          const priorityScore = Math.min(100, Math.max(1, Math.round(Number(rec.priority_score))));
          const estimatedHours = Math.max(1, Math.ceil(Number(rec.estimated_hours)));

          const implementationSteps = Array.isArray(rec.implementation_steps)
            ? rec.implementation_steps.map((s: any, idx: number) => ({
                step: typeof s?.step === 'number' ? Math.max(1, Math.round(s.step)) : idx + 1,
                action: s?.action,
                time: s?.time,
              }))
            : [];

          const tokensUsed = Math.max(0, Math.round(Number(data.usage?.total_tokens) || 0));

          const { error: insertError } = await supabase.from("optimizations_v2").insert({
            org_id: orgId,
            brand_id: brandId || null, // Include brand_id for multi-brand isolation
            prompt_id: prompt.prompt_id,
            title: rec.title,
            description: rec.description,
            content_type: rec.content_type,
            priority_score: priorityScore,
            difficulty_level: rec.difficulty_level,
            estimated_hours: estimatedHours,
            implementation_steps: implementationSteps,
            distribution_channels: rec.distribution_channels,
            success_metrics: rec.success_metrics,
            optimization_category: "visibility",
            content_hash: contentHash,
            llm_model: "google/gemini-2.5-flash",
            llm_tokens_used: tokensUsed,
            // Omit generation_confidence to avoid integer vs decimal mismatch; can be re-added once schema clarified
            status: "open",
            prompt_context: {
              prompt_text: prompt.prompt_text,
              presence_rate: prompt.presence_rate,
              total_runs: prompt.total_runs,
              brand_id: brandId || null, // Track which brand context was used
            },
            citations_used: prompt.top_citations || [],
          });

          if (insertError) {
            console.error(`[GENERATE-RECS] Insert error for prompt ${processed}:`, insertError, { priorityScore, estimatedHours });
            errors.push(`Failed to save recommendation: ${rec.title}`);
          } else {
            totalCreated++;
            console.log(`[GENERATE-RECS] Saved recommendation: ${rec.title}`);
          }
        }

        // Rate limiting: wait 500ms between AI calls (reduced from 1s)
        if (processed < lowVisPrompts.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[GENERATE-RECS] Error processing prompt ${processed}/${lowVisPrompts.length}:`, errorMsg);
        errors.push(`Error: ${prompt.prompt_text.substring(0, 50)}... (${errorMsg})`);
      }
    }

    console.log(`[GENERATE-RECS] Completed: ${totalCreated} created, ${processed} processed, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        count: totalCreated,
        processed: lowVisPrompts.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[GENERATE-RECS] Fatal error:", errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
