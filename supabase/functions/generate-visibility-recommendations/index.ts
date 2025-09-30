import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_SYNC = 1;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function safeJSON(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}

function pick<T>(v: T | null | undefined, alt: T): T { return v ?? alt; }

const SYSTEM = `You are an AI Search Visibility strategist for B2B SaaS. You create actionable recommendations that increase a brand's likelihood of being cited/mentioned in AI assistants (ChatGPT, Perplexity, Gemini, Google AI Overviews).

Return STRICT JSON only (no prose, no backticks). Required keys:
{
  "content": [
    {
      "subtype": "blog_post|resource_hub|landing_page",
      "title": "...",
      "outline": [{"h2": "...", "h3": ["...", "..."]}],
      "must_include": {
        "entities": ["..."],
        "keywords": ["..."],
        "faqs": ["..."],
        "schema": ["FAQPage", "HowTo"]
      },
      "where_to_publish": {
        "path": "/blog/...",
        "update_existing": false
      },
      "posting_instructions": "step-by-step to implement correctly for AI visibility",
      "citations_used": [{"domain": "...", "link": "..."}],
      "success_metrics": ["increase presence on prompt by X% in 14 days", "..."]
    }
  ],
  "social": [
    {
      "subtype": "linkedin_post|x_post",
      "title": "hook/headline",
      "body_bullets": ["...", "..."],
      "cta": "...",
      "where_to_publish": {
        "platform": "LinkedIn|X",
        "profile": "company"
      },
      "must_include": {
        "entities": ["..."],
        "keywords": ["..."]
      },
      "posting_instructions": "timing, tags, mention strategy",
      "citations_used": [{"domain": "...", "link": "..."}],
      "success_metrics": ["impressions > ...", "mentions > ..."]
    }
  ],
  "projected_impact": "1-2 sentences"
}

Use the tracked prompt text and recently seen citations/domains. Avoid naming competitors; emphasize our brand value.`;

function userPrompt(args: {
  brand: string;
  promptText: string;
  presenceRate: number;
  citations: {domain: string; link: string; title?: string}[];
}) {
  const cites = args.citations.slice(0, 8).map(c => 
    `- ${c.domain}${c.title ? ` — ${c.title}` : ''} (${c.link})`
  ).join('\n');
  
  return `BRAND: ${args.brand}
TRACKED PROMPT: "${args.promptText}"
CURRENT PRESENCE (14d): ${args.presenceRate.toFixed(1)}%
RECENT CITATIONS:
${cites || 'No recent citations available'}

Create content+social recommendations that specifically target this prompt intent and increase presence in AI answers.
JSON ONLY.`;
}

