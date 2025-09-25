import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function jsonRepair(s: string) {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const body = s.slice(start, end + 1);
    try { return JSON.parse(body); } catch {}
  }
  return null;
}

function optimizerSystem() {
  return `You are an AI Search Optimization strategist. Create comprehensive, actionable content strategies with detailed implementation instructions.
Return STRICT JSON only (no backticks). Keys:
{
  "optimizations": [
    {
      "content_type": "social_post|blog_outline|talking_points|cta_snippets|reddit_strategy",
      "title": "Clear descriptive title",
      "body": "Main content (structured JSON for complex types)",
      "implementation_details": {
        "steps": ["Step 1", "Step 2", "..."],
        "tools_needed": ["Tool 1", "Tool 2"],
        "timeline": "Expected timeframe",
        "best_practices": ["Practice 1", "Practice 2"]
      },
      "resources": [
        {"type": "template|tool|guide", "title": "Resource name", "url": "URL if applicable", "description": "Brief description"}
      ],
      "success_metrics": {
        "primary": "Main KPI to track",
        "secondary": ["Additional metrics"],
        "timeline": "When to expect results"
      },
      "reddit_strategy": {
        "subreddits": [{"name": "r/subreddit", "audience": "Description", "rules": "Key posting rules"}],
        "post_types": ["discussion", "tutorial", "case_study"],
        "content_approach": "Value-first strategy description"
      },
      "impact_score": 7,
      "difficulty_level": "easy|medium|hard",
      "timeline_weeks": 4
    }
  ]
}`;
}

