
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

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
  uniquenessHint?: string;
}) {
  const cites = args.citations.slice(0,8).map((c: any) => `- ${c.domain}${c.title?` — ${c.title}`:''} (${c.link})`).join("\n");
  const comp  = args.competitors.slice(0,8).join(", ") || "None observed";
  
  // Add deduplication instruction
  const dedupInstruction = args.existingTitles && args.existingTitles.length > 0
    ? `\n\nIMPORTANT - AVOID DUPLICATES: These optimization titles already exist for this prompt. Create COMPLETELY DIFFERENT strategies with fresh angles:\n${args.existingTitles.map(t => `- "${t}"`).join('\n')}\n\nYour new optimizations MUST have distinct titles and approaches. Do not repeat these concepts.`
    : '';
  
  const uniqueHint = args.uniquenessHint 
    ? `\n\nGeneration ID: ${args.uniquenessHint} (use this to ensure fresh perspectives)`
    : '';
  
  if (args.category === 'low_visibility') {
    return `BRAND: ${args.brand}
LOW-VISIBILITY PROMPT: "${args.promptText}"
CURRENT PRESENCE: ${args.presenceRate.toFixed(1)}% (needs improvement)
COMPETITORS IN RESPONSES: ${comp}
TOP CITATION DOMAINS:
${cites}${dedupInstruction}${uniqueHint}

GOAL: Create 3-4 NEW, DISTINCT targeted optimizations to improve visibility for this specific prompt.

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
- Impact score (1-10) and difficulty level

CRITICAL: Each strategy must be UNIQUE and different from existing optimizations listed above.`;
  } else {
    return `BRAND: ${args.brand}
GENERAL BRAND VISIBILITY OPTIMIZATION
CURRENT PROMPT CONTEXT: "${args.promptText}"
MARKET COMPETITORS: ${comp}
INDUSTRY CITATION SOURCES:
${cites}${dedupInstruction}${uniqueHint}

GOAL: Create 4-5 NEW, comprehensive brand visibility strategies for general market presence.

REQUIREMENTS:
1) SOCIAL POST: Thought leadership content, speaking opportunities, industry positioning
2) BLOG OUTLINE: Multi-platform approach including LinkedIn, Twitter, Reddit
3) REDDIT STRATEGY: Industry forums, Reddit communities, professional networks  
4) TALKING POINTS: SEO content, video series, podcast appearances
5) CTA SNIPPETS: Long-term subreddit engagement, value-first contributions

Focus on scalable strategies that build long-term brand authority and visibility across AI search results.
Include detailed implementation guides, resource requirements, and projected ROI.

CRITICAL: Each strategy must be UNIQUE and different from existing optimizations listed above.`;
  }
}

