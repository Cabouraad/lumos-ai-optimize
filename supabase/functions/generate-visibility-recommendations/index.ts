// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const ORIGIN = Deno.env.get("APP_ORIGIN") || "*";

function cors() {
  return {
    "access-control-allow-origin": ORIGIN,
    "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

function j(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors() }
  });
}

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }

  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return j({ code: "unauthorized", detail: "Missing Bearer token." }, 200);
    }
    const jwt = auth.slice("Bearer ".length);

    if (!OPENAI_API_KEY) {
      return j({ code: "misconfigured_env", detail: "OPENAI_API_KEY is not configured on this project." }, 200);
    }

    // Service client for system writes (bypasses RLS)
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // User-bound client for auth
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    });

    const { data: authUser, error: authErr } = await userSupabase.auth.getUser();
    if (authErr || !authUser?.user) {
      return j({ code: "unauthorized", detail: "Invalid or expired session." }, 200);
    }

    const { promptId } = await req.json().catch(() => ({}));
    if (!promptId) return j({ code: "invalid_input", detail: "promptId is required." }, 200);

    const { data: user, error: userErr } = await service
      .from("users")
      .select("id, org_id")
      .eq("id", authUser.user.id)
      .single();

    if (userErr || !user?.org_id) {
      return j({ code: "forbidden", detail: "No organization found for user." }, 200);
    }

    const { data: org } = await service
      .from("organizations")
      .select("name")
      .eq("id", user.org_id)
      .single();

    const { data: prompt } = await service
      .from("prompts")
      .select("id, text, org_id")
      .eq("id", promptId)
      .eq("org_id", user.org_id)
      .single();

    if (!prompt) return j({ code: "not_found", detail: "Prompt not found in your organization." }, 200);

    // Pull visibility
    const { data: vis } = await service
      .from("prompt_visibility_14d")
      .select("presence_rate, prompt_id")
      .eq("org_id", user.org_id)
      .eq("prompt_id", promptId)
      .maybeSingle();

    const presence = vis?.presence_rate ?? 0;

    // Collect recent citations from prompt_provider_responses
    const { data: responses } = await service
      .from("prompt_provider_responses")
      .select("citations_json")
      .eq("org_id", user.org_id)
      .eq("prompt_id", promptId)
      .not("citations_json", "is", null)
      .order("run_at", { ascending: false })
      .limit(5);

    const citations: any[] = [];
    (responses ?? []).forEach((r: any) => {
      if (Array.isArray(r.citations_json)) {
        r.citations_json.forEach((c: any) => {
          citations.push({
            domain: c.domain || (c.url ? new URL(c.url).hostname : ""),
            link: c.url,
            title: c.title || null,
          });
        });
      }
    });

    // Existing recommendations to avoid duplicates
    const { data: existing } = await service
      .from("optimizations")
      .select("id, content_type, title")
      .eq("org_id", user.org_id)
      .eq("prompt_id", promptId)
      .order("created_at", { ascending: false })
      .limit(30);

    const avoid = (existing ?? []).map((r: any) => `${r.content_type}:${(r.title || "").toLowerCase()}`).slice(0, 12);

    const brandName = org?.name || "Your Brand";
    const citesList = citations.slice(0, 8).map(c => `- ${c.domain}${c.title ? ` — ${c.title}` : ""} (${c.link})`).join("\n");
    const avoidList = avoid.join("\n");

    const system = "You are an AI Search Visibility strategist for B2B SaaS. Respond with strict JSON only.";
    const userPrompt = `
BRAND: ${brandName}
TRACKED PROMPT: "${prompt.text}"
WINDOW: last 14 days
CURRENT PRESENCE: ${presence.toFixed(1)}%

TOP CITATIONS:
${citesList || "(none)"}

AVOID DUPLICATES:
${avoidList || "(none)"}

Create content + social recommendations in JSON:
{
 "content":[{"subtype":"blog_post|resource_hub|landing_page","title":"...","outline":[{"h2":"...","h3":["..."]}],
   "must_include":{"entities":["..."],"keywords":["..."],"faqs":["..."],"schema":["FAQPage"]},
   "where_to_publish":{"path":"/blog/...","update_existing":false},
   "posting_instructions":"...", "citations_used":[{"domain":"...","link":"..."}], "success_metrics":["..."]}],
 "social":[{"subtype":"linkedin_post|x_post","title":"hook","body_bullets":["..."],"cta":"...",
   "where_to_publish":{"platform":"LinkedIn|X","profile":"company"},
   "must_include":{"entities":["..."],"keywords":["..."]}, "posting_instructions":"...", "success_metrics":["..."]}],
 "projected_impact":"..."
}
JSON ONLY.`.trim();

    // Call OpenAI
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return j({ code: "llm_error", detail: t }, 200);
    }

    const raw = await resp.json();
    const content = raw?.choices?.[0]?.message?.content ?? "{}";
    let json: any;
    try { json = JSON.parse(content); } catch { json = null; }

    if (!json) {
      json = {
        content: [{
          subtype: "resource_hub",
          title: `Resource Hub: ${prompt.text}`,
          outline: [{ h2: "What buyers need", h3: ["Key terms", "Comparison", "Pricing"] }],
          must_include: { entities: [brandName], keywords: ["guide","comparison"] },
          where_to_publish: { path: "/resources/" },
          posting_instructions: "Add FAQ schema and 2 internal links.",
          success_metrics: ["Presence +20% in 14d"]
        }],
        social: [{
          subtype: "linkedin_post",
          title: `Most teams miss this about ${prompt.text}`,
          body_bullets: ["One key insight", "Practical step", "Link to hub"],
          cta: "Read the full guide",
          where_to_publish: { platform: "LinkedIn", profile: "company" },
          must_include: { entities: [brandName] },
          success_metrics: [">2k impressions"]
        }]
      };
    }

    // Normalize rows and insert into optimizations table
    const rows: any[] = [];
    const presenceScore = presence ?? 0;

    (Array.isArray(json.content) ? json.content : []).forEach((c: any) => rows.push({
      org_id: user.org_id,
      prompt_id: promptId,
      content_type: c.subtype || "blog_post",
      title: c.title || "Untitled",
      body: JSON.stringify({
        outline: c.outline || [],
        must_include: c.must_include || {},
        where_to_publish: c.where_to_publish || {},
        posting_instructions: c.posting_instructions || "",
        success_metrics: c.success_metrics || []
      }),
      sources: citations.length > 0 ? citations : null,
      score_before: presenceScore,
      projected_impact: json.projected_impact || null
    }));

    (Array.isArray(json.social) ? json.social : []).forEach((s: any) => rows.push({
      org_id: user.org_id,
      prompt_id: promptId,
      content_type: "social_post",
      title: s.title || "Untitled",
      body: JSON.stringify({
        subtype: s.subtype || "linkedin_post",
        bullets: s.body_bullets || [],
        cta: s.cta || "",
        where_to_publish: s.where_to_publish || {},
        must_include: s.must_include || {},
        success_metrics: s.success_metrics || []
      }),
      sources: citations.length > 0 ? citations : null,
      score_before: presenceScore,
      projected_impact: json.projected_impact || null
    }));

    let inserted = 0;
    for (const r of rows) {
      const { error } = await service.from("optimizations").insert(r);
      if (!error) inserted++;
    }

    return j({ 
      code: inserted > 0 ? "success" : "nothing_to_do",
      inserted, 
      items: rows, 
      message: inserted ? "Recommendations generated." : "No new items (possible duplicates)." 
    }, 200);
  } catch (e) {
    console.error("Error in generate-visibility-recommendations:", e);
    return j({ code: "crash", detail: String(e) }, 200);
  }
});
