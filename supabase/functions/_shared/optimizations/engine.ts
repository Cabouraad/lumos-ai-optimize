// deno-lint-ignore-file no-explicit-any
/**
 * Unified optimization generation engine
 * Used by both direct generation and queue worker
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { WINDOW_DAYS, LLM_MODEL, MAX_RETRIES, RETRY_BASE_MS, FINGERPRINT_ALGO } from "./constants.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function sleep(ms: number) { 
  return new Promise(res => setTimeout(res, ms)); 
}

function asJSON(s: string) { 
  try { 
    return JSON.parse(s); 
  } catch { 
    return null; 
  } 
}

function jitter(i: number) { 
  return RETRY_BASE_MS * (2 ** i) + Math.floor(Math.random() * 200); 
}

async function callLLM(messages: any[]) {
  if (!OPENAI_API_KEY) {
    console.warn("[Engine] OpenAI API key not configured");
    return { json: null, source: "missing-openai" };
  }
  
  let last: any = null;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { 
          "authorization": `Bearer ${OPENAI_API_KEY}`, 
          "content-type": "application/json" 
        },
        body: JSON.stringify({ 
          model: LLM_MODEL, 
          temperature: 0.25, 
          response_format: { type: "json_object" }, 
          messages 
        })
      });
      
      if (r.ok) {
        const raw = (await r.json())?.choices?.[0]?.message?.content ?? "";
        const json = asJSON(raw);
        if (json) {
          console.log("[Engine] LLM call successful");
          return { json, source: "llm" };
        }
        last = "parse-failed";
      } else {
        last = await r.text();
        console.warn(`[Engine] LLM call failed (attempt ${i + 1}/${MAX_RETRIES}):`, last);
      }
      
      if (i < MAX_RETRIES - 1) {
        await sleep(jitter(i));
      }
    } catch (e) {
      last = String(e);
      console.error(`[Engine] LLM call error (attempt ${i + 1}/${MAX_RETRIES}):`, e);
    }
  }
  
  console.error("[Engine] All LLM attempts failed, using fallback");
  return { json: null, source: "llm-failed", last };
}

function deterministicFallback(brand: string, promptText: string) {
  console.log("[Engine] Using deterministic fallback for:", promptText);
  const slug = promptText.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$|--+/g, "-")
    .slice(0, 60);
    
  return {
    content: [{
      subtype: "blog_post",
      title: `Definitive Guide: ${promptText}`,
      outline: [
        { h2: "What buyers need to know", h3: ["Key terms", "Decision criteria", "Common pitfalls"] },
        { h2: "How to evaluate solutions", h3: ["Checklist", "Comparison table", "Implementation tips"] }
      ],
      must_include: { 
        entities: [brand], 
        keywords: ["best practices", "comparison", "pricing", "alternatives"], 
        faqs: ["What is it?", "How to choose?"], 
        schema: ["FAQPage"] 
      },
      where_to_publish: { path: `/blog/${slug}` },
      posting_instructions: "Add internal links to relevant product pages; include FAQ schema; cite 2-3 reputable sources; add comparison table.",
      citations_used: [],
      success_metrics: ["Presence on this prompt +20% in 14 days", "Time-on-page > 2m"]
    }],
    social: [{
      subtype: "linkedin_post",
      title: `Most teams miss this about ${promptText}`,
      body_bullets: [
        "1 hard fact (with source)",
        "1 counter-intuitive insight",
        "1 practical step to try today"
      ],
      cta: "Read the full guide",
      where_to_publish: { platform: "LinkedIn", profile: "company" },
      must_include: { entities: [brand], keywords: ["guide", "checklist"] },
      posting_instructions: "Post Tue/Wed morning; 2 niche hashtags; reply to first 3 comments.",
      success_metrics: ["Impressions > 2k", "Clicks > 100"]
    }],
    projected_impact: "Increases brand citation likelihood for this exact prompt intent."
  };
}

async function cryptoDigest(s: string) {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest(FINGERPRINT_ALGO, buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export type EngineInput = { 
  jwt: string; 
  orgId: string; 
  promptIds: string[]; 
  brand: string; 
  mode: "direct" | "queue" 
};

export async function runOptimizationEngine(input: EngineInput) {
  console.log(`[Engine] Starting optimization generation for org ${input.orgId}, mode: ${input.mode}, prompts: ${input.promptIds.length}`);
  
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: { promptId: string; inserted: number }[] = [];

  for (const pid of input.promptIds) {
    console.log(`[Engine] Processing prompt ${pid}`);
    
    // Get prompt data
    const { data: prompt } = await service
      .from("prompts")
      .select("id,text,org_id")
      .eq("id", pid)
      .eq("org_id", input.orgId)
      .single();
      
    if (!prompt) {
      console.warn(`[Engine] Prompt ${pid} not found or access denied`);
      continue;
    }

    // Get visibility data
    const { data: vis } = await service
      .from("prompt_visibility_14d")
      .select("presence_rate")
      .eq("org_id", input.orgId)
      .eq("prompt_id", pid)
      .maybeSingle();
    const presence = vis?.presence_rate ?? 0;
    console.log(`[Engine] Prompt presence: ${presence.toFixed(1)}%`);

    // Get citations (defensive parsing)
    const { data: citesData } = await service
      .from("prompt_provider_responses")
      .select("citations_json")
      .eq("org_id", input.orgId)
      .eq("prompt_id", pid)
      .not("citations_json", "is", null)
      .order("run_at", { ascending: false })
      .limit(12);
      
    const citations: any[] = [];
    (citesData ?? []).forEach((r: any) => {
      if (Array.isArray(r.citations_json)) {
        r.citations_json.forEach((c: any) => {
          if (c.value || c.link) {
            const url = c.value || c.link;
            let domain = c.hostname || c.domain || '';
            if (!domain && url) {
              try {
                domain = new URL(url).hostname.replace(/^www\./, '');
              } catch {
                domain = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
              }
            }
            citations.push({
              domain,
              link: url,
              title: c.title || null
            });
          }
        });
      }
    });
    console.log(`[Engine] Found ${citations.length} citations`);

    // Get existing optimizations (for deduplication)
    const { data: existing } = await service
      .from("optimizations")
      .select("id,content_type,title,body")
      .eq("org_id", input.orgId)
      .eq("prompt_id", pid)
      .order("created_at", { ascending: false })
      .limit(30);
    const avoid = (existing ?? []).map((r: any) => ({ 
      subtype: r.content_type, 
      title: r.title 
    }));

    // Construct LLM prompts
    const SYSTEM = `You are an AI Search Visibility strategist for B2B SaaS. Return STRICT JSON only.`;
    const citesList = citations.slice(0, 8)
      .map(c => `- ${c.domain}${c.title ? ` — ${c.title}` : ''} (${c.link})`)
      .join("\n");
    const avoidList = avoid.slice(0, 8)
      .map(a => `${a.subtype}: ${a.title}`)
      .join("\n");
    const USER = `BRAND: ${input.brand}
TRACKED PROMPT: "${prompt.text}"
WINDOW: last ${WINDOW_DAYS} days
CURRENT PRESENCE: ${presence.toFixed(1)}%
TOP CITATIONS:\n${citesList || "(none)"}
AVOID DUPLICATES:\n${avoidList || "(none)"}

Create content + social recommendations with JSON keys:
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
JSON ONLY.`;

    // Call LLM with fallback
    const { json, source } = await callLLM([
      { role: "system", content: SYSTEM },
      { role: "user", content: USER }
    ]);

    const ai = json || deterministicFallback(input.brand || "Your Brand", prompt.text);

    // Build rows for insertion
    const rows: any[] = [];
    (Array.isArray(ai.content) ? ai.content : []).forEach((c: any) => rows.push({
      org_id: input.orgId,
      prompt_id: pid,
      content_type: c.subtype || "blog_outline",
      title: c.title || "Untitled",
      body: JSON.stringify({
        outline: c.outline || [],
        must_include: c.must_include || {},
        where_to_publish: c.where_to_publish || {},
        posting_instructions: c.posting_instructions || "",
        success_metrics: c.success_metrics || []
      }),
      sources: citations.slice(0, 8),
      score_before: presence,
      projected_impact: ai.projected_impact || null
    }));
    
    (Array.isArray(ai.social) ? ai.social : []).forEach((s: any) => rows.push({
      org_id: input.orgId,
      prompt_id: pid,
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
      sources: citations.slice(0, 8),
      score_before: presence,
      projected_impact: ai.projected_impact || null
    }));

    // Compute fingerprints and upsert
    for (const r of rows) {
      const norm = `${r.content_type}|${(r.title || "").toLowerCase()}|${r.body}`;
      r.fingerprint = await cryptoDigest(`${input.orgId}|${pid}|${norm}`);
    }
    
    let inserted = 0;
    for (const r of rows) {
      const { error } = await service.from("optimizations").insert(r);
      if (!error) {
        inserted++;
      }
      // If unique violation on fingerprint, silently skip (idempotent)
    }
    
    console.log(`[Engine] Prompt ${pid}: inserted ${inserted}/${rows.length} optimizations`);
    results.push({ promptId: pid, inserted });
  }

  console.log(`[Engine] Completed: ${results.reduce((a, b) => a + b.inserted, 0)} total insertions`);
  return results;
}
