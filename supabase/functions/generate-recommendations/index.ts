import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Get organization details
    const { data: org } = await supabase
      .from("organizations")
      .select("name, business_description, keywords, competitors")
      .eq("id", orgId)
      .single();

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 10, 20);

    // Query for low-visibility prompts directly
    const { data: lowVisPrompts, error: promptError } = await supabase.rpc(
      "get_low_visibility_prompts",
      { p_org_id: orgId, p_limit: limit }
    );

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

    console.log(`Processing ${lowVisPrompts.length} low-visibility prompts for org ${orgId}`);

    let totalCreated = 0;
    const errors: string[] = [];

    // Process each prompt synchronously
    for (const prompt of lowVisPrompts) {
      try {
        // Build system prompt with org context
        const systemPrompt = `You are an AI optimization strategist helping ${org?.name || "a company"} improve their visibility in AI search results.

Organization Context:
- Business: ${org?.business_description || "Not provided"}
- Keywords: ${org?.keywords?.join(", ") || "Not provided"}
- Competitors: ${org?.competitors?.join(", ") || "Not provided"}

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

        // Call OpenAI with tool calling for structured output
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
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
        });

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error(`OpenAI error for prompt ${prompt.prompt_id}:`, errorText);
          errors.push(`Failed to generate for prompt: ${prompt.prompt_text.substring(0, 50)}...`);
          continue;
        }

        const data = await openaiResponse.json();
        const toolCall = data.choices[0]?.message?.tool_calls?.[0];

        if (!toolCall) {
          console.error("No tool call in response");
          errors.push(`No recommendations generated for: ${prompt.prompt_text.substring(0, 50)}...`);
          continue;
        }

        const result: RecommendationOutput = JSON.parse(toolCall.function.arguments);

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

          const { error: insertError } = await supabase.from("optimizations_v2").insert({
            org_id: orgId,
            prompt_id: prompt.prompt_id,
            title: rec.title,
            description: rec.description,
            content_type: rec.content_type,
            priority_score: rec.priority_score,
            difficulty_level: rec.difficulty_level,
            estimated_hours: rec.estimated_hours,
            implementation_steps: rec.implementation_steps,
            distribution_channels: rec.distribution_channels,
            success_metrics: rec.success_metrics,
            optimization_category: "visibility",
            content_hash: contentHash,
            llm_model: "gpt-4o-mini",
            llm_tokens_used: data.usage?.total_tokens || 0,
            generation_confidence: 0.9,
            status: "open",
            prompt_context: {
              prompt_text: prompt.prompt_text,
              presence_rate: prompt.presence_rate,
              total_runs: prompt.total_runs,
            },
            citations_used: prompt.top_citations || [],
          });

          if (insertError) {
            console.error("Insert error:", insertError);
            errors.push(`Failed to save recommendation: ${rec.title}`);
          } else {
            totalCreated++;
          }
        }

        // Rate limiting: wait 1 second between OpenAI calls
        if (lowVisPrompts.indexOf(prompt) < lowVisPrompts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error processing prompt ${prompt.prompt_id}:`, error);
        errors.push(`Error: ${prompt.prompt_text.substring(0, 50)}...`);
      }
    }

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
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
