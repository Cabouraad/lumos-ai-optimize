
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

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
  existingTitles?: string[];
}) {
  const cites = args.citations.slice(0,8).map((c: any) => `- ${c.domain}${c.title?` — ${c.title}`:''} (${c.link})`).join("\n");
  const comp  = args.competitors.slice(0,8).join(", ") || "None observed";
  
  const dedupInstruction = args.existingTitles && args.existingTitles.length > 0
    ? `\n\nIMPORTANT - AVOID DUPLICATES: These optimization titles already exist. Create COMPLETELY DIFFERENT strategies:\n${args.existingTitles.map(t => `- "${t}"`).join('\n')}`
    : '';
  
  if (args.category === 'low_visibility') {
    return `BRAND: ${args.brand}
LOW-VISIBILITY PROMPT: "${args.promptText}"
CURRENT PRESENCE: ${args.presenceRate.toFixed(1)}% (needs improvement)
COMPETITORS: ${comp}
TOP CITATIONS:
${cites}${dedupInstruction}

Create 3-4 NEW, DISTINCT targeted optimizations to improve visibility for this specific prompt.

REQUIREMENTS:
1) SOCIAL POST: Professional thought leadership post addressing the prompt topic
2) REDDIT STRATEGY: Identify 5-7 relevant subreddits with specific post approaches
3) BLOG OUTLINE: Comprehensive SEO-optimized article
4) TALKING POINTS: 5 key points for interviews/podcasts positioning ${args.brand} as the solution`;
  } else {
    return `BRAND: ${args.brand}
GENERAL BRAND VISIBILITY OPTIMIZATION
CONTEXT: "${args.promptText}"
COMPETITORS: ${comp}
CITATIONS:
${cites}${dedupInstruction}

Create 4-5 NEW comprehensive brand visibility strategies for general market presence.

Focus on scalable strategies that build long-term brand authority across AI search results.`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[generate-optimizations] Function called');

  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: auth } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('[generate-optimizations] Auth failed:', userError);
      return new Response("Auth failed", { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const promptId: string | undefined = body?.promptId;
    const doBatch: boolean = !!body?.batch;
    const category: 'low_visibility' | 'general' = body?.category || 'general';

    console.log('[generate-optimizations] Request:', { promptId, doBatch, category });

    // Get user's org
    const { data: userRecord } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!userRecord?.org_id) {
      return new Response("No org found", { status: 403, headers: corsHeaders });
    }

    const orgId = userRecord.org_id;
    console.log('[generate-optimizations] Org ID:', orgId);

    // Get organization details
    const { data: org } = await supabase
      .from("organizations")
      .select("name, business_description")
      .eq("id", orgId)
      .single();

    // ============================================================
    // REAL-TIME VISIBILITY CALCULATION
    // Query latest responses directly instead of stale table
    // ============================================================
    
    let promptIds: string[] = [];
    
    if (promptId) {
      promptIds = [promptId];
    } else if (doBatch) {
      console.log('[generate-optimizations] Batch mode: calculating real-time visibility');
      
      // Get all active prompts
      const { data: allPrompts } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('org_id', orgId)
        .eq('active', true);
      
      if (!allPrompts || allPrompts.length === 0) {
        console.log('[generate-optimizations] No active prompts found');
        return new Response(JSON.stringify({ inserted: 0, optimizations: [] }), { 
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      // Calculate real-time visibility for each prompt from latest responses (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const visibilityMap = new Map<string, number>();
      
      for (const prompt of allPrompts) {
        const { data: recentResponses } = await supabase
          .from('prompt_provider_responses')
          .select('org_brand_present')
          .eq('org_id', orgId)
          .eq('prompt_id', prompt.id)
          .eq('status', 'success')
          .gte('run_at', sevenDaysAgo.toISOString())
          .order('run_at', { ascending: false })
          .limit(50); // Latest 50 responses per prompt
        
        if (recentResponses && recentResponses.length > 0) {
          const presentCount = recentResponses.filter(r => r.org_brand_present).length;
          const presenceRate = (presentCount / recentResponses.length) * 100;
          visibilityMap.set(prompt.id, presenceRate);
          console.log(`[generate-optimizations] Prompt ${prompt.id}: ${presenceRate.toFixed(1)}% visibility (${presentCount}/${recentResponses.length} runs)`);
        } else {
          visibilityMap.set(prompt.id, 0);
        }
      }
      
      // Filter to prompts with < 100% visibility
      promptIds = allPrompts
        .filter(p => (visibilityMap.get(p.id) ?? 0) < 100)
        .map(p => p.id);
      
      console.log(`[generate-optimizations] Found ${promptIds.length} prompts with <100% visibility out of ${allPrompts.length} total`);
    }

    if (promptIds.length === 0) {
      console.log('[generate-optimizations] No prompts to process');
      return new Response(JSON.stringify({ inserted: 0, optimizations: [] }), { 
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    // ============================================================
    // PROCESS PROMPTS WITH LATEST DATA
    // ============================================================
    
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

        if (!prompt) continue;

        // Get LATEST responses (last 7 days, ordered by run_at descending)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data: latestResponses } = await supabase
          .from("prompt_provider_responses")
          .select("org_brand_present, competitors_json, citations_json, run_at")
          .eq("org_id", orgId)
          .eq("prompt_id", pid)
          .eq("status", "success")
          .gte('run_at', sevenDaysAgo.toISOString())
          .order("run_at", { ascending: false })
          .limit(50); // Latest 50 responses

        // Calculate REAL-TIME presence rate from latest data
        let presenceRate = 0;
        if (latestResponses && latestResponses.length > 0) {
          const presentCount = latestResponses.filter(r => r.org_brand_present).length;
          presenceRate = (presentCount / latestResponses.length) * 100;
          console.log(`[generate-optimizations] Prompt ${pid} real-time visibility: ${presenceRate.toFixed(1)}% (${presentCount}/${latestResponses.length} runs, latest: ${latestResponses[0].run_at})`);
        }

        // Extract competitors and citations from LATEST responses
        const competitors = Array.from(
          new Set((latestResponses ?? [])
            .flatMap((r: any) => r.competitors_json ? 
              (Array.isArray(r.competitors_json) ? r.competitors_json : []) : [])
            .filter(Boolean)
          )
        );

        const citations = (latestResponses ?? [])
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

        // Get existing optimizations to avoid duplicates
        const { data: existingOpts } = await supabase
          .from('optimizations')
          .select('title')
          .eq('org_id', orgId)
          .eq('prompt_id', pid)
          .order('created_at', { ascending: false })
          .limit(50);

        const existingTitles = (existingOpts || [])
          .map((o: any) => o.title)
          .filter(Boolean);

        console.log(`[generate-optimizations] Prompt ${pid}: ${existingTitles.length} existing optimizations`);

        // Call OpenAI
        const promptInput = optimizerUserPrompt({
          brand: org?.name || "Your brand",
          promptText: prompt.text,
          presenceRate,
          competitors,
          citations,
          category,
          existingTitles
        });

        console.log('[generate-optimizations] Calling OpenAI API (gpt-5-mini)');
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${openaiApiKey}`, 
            "Content-Type": "application/json" 
          },
          body: JSON.stringify({
            model: "gpt-5-mini-2025-08-07",
            response_format: { type: "json_object" },
            max_completion_tokens: 4000,
            messages: [
              { role: "system", content: optimizerSystem() },
              { role: "user", content: promptInput }
            ]
          })
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          console.error('[generate-optimizations] OpenAI API error:', resp.status, errorText);
          
          if (resp.status === 429) {
            console.warn('[generate-optimizations] Rate limited - waiting 5s');
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          
          continue;
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
          console.error('[generate-optimizations] Failed to parse JSON');
          continue;
        }

        // ============================================================
        // INSERT OPTIMIZATIONS - CRITICAL FIX
        // Use .insert().select() to verify insertion and return data
        // ============================================================
        
        const toInsert: any[] = (parsed.optimizations ?? []).map((opt: any) => {
          let validContentType = 'social_post';
          const rawType = (opt.content_type || '').toLowerCase();
          
          if (rawType.includes('social') || rawType.includes('post')) {
            validContentType = 'social_post';
          } else if (rawType.includes('blog') || rawType.includes('outline')) {
            validContentType = 'blog_outline';
          } else if (rawType.includes('talk') || rawType.includes('point')) {
            validContentType = 'talking_points';
          } else if (rawType.includes('cta') || rawType.includes('snippet')) {
            validContentType = 'cta_snippets';
          } else if (rawType.includes('reddit')) {
            validContentType = 'reddit_strategy';
          }

          return { 
            org_id: orgId, 
            prompt_id: pid, 
            optimization_category: category,
            content_type: validContentType,
            title: opt.title || "Optimization", 
            body: typeof opt.body === 'string' ? opt.body : JSON.stringify(opt.body), 
            sources: citations, 
            score_before: presenceRate,
            projected_impact: opt.implementation_details?.timeline || "4-6 weeks",
            provider: 'optimizer',
            implementation_details: opt.implementation_details || {},
            resources: opt.resources || [],
            success_metrics: opt.success_metrics || {},
            reddit_strategy: opt.reddit_strategy || {},
            impact_score: opt.impact_score || 5,
            difficulty_level: opt.difficulty_level || 'medium',
            timeline_weeks: opt.timeline_weeks || 4
          };
        });

        if (toInsert.length > 0) {
          const { data: inserted, error: insertError } = await supabase
            .from('optimizations')
            .insert(toInsert)
            .select();

          if (insertError) {
            console.error('[generate-optimizations] Insert error:', insertError);
          } else {
            console.log(`[generate-optimizations] ✅ Successfully inserted ${inserted?.length || 0} optimizations for prompt ${pid}`);
            totalInserted += inserted?.length || 0;
            allOptimizations.push(...(inserted || []));
          }
        }

      } catch (error) {
        console.error('[generate-optimizations] Error processing prompt:', error);
        continue;
      }
    }

    console.log(`[generate-optimizations] ===== COMPLETE =====`);
    console.log(`[generate-optimizations] Total optimizations inserted: ${totalInserted}`);
    console.log(`[generate-optimizations] Prompts processed: ${promptIds.length}`);

    return new Response(
      JSON.stringify({ 
        inserted: totalInserted, 
        optimizations: allOptimizations,
        promptsProcessed: promptIds.length
      }), 
      { 
        headers: { ...corsHeaders, "content-type": "application/json" }
      }
    );

  } catch (error) {
    console.error('[generate-optimizations] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        inserted: 0,
        optimizations: []
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, "content-type": "application/json" }
      }
    );
  }
});
