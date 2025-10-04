// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ENABLE_GOOGLE_AIO = (Deno.env.get("ENABLE_GOOGLE_AIO") || "").toLowerCase() === "true";
const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY") || "";
const DEBUG = (Deno.env.get("DEBUG_AIO") || "").toLowerCase() === "true";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function normDomain(link: string): string {
  try {
    const u = new URL(link);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return link.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

async function callSerp(query: string, gl = "us", hl = "en") {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_ai_mode");
  url.searchParams.set("q", query);
  url.searchParams.set("gl", gl);
  url.searchParams.set("hl", hl);
  url.searchParams.set("api_key", SERPAPI_KEY);

  const r = await fetch(url.toString(), { method: "GET" });
  const text = await r.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* non-json error from SerpApi */ }

  if (!r.ok) {
    return { ok: false, status: r.status, body: data || text };
  }
  return { ok: true, status: r.status, body: data };
}

serve(async (req) => {
  try {
    const auth = req.headers.get("authorization") || "";
    // Allow: service role (internal), cron, or user JWT (bearer anything)
    if (!auth.startsWith("Bearer ")) {
      return json({ enabled: ENABLE_GOOGLE_AIO, error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const query: string = body?.query || "";
    const gl: string = body?.gl || "us";
    const hl: string = body?.hl || "en";
    const dryRun: boolean = !!body?.dry_run;

    // Feature gate: never return 204; always JSON so callers can .json()
    if (!ENABLE_GOOGLE_AIO || !SERPAPI_KEY) {
      return json({ enabled: false, summary: "", text: "", citations: [], reason: "disabled" }, 200);
    }

    if (dryRun) {
      // Used by availability check; never calls SerpApi
      return json({ enabled: true, summary: "", text: "", citations: [], reason: "dry_run" }, 200);
    }

    if (!query?.trim()) {
      return json({ enabled: true, summary: "", text: "", citations: [], reason: "empty_query" }, 200);
    }

    const resp = await callSerp(query, gl, hl);
    if (!resp.ok) {
      // Respect rate limits but still return JSON
      if (resp.status === 429) {
        return json({ enabled: true, summary: "", text: "", citations: [], error: "rate_limited", retry_after: 3600 }, 429);
      }
      return json({ enabled: true, summary: "", text: "", citations: [], error: "serp_error", detail: resp.body }, 502);
    }

    const raw = resp.body;
    const ai = raw?.ai_overview || raw?.answer_box || null;
    const summary =
      ai?.text?.trim?.() ||
      ai?.answer?.trim?.() ||
      ai?.snippet?.trim?.() ||
      "";

    const citations = ((ai?.citations ?? []) as any[])
      .map((c) => {
        const link = c?.link || c?.url || "";
        if (!link) return null;
        return {
          title: c?.title || c?.snippet || "",
          link,
          domain: normDomain(link),
          source_provider: "google_ai_overview",
        };
      })
      .filter(Boolean)
      .slice(0, 10);

    // Always JSON, always include both fields for downstream compatibility
    return json({
      enabled: true,
      summary,
      text: summary, // alias for existing downstream code
      citations,
      follow_up_questions: ai?.follow_up_questions ?? ai?.related_questions ?? [],
      reason: summary ? "ok" : "no_ai_overview",
      raw: DEBUG ? raw : undefined,
    }, 200);
  } catch (e) {
    return json({ enabled: ENABLE_GOOGLE_AIO, summary: "", text: "", citations: [], error: "crash", detail: String(e) }, 500);
  }
});
