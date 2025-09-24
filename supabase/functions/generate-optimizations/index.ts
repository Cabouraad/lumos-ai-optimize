import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  return `You are an AI Search Optimization strategist. Produce structured, publish-ready content
targeted to a tracked prompt where the brand currently has low visibility in LLM answers.
Return STRICT JSON only (no backticks). Keys:
{
  "social_posts": [{"platform":"LinkedIn|X","headline": "...","bullets":["..."],"cta":"..."}],
  "blog_outline": {"title":"...","sections":[{"h2":"...","h3":["..."], "notes":["..."]}], "internal_links":["..."], "outreach_domains":["example.com","..."]},
  "talking_points": ["..."],
  "cta_snippets": ["..."],
  "projected_impact": "1-2 sentences on why this lifts visibility"
}`;
}

function optimizerUserPrompt(args: {
  brand: string; promptText: string; presenceRate: number;
  competitors: string[]; citations: { domain: string; title?: string; link: string }[];
}) {
  const cites = args.citations.slice(0,8).map(c => `- ${c.domain}${c.title?` — ${c.title}`:''} (${c.link})`).join("\n");
  const comp  = args.competitors.slice(0,8).join(", ") || "None observed";
  return `BRAND: ${args.brand}
TRACKED PROMPT: "${args.promptText}"
CURRENT PRESENCE: ${args.presenceRate.toFixed(1)}% (last 14 days)
COMPETITORS IN RESPONSES: ${comp}
TOP CITATION DOMAINS:
${cites}

TASKS:
1) 2 SOCIAL POSTS (LinkedIn + X): hook + 2-3 bullets + CTA.
2) 1 BLOG OUTLINE: H2/H3 + bullets + 3 internal link ideas + 3 outreach domains from the citations list.
3) 5 TALKING POINTS for winning mentions in LLM answers.
4) 3 CTA SNIPPETS (<=120 chars).
Rules: B2B SaaS tone, non-spammy brand mention, JSON ONLY.`;
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
      return new Response("Auth failed", { status: 401, headers: corsHeaders });
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const promptId: string | undefined = body?.promptId;
    const doBatch: boolean = !!body?.batch;

    console.log('[generate-optimizations] Request body parsed', { promptId, doBatch });

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

    // Single prompt (sync) or batch (fall back to job enqueue if >1)
    let promptIds: string[] = [];
    if (promptId) {
      promptIds = [promptId];
    } else if (doBatch) {
      // select low-visibility prompts for org
      const { data: lows } = await supabase
        .from("low_visibility_prompts")
        .select("prompt_id")
        .eq("org_id", orgId)
        .limit(20);
      promptIds = (lows ?? []).map((r: any) => r.prompt_id);
    }

    if (promptIds.length === 0) {
      console.log('[generate-optimizations] No prompts to process');
      return new Response(JSON.stringify({ inserted: 0, optimizations: [] }), { 
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    console.log('[generate-optimizations] Processing prompts', { count: promptIds.length, promptIds });

    // Generate for single prompt synchronously
    const pid = promptIds[0];

    // Get prompt details
    const { data: prompt } = await supabase
      .from("prompts")
      .select("id, text")
      .eq("id", pid)
      .eq("org_id", orgId)
      .single();

    if (!prompt) {
      return new Response("Prompt not found", { status: 404, headers: corsHeaders });
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

    // Call OpenAI
    const promptInput = optimizerUserPrompt({
      brand: org?.name || "Your brand",
      promptText: prompt.text,
      presenceRate: presence,
      competitors,
      citations
    });

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
      console.error('OpenAI error:', errorText);
      return new Response(`OpenAI error: ${errorText}`, { 
        status: 502, 
        headers: corsHeaders 
      });
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
      console.error('Failed to parse optimizer JSON:', raw);
      return new Response("Failed to parse optimizer JSON", { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Normalize & insert optimization rows
    const toInsert: any[] = [];
    
    (parsed.social_posts ?? []).forEach((sp: any, index: number) => {
      toInsert.push({ 
        org_id: orgId, 
        prompt_id: pid, 
        content_type: "social_post",
        title: sp.headline ?? `Social Post ${index + 1}`, 
        body: JSON.stringify(sp), 
        sources: citations, 
        score_before: presence,
        projected_impact: parsed.projected_impact ?? null,
        provider: 'optimizer'
      });
    });
    
    if (parsed.blog_outline) {
      toInsert.push({ 
        org_id: orgId, 
        prompt_id: pid, 
        content_type: "blog_outline",
        title: parsed.blog_outline.title ?? "Blog Outline", 
        body: JSON.stringify(parsed.blog_outline),
        sources: citations, 
        score_before: presence, 
        projected_impact: parsed.projected_impact ?? null,
        provider: 'optimizer'
      });
    }
    
    (parsed.talking_points ?? []).forEach((tp: string, index: number) => {
      toInsert.push({ 
        org_id: orgId, 
        prompt_id: pid, 
        content_type: "talking_points",
        title: `Talking Point ${index + 1}`, 
        body: tp, 
        sources: citations, 
        score_before: presence, 
        projected_impact: parsed.projected_impact ?? null,
        provider: 'optimizer'
      });
    });
    
    (parsed.cta_snippets ?? []).forEach((cta: string, index: number) => {
      toInsert.push({ 
        org_id: orgId, 
        prompt_id: pid, 
        content_type: "cta_snippets",
        title: `CTA ${index + 1}`, 
        body: cta, 
        sources: citations, 
        score_before: presence, 
        projected_impact: parsed.projected_impact ?? null,
        provider: 'optimizer'
      });
    });

    console.log('[generate-optimizations] Ready to insert', { count: toInsert.length });
    
    if (toInsert.length) {
      const { error: insErr } = await supabase
        .from("optimizations")
        .insert(toInsert);
        
      if (insErr) {
        console.error('[generate-optimizations] Insert error:', insErr);
        return new Response(`Insert error: ${insErr.message}`, { 
          status: 500, 
          headers: corsHeaders 
        });
      }
      
      console.log('[generate-optimizations] Successfully inserted optimizations');
    }

    // Refresh visibility data
    await supabase.rpc('refresh_prompt_visibility_14d');

    return new Response(JSON.stringify({ 
      inserted: toInsert.length, 
      optimizations: toInsert 
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });

  } catch (e) {
    console.error('Server error:', e);
    return new Response(`Server error: ${e}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});