function optimizerUserPrompt(args: {
  brand: string; promptText: string; presenceRate: number;
  competitors: string[]; citations: { domain: string; title?: string; link: string }[];
  category: 'low_visibility' | 'general';
}) {
  const cites = args.citations.slice(0,8).map(c => `- ${c.domain}${c.title?` — ${c.title}`:''} (${c.link})`).join("\n");
  const comp  = args.competitors.slice(0,8).join(", ") || "None observed";
  
  if (args.category === 'low_visibility') {
    return `BRAND: ${args.brand}
LOW-VISIBILITY PROMPT: "${args.promptText}"
CURRENT PRESENCE: ${args.presenceRate.toFixed(1)}% (needs improvement)
COMPETITORS IN RESPONSES: ${comp}
TOP CITATION DOMAINS:
${cites}

GOAL: Create 3-4 targeted optimizations to improve visibility for this specific prompt.

REQUIREMENTS:
1) SOCIAL POST: Professional thought leadership post that naturally addresses the prompt topic. Include step-by-step posting instructions, optimal timing, hashtag strategy.
2) REDDIT STRATEGY: Identify 5-7 relevant subreddits, specific post approaches, community engagement tactics. Focus on providing value first.
3) BLOG OUTLINE: Comprehensive SEO-optimized article addressing the prompt. Include keyword strategy, internal linking, outreach targets.
4) TALKING POINTS: 5 key points for interviews, podcasts, and conversations that position ${args.brand} as the solution.

For each optimization include:
- Detailed implementation steps
- Required tools and resources  
- Success metrics and timeline
- Specific Reddit subreddits with posting strategies
- Impact score (1-10) and difficulty level`;
  } else {
    return `BRAND: ${args.brand}
GENERAL BRAND VISIBILITY OPTIMIZATION
CURRENT PROMPT CONTEXT: "${args.promptText}"
MARKET COMPETITORS: ${comp}
INDUSTRY CITATION SOURCES:
${cites}

GOAL: Create 4-5 comprehensive brand visibility strategies for general market presence.

REQUIREMENTS:
1) SOCIAL POST: Thought leadership content, speaking opportunities, industry positioning
2) BLOG OUTLINE: Multi-platform approach including LinkedIn, Twitter, Reddit
3) REDDIT STRATEGY: Industry forums, Reddit communities, professional networks  
4) TALKING POINTS: SEO content, video series, podcast appearances
5) CTA SNIPPETS: Long-term subreddit engagement, value-first contributions

Focus on scalable strategies that build long-term brand authority and visibility across AI search results.
Include detailed implementation guides, resource requirements, and projected ROI.`;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[generate-optimizations] Function called', { 
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      console.error('[generate-optimizations] Unauthorized request');
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // Get user context first
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: auth } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('[generate-optimizations] Auth failed:', userError);
      return new Response("Auth failed", { status: 401, headers: corsHeaders });
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const promptId: string | undefined = body?.promptId;
    const doBatch: boolean = !!body?.batch;
    const category: 'low_visibility' | 'general' = body?.category || 'general';

    console.log('[generate-optimizations] Request body parsed', { promptId, doBatch, category });

    // Get user's org
    const { data: userRecord } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!userRecord?.org_id) {
      console.error('[generate-optimizations] No org found for user', user.id);
      return new Response("No org found", { status: 403, headers: corsHeaders });
    }

    const orgId = userRecord.org_id;
    console.log('[generate-optimizations] Found org', { orgId, userId: user.id });

    // Get organization details
    const { data: org } = await supabase
      .from("organizations")
      .select("name, business_description")
      .eq("id", orgId)
      .single();

    // Single prompt (sync) or batch (ALL prompts for batch mode)
    let promptIds: string[] = [];
    if (promptId) {
      promptIds = [promptId];
    } else if (doBatch) {
      // FIXED: Get ALL low-visibility prompts for batch processing, not just limit 10
      const limit = category === 'low_visibility' ? 50 : 20; // Increased limit
      const { data: lows } = await supabase
        .from("low_visibility_prompts")
        .select("prompt_id")
        .eq("org_id", orgId)
        .order("presence_rate", { ascending: true }) // Process lowest visibility first
        .limit(limit);
      promptIds = (lows ?? []).map((r: any) => r.prompt_id);
      console.log('[generate-optimizations] Batch mode: processing', promptIds.length, 'prompts');
    }

    if (promptIds.length === 0) {
      console.log('[generate-optimizations] No prompts to process');
      return new Response(JSON.stringify({ inserted: 0, optimizations: [] }), { 
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    console.log('[generate-optimizations] Processing prompts', { count: promptIds.length, promptIds });

    // FIXED: Process ALL prompts in batch mode, not just the first one
    let totalInserted = 0;
    const allOptimizations = [];

    for (const pid of promptIds) {
      try {
        // Get prompt details
        const { data: prompt } = await supabase
          .from("prompts")
          .select("id, text")
          .eq("id", pid)
          .eq("org_id", orgId)
          .single();

        if (!prompt) {
          console.log('[generate-optimizations] Prompt not found:', pid);
          continue;
        }

        // Get visibility metrics
        const { data: vis } = await supabase
          .from("prompt_visibility_14d")
          .select("presence_rate")
          .eq("org_id", orgId)
          .eq("prompt_id", pid)
          .maybeSingle();

        const presence = vis?.presence_rate ?? 0;

        // Get recent competitors and citations from prompt_provider_responses
        const { data: responses } = await supabase
          .from("prompt_provider_responses")
          .select("competitors_json, citations_json")
          .eq("org_id", orgId)
          .eq("prompt_id", pid)
          .eq("status", "success")
          .order("run_at", { ascending: false })
          .limit(20);

        const competitors = Array.from(
          new Set((responses ?? [])
            .flatMap((r: any) => r.competitors_json ? 
              (Array.isArray(r.competitors_json) ? r.competitors_json : []) : [])
            .filter(Boolean)
          )
        );

        const citations = (responses ?? [])
          .flatMap((r: any) => r.citations_json ? 
            (Array.isArray(r.citations_json) ? r.citations_json : []) : [])
          .filter(Boolean)
          .slice(0, 10)
          .map((c: any) => ({
            domain: c.domain || (c.url ? new URL(c.url).hostname : ''),
            title: c.title || null,
            link: c.url || c.link || ''
          }))
          .filter((c: any) => c.domain && c.link);

        // Call OpenAI for this prompt
        const promptInput = optimizerUserPrompt({
          brand: org?.name || "Your brand",
          promptText: prompt.text,
          presenceRate: presence,
          competitors,
          citations,
          category
        });

        console.log('[generate-optimizations] Calling OpenAI for prompt:', pid);
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { 
            "authorization": `Bearer ${openAIApiKey}`, 
            "content-type": "application/json" 
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: optimizerSystem() },
              { role: "user", content: promptInput }
            ]
          })
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          console.error('[generate-optimizations] OpenAI error for prompt', pid, ':', errorText);
          continue; // Skip this prompt but continue with others
        }

        const ai = await resp.json();
        const raw = ai?.choices?.[0]?.message?.content ?? "";
        let parsed: any;
        
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = jsonRepair(raw);
        }
        
        if (!parsed || typeof parsed !== "object") {
          console.error('[generate-optimizations] Failed to parse optimizer JSON for prompt', pid, ':', raw);
          continue; // Skip this prompt but continue with others
        }

        // Normalize & insert optimization rows from new structure
        const toInsert: any[] = [];
        
        (parsed.optimizations ?? []).forEach((opt: any) => {
          // FIXED: Map content types to valid constraint values
          let validContentType = 'social_post'; // default
          const rawType = (opt.content_type || '').toLowerCase();
          
          if (rawType.includes('social') || rawType.includes('linkedin') || rawType.includes('post')) {
            validContentType = 'social_post';
          } else if (rawType.includes('blog') || rawType.includes('outline') || rawType.includes('article')) {
            validContentType = 'blog_outline';
          } else if (rawType.includes('talk') || rawType.includes('point') || rawType.includes('interview')) {
            validContentType = 'talking_points';
          } else if (rawType.includes('cta') || rawType.includes('snippet') || rawType.includes('call')) {
            validContentType = 'cta_snippets';
          } else if (rawType.includes('reddit') || rawType.includes('community')) {
            validContentType = 'reddit_strategy';
          }

          toInsert.push({ 
            org_id: orgId, 
            prompt_id: pid, 
            optimization_category: category,
            content_type: validContentType,
            title: opt.title || "Optimization", 
            body: typeof opt.body === 'string' ? opt.body : JSON.stringify(opt.body), 
            sources: citations, 
            score_before: presence,
            projected_impact: opt.implementation_details?.timeline || "Improvement expected within 4-6 weeks",
            provider: 'optimizer',
            implementation_details: opt.implementation_details || {},
            resources: opt.resources || [],
            success_metrics: opt.success_metrics || {},
            reddit_strategy: opt.reddit_strategy || {},
            impact_score: opt.impact_score || 5,
            difficulty_level: opt.difficulty_level || 'medium',
            timeline_weeks: opt.timeline_weeks || 4
          });
        });

        console.log('[generate-optimizations] Ready to insert for prompt', pid, ':', { count: toInsert.length });
        
        if (toInsert.length) {
          const { error: insErr } = await supabase
            .from("optimizations")
            .insert(toInsert);
            
          if (insErr) {
            console.error('[generate-optimizations] Insert error for prompt', pid, ':', insErr);
            continue; // Skip this prompt but continue with others
          }
          
          console.log('[generate-optimizations] Successfully inserted optimizations for prompt', pid);
          totalInserted += toInsert.length;
          allOptimizations.push(...toInsert);
        }

        // Add small delay between prompts to avoid rate limiting
        if (promptIds.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error('[generate-optimizations] Error processing prompt', pid, ':', error);
        // Continue with next prompt
        continue;
      }
    }

    // Refresh visibility data
    await supabase.rpc('refresh_prompt_visibility_14d');

    console.log('[generate-optimizations] Batch complete:', { totalInserted, promptsProcessed: promptIds.length });

    return new Response(JSON.stringify({ 
      inserted: totalInserted, 
      optimizations: allOptimizations.slice(0, 10), // Return sample for response size
      promptsProcessed: promptIds.length
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });

  } catch (e) {
    console.error('[generate-optimizations] Server error:', e);
    return new Response(`Server error: ${e}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});