async function openaiJSON(messages: any[], tries = 2): Promise<any> {
  let lastError: any = null;
  
  while (tries-- > 0) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          max_tokens: 4000,
          messages
        })
      });
      
      if (!response.ok) {
        lastError = await response.text();
        console.error('[openaiJSON] API error:', response.status, lastError);
        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        continue;
      }
      
      const json = await response.json();
      const raw = json?.choices?.[0]?.message?.content ?? "";
      const parsed = safeJSON(raw);
      
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
      
      lastError = raw;
    } catch (error) {
      lastError = error;
      console.error('[openaiJSON] Fetch error:', error);
    }
  }
  
  console.warn('[openaiJSON] All retries failed, using deterministic fallback');
  
  // Deterministic fallback - always returns useful recommendations
  const promptMatch = messages[1]?.content?.match(/TRACKED PROMPT: "([^"]+)"/);
  const brandMatch = messages[1]?.content?.match(/BRAND: (.*)/);
  const promptText = promptMatch?.[1] ?? "Your Topic";
  const brandName = brandMatch?.[1]?.trim() ?? "Your Brand";
  
  return {
    content: [
      {
        subtype: "blog_post",
        title: `Complete Guide: ${promptText}`,
        outline: [
          {
            h2: "Understanding the Fundamentals",
            h3: ["Key Concepts", "Common Terminology", "Why This Matters"]
          },
          {
            h2: "Step-by-Step Implementation",
            h3: ["Getting Started", "Best Practices", "Common Pitfalls to Avoid"]
          },
          {
            h2: "Advanced Strategies",
            h3: ["Expert Tips", "Optimization Techniques", "Measuring Success"]
          }
        ],
        must_include: {
          entities: [brandName],
          keywords: ["best practices", "guide", "how to", "comparison", "pricing"],
          faqs: [
            `What is ${promptText}?`,
            `How do I get started with ${promptText}?`,
            "What are the benefits?"
          ],
          schema: ["FAQPage", "HowTo"]
        },
        where_to_publish: {
          path: `/blog/${promptText.toLowerCase().replace(/\s+/g, '-')}-guide`,
          update_existing: false
        },
        posting_instructions: `1. Create comprehensive 2000+ word article\n2. Add FAQ schema markup\n3. Include comparison table\n4. Add internal links to product pages\n5. Cite 2-3 authoritative sources\n6. Include downloadable checklist or template\n7. Optimize meta description with target keyword\n8. Add structured data markup`,
        citations_used: [],
        success_metrics: [
          "Increase prompt presence by 25% within 14 days",
          "Time on page > 3 minutes",
          "Bounce rate < 60%"
        ]
      },
      {
        subtype: "resource_hub",
        title: `${promptText} Resources & Tools`,
        outline: [
          {
            h2: "Essential Resources",
            h3: ["Templates & Checklists", "Tools & Software", "Learning Materials"]
          },
          {
            h2: "Case Studies & Examples",
            h3: ["Success Stories", "Real-World Applications", "ROI Metrics"]
          }
        ],
        must_include: {
          entities: [brandName],
          keywords: ["resources", "tools", "templates", "case studies"],
          faqs: [
            "What tools do I need?",
            "Are there free resources available?"
          ],
          schema: ["FAQPage"]
        },
        where_to_publish: {
          path: `/resources/${promptText.toLowerCase().replace(/\s+/g, '-')}`,
          update_existing: false
        },
        posting_instructions: `1. Create dedicated resource hub page\n2. Include downloadable assets\n3. Add email capture for gated content\n4. Feature ${brandName} solution prominently\n5. Add social proof (testimonials, logos)\n6. Include comparison tools or calculators\n7. Optimize for featured snippets`,
        citations_used: [],
        success_metrics: [
          "50+ resource downloads per month",
          "10% conversion to trial/demo",
          "Average 4+ minutes engagement"
        ]
      }
    ],
    social: [
      {
        subtype: "linkedin_post",
        title: `The #1 mistake people make with ${promptText}`,
        body_bullets: [
          `Most teams struggle with ${promptText} because they skip this critical step`,
          `Here's the framework we use at ${brandName} to get 10x better results`,
          `Save this post - you'll want to reference it later`
        ],
        cta: "Drop a 💡 if this was helpful. Comment with your biggest challenge and I'll share our framework.",
        where_to_publish: {
          platform: "LinkedIn",
          profile: "company"
        },
        must_include: {
          entities: [brandName],
          keywords: ["framework", "strategy", "results"]
        },
        posting_instructions: `1. Post Tuesday or Wednesday 8-10am\n2. Use 2-3 relevant hashtags\n3. Tag relevant industry leaders (no competitors)\n4. Reply to first 5 comments within 30 mins\n5. Share from personal profile for 3x reach\n6. Include link to blog post in comments\n7. Use carousel format with 5-7 slides`,
        citations_used: [],
        success_metrics: [
          "1000+ impressions",
          "50+ engagements",
          "20+ link clicks"
        ]
      },
      {
        subtype: "x_post",
        title: `Quick thread: ${promptText} explained`,
        body_bullets: [
          `1/ Everyone talks about ${promptText}, but few do it right`,
          `2/ Here's what actually works (thread 🧵)`,
          `3/ The key is [specific insight related to brand value]`
        ],
        cta: "Follow @YourBrand for more insights like this",
        where_to_publish: {
          platform: "X",
          profile: "company"
        },
        must_include: {
          entities: [brandName],
          keywords: ["thread", "insights", "tips"]
        },
        posting_instructions: `1. Post as 5-7 tweet thread\n2. Use 1-2 hashtags in final tweet\n3. Include visual in tweet 1\n4. Link to resource in final tweet\n5. Pin thread for 48 hours\n6. Retweet with additional context after 4 hours\n7. Engage with replies within first hour`,
        citations_used: [],
        success_metrics: [
          "500+ impressions per tweet",
          "25+ retweets",
          "15+ quote tweets"
        ]
      }
    ],
    projected_impact: `These recommendations target the exact intent of "${promptText}" and will increase ${brandName}'s visibility in AI search results by providing comprehensive, citable content that AI models prefer to reference.`
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[generate-visibility-recommendations] Function called');
    
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      console.error('[generate-visibility-recommendations] Missing or invalid authorization');
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const jwt = auth.slice("Bearer ".length);
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const promptId: string | undefined = body?.promptId;
    const batch: boolean = !!body?.batch;

    console.log('[generate-visibility-recommendations] Request:', { promptId, batch });

    const { data: me, error: userError } = await userClient.auth.getUser();
    if (userError || !me?.user) {
      console.error('[generate-visibility-recommendations] Auth failed:', userError);
      return new Response("Auth failed", { status: 401, headers: corsHeaders });
    }

    const { data: user } = await service
      .from("users")
      .select("id, org_id, email")
      .eq("id", me.user.id)
      .single();
      
    if (!user?.org_id) {
      console.error('[generate-visibility-recommendations] No org found for user');
      return new Response("No org", { status: 403, headers: corsHeaders });
    }

    const { data: org } = await service
      .from("organizations")
      .select("id, name")
      .eq("id", user.org_id)
      .single();

    // Determine target prompts
    let promptIds: string[] = [];
    if (promptId) {
      promptIds = [promptId];
    } else if (batch) {
      const { data: lows } = await service
        .from("prompt_visibility_14d")
        .select("prompt_id")
        .eq("org_id", user.org_id)
        .lt("presence_rate", 50)
        .order("presence_rate", { ascending: true })
        .limit(20);
      promptIds = (lows ?? []).map((r: any) => r.prompt_id);
    }

    if (promptIds.length === 0) {
      console.log('[generate-visibility-recommendations] No prompts to process');
      return new Response(
        JSON.stringify({ inserted: 0, recommendations: [] }), 
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    // For now, only process single prompt synchronously
    if (promptIds.length > MAX_SYNC) {
      console.log('[generate-visibility-recommendations] Batch queuing not implemented yet, processing first prompt only');
      promptIds = [promptIds[0]];
    }

    const pid = promptIds[0];
    console.log('[generate-visibility-recommendations] Processing prompt:', pid);

    // Get prompt details
    const { data: prompt } = await service
      .from("prompts")
      .select("id, text, org_id")
      .eq("id", pid)
      .eq("org_id", user.org_id)
      .single();
      
    if (!prompt) {
      console.error('[generate-visibility-recommendations] Prompt not found');
      return new Response("Prompt not found", { status: 404, headers: corsHeaders });
    }

    // Get visibility stats
    const { data: vis } = await service
      .from("prompt_visibility_14d")
      .select("presence_rate")
      .eq("org_id", user.org_id)
      .eq("prompt_id", pid)
      .maybeSingle();
    const presence = pick(vis?.presence_rate, 0);

    console.log('[generate-visibility-recommendations] Presence rate:', presence);

    // Get recent citations
    const { data: responses } = await service
      .from("prompt_provider_responses")
      .select("citations_json")
      .eq("org_id", user.org_id)
      .eq("prompt_id", pid)
      .not("citations_json", "is", null)
      .order("run_at", { ascending: false })
      .limit(20);

    const citations: {domain: string; link: string; title?: string}[] = [];
    (responses ?? []).forEach((r: any) => {
      if (r.citations_json && Array.isArray(r.citations_json)) {
        r.citations_json.forEach((c: any) => {
          if (c.url || c.link) {
            try {
              const url = c.url || c.link;
              const domain = c.domain || new URL(url).hostname;
              citations.push({
                domain,
                link: url,
                title: c.title || null
              });
            } catch (e) {
              console.warn('[generate-visibility-recommendations] Invalid citation URL:', c);
            }
          }
        });
      }
    });

    console.log('[generate-visibility-recommendations] Found citations:', citations.length);

    // Call OpenAI with retry and fallback
    const messages = [
      { role: "system", content: SYSTEM },
      { 
        role: "user", 
        content: userPrompt({
          brand: org?.name || "Your Brand",
          promptText: prompt.text,
          presenceRate: presence,
          citations
        })
      }
    ];

    console.log('[generate-visibility-recommendations] Calling OpenAI');
    const json = await openaiJSON(messages, 2);
    
    const content = Array.isArray(json?.content) ? json.content : [];
    const social = Array.isArray(json?.social) ? json.social : [];
    const projectedImpact = typeof json?.projected_impact === "string" ? json.projected_impact : null;

    console.log('[generate-visibility-recommendations] Generated:', { content: content.length, social: social.length });

    // Build insert rows
    const rows: any[] = [];
    
    content.forEach((c: any) => {
      rows.push({
        org_id: user.org_id,
        prompt_id: pid,
        channel: "content",
        subtype: c.subtype || "blog_post",
        title: c.title || "Untitled",
        outline: c.outline || null,
        posting_instructions: c.posting_instructions || "",
        must_include: c.must_include || {},
        where_to_publish: c.where_to_publish || {},
        citations_used: citations.slice(0, 10),
        success_metrics: c.success_metrics || (projectedImpact ? [projectedImpact] : []),
        score_before: presence
      });
    });

    social.forEach((s: any) => {
      rows.push({
        org_id: user.org_id,
        prompt_id: pid,
        channel: "social",
        subtype: s.subtype || "linkedin_post",
        title: s.title || "Untitled",
        outline: { body_bullets: s.body_bullets || [] },
        posting_instructions: s.posting_instructions || "",
        must_include: s.must_include || {},
        where_to_publish: s.where_to_publish || {},
        citations_used: citations.slice(0, 5),
        success_metrics: s.success_metrics || (projectedImpact ? [projectedImpact] : []),
        score_before: presence
      });
    });

    // Insert recommendations
    if (rows.length > 0) {
      const { data: inserted, error: insertError } = await service
        .from("ai_visibility_recommendations")
        .insert(rows)
        .select();

      if (insertError) {
        console.error('[generate-visibility-recommendations] Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: `Insert failed: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      console.log('[generate-visibility-recommendations] Successfully inserted:', inserted?.length || 0);

      return new Response(
        JSON.stringify({ 
          inserted: inserted?.length || 0, 
          recommendations: inserted || [] 
        }),
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ inserted: 0, recommendations: [] }),
      { headers: { ...corsHeaders, "content-type": "application/json" } }
    );

  } catch (error) {
    console.error('[generate-visibility-recommendations] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        inserted: 0,
        recommendations: []
      }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }
});