Deno.serve(async (req) => {
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
      console.log('[generate-optimizations] Fetching ALL active prompts for org:', orgId);
      
      // Get ALL active prompts
      const { data: allPrompts } = await supabase
        .from('prompts')
        .select('id')
        .eq('org_id', orgId)
        .eq('active', true);
      
      // Get visibility data for all prompts
      const { data: visibilityData } = await supabase
        .from('prompt_visibility_14d')
        .select('prompt_id, presence_rate')
        .eq('org_id', orgId);
      
      // Build presence rate map
      const presenceMap = new Map(
        (visibilityData || []).map((v: any) => [v.prompt_id, Number(v.presence_rate) || 0])
      );
      
      // Filter to only prompts with < 100% visibility (or missing data = 0%)
      promptIds = (allPrompts || [])
        .filter((p: any) => {
          const rate = presenceMap.get(p.id) ?? 0;
          return rate < 100;
        })
        .map((p: any) => p.id);
      
      console.log('[generate-optimizations] Total active prompts:', allPrompts?.length || 0);
      console.log('[generate-optimizations] Prompts with <100% visibility:', promptIds.length);
      console.log('[generate-optimizations] Processing ALL under-100% prompts (no limit)');
    }

    if (promptIds.length === 0) {
      console.log('[generate-optimizations] No prompts to process');
      return new Response(JSON.stringify({ inserted: 0, optimizations: [] }), { 
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    console.log('[generate-optimizations] Processing prompts', { count: promptIds.length, promptIds });

    // Process ALL prompts in batch mode
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

        // Fetch existing optimizations for this prompt to avoid duplicates
        const { data: existingOpts } = await supabase
          .from('optimizations')
          .select('title, content_type, created_at')
          .eq('org_id', orgId)
          .eq('prompt_id', pid)
          .order('created_at', { ascending: false })
          .limit(100);

        const existingTitles = (existingOpts || [])
          .map((o: any) => o.title)
          .filter(Boolean);

        const existingTypes = new Set(
          (existingOpts || []).map((o: any) => o.content_type)
        );

        console.log('[generate-optimizations] Existing optimizations for prompt', pid, ':', {
          count: existingOpts?.length || 0,
          titles: existingTitles,
          types: Array.from(existingTypes)
        });

        // Add uniqueness hint to encourage varied outputs
        const uniquenessHint = `${new Date().toISOString().split('T')[0]}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

        // Call Lovable AI (Gemini 2.5 Flash) for this prompt
        const promptInput = optimizerUserPrompt({
          brand: org?.name || "Your brand",
          promptText: prompt.text,
          presenceRate: presence,
          competitors,
          citations,
          category,
          existingTitles,
          uniquenessHint
        });

        console.log('[generate-optimizations] Calling Lovable AI (Gemini 2.5 Flash) for prompt:', pid);
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { 
            "authorization": `Bearer ${lovableApiKey}`, 
            "content-type": "application/json" 
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: optimizerSystem() },
              { role: "user", content: promptInput }
            ]
          })
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          console.error('[generate-optimizations] Lovable AI error for prompt', pid, ':', errorText);
          
          // Check for rate limiting
          if (resp.status === 429) {
            console.warn('[generate-optimizations] Rate limited - adding delay before next prompt');
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second backoff
          }
          
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
        let toInsert: any[] = [];
        
        (parsed.optimizations ?? []).forEach((opt: any) => {
          // Map content types to valid constraint values
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

        // FALLBACK: If LLM returned empty or failed, generate default optimizations
        if (toInsert.length === 0) {
          console.warn('[generate-optimizations] LLM returned no optimizations for prompt', pid, '- using fallback');
          
          const brandName = org?.name || "your brand";
          const promptText = prompt.text;
          
          toInsert = [
            {
              org_id: orgId,
              prompt_id: pid,
              optimization_category: category,
              content_type: 'social_post',
              title: `LinkedIn Thought Leadership: ${promptText.slice(0, 50)}`,
              body: `Share insights about ${promptText} on LinkedIn:\n1. Create a post addressing this topic\n2. Tag relevant industry leaders\n3. Include 3-5 relevant hashtags\n4. Post during business hours for max visibility\n5. Engage with comments within first 2 hours`,
              sources: citations,
              score_before: presence,
              projected_impact: "Improved visibility expected within 2-3 weeks",
              provider: 'optimizer',
              implementation_details: { steps: ["Draft post", "Review and edit", "Schedule posting", "Monitor engagement"] },
              resources: [],
              success_metrics: { primary: "Post engagement rate", timeline: "2 weeks" },
              reddit_strategy: {},
              impact_score: 6,
              difficulty_level: 'easy',
              timeline_weeks: 2
            },
            {
              org_id: orgId,
              prompt_id: pid,
              optimization_category: category,
              content_type: 'blog_outline',
              title: `SEO-Optimized Article: ${promptText.slice(0, 50)}`,
              body: `Article outline:\n1. Introduction - Address the main question\n2. Current market landscape\n3. How ${brandName} provides a solution\n4. Key benefits and features\n5. Case studies or examples\n6. Conclusion and CTA`,
              sources: citations,
              score_before: presence,
              projected_impact: "Increased organic search visibility in 4-6 weeks",
              provider: 'optimizer',
              implementation_details: { steps: ["Research keywords", "Draft article", "Optimize for SEO", "Publish and promote"] },
              resources: [],
              success_metrics: { primary: "Organic search rankings", timeline: "6 weeks" },
              reddit_strategy: {},
              impact_score: 7,
              difficulty_level: 'medium',
              timeline_weeks: 4
            },
            {
              org_id: orgId,
              prompt_id: pid,
              optimization_category: category,
              content_type: 'talking_points',
              title: `Key Talking Points: ${promptText.slice(0, 50)}`,
              body: `Key messages for ${promptText}:\n1. ${brandName} addresses this need by...\n2. Our unique approach includes...\n3. Customer results show...\n4. Industry trends support...\n5. Get started with...`,
              sources: citations,
              score_before: presence,
              projected_impact: "Consistent messaging in interviews and content",
              provider: 'optimizer',
              implementation_details: { steps: ["Review and memorize key points", "Practice delivery", "Use in presentations"] },
              resources: [],
              success_metrics: { primary: "Message consistency", timeline: "Immediate" },
              reddit_strategy: {},
              impact_score: 5,
              difficulty_level: 'easy',
              timeline_weeks: 1
            },
            {
              org_id: orgId,
              prompt_id: pid,
              optimization_category: category,
              content_type: 'reddit_strategy',
              title: `Reddit Community Engagement: ${promptText.slice(0, 40)}`,
              body: `Identify and engage in relevant Reddit communities discussing ${promptText}. Focus on providing value before promoting ${brandName}.`,
              sources: citations,
              score_before: presence,
              projected_impact: "Community credibility built over 6-8 weeks",
              provider: 'optimizer',
              implementation_details: { 
                steps: ["Find relevant subreddits", "Read rules and lurk", "Provide value-first comments", "Share expertise naturally"] 
              },
              resources: [],
              success_metrics: { primary: "Community karma and engagement", timeline: "8 weeks" },
              reddit_strategy: {
                subreddits: [
                  { name: "r/entrepreneur", audience: "Business owners", rules: "No self-promotion in posts" },
                  { name: "r/startups", audience: "Startup founders", rules: "Must provide value first" }
                ],
                post_types: ["helpful comment", "expertise sharing", "case study"],
                content_approach: "Focus on helping others solve problems related to this topic"
              },
              impact_score: 6,
              difficulty_level: 'medium',
              timeline_weeks: 6
            }
          ];
          
          console.log('[generate-optimizations] Generated', toInsert.length, 'fallback optimizations');
        }

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

      } catch (error: unknown) {
        console.error('[generate-optimizations] Error processing prompt', pid, ':', error);
        // Continue with next prompt
        continue;
      }
    }

    // Refresh visibility data
    await supabase.rpc('refresh_prompt_visibility_14d');

    console.log('[generate-optimizations] ===== BATCH SUMMARY =====');
    console.log('[generate-optimizations] Prompts processed:', promptIds.length);
    console.log('[generate-optimizations] Total optimizations inserted:', totalInserted);
    console.log('[generate-optimizations] Average per prompt:', (totalInserted / Math.max(promptIds.length, 1)).toFixed(1));
    console.log('[generate-optimizations] ========================');

    return new Response(JSON.stringify({ 
      inserted: totalInserted, 
      optimizations: allOptimizations.slice(0, 10), // Return sample for response size
      promptsProcessed: promptIds.length
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });

  } catch (e: unknown) {
    console.error('[generate-optimizations] Server error:', e);
    return new Response(`Server error: ${e}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
