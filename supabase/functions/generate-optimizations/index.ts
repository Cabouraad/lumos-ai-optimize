// deno-lint-ignore-file no-explicit-any
/**
 * Direct optimization generation endpoint
 * Delegates to shared engine for consistent behavior
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runOptimizationEngine } from "../_shared/optimizations/engine.ts";
import { WINDOW_DAYS } from "../_shared/optimizations/constants.ts";

const ORIGIN = Deno.env.get("APP_ORIGIN") || "*";

function cors() {
  return {
    "access-control-allow-origin": ORIGIN,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

function jres(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...cors() }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }

  console.log("[generate-optimizations] Request received");
  
  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      console.warn("[generate-optimizations] Missing or invalid authorization header");
      return jres({ code: "unauthorized", detail: "Missing Bearer token" }, 200);
    }
    const jwt = auth.slice("Bearer ".length);

    const body = await req.json().catch(() => ({}));
    const promptId: string | undefined = body?.promptId;
    const batch: boolean = !!body?.batch;

    console.log("[generate-optimizations] Params:", { promptId, batch });

    // Service client for system writes
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    });

    const { data: me } = await userClient.auth.getUser();
    if (!me?.user) {
      console.warn("[generate-optimizations] Invalid user token");
      return jres({ code: "unauthorized", detail: "Invalid token" }, 200);
    }

    const { data: user } = await service
      .from("users")
      .select("id,org_id")
      .eq("id", me.user.id)
      .single();
      
    if (!user?.org_id) {
      console.warn("[generate-optimizations] User has no org");
      return jres({ code: "forbidden", detail: "No organization found" }, 200);
    }

    // Get org details
    const { data: org } = await service
      .from("organizations")
      .select("id,name")
      .eq("id", user.org_id)
      .single();

    let promptIds: string[] = [];
    if (promptId) {
      promptIds = [promptId];
    } else if (batch) {
      // Get low visibility prompts
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
      console.log("[generate-optimizations] No prompts to process");
      return jres({ code: "nothing_to_do", detail: "No prompts to process", inserted: 0, items: [], windowDays: WINDOW_DAYS }, 200);
    }

    console.log(`[generate-optimizations] Processing ${promptIds.length} prompts`);

    // Run engine
    const results = await runOptimizationEngine({
      jwt,
      orgId: user.org_id,
      promptIds,
      brand: org?.name || "Your Brand",
      mode: "direct"
    });

    const inserted = results.reduce((a, b) => a + b.inserted, 0);
    console.log(`[generate-optimizations] Complete: ${inserted} insertions`);
    
    return jres({ code: "success", inserted, results, windowDays: WINDOW_DAYS }, 200);
  } catch (e) {
    console.error("[generate-optimizations] Error:", e);
    return jres({ code: "crash", detail: String(e) }, 200);
  }
